const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Subject = require('../models/Subject');
const AcademicRecord = require('../models/AcademicRecord');
const AcademicYear = require('../models/AcademicYear');
const adminController = require('../controllers/adminController');

async function testDynamicAcademicStats() {
  console.log('=== Testing Dashboard Academic Records Removal & Dynamic Calculation ===\n');
  await mongoose.connect(process.env.MONGODB_URI);

  const adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) throw new Error('No admin user found');
  const institutionId = adminUser.institution;

  const mockReq = { currentUser: adminUser };
  const getAnalytics = async () => {
    let result = null;
    const mockRes = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { result = d; return this; }
    };
    await adminController.getPerformanceAnalytics(mockReq, mockRes);
    return result?.data;
  };

  // STEP 1: Verify Empty State when no records exist
  console.log('Step 1: Checking Empty State (No Academic Records in DB)...');
  const emptyData = await getAnalytics();
  console.log('Empty Data:', JSON.stringify(emptyData, null, 2));

  if (emptyData.performance.length !== 0) throw new Error('Expected performance to be empty array');
  if (emptyData.attendance.length !== 0) throw new Error('Expected attendance to be empty array');
  if (emptyData.latestScore !== null) throw new Error('Expected latestScore to be null');
  if (emptyData.latestAttendance !== null) throw new Error('Expected latestAttendance to be null');
  if (emptyData.overallAverageScore !== null) throw new Error('Expected overallAverageScore to be null');
  if (emptyData.overallAverageAttendance !== null) throw new Error('Expected overallAverageAttendance to be null');
  console.log('✓ PASS: Verified honest empty state when no academic records exist in database.\n');

  // STEP 2: Insert valid academic records and verify dynamic calculation
  console.log('Step 2: Adding dynamic academic records and verifying accurate calculation...');
  const activeAY = await AcademicYear.findOne({ isActive: true, institution: institutionId });
  const student1 = await StudentProfile.findOne({ institution: institutionId });
  const student2 = await StudentProfile.findOne({ institution: institutionId, _id: { $ne: student1?._id } });
  const subject1 = await Subject.findOne({ institution: institutionId });

  if (!activeAY || !student1 || !student2 || !subject1) {
    throw new Error('Missing active academic year, students, or subject to run dynamic test');
  }

  const createdRecordIds = [];
  try {
    // Record 1: 70 / 100 = 70%, attendance = 80%
    const r1 = await AcademicRecord.create({
      institution: institutionId,
      student: student1._id,
      subject: subject1._id,
      academicYear: activeAY._id,
      marksObtained: 70,
      totalMarks: 100,
      attendancePercentage: 80
    });
    createdRecordIds.push(r1._id);

    // Record 2: 90 / 100 = 90%, attendance = 100%
    const r2 = await AcademicRecord.create({
      institution: institutionId,
      student: student2._id,
      subject: subject1._id,
      academicYear: activeAY._id,
      marksObtained: 90,
      totalMarks: 100,
      attendancePercentage: 100
    });
    createdRecordIds.push(r2._id);

    // Expected average score: (70 + 90) / 2 = 80%
    // Expected average attendance: (80 + 100) / 2 = 90%
    const dynamicData = await getAnalytics();
    console.log('Dynamic Data Output:', JSON.stringify(dynamicData, null, 2));

    if (dynamicData.performance.length !== 1 || dynamicData.performance[0].averageScore !== 80) {
      throw new Error(`Expected performance averageScore 80, got: ${JSON.stringify(dynamicData.performance)}`);
    }
    if (dynamicData.attendance.length !== 1 || dynamicData.attendance[0].averageAttendance !== 90) {
      throw new Error(`Expected attendance averageAttendance 90, got: ${JSON.stringify(dynamicData.attendance)}`);
    }
    if (dynamicData.latestScore !== 80) {
      throw new Error(`Expected latestScore 80, got: ${dynamicData.latestScore}`);
    }
    if (dynamicData.latestAttendance !== 90) {
      throw new Error(`Expected latestAttendance 90, got: ${dynamicData.latestAttendance}`);
    }
    console.log('✓ PASS: Dynamic averages accurately calculated: 80% score and 90% attendance from actual records.\n');

  } finally {
    // STEP 3: Cleanup
    console.log('Step 3: Cleaning up test academic records...');
    if (createdRecordIds.length > 0) {
      await AcademicRecord.deleteMany({ _id: { $in: createdRecordIds } });
    }
    const finalCount = await AcademicRecord.countDocuments({ institution: institutionId });
    console.log(`Remaining AcademicRecord count: ${finalCount}`);
    if (finalCount !== 0) throw new Error('Failed to clean up test records');
    console.log('✓ PASS: Cleaned up all test records; zero records remain in DB.\n');
  }

  // STEP 4: Verify Empty State Restored
  console.log('Step 4: Verifying empty state restored after cleanup...');
  const restoredData = await getAnalytics();
  if (restoredData.performance.length !== 0 || restoredData.latestScore !== null) {
    throw new Error('Empty state was not restored after record deletion');
  }
  console.log('✓ PASS: Empty state restored. No hardcoded or placeholder values exist.\n');

  console.log('=== ALL TESTS PASSED SUCCESSFULLY ===');
  process.exit(0);
}

testDynamicAcademicStats().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
