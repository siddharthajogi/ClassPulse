const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Class = require('../models/Class');
const Institution = require('../models/Institution');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING ACCEPTANCE TESTS FOR ACADEMIC HIERARCHY ---');
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Authenticate as admin
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: '0001',
      password: 'StudyPoint@Admin2026',
      role: 'admin'
    })
  });

  const cookie = loginRes.headers.get('set-cookie') || '';
  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': cookie
  };

  const loginData = await loginRes.json();
  if (!loginData.success) {
    throw new Error('Admin login failed: ' + JSON.stringify(loginData));
  }
  console.log('✓ Admin authenticated successfully');

  // Test 1: GET /api/admin/classes
  const classesRes = await fetch(`${BASE_URL}/admin/classes`, { headers: authHeaders });
  const classesData = await classesRes.json();
  if (!classesData.success || !Array.isArray(classesData.classes)) {
    throw new Error('GET /api/admin/classes failed: ' + JSON.stringify(classesData));
  }
  console.log(`✓ GET /api/admin/classes returned ${classesData.classes.length} classes. Deduplicated total enrolled: ${classesData.totalEnrolledStudents}`);

  // Verify yearOfStudy exists on returned classes
  const missingYear = classesData.classes.some(c => !c.yearOfStudy);
  if (missingYear) {
    throw new Error('Some classes do not have yearOfStudy populated!');
  }
  console.log('✓ All classes have yearOfStudy populated properly (First Year, Second Year, Third Year, or Fourth Year)');

  // Test 2: Duplicate Prevention in POST /api/admin/classes
  const sampleClass = classesData.classes[0];
  const dupRes = await fetch(`${BASE_URL}/admin/classes`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      course: sampleClass.course,
      department: sampleClass.department,
      academicYear: sampleClass.academicYear,
      semester: sampleClass.semester,
      section: sampleClass.section,
      yearOfStudy: sampleClass.yearOfStudy
    })
  });
  const dupData = await dupRes.json();
  if (dupRes.status === 400 && !dupData.success) {
    console.log('✓ Duplicate section prevented with 400 error:', dupData.error);
  } else {
    throw new Error('Expected duplicate section creation to fail with 400! Got: ' + dupRes.status);
  }

  // Test 3: Create a real new section
  const testSectionName = 'TEST_SEC_' + Date.now().toString().slice(-4);
  const createRes = await fetch(`${BASE_URL}/admin/classes`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      academicYear: '2026-2027',
      semester: '1st',
      section: testSectionName,
      yearOfStudy: 'First Year'
    })
  });
  const createData = await createRes.json();
  if (!createData.success || !createData.class) {
    throw new Error('Failed to create new test section: ' + JSON.stringify(createData));
  }
  const createdClassId = createData.class._id;
  console.log(`✓ Created new section "${testSectionName}" under First Year (ID: ${createdClassId})`);

  // Test 4: Student creation with unconfigured section should fail with 400 validation error
  const unconfiguredStudentId = 'unconf_' + Date.now().toString().slice(-6);
  const unconfRes = await fetch(`${BASE_URL}/admin/students`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      studentId: unconfiguredStudentId,
      password: 'Password@123',
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      academicYear: '2026-2027',
      semester: '1st',
      section: 'NON_EXISTENT_SECTION_XYZ',
      personalInfo: {
        name: 'Test Unconfigured Student',
        email: `${unconfiguredStudentId}@university.edu`
      }
    })
  });
  const unconfData = await unconfRes.json();
  if (unconfRes.status === 400 && !unconfData.success) {
    console.log('✓ Student creation with unconfigured section was correctly rejected with 400:', unconfData.error);
  } else {
    throw new Error('Expected student creation with unconfigured section to fail with 400!');
  }

  // Test 5: Student creation with configured section should succeed and auto-group
  const validStudentId = 'auto_' + Date.now().toString().slice(-6);
  const studentCreateRes = await fetch(`${BASE_URL}/admin/students`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      studentId: validStudentId,
      password: 'Password@123',
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      academicYear: '2026-2027',
      semester: '1st',
      section: testSectionName,
      personalInfo: {
        name: 'Auto Grouped Student',
        email: `${validStudentId}@university.edu`
      }
    })
  });
  const studentCreateData = await studentCreateRes.json();
  if (!studentCreateData.success || !studentCreateData.group) {
    throw new Error('Failed to create student with valid section: ' + JSON.stringify(studentCreateData));
  }
  console.log(`✓ Student ${validStudentId} created and automatically grouped into section ${testSectionName} (Group ID: ${studentCreateData.group._id})`);

  // Test 6: Verify GET /api/admin/classes/:id returns only this section's students
  const sectionDetailsRes = await fetch(`${BASE_URL}/admin/classes/${createdClassId}`, { headers: authHeaders });
  const sectionDetailsData = await sectionDetailsRes.json();
  if (!sectionDetailsData.success || !sectionDetailsData.class) {
    throw new Error('Failed to fetch section details by ID: ' + JSON.stringify(sectionDetailsData));
  }
  const sectionStudents = sectionDetailsData.class.students;
  if (!Array.isArray(sectionStudents) || sectionStudents.length !== 1 || sectionStudents[0].studentId !== validStudentId) {
    throw new Error(`Section students mismatch! Expected 1 student (${validStudentId}), got: ${JSON.stringify(sectionStudents.map(s => s.studentId))}`);
  }
  console.log(`✓ Section details strictly enforce section filter on backend: found ${sectionStudents.length} student (${sectionStudents[0].studentId})`);

  // Test 7: Safe Reconciliation endpoint
  const reconcileRes = await fetch(`${BASE_URL}/admin/classes/reconcile-students`, {
    method: 'POST',
    headers: authHeaders
  });
  const reconcileData = await reconcileRes.json();
  if (!reconcileData.success) {
    throw new Error('Reconciliation endpoint failed: ' + JSON.stringify(reconcileData));
  }
  console.log(`✓ Reconciliation endpoint executed safely: ${reconcileData.reconciledCount} reconciled, ${reconcileData.unmatchedCount} unmatched`);

  // Cleanup the test student and test class
  const createdStudentProfile = await StudentProfile.findOne({ studentId: validStudentId });
  if (createdStudentProfile) {
    await User.findByIdAndDelete(createdStudentProfile.user);
    await StudentProfile.findByIdAndDelete(createdStudentProfile._id);
  }
  await Class.findByIdAndDelete(createdClassId);
  console.log('✓ Cleaned up temporary test records cleanly');

  await mongoose.disconnect();
  console.log('--- ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
