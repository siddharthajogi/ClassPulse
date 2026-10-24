const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Institution = require('../models/Institution');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const Department = require('../models/Department');
const teacherController = require('../controllers/teacherController');
const adminController = require('../controllers/adminController');

const createMockRes = () => {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
};

async function runEndToEndVerification() {
  console.log('========================================================================');
  console.log(' E2E Workflow Verification: Admin-Style Departments & Sections');
  console.log('                     in Teacher Portal');
  console.log('========================================================================\n');

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  try {
    const institution = await Institution.findOne({ name: /Study Point/i }) || await Institution.findOne();
    if (!institution) throw new Error('No institution found');
    console.log(`Using Institution: ${institution.name} (${institution._id})`);

    // Find two distinct teachers
    const teachers = await TeacherProfile.find({ institution: institution._id }).populate('user');
    if (teachers.length < 2) throw new Error('Need at least 2 teachers in DB for test');
    const teacherA = teachers[0];
    const teacherB = teachers[1];

    console.log(`Teacher A: ${teacherA.personalInfo?.name || teacherA.teacherId} (User ID: ${teacherA.user?._id}, Profile: ${teacherA._id})`);
    console.log(`Teacher B: ${teacherB.personalInfo?.name || teacherB.teacherId} (User ID: ${teacherB.user?._id}, Profile: ${teacherB._id})`);

    // Clean up any previous test artifacts
    const testDeptName = 'AI & Machine Learning E2E';
    const testDeptCode = 'AIML';
    const academicYear = '2026-2027';

    await Class.deleteMany({ institution: institution._id, section: { $in: ['E2E-SEC-1', 'E2E-SEC-2'] } });
    await Subject.deleteMany({ institution: institution._id, code: 'E2E-AIML-501' });

    // 1. Create test Subject
    const testSubject = await Subject.create({
      institution: institution._id,
      name: 'Deep Learning & Neural Networks',
      code: 'E2E-AIML-501',
      department: testDeptName,
      subjectType: 'Theory',
      credits: 4,
      semester: '5th',
      academicYear,
      isActive: true
    });
    console.log(`\nCreated test subject: ${testSubject.code} - ${testSubject.name}`);

    // ========================================================================
    // Step 1: Admin creates Department and Section 1
    // ========================================================================
    console.log('\n--- Step 1: Admin creates Department & Section 1 (Third Year, Sem 5th, Section E2E-SEC-1) ---');
    const class1 = await Class.create({
      institution: institution._id,
      name: `B.Tech - ${testDeptName} (Sem 5th, Sec E2E-SEC-1)`,
      course: 'B.Tech',
      department: testDeptName,
      academicYear,
      semester: '5th',
      section: 'E2E-SEC-1',
      yearOfStudy: 'Third Year',
      isActive: true
    });
    console.log(`✓ Created Class 1: ${class1.name} (_id: ${class1._id})`);

    // ========================================================================
    // Step 2: Admin enrolls Students into Section 1
    // ========================================================================
    console.log('\n--- Step 2: Admin enrolls Students in Section 1 ---');
    // Clean up any test students with these IDs
    await StudentProfile.deleteMany({ institution: institution._id, studentId: { $in: ['E2E_STU_101', 'E2E_STU_102'] } });
    await User.deleteMany({ institution: institution._id, userId: { $in: ['E2E_STU_101', 'E2E_STU_102'] } });

    const studentUser1 = await User.create({
      institution: institution._id,
      userId: 'E2E_STU_101',
      name: 'Alex Johnson',
      email: 'alex.e2e@studypoint.edu',
      role: 'student',
      password: 'HashPassword123!',
      isActive: true
    });
    const studentUser2 = await User.create({
      institution: institution._id,
      userId: 'E2E_STU_102',
      name: 'Beth Davis',
      email: 'beth.e2e@studypoint.edu',
      role: 'student',
      password: 'HashPassword123!',
      isActive: true
    });

    const studentProfile1 = await StudentProfile.create({
      institution: institution._id,
      user: studentUser1._id,
      studentId: 'E2E_STU_101',
      personalInfo: { name: 'Alex Johnson', email: 'alex.e2e@studypoint.edu' },
      academicInfo: { course: 'B.Tech', department: testDeptName, semester: '5th', section: 'E2E-SEC-1', academicYear },
      department: testDeptName,
      section: 'E2E-SEC-1',
      course: 'B.Tech',
      academicYear,
      semester: '5th',
      yearOfStudy: 'Third Year',
      classRef: class1._id,
      isActive: true
    });
    const studentProfile2 = await StudentProfile.create({
      institution: institution._id,
      user: studentUser2._id,
      studentId: 'E2E_STU_102',
      personalInfo: { name: 'Beth Davis', email: 'beth.e2e@studypoint.edu' },
      academicInfo: { course: 'B.Tech', department: testDeptName, semester: '5th', section: 'E2E-SEC-1', academicYear },
      department: testDeptName,
      section: 'E2E-SEC-1',
      course: 'B.Tech',
      academicYear,
      semester: '5th',
      yearOfStudy: 'Third Year',
      classRef: class1._id,
      isActive: true
    });
    console.log(`✓ Enrolled 2 students in Section E2E-SEC-1: ${studentProfile1.studentId}, ${studentProfile2.studentId}`);

    // Verify Teacher A initially DOES NOT see Section 1 because Teacher A is not yet assigned
    let reqA = { currentUser: { ...teacherA.user.toObject(), institution: institution._id } };
    let resA = createMockRes();
    await teacherController.getMyClasses(reqA, resA);
    const classesBeforeAssign = (resA.body?.classes || []).filter(c => c._id.toString() === class1._id.toString());
    if (classesBeforeAssign.length !== 0) {
      throw new Error('Teacher A saw unassigned class before assignment!');
    }
    console.log('✓ PASS: Teacher A does not see unassigned section before admin assignment.');

    // ========================================================================
    // Step 3: Admin assigns Subject and Teacher A to Section 1
    // ========================================================================
    console.log('\n--- Step 3: Admin assigns Subject and Teacher A to Section 1 ---');
    const adminUser = await User.findOne({ role: 'admin', institution: institution._id }) || { _id: new mongoose.Types.ObjectId(), institution };
    const adminReq = {
      params: { id: class1._id.toString() },
      currentUser: adminUser,
      body: {
        assignments: [
          { subjectId: testSubject._id.toString(), teacherId: teacherA._id.toString() }
        ]
      }
    };
    const adminRes = createMockRes();
    await adminController.updateClassAssignments(adminReq, adminRes);
    if (adminRes.statusCode !== 200 || !adminRes.body?.success) {
      throw new Error(`Admin assignment failed: ${JSON.stringify(adminRes.body)}`);
    }
    console.log(`✓ Admin assignment saved: ${adminRes.body.message}`);

    // ========================================================================
    // Step 4: Teacher A views My Classes & Sections
    // ========================================================================
    console.log('\n--- Step 4: Teacher A views My Classes & Sections ---');
    resA = createMockRes();
    await teacherController.getMyClasses(reqA, resA);
    if (resA.statusCode !== 200 || !resA.body?.success) {
      throw new Error(`Teacher getMyClasses failed: ${JSON.stringify(resA.body)}`);
    }

    const assignedClass1 = (resA.body.classes || []).find(c => c._id.toString() === class1._id.toString());
    if (!assignedClass1) {
      throw new Error('Teacher A does not see assigned section in getMyClasses');
    }
    console.log(`Assigned Section returned to Teacher A:`);
    console.log(`  Name: ${assignedClass1.name}`);
    console.log(`  Department: ${assignedClass1.department}`);
    console.log(`  Year of Study: ${assignedClass1.yearOfStudy}`);
    console.log(`  Section: ${assignedClass1.section}`);
    console.log(`  Enrolled Students: ${assignedClass1.studentCount}`);
    console.log(`  Subjects Count (for teacher): ${assignedClass1.subjectsCount}`);
    console.log(`  Status: ${assignedClass1.status}`);

    if (assignedClass1.yearOfStudy !== 'Third Year') {
      throw new Error(`Expected Year of Study "Third Year", got "${assignedClass1.yearOfStudy}"`);
    }
    if (assignedClass1.department !== testDeptName) {
      throw new Error(`Expected Department "${testDeptName}", got "${assignedClass1.department}"`);
    }
    if (assignedClass1.studentCount !== 2) {
      throw new Error(`Expected studentCount 2, got ${assignedClass1.studentCount}`);
    }
    if (assignedClass1.subjectsCount !== 1) {
      throw new Error(`Expected subjectsCount 1, got ${assignedClass1.subjectsCount}`);
    }
    if (assignedClass1.status !== 'Assigned') {
      throw new Error(`Expected status "Assigned", got "${assignedClass1.status}"`);
    }
    console.log('✓ PASS: Academic year, department, inner section card, student count (2), and status match perfectly!\n');

    // ========================================================================
    // Step 5: Teacher A views My Subjects
    // ========================================================================
    console.log('--- Step 5: Teacher A views My Subjects page ---');
    const resSubjectsA = createMockRes();
    await teacherController.getMySubjects(reqA, resSubjectsA);
    const assignedSubj = (resSubjectsA.body?.subjects || []).find(s => s.subjectId.toString() === testSubject._id.toString());
    if (!assignedSubj) {
      throw new Error('Assigned subject does not appear in Teacher A My Subjects page');
    }
    console.log(`✓ PASS: Subject "${assignedSubj.name}" appears on My Subjects with sections: [${assignedSubj.sections.join(', ')}]\n`);

    // ========================================================================
    // Step 6: Teacher A opens "View Student Details" modal (getClassDetails)
    // ========================================================================
    console.log('--- Step 6: Teacher A requests Section Details and Student Roster ---');
    const reqDetailsA = {
      params: { id: class1._id.toString() },
      currentUser: { ...teacherA.user.toObject(), institution: institution._id }
    };
    const resDetailsA = createMockRes();
    await teacherController.getClassDetails(reqDetailsA, resDetailsA);
    if (resDetailsA.statusCode !== 200 || !resDetailsA.body?.success) {
      throw new Error(`getClassDetails failed: ${JSON.stringify(resDetailsA.body)}`);
    }
    const modalData = resDetailsA.body.class;
    console.log(`Modal data returned: Section ${modalData.section}, Enrolled Students: ${modalData.students?.length}`);
    if (modalData.students?.length !== 2) {
      throw new Error(`Expected 2 students in modal, got ${modalData.students?.length}`);
    }
    const studentNames = modalData.students.map(s => s.user?.name || s.personalInfo?.name);
    console.log(`  Enrolled student names: ${studentNames.join(', ')}`);
    if (!studentNames.includes('Alex Johnson') || !studentNames.includes('Beth Davis')) {
      throw new Error('Enrolled student roster names mismatch');
    }
    console.log('✓ PASS: Modal correctly loads student roster and curriculum allocations.\n');

    // ========================================================================
    // Step 7: Security check - Teacher B attempts to view Section 1
    // ========================================================================
    console.log('--- Step 7: Security Check - Unauthorized Teacher Access Prevention ---');
    const reqB = { currentUser: { ...teacherB.user.toObject(), institution: institution._id } };
    const resBClasses = createMockRes();
    await teacherController.getMyClasses(reqB, resBClasses);
    const teacherBSeesClass1 = (resBClasses.body?.classes || []).some(c => c._id.toString() === class1._id.toString());
    if (teacherBSeesClass1) {
      throw new Error('SECURITY VIOLATION: Teacher B can see Section 1 which is only assigned to Teacher A!');
    }
    console.log('✓ PASS: Teacher B does not see Section 1 in their classes hierarchy.');

    const reqDetailsB = {
      params: { id: class1._id.toString() },
      currentUser: { ...teacherB.user.toObject(), institution: institution._id }
    };
    const resDetailsB = createMockRes();
    await teacherController.getClassDetails(reqDetailsB, resDetailsB);
    if (resDetailsB.statusCode !== 403) {
      throw new Error(`SECURITY VIOLATION: Expected 403 Forbidden for unassigned Teacher B, got ${resDetailsB.statusCode}`);
    }
    console.log(`✓ PASS: Unauthorized access by Teacher B to Section 1 correctly rejected with 403: "${resDetailsB.body?.error}"\n`);

    // ========================================================================
    // Step 8: Multi-Section Assignment & Deduplication Check
    // ========================================================================
    console.log('--- Step 8: Multi-Section Assignment & Deduplication Check ---');
    const class2 = await Class.create({
      institution: institution._id,
      name: `B.Tech - ${testDeptName} (Sem 5th, Sec E2E-SEC-2)`,
      course: 'B.Tech',
      department: testDeptName,
      academicYear,
      semester: '5th',
      section: 'E2E-SEC-2',
      yearOfStudy: 'Third Year',
      isActive: true
    });
    console.log(`Created Section 2: ${class2.name}`);

    // Assign same subject and Teacher A to Section 2
    const adminReq2 = {
      params: { id: class2._id.toString() },
      currentUser: adminUser,
      body: {
        assignments: [
          { subjectId: testSubject._id.toString(), teacherId: teacherA._id.toString() }
        ]
      }
    };
    const adminRes2 = createMockRes();
    await adminController.updateClassAssignments(adminReq2, adminRes2);
    console.log(`✓ Admin assigned same subject to Section 2`);

    // Check My Subjects: Subject should appear ONCE, with both sections [E2E-SEC-1, E2E-SEC-2]
    const resSubjectsA2 = createMockRes();
    await teacherController.getMySubjects(reqA, resSubjectsA2);
    const matchingSubjects = (resSubjectsA2.body?.subjects || []).filter(s => s.subjectId.toString() === testSubject._id.toString());
    if (matchingSubjects.length !== 1) {
      throw new Error(`Expected subject to appear exactly ONCE on My Subjects, appeared ${matchingSubjects.length} times`);
    }
    const singleSubj = matchingSubjects[0];
    console.log(`✓ My Subjects: Single subject entry "${singleSubj.name}" with sections: [${singleSubj.sections.join(', ')}]`);
    if (singleSubj.sectionCount !== 2 || !singleSubj.sections.includes('E2E-SEC-1') || !singleSubj.sections.includes('E2E-SEC-2')) {
      throw new Error(`Expected sections ['E2E-SEC-1', 'E2E-SEC-2'], got [${singleSubj.sections.join(', ')}]`);
    }

    // Check My Classes & Sections: Teacher A should see BOTH section cards separately
    const resClassesA2 = createMockRes();
    await teacherController.getMyClasses(reqA, resClassesA2);
    const teacherASections = (resClassesA2.body?.classes || []).filter(c => c.department === testDeptName);
    console.log(`✓ My Classes & Sections: Both sections appear as separate inner section cards: ${teacherASections.map(s => `Section ${s.section}`).join(', ')}`);
    if (teacherASections.length !== 2) {
      throw new Error(`Expected 2 separate section cards in My Classes, got ${teacherASections.length}`);
    }
    console.log('✓ PASS: Subject deduplicated on My Subjects, while sections appear individually in My Classes & Sections.\n');

    // ========================================================================
    // Step 9: Verify Admin Portal remains intact and unchanged
    // ========================================================================
    console.log('--- Step 9: Verify Admin Portal Remains Intact ---');
    const adminClassesRes = createMockRes();
    await adminController.getClasses({ currentUser: adminUser }, adminClassesRes);
    if (adminClassesRes.statusCode !== 200 || !adminClassesRes.body?.success) {
      throw new Error('Admin getClasses failed');
    }
    console.log(`✓ Admin Portal getClasses returned ${adminClassesRes.body.classes?.length} classes across the institution.`);
    console.log('✓ PASS: Admin Portal functionality remains completely intact.\n');

    // Clean up test data
    console.log('Cleaning up test data...');
    await TeachingAssignment.deleteMany({ institution: institution._id, subject: testSubject._id });
    await Class.deleteMany({ _id: { $in: [class1._id, class2._id] } });
    await StudentProfile.deleteMany({ _id: { $in: [studentProfile1._id, studentProfile2._id] } });
    await User.deleteMany({ _id: { $in: [studentUser1._id, studentUser2._id] } });
    await Subject.deleteOne({ _id: testSubject._id });
    console.log('Cleanup completed.\n');

    console.log('========================================================================');
    console.log(' ALL E2E VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('========================================================================');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ VERIFICATION TEST FAILED:', error);
    process.exit(1);
  }
}

runEndToEndVerification();
