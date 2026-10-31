/**
 * seed_development_data.js
 * 
 * ClassPulse Development Dataset Seeder
 * Creates a realistic, fully connected, idempotent administrative dataset:
 * - Admin creates and validates Academic Placements (Classes/Sections, Departments, Subjects)
 * - Admin provisions 15 realistic Students across all 4 Academic Years (First, Second, Third, Fourth Year)
 * - Admin provisions Teachers (t001, t002, t003, t004) and assigns them to valid Subjects and Sections
 * - Establishes complete relationship chains:
 *   Admin -> Creates Students -> Academic Placement -> Assigns Teachers -> Teacher Views Authorized Students
 *
 * Usage:
 *   node backend/scripts/seed_development_data.js
 *   node backend/scripts/seed_development_data.js --cleanup (Optional rollback)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Models
const Institution = require('../models/Institution');
const Department = require('../models/Department');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const StudentProfile = require('../models/StudentProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const AuditLog = require('../models/AuditLog');

const ACADEMIC_YEAR = '2026-2027';
const COURSE = 'B.Tech';
const TEACHER_PASSWORD = 'StudyPoint@Teacher2026';
const STUDENT_PASSWORD = 'StudyPoint@Student2026';

// 15 Realistic Students definition
const SEED_STUDENTS = [
  // Second Year (CSE - Sec B) - Existing baseline
  { studentId: 'STU2026001', name: 'Alice Sharma', email: 'alice.sharma@studypoint.edu', department: 'Computer Science and Engineering', semester: '3rd', section: 'B', yearOfStudy: 'Second Year' },
  { studentId: 'STU2026002', name: 'Aarav Patel', email: 'aarav.patel@studypoint.edu', department: 'Computer Science and Engineering', semester: '3rd', section: 'B', yearOfStudy: 'Second Year' },

  // First Year (CSE - Sec A & Sec B)
  { studentId: 'STU2026003', name: 'Rohan Verma', email: 'rohan.verma@studypoint.edu', department: 'Computer Science and Engineering', semester: '1st', section: 'A', yearOfStudy: 'First Year' },
  { studentId: 'STU2026004', name: 'Ananya Iyer', email: 'ananya.iyer@studypoint.edu', department: 'Computer Science and Engineering', semester: '1st', section: 'A', yearOfStudy: 'First Year' },
  { studentId: 'STU2026005', name: 'Kabir Mehta', email: 'kabir.mehta@studypoint.edu', department: 'Computer Science and Engineering', semester: '1st', section: 'B', yearOfStudy: 'First Year' },
  { studentId: 'STU2026006', name: 'Diya Sen', email: 'diya.sen@studypoint.edu', department: 'Computer Science and Engineering', semester: '1st', section: 'B', yearOfStudy: 'First Year' },

  // First Year (ECE - Sec A)
  { studentId: 'STU2026007', name: 'Siddharth Reddy', email: 'siddharth.reddy@studypoint.edu', department: 'Electronics and Communication Engineering', semester: '1st', section: 'A', yearOfStudy: 'First Year' },
  { studentId: 'STU2026008', name: 'Meera Joshi', email: 'meera.joshi@studypoint.edu', department: 'Electronics and Communication Engineering', semester: '1st', section: 'A', yearOfStudy: 'First Year' },

  // Second Year (CSE - Sec A)
  { studentId: 'STU2026009', name: 'Ishaan Gupta', email: 'ishaan.gupta@studypoint.edu', department: 'Computer Science and Engineering', semester: '3rd', section: 'A', yearOfStudy: 'Second Year' },
  { studentId: 'STU2026010', name: 'Riya Deshmukh', email: 'riya.deshmukh@studypoint.edu', department: 'Computer Science and Engineering', semester: '3rd', section: 'A', yearOfStudy: 'Second Year' },

  // Third Year (CSE - Sec A)
  { studentId: 'STU2026011', name: 'Aditya Kulkarni', email: 'aditya.kulkarni@studypoint.edu', department: 'Computer Science and Engineering', semester: '5th', section: 'A', yearOfStudy: 'Third Year' },
  { studentId: 'STU2026012', name: 'Pooja Nair', email: 'pooja.nair@studypoint.edu', department: 'Computer Science and Engineering', semester: '5th', section: 'A', yearOfStudy: 'Third Year' },

  // Third Year (EEE - Sec A)
  { studentId: 'STU2026013', name: 'Vikram Malhotra', email: 'vikram.malhotra@studypoint.edu', department: 'Electrical and Electronics Engineering', semester: '5th', section: 'A', yearOfStudy: 'Third Year' },
  { studentId: 'STU2026014', name: 'Sneha Pillai', email: 'sneha.pillai@studypoint.edu', department: 'Electrical and Electronics Engineering', semester: '5th', section: 'A', yearOfStudy: 'Third Year' },

  // Fourth Year (CSE - Sec A)
  { studentId: 'STU2026015', name: 'Nikhil Chawla', email: 'nikhil.chawla@studypoint.edu', department: 'Computer Science and Engineering', semester: '7th', section: 'A', yearOfStudy: 'Fourth Year' }
];

// Classes definition
const REQUIRED_CLASSES = [
  { course: COURSE, department: 'Computer Science and Engineering', semester: '1st', section: 'A', yearOfStudy: 'First Year' },
  { course: COURSE, department: 'Computer Science and Engineering', semester: '1st', section: 'B', yearOfStudy: 'First Year' },
  { course: COURSE, department: 'Electronics and Communication Engineering', semester: '1st', section: 'A', yearOfStudy: 'First Year' },
  { course: COURSE, department: 'Computer Science and Engineering', semester: '3rd', section: 'A', yearOfStudy: 'Second Year' },
  { course: COURSE, department: 'Computer Science and Engineering', semester: '3rd', section: 'B', yearOfStudy: 'Second Year' },
  { course: COURSE, department: 'Computer Science and Engineering', semester: '5th', section: 'A', yearOfStudy: 'Third Year' },
  { course: COURSE, department: 'Electrical and Electronics Engineering', semester: '5th', section: 'A', yearOfStudy: 'Third Year' },
  { course: COURSE, department: 'Computer Science and Engineering', semester: '7th', section: 'A', yearOfStudy: 'Fourth Year' }
];

// Subjects definition
const REQUIRED_SUBJECTS = [
  { name: 'Programming in C', code: 'CS101', department: 'Computer Science and Engineering', semester: '1st', credits: 4 },
  { name: 'Digital Electronics', code: 'EC101', department: 'Electronics and Communication Engineering', semester: '1st', credits: 4 },
  { name: 'Distributed Systems', code: 'TEST_SUB_1', department: 'Computer Science and Engineering', semester: '3rd', credits: 4 },
  { name: 'Database Management Systems', code: 'CS201', department: 'Computer Science and Engineering', semester: '3rd', credits: 4 },
  { name: 'Power Systems', code: 'EE301', department: 'Electrical and Electronics Engineering', semester: '5th', credits: 4 },
  { name: 'Software Engineering', code: 'CS302', department: 'Computer Science and Engineering', semester: '5th', credits: 3 },
  { name: 'DSA', code: 'CSE101', department: 'Computer Science and Engineering', semester: '7th', credits: 4 }
];

// Teachers definition
const REQUIRED_TEACHERS = [
  {
    teacherId: 't001',
    name: 'Jogi Umadevi',
    email: 'jogi.umadevi@studypoint.edu',
    phone: '9876543201',
    address: 'Block A, Faculty Housing',
    department: 'Computer Science and Engineering',
    designation: 'Assistant Professor',
    qualifications: ['M.Tech', 'B.Tech'],
    highestQualification: 'M.Tech',
    specialization: 'Distributed Computing',
    yearsOfExperience: 8
  },
  {
    teacherId: 't002',
    name: 'Dr. Rajesh Sharma',
    email: 'rajesh.sharma@studypoint.edu',
    phone: '9876543202',
    address: 'Block B, Faculty Housing',
    department: 'Electronics and Communication Engineering',
    designation: 'Associate Professor',
    qualifications: ['Ph.D.', 'M.Tech'],
    highestQualification: 'Ph.D.',
    specialization: 'VLSI & Embedded Systems',
    yearsOfExperience: 12
  },
  {
    teacherId: 't003',
    name: 'Dr. Priya Nair',
    email: 'priya.nair@studypoint.edu',
    phone: '9876543203',
    address: 'Block C, Faculty Housing',
    department: 'Electrical and Electronics Engineering',
    designation: 'Assistant Professor',
    qualifications: ['Ph.D.', 'M.Tech'],
    highestQualification: 'Ph.D.',
    specialization: 'Power Systems Engineering',
    yearsOfExperience: 7
  },
  {
    teacherId: 't004',
    name: 'Prof. Anand Verma',
    email: 'anand.verma@studypoint.edu',
    phone: '9876543204',
    address: 'Block D, Faculty Housing',
    department: 'Computer Science and Engineering',
    designation: 'Professor',
    qualifications: ['Ph.D.', 'M.Tech'],
    highestQualification: 'Ph.D.',
    specialization: 'Software Architecture & Databases',
    yearsOfExperience: 18
  }
];

async function seed() {
  const isCleanup = process.argv.includes('--cleanup');
  console.log(`\n======================================================`);
  console.log(` ClassPulse Development Data Seeder: ${isCleanup ? 'CLEANUP MODE' : 'SEED MODE'}`);
  console.log(`======================================================\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB database.');

  // Find Primary Institution (ClassPulse Institute of Technology)
  let institution = await Institution.findOne({ code: 'CPIT' });
  if (!institution) {
    institution = await Institution.findOne();
  }
  if (!institution) {
    throw new Error('No Institution found. Please run baseline institution provisioning first.');
  }
  const institutionId = institution._id;
  console.log(`[INSTITUTION] Target: "${institution.name}" (${institution._id})`);

  // Find Admin for Audit Logs
  const adminUser = await User.findOne({ institution: institutionId, role: 'admin' });
  const adminId = adminUser ? adminUser._id : null;

  // ------------------------------------------------------------------
  // OPTIONAL CLEANUP PROCESS (Rollback only records created by this seeder)
  // ------------------------------------------------------------------
  if (isCleanup) {
    console.log('\n--- Running Idempotent Cleanup of Seeded Test Records ---');
    const studentIdsToDelete = SEED_STUDENTS.filter(s => s.studentId !== 'STU2026001' && s.studentId !== 'STU2026002').map(s => s.studentId.toLowerCase());
    const teacherIdsToDelete = ['t002', 't003', 't004'];

    const delStudents = await StudentProfile.deleteMany({ institution: institutionId, studentId: { $in: studentIdsToDelete } });
    const delStudentUsers = await User.deleteMany({ institution: institutionId, userId: { $in: studentIdsToDelete } });
    console.log(`[CLEANUP] Removed ${delStudents.deletedCount} seed StudentProfiles and ${delStudentUsers.deletedCount} Users.`);

    const seedTeachers = await TeacherProfile.find({ institution: institutionId, teacherId: { $in: teacherIdsToDelete } });
    const seedTeacherIds = seedTeachers.map(t => t._id);
    const delAssignments = await TeachingAssignment.deleteMany({ institution: institutionId, teacher: { $in: seedTeacherIds } });
    const delTeachers = await TeacherProfile.deleteMany({ institution: institutionId, teacherId: { $in: teacherIdsToDelete } });
    const delTeacherUsers = await User.deleteMany({ institution: institutionId, userId: { $in: teacherIdsToDelete } });
    console.log(`[CLEANUP] Removed ${delTeachers.deletedCount} seed Teachers, ${delAssignments.deletedCount} Assignments, and ${delTeacherUsers.deletedCount} Users.`);

    console.log('\n[CLEANUP COMPLETE] Baseline records preserved.\n');
    await mongoose.disconnect();
    return;
  }

  // ------------------------------------------------------------------
  // STEP 1: Ensure Departments exist & build map
  // ------------------------------------------------------------------
  console.log('\n--- Step 1: Validating Departments ---');
  const departmentsMap = new Map();
  const allDepts = await Department.find({ institution: institutionId, isActive: true });
  allDepts.forEach(d => {
    departmentsMap.set(d.name.toLowerCase(), d);
    if (d.code) departmentsMap.set(d.code.toLowerCase(), d);
  });

  const ensureDept = async (name, code) => {
    let dept = departmentsMap.get(name.toLowerCase());
    if (!dept) {
      dept = await Department.create({ institution: institutionId, name, code, isActive: true });
      departmentsMap.set(name.toLowerCase(), dept);
      departmentsMap.set(code.toLowerCase(), dept);
      console.log(`  [+] Created Department: ${name} (${code})`);
    } else {
      console.log(`  [OK] Department exists: ${dept.name} (${dept.code})`);
    }
    return dept;
  };

  const cseDept = await ensureDept('Computer Science and Engineering', 'CSE');
  const eceDept = await ensureDept('Electronics and Communication Engineering', 'ECE');
  const eeeDept = await ensureDept('Electrical and Electronics Engineering', 'EEE');

  // ------------------------------------------------------------------
  // STEP 2: Configure Academic Placement (Classes / Sections)
  // ------------------------------------------------------------------
  console.log('\n--- Step 2: Configuring Academic Classes & Sections ---');
  const classMap = new Map();

  for (const rc of REQUIRED_CLASSES) {
    const deptDoc = departmentsMap.get(rc.department.toLowerCase());
    const deptName = deptDoc ? deptDoc.name : rc.department;
    const cleanSection = rc.section.replace(/^section\s+/i, '').trim();

    let classDoc = await Class.findOne({
      institution: institutionId,
      course: rc.course,
      department: deptName,
      academicYear: ACADEMIC_YEAR,
      semester: rc.semester,
      section: { $regex: new RegExp(`^(Section\\s*)?${cleanSection}$`, 'i') }
    });

    if (!classDoc) {
      const groupName = `${rc.course} - ${deptName} (Sem ${rc.semester}, Sec ${cleanSection})`;
      classDoc = await Class.create({
        institution: institutionId,
        name: groupName,
        course: rc.course,
        department: deptName,
        departmentRef: deptDoc ? deptDoc._id : undefined,
        academicYear: ACADEMIC_YEAR,
        semester: rc.semester,
        section: cleanSection,
        yearOfStudy: rc.yearOfStudy,
        isActive: true
      });
      console.log(`  [+] Created Class: ${groupName} [${rc.yearOfStudy}]`);
    } else {
      // Ensure yearOfStudy is updated if previously unset
      if (!classDoc.yearOfStudy) {
        classDoc.yearOfStudy = rc.yearOfStudy;
        await classDoc.save();
      }
      console.log(`  [OK] Class exists: ${classDoc.name} [${classDoc.yearOfStudy || rc.yearOfStudy}]`);
    }

    const key = `${deptName}__${rc.semester}__${cleanSection}`;
    classMap.set(key, classDoc);
  }

  // ------------------------------------------------------------------
  // STEP 3: Configure Subjects
  // ------------------------------------------------------------------
  console.log('\n--- Step 3: Configuring Academic Subjects ---');
  const subjectMap = new Map();

  for (const rs of REQUIRED_SUBJECTS) {
    const deptDoc = departmentsMap.get(rs.department.toLowerCase());
    const deptName = deptDoc ? deptDoc.name : rs.department;

    let subDoc = await Subject.findOne({
      institution: institutionId,
      code: rs.code
    });

    if (!subDoc) {
      subDoc = await Subject.create({
        institution: institutionId,
        name: rs.name,
        code: rs.code,
        department: deptName,
        departmentRef: deptDoc ? deptDoc._id : undefined,
        semester: rs.semester,
        academicYear: ACADEMIC_YEAR,
        credits: rs.credits,
        subjectType: 'Theory',
        isActive: true
      });
      console.log(`  [+] Created Subject: ${rs.name} (${rs.code})`);
    } else {
      console.log(`  [OK] Subject exists: ${subDoc.name} (${subDoc.code})`);
    }

    subjectMap.set(rs.code, subDoc);
  }

  // ------------------------------------------------------------------
  // STEP 4: Configure Teacher Accounts
  // ------------------------------------------------------------------
  console.log('\n--- Step 4: Configuring Teachers (Admin Teacher Workflow) ---');
  const teacherProfileMap = new Map();
  const hashedTeacherPassword = await bcrypt.hash(TEACHER_PASSWORD, 10);

  for (const rt of REQUIRED_TEACHERS) {
    const cleanId = rt.teacherId.toLowerCase();
    const deptDoc = departmentsMap.get(rt.department.toLowerCase());
    const deptName = deptDoc ? deptDoc.name : rt.department;

    let user = await User.findOne({ userId: cleanId });
    if (!user) {
      user = await User.create({
        institution: institutionId,
        userId: cleanId,
        password: hashedTeacherPassword,
        role: 'teacher',
        name: rt.name,
        mustChangePassword: false,
        isActive: true,
        qualifications: rt.qualifications,
        highestQualification: rt.highestQualification
      });
      console.log(`  [+] Created Teacher User: ${rt.name} (${cleanId})`);
    }

    let profile = await TeacherProfile.findOne({ teacherId: cleanId });
    if (!profile) {
      profile = await TeacherProfile.create({
        institution: institutionId,
        user: user._id,
        teacherId: cleanId,
        department: deptName,
        departmentRef: deptDoc ? deptDoc._id : undefined,
        designation: rt.designation,
        personalInfo: {
          name: rt.name,
          email: rt.email,
          phone: rt.phone,
          address: rt.address
        },
        professionalInfo: {
          qualifications: rt.qualifications,
          highestQualification: rt.highestQualification,
          specialization: rt.specialization,
          yearsOfExperience: rt.yearsOfExperience
        }
      });
      console.log(`  [+] Created TeacherProfile: ${rt.name} (${cleanId})`);
    } else {
      // Ensure name and active status are set
      if (!profile.personalInfo?.name) {
        profile.personalInfo = { ...(profile.personalInfo || {}), name: rt.name, email: rt.email, phone: rt.phone, address: rt.address };
        await profile.save();
      }
      console.log(`  [OK] TeacherProfile exists: ${rt.name} (${cleanId})`);
    }

    teacherProfileMap.set(cleanId, profile);
  }

  // ------------------------------------------------------------------
  // STEP 5: Assign Teachers to Subjects & Sections (TeachingAssignments)
  // ------------------------------------------------------------------
  console.log('\n--- Step 5: Assigning Teachers to Subjects and Sections ---');

  const ASSIGNMENT_MATRIX = [
    // t001: Assigned across multiple years and sections (1st Yr Sec A & B, 2nd Yr Sec B, 4th Yr Sec A)
    { teacherId: 't001', subjectCode: 'CS101', classKey: 'Computer Science and Engineering__1st__A' },
    { teacherId: 't001', subjectCode: 'CS101', classKey: 'Computer Science and Engineering__1st__B' },
    { teacherId: 't001', subjectCode: 'TEST_SUB_1', classKey: 'Computer Science and Engineering__3rd__B' },
    { teacherId: 't001', subjectCode: 'CSE101', classKey: 'Computer Science and Engineering__7th__A' },

    // t002: Assigned to exactly ONE section (ECE First Year Sec A)
    { teacherId: 't002', subjectCode: 'EC101', classKey: 'Electronics and Communication Engineering__1st__A' },

    // t003: Assigned to exactly ONE section (EEE Third Year Sec A)
    { teacherId: 't003', subjectCode: 'EE301', classKey: 'Electrical and Electronics Engineering__5th__A' },

    // t004: Assigned to CSE Second Year Sec A and CSE Third Year Sec A
    { teacherId: 't004', subjectCode: 'CS201', classKey: 'Computer Science and Engineering__3rd__A' },
    { teacherId: 't004', subjectCode: 'CS302', classKey: 'Computer Science and Engineering__5th__A' }
  ];

  for (const asgn of ASSIGNMENT_MATRIX) {
    const teacherProfile = teacherProfileMap.get(asgn.teacherId.toLowerCase());
    const subjectDoc = subjectMap.get(asgn.subjectCode);
    const classDoc = classMap.get(asgn.classKey);

    if (!teacherProfile || !subjectDoc || !classDoc) {
      console.warn(`  [!] Skipping assignment: missing entity for ${JSON.stringify(asgn)}`);
      continue;
    }

    const existingAsgn = await TeachingAssignment.findOne({
      institution: institutionId,
      classRef: classDoc._id,
      subject: subjectDoc._id
    });

    if (!existingAsgn) {
      await TeachingAssignment.create({
        institution: institutionId,
        teacher: teacherProfile._id,
        subject: subjectDoc._id,
        classRef: classDoc._id,
        academicYear: ACADEMIC_YEAR,
        isActive: true
      });
      console.log(`  [+] Assigned ${teacherProfile.personalInfo?.name || asgn.teacherId} -> Subject: ${subjectDoc.name} -> ${classDoc.name}`);
    } else {
      if (String(existingAsgn.teacher) !== String(teacherProfile._id)) {
        existingAsgn.teacher = teacherProfile._id;
        existingAsgn.isActive = true;
        await existingAsgn.save();
        console.log(`  [UPDATED] Reassigned Subject: ${subjectDoc.name} in ${classDoc.name} -> ${teacherProfile.personalInfo?.name || asgn.teacherId}`);
      } else {
        console.log(`  [OK] Assignment exists: ${asgn.teacherId} -> ${subjectDoc.code} in ${classDoc.section}`);
      }
    }
  }

  // ------------------------------------------------------------------
  // STEP 6: Admin Creates 15 Student Accounts & Academic Placements
  // ------------------------------------------------------------------
  console.log('\n--- Step 6: Admin Creates Student Accounts & Academic Placement ---');
  const hashedStudentPassword = await bcrypt.hash(STUDENT_PASSWORD, 10);
  let createdCount = 0;
  let existingCount = 0;

  for (const st of SEED_STUDENTS) {
    const cleanId = st.studentId.trim();
    const deptDoc = departmentsMap.get(st.department.toLowerCase());
    const deptName = deptDoc ? deptDoc.name : st.department;
    const cleanSection = st.section.replace(/^section\s+/i, '').trim();
    const classKey = `${deptName}__${st.semester}__${cleanSection}`;
    const targetClass = classMap.get(classKey);

    if (!targetClass) {
      console.error(`  [!] Cannot place student ${st.studentId}: class not found for key ${classKey}`);
      continue;
    }

    let user = await User.findOne({
      institution: institutionId,
      userId: new RegExp(`^${cleanId}$`, 'i')
    });
    if (!user) {
      user = await User.create({
        institution: institutionId,
        userId: cleanId,
        password: hashedStudentPassword,
        role: 'student',
        name: st.name,
        mustChangePassword: false,
        isActive: true
      });
      console.log(`  [+] Created Student User: ${st.name} (${cleanId})`);
    }

    let profile = await StudentProfile.findOne({
      institution: institutionId,
      studentId: new RegExp(`^${cleanId}$`, 'i')
    });
    if (!profile) {
      profile = await StudentProfile.create({
        institution: institutionId,
        user: user._id,
        studentId: cleanId,
        course: COURSE,
        department: deptName,
        departmentRef: deptDoc ? deptDoc._id : undefined,
        academicYear: ACADEMIC_YEAR,
        semester: st.semester,
        yearOfStudy: st.yearOfStudy,
        classRef: targetClass._id,
        section: cleanSection,
        personalInfo: {
          name: st.name,
          email: st.email
        }
      });

      if (adminId) {
        await AuditLog.create({
          institution: institutionId,
          actor: adminId,
          action: 'CREATE_STUDENT',
          targetResource: user._id,
          resourceModel: 'User',
          metadata: { studentId: cleanId, groupId: targetClass._id, seeded: true }
        });
      }

      console.log(`  [+] Provisioned Student: ${st.name} (${st.studentId}) -> ${st.yearOfStudy} | ${deptName} | Sec ${cleanSection}`);
      createdCount++;
    } else {
      // Idempotency: verify placement and update if needed
      let updated = false;
      if (String(profile.classRef) !== String(targetClass._id)) {
        profile.classRef = targetClass._id;
        updated = true;
      }
      if (profile.personalInfo?.name !== st.name) {
        profile.personalInfo = { ...(profile.personalInfo || {}), name: st.name, email: st.email };
        updated = true;
      }
      if (profile.yearOfStudy !== st.yearOfStudy) {
        profile.yearOfStudy = st.yearOfStudy;
        updated = true;
      }
      if (updated) {
        await profile.save();
        console.log(`  [UPDATED] Aligned placement for ${st.studentId} -> ${st.yearOfStudy} Sec ${cleanSection}`);
      } else {
        console.log(`  [OK] Student profile exists & valid: ${st.name} (${st.studentId})`);
      }
      existingCount++;
    }
  }

  // ------------------------------------------------------------------
  // SUMMARY REPORT
  // ------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(' SEEDING COMPLETE — RELATIONSHIP MATRIX SUMMARY');
  console.log('======================================================');
  console.log(`Total Students in Scope:   ${SEED_STUDENTS.length} (New: ${createdCount}, Existing/Updated: ${existingCount})`);
  console.log(`Academic Distribution:`);
  console.log(`  - First Year:  6 students (4 CSE in Sec A & B, 2 ECE in Sec A)`);
  console.log(`  - Second Year: 4 students (2 CSE in Sec B, 2 CSE in Sec A)`);
  console.log(`  - Third Year:  4 students (2 CSE in Sec A, 2 EEE in Sec A)`);
  console.log(`  - Fourth Year: 1 student  (1 CSE in Sec A)`);
  console.log(`\nTeacher Authorization Scopes:`);
  console.log(`  - t001 (Prof. Jogi Umadevi):  7 Authorized Students (1st Yr CSE Sec A & B, 2nd Yr CSE Sec B, 4th Yr CSE Sec A)`);
  console.log(`  - t002 (Dr. Rajesh Sharma):   2 Authorized Students (1st Yr ECE Sec A ONLY)`);
  console.log(`  - t003 (Dr. Priya Nair):      2 Authorized Students (3rd Yr EEE Sec A ONLY)`);
  console.log(`  - t004 (Prof. Anand Verma):   4 Authorized Students (2nd Yr CSE Sec A, 3rd Yr CSE Sec A)`);
  console.log(`======================================================\n`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('\n[FATAL ERROR IN SEED PROCESS]:', err);
  process.exit(1);
});
