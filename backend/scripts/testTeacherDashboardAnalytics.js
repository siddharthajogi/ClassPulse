const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const StudentProfile = require('../models/StudentProfile');
const AcademicRecord = require('../models/AcademicRecord');
const RiskPrediction = require('../models/RiskPrediction');
const AcademicYear = require('../models/AcademicYear');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const teacherController = require('../controllers/teacherController');

async function runTests() {
  console.log('=== Running Comprehensive Teacher Dashboard Analytics Test Suite ===\n');
  await mongoose.connect(process.env.MONGODB_URI);

  const teachers = await User.find({ role: 'teacher', isActive: true });
  if (teachers.length === 0) {
    console.error('FAILED: No active teacher user found in DB');
    process.exit(1);
  }

  const teacherUser = teachers[0];
  const institutionId = teacherUser.institution;
  console.log(`Testing with Teacher User: ${teacherUser.userId} (Inst: ${institutionId})`);

  const createMockRes = () => ({
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
  });

  // TEST 1: Live DB query for authenticated teacher
  console.log('\n--- TEST 1: Live Atlas query for teacher ---');
  const mockReq = { currentUser: teacherUser };
  const mockRes = createMockRes();
  await teacherController.getDashboardAnalytics(mockReq, mockRes);

  if (mockRes.statusCode !== 200 || !mockRes.body || !mockRes.body.success) {
    console.error('FAILED: getDashboardAnalytics did not return 200 success', mockRes.statusCode, mockRes.body);
    process.exit(1);
  }

  const { stats, riskAnalytics, attendanceAnalytics, scoreAnalytics, context } = mockRes.body;
  console.log('Stats:', stats);
  console.log('Risk Analytics:', riskAnalytics);
  console.log('Attendance Analytics:', attendanceAnalytics);
  console.log('Score Analytics:', scoreAnalytics);

  // Validate contract structure
  console.log('Validating API contract structure...');
  if (typeof stats.mySubjects !== 'number' ||
      typeof stats.myClasses !== 'number' ||
      typeof stats.totalStudents !== 'number' ||
      typeof stats.studentsAtRisk !== 'number') {
    console.error('FAILED: stats structure mismatch', stats);
    process.exit(1);
  }
  if (!Array.isArray(riskAnalytics.data) || typeof riskAnalytics.total !== 'number' || typeof riskAnalytics.isAvailable !== 'boolean') {
    console.error('FAILED: riskAnalytics structure mismatch', riskAnalytics);
    process.exit(1);
  }
  if (!Array.isArray(attendanceAnalytics.attendance) || typeof attendanceAnalytics.hasData !== 'boolean') {
    console.error('FAILED: attendanceAnalytics structure mismatch', attendanceAnalytics);
    process.exit(1);
  }
  if (!Array.isArray(scoreAnalytics.performance) || typeof scoreAnalytics.hasData !== 'boolean') {
    console.error('FAILED: scoreAnalytics structure mismatch', scoreAnalytics);
    process.exit(1);
  }
  console.log('✓ PASSED: API contract strictly adhered to.');

  // TEST 2: Multi-assignment and de-duplication integration simulation
  console.log('\n--- TEST 2: Subject & Class De-duplication Simulation ---');
  const tempTeacherUser = await User.create({
    userId: `t_sim_${Date.now()}`,
    password: 'hashed_password_123',
    role: 'teacher',
    institution: institutionId,
    name: 'Simulation Teacher'
  });

  const tempTeacherProfile = await TeacherProfile.create({
    user: tempTeacherUser._id,
    teacherId: tempTeacherUser.userId,
    institution: institutionId,
    department: 'CSE',
    designation: 'Assistant Professor'
  });

  // Create 2 test subjects
  const sub1 = await Subject.create({
    name: 'Sim Subject A',
    code: `SUB_A_${Date.now()}`,
    department: 'CSE',
    institution: institutionId
  });
  const sub2 = await Subject.create({
    name: 'Sim Subject B',
    code: `SUB_B_${Date.now()}`,
    department: 'CSE',
    institution: institutionId
  });

  // Create 2 test classes
  const cls1 = await Class.create({
    name: 'Sim Class 1',
    course: 'B.Tech',
    department: 'CSE',
    academicYear: '2026-2027',
    semester: '5th',
    section: 'A',
    institution: institutionId
  });
  const cls2 = await Class.create({
    name: 'Sim Class 2',
    course: 'B.Tech',
    department: 'CSE',
    academicYear: '2026-2027',
    semester: '5th',
    section: 'B',
    institution: institutionId
  });

  // Create 3 assignments:
  // - Sub 1 in Class 1
  // - Sub 1 in Class 2 (Same subject across multiple classes)
  // - Sub 2 in Class 1
  // Expected distinct subjects = 2 (not 3!)
  // Expected distinct classes = 2 (not 3!)
  const asgn1 = await TeachingAssignment.create({
    teacher: tempTeacherProfile._id,
    subject: sub1._id,
    classRef: cls1._id,
    academicYear: '2026-2027',
    institution: institutionId
  });
  const asgn2 = await TeachingAssignment.create({
    teacher: tempTeacherProfile._id,
    subject: sub1._id,
    classRef: cls2._id,
    academicYear: '2026-2027',
    institution: institutionId
  });
  const asgn3 = await TeachingAssignment.create({
    teacher: tempTeacherProfile._id,
    subject: sub2._id,
    classRef: cls1._id,
    academicYear: '2026-2027',
    institution: institutionId
  });

  // Create 2 students: Student 1 in Class 1, Student 2 in Class 2
  const stuUser1 = await User.create({
    userId: `stu_sim1_${Date.now()}`,
    password: 'pw',
    role: 'student',
    institution: institutionId
  });
  const stuUser2 = await User.create({
    userId: `stu_sim2_${Date.now()}`,
    password: 'pw',
    role: 'student',
    institution: institutionId
  });

  const stu1 = await StudentProfile.create({
    user: stuUser1._id,
    studentId: stuUser1.userId,
    institution: institutionId,
    course: 'B.Tech',
    department: 'CSE',
    academicYear: '2026-2027',
    semester: '5th',
    section: 'A',
    classRef: cls1._id
  });
  const stu2 = await StudentProfile.create({
    user: stuUser2._id,
    studentId: stuUser2.userId,
    institution: institutionId,
    course: 'B.Tech',
    department: 'CSE',
    academicYear: '2026-2027',
    semester: '5th',
    section: 'B',
    classRef: cls2._id
  });

  // Create an unrelated student in a different class
  const otherCls = await Class.create({
    name: 'Unrelated Class',
    course: 'B.Tech',
    department: 'ECE',
    academicYear: '2026-2027',
    semester: '1st',
    section: 'A',
    institution: institutionId
  });
  const stuOtherUser = await User.create({
    userId: `stu_other_${Date.now()}`,
    password: 'pw',
    role: 'student',
    institution: institutionId
  });
  const stuOther = await StudentProfile.create({
    user: stuOtherUser._id,
    studentId: stuOtherUser.userId,
    institution: institutionId,
    course: 'B.Tech',
    department: 'ECE',
    academicYear: '2026-2027',
    semester: '1st',
    section: 'A',
    classRef: otherCls._id
  });

  // Add risk prediction: stu1 = high, stu2 = low, stuOther = high
  const risk1 = await RiskPrediction.create({
    institution: institutionId,
    student: stu1._id,
    riskLevel: 'high',
    score: 85
  });
  const risk2 = await RiskPrediction.create({
    institution: institutionId,
    student: stu2._id,
    riskLevel: 'low',
    score: 20
  });
  const riskOther = await RiskPrediction.create({
    institution: institutionId,
    student: stuOther._id,
    riskLevel: 'high',
    score: 95
  });

  // Add academic records:
  // AcademicYear
  let acYear = await AcademicYear.findOne({ institution: institutionId });
  if (!acYear) {
    acYear = await AcademicYear.create({
      institution: institutionId,
      year: '2026-2027',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30')
    });
  }

  // stu1: 40/50 marks (80%), attendance 90%
  const rec1 = await AcademicRecord.create({
    institution: institutionId,
    student: stu1._id,
    subject: sub1._id,
    academicYear: acYear._id,
    marksObtained: 40,
    totalMarks: 50,
    attendancePercentage: 90
  });

  // stu2: 90/100 marks (90%), attendance 80%
  const rec2 = await AcademicRecord.create({
    institution: institutionId,
    student: stu2._id,
    subject: sub1._id,
    academicYear: acYear._id,
    marksObtained: 90,
    totalMarks: 100,
    attendancePercentage: 80
  });

  // Unrelated student score: 20/100 marks
  const recOther = await AcademicRecord.create({
    institution: institutionId,
    student: stuOther._id,
    subject: sub1._id,
    academicYear: acYear._id,
    marksObtained: 20,
    totalMarks: 100,
    attendancePercentage: 30
  });

  try {
    const simReq = { currentUser: tempTeacherUser };
    const simRes = createMockRes();
    await teacherController.getDashboardAnalytics(simReq, simRes);

    const simData = simRes.body;
    console.log('Simulation Results:', JSON.stringify(simData, null, 2));

    // Verify Card 1: My Subjects = 2
    if (simData.stats.mySubjects !== 2) {
      console.error(`FAILED: Expected 2 distinct subjects, got ${simData.stats.mySubjects}`);
      process.exit(1);
    }
    console.log('✓ PASSED: Distinct subjects correctly counted as 2 (sub1 not duplicated across 2 classes)');

    // Verify Card 2: My Classes = 2
    if (simData.stats.myClasses !== 2) {
      console.error(`FAILED: Expected 2 distinct classes, got ${simData.stats.myClasses}`);
      process.exit(1);
    }
    console.log('✓ PASSED: Distinct classes correctly counted as 2');

    // Verify Card 3: Total Students = 2 (stu1 and stu2 only, NOT stuOther)
    if (simData.stats.totalStudents !== 2) {
      console.error(`FAILED: Expected 2 distinct assigned students, got ${simData.stats.totalStudents}`);
      process.exit(1);
    }
    console.log('✓ PASSED: Total students accurately scoped to assigned classes (unrelated student excluded)');

    // Verify Card 4 & Graph 1: Students at risk
    // 2 valid predictions for assigned students (1 high, 1 low). stuOther's high risk must NOT be included!
    if (simData.stats.studentsAtRisk !== 2) {
      console.error(`FAILED: Expected 2 valid predictions, got ${simData.stats.studentsAtRisk}`);
      process.exit(1);
    }
    if (simData.stats.highRisk !== 1 || simData.stats.lowRisk !== 1 || simData.stats.mediumRisk !== 0) {
      console.error('FAILED: Risk distribution mismatch', simData.stats);
      process.exit(1);
    }
    console.log('✓ PASSED: Risk analytics correctly scoped to assigned students (1 High, 1 Low, other student excluded)');

    // Verify Graph 2: Attendance Analytics
    // Average attendance = (90 + 80) / 2 = 85%
    if (simData.attendanceAnalytics.overallAverageAttendance !== 85) {
      console.error(`FAILED: Expected attendance average 85%, got ${simData.attendanceAnalytics.overallAverageAttendance}%`);
      process.exit(1);
    }
    console.log('✓ PASSED: Attendance average correctly calculated as 85% (excluding unrelated student 30%)');

    // Verify Graph 3: Score Analytics
    // stu1 = 40/50 (80%), stu2 = 90/100 (90%) -> Expected overall average = (80 + 90) / 2 = 85%
    if (simData.scoreAnalytics.overallAverageScore !== 85) {
      console.error(`FAILED: Expected score average 85%, got ${simData.scoreAnalytics.overallAverageScore}%`);
      process.exit(1);
    }
    console.log('✓ PASSED: Score normalization correctly normalized 40/50 and 90/100 to 85% (excluding unrelated student 20%)');

  } finally {
    // Clean up temporary simulation records
    console.log('\nCleaning up simulation documents...');
    await AcademicRecord.deleteMany({ _id: { $in: [rec1._id, rec2._id, recOther._id] } });
    await RiskPrediction.deleteMany({ _id: { $in: [risk1._id, risk2._id, riskOther._id] } });
    await TeachingAssignment.deleteMany({ _id: { $in: [asgn1._id, asgn2._id, asgn3._id] } });
    await StudentProfile.deleteMany({ _id: { $in: [stu1._id, stu2._id, stuOther._id] } });
    await User.deleteMany({ _id: { $in: [stuUser1._id, stuUser2._id, stuOtherUser._id, tempTeacherUser._id] } });
    await TeacherProfile.findByIdAndDelete(tempTeacherProfile._id);
    await Subject.deleteMany({ _id: { $in: [sub1._id, sub2._id] } });
    await Class.deleteMany({ _id: { $in: [cls1._id, cls2._id, otherCls._id] } });
    console.log('✓ Simulation cleanup complete.');
  }

  console.log('\n=== ALL COMPREHENSIVE TESTS PASSED SUCCESSFULLY ===');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
