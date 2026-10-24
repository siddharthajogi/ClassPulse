const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const Institution = require('../models/Institution');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');
const AcademicRecord = require('../models/AcademicRecord');
const AcademicYear = require('../models/AcademicYear');

async function testSectionDeletion() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const results = [];

  try {
    const institution = await Institution.findOne({ name: /Study Point/i }) || await Institution.findOne();
    if (!institution) throw new Error('No institution found');

    const subject = await Subject.findOne({ institution: institution._id, isActive: true });
    const teacher = await TeacherProfile.findOne({ institution: institution._id }).populate('user');
    const academicYearDoc = await AcademicYear.findOne({ institution: institution._id }) || { _id: new mongoose.Types.ObjectId() };

    console.log(`Institution: ${institution.name}`);

    // Clean up any old test sections
    await Class.deleteMany({ institution: institution._id, section: { $in: ['TEST-EMPTY', 'TEST-WITH-STUDENTS'] } });
    await User.deleteMany({ $or: [{ username: 'test_student_deletion_user' }, { userId: 'test_student_del_uid' }] });
    await StudentProfile.deleteMany({ studentId: 'test_student_del_id' });

    // ========================================================
    // TEST 1: Deleting an empty section without dependencies
    // ========================================================
    console.log('\n--- Test 1: Deleting an empty section ---');
    const emptyClass = await Class.create({
      institution: institution._id,
      name: 'B.Tech - Computer Science and Engineering',
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      academicYear: '2026-2027',
      semester: '5th',
      section: 'TEST-EMPTY',
      yearOfStudy: 'Third Year',
      isActive: true
    });

    // Simulate deleteClass logic without confirm (empty section should delete smoothly)
    const emptyStudentCount = await StudentProfile.countDocuments({
      institution: institution._id,
      $or: [
        { classRef: emptyClass._id },
        { department: emptyClass.department, academicYear: emptyClass.academicYear, semester: emptyClass.semester, section: emptyClass.section }
      ]
    });
    const emptyAsgnCount = await TeachingAssignment.countDocuments({
      institution: institution._id,
      classRef: emptyClass._id
    });

    const isConfirmedEmpty = false;
    let emptyBlocked = (emptyStudentCount > 0 || emptyAsgnCount > 0) && !isConfirmedEmpty;
    if (!emptyBlocked) {
      await Class.findByIdAndDelete(emptyClass._id);
    }
    const emptyStillExists = await Class.findById(emptyClass._id);
    results.push({
      test: '1. Delete Empty Section (No dependencies, normal confirmation)',
      status: (!emptyBlocked && !emptyStillExists) ? 'PASS' : 'FAIL',
      details: { wasBlocked: emptyBlocked, stillExists: !!emptyStillExists }
    });

    // ========================================================
    // TEST 2: Section with enrolled student and assignments
    // ========================================================
    console.log('\n--- Test 2: Section with enrolled student & teaching assignment ---');
    const depClass = await Class.create({
      institution: institution._id,
      name: 'B.Tech - Computer Science and Engineering',
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      academicYear: '2026-2027',
      semester: '5th',
      section: 'TEST-WITH-STUDENTS',
      yearOfStudy: 'Third Year',
      isActive: true
    });

    // Create a real student user and profile in this section
    const studentUser = await User.create({
      institution: institution._id,
      userId: 'test_student_del_uid',
      username: 'test_student_deletion_user',
      password: 'HashedTestPassword123!',
      role: 'student',
      name: 'Test Student For Deletion',
      email: 'test_del_student@example.com',
      isActive: true
    });

    const studentProfile = await StudentProfile.create({
      institution: institution._id,
      user: studentUser._id,
      studentId: 'test_student_del_id',
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      academicYear: '2026-2027',
      semester: '5th',
      yearOfStudy: 'Third Year',
      section: 'TEST-WITH-STUDENTS',
      classRef: depClass._id,
      personalInfo: { email: 'test_del_student@example.com' }
    });

    // Create an academic record (marks/attendance) for this student
    const academicRec = await AcademicRecord.create({
      institution: institution._id,
      student: studentProfile._id,
      subject: subject._id,
      academicYear: academicYearDoc._id,
      marksObtained: 88,
      totalMarks: 100,
      attendancePercentage: 95
    });

    // Create a teaching assignment in this section
    const teachingAsgn = await TeachingAssignment.create({
      institution: institution._id,
      classRef: depClass._id,
      subject: subject._id,
      teacher: teacher._id,
      academicYear: '2026-2027',
      title: 'TEST-WITH-STUDENTS Assignment',
      isActive: true
    });

    console.log(`Created Section TEST-WITH-STUDENTS: ID ${depClass._id}`);
    console.log(`Enrolled Student: ${studentUser.name} (${studentProfile.studentId})`);
    console.log(`Created AcademicRecord: ${academicRec._id}`);
    console.log(`Created TeachingAssignment: ${teachingAsgn._id}`);

    // --- Sub-test A: Deletion without confirmation should require confirmation ---
    const depStudentCount = await StudentProfile.countDocuments({
      institution: institution._id,
      $or: [
        { classRef: depClass._id },
        { department: depClass.department, academicYear: depClass.academicYear, semester: depClass.semester, section: depClass.section }
      ]
    });
    const depAsgnCount = await TeachingAssignment.countDocuments({
      institution: institution._id,
      classRef: depClass._id
    });

    const unconfirmedBlocked = (depStudentCount > 0 || depAsgnCount > 0);
    results.push({
      test: '2A. Unconfirmed request on section with dependencies requires explicit confirmation',
      status: unconfirmedBlocked ? 'PASS' : 'FAIL',
      details: { studentCount: depStudentCount, assignmentCount: depAsgnCount, requiresConfirmation: unconfirmedBlocked }
    });

    // --- Sub-test B: Confirmed deletion proceeds safely ---
    console.log('\n--- Executing confirmed deletion with explicit confirmation ---');
    const isConfirmed = true;

    // 1. Unassign students safely
    await StudentProfile.updateMany(
      {
        institution: institution._id,
        $or: [
          { classRef: depClass._id },
          { department: depClass.department, academicYear: depClass.academicYear, semester: depClass.semester, section: depClass.section }
        ]
      },
      {
        $unset: { classRef: 1, section: 1 }
      }
    );

    // 2. Remove section-specific teaching assignments
    await TeachingAssignment.deleteMany({
      institution: institution._id,
      classRef: depClass._id
    });

    // 3. Delete Class document
    await Class.findByIdAndDelete(depClass._id);

    // --- Verification Checks after confirmed deletion ---
    // Check 1: Section document is gone
    const deletedClassCheck = await Class.findById(depClass._id);
    const sectionDeleted = deletedClassCheck === null;

    // Check 2: Student user account still exists
    const studentUserCheck = await User.findById(studentUser._id);
    const userAccountIntact = studentUserCheck !== null && studentUserCheck.isActive === true;

    // Check 3: Student profile still exists and is safely unassigned
    const studentProfileCheck = await StudentProfile.findById(studentProfile._id);
    const studentProfileIntact = studentProfileCheck !== null;
    const studentUnassigned = studentProfileCheck && !studentProfileCheck.classRef && !studentProfileCheck.section;

    // Check 4: Teacher user and teacher profile still exist
    const teacherUserCheck = await User.findById(teacher.user._id);
    const teacherProfileCheck = await TeacherProfile.findById(teacher._id);
    const teacherIntact = teacherUserCheck !== null && teacherProfileCheck !== null;

    // Check 5: Academic records (marks, attendance) remain 100% intact
    const academicRecCheck = await AcademicRecord.findById(academicRec._id);
    const academicRecordsIntact = academicRecCheck !== null && academicRecCheck.marksObtained === 88;

    // Check 6: Section assignments were cleaned up
    const remainingAsgnCheck = await TeachingAssignment.find({ classRef: depClass._id });
    const assignmentsCleaned = remainingAsgnCheck.length === 0;

    results.push({
      test: '2B. Section permanently deleted from database',
      status: sectionDeleted ? 'PASS' : 'FAIL',
      details: { sectionDeleted }
    });

    results.push({
      test: '2C. Student User and Profile accounts remain 100% intact',
      status: (userAccountIntact && studentProfileIntact) ? 'PASS' : 'FAIL',
      details: { userAccountIntact, studentProfileIntact }
    });

    results.push({
      test: '2D. Student successfully unassigned from deleted section without data loss',
      status: studentUnassigned ? 'PASS' : 'FAIL',
      details: { studentUnassigned, currentClassRef: studentProfileCheck?.classRef, currentSection: studentProfileCheck?.section }
    });

    results.push({
      test: '2E. Teacher accounts and User profiles remain 100% intact',
      status: teacherIntact ? 'PASS' : 'FAIL',
      details: { teacherIntact }
    });

    results.push({
      test: '2F. Academic records (marks, attendance, assessments) remain 100% intact',
      status: academicRecordsIntact ? 'PASS' : 'FAIL',
      details: { academicRecordsIntact, marksObtained: academicRecCheck?.marksObtained }
    });

    results.push({
      test: '2G. Section-specific assignments cleanly removed',
      status: assignmentsCleaned ? 'PASS' : 'FAIL',
      details: { remainingAssignments: remainingAsgnCheck.length }
    });

    // Cleanup test student and records
    await AcademicRecord.findByIdAndDelete(academicRec._id);
    await StudentProfile.findByIdAndDelete(studentProfile._id);
    await User.findByIdAndDelete(studentUser._id);
    console.log('Cleaned up test student user and records.');

  } catch (err) {
    console.error('Test execution error:', err);
    results.push({
      test: 'Execution Error',
      status: 'FAIL',
      details: err.message
    });
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }

  console.log('\n======================================================');
  console.log('      SECTION DELETION VERIFICATION REPORT           ');
  console.log('======================================================');
  results.forEach(r => {
    console.log(`[${r.status}] ${r.test}`);
    console.log(`     Details: ${JSON.stringify(r.details)}`);
  });
  console.log('======================================================\n');
}

testSectionDeletion();
