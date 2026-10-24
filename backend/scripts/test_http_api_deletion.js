const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const Institution = require('../models/Institution');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');

const API_BASE = 'http://localhost:5000/api';

async function testHttpApi() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const results = [];

  try {
    const institution = await Institution.findOne({ name: /Study Point/i }) || await Institution.findOne();
    const subject = await Subject.findOne({ institution: institution._id, isActive: true });
    const teacher = await TeacherProfile.findOne({ institution: institution._id }).populate('user');

    // 1. Authenticate as administrator
    console.log('\n--- 1. Authenticating as administrator (0001) ---');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: '0001',
        password: process.env.SEED_ADMIN_PASSWORD || 'StudyPoint@Admin2026',
        role: 'admin'
      })
    });

    const cookies = loginRes.headers.getSetCookie();
    const cookie = cookies.length > 0 ? cookies[0] : loginRes.headers.get('set-cookie');
    if (!cookie) throw new Error('No cookie received from login');
    console.log('Login successful. Session cookie acquired.');

    // 2. Create test class with student & assignment
    console.log('\n--- 2. Setting up test section with dependencies ---');
    await Class.deleteMany({ institution: institution._id, section: 'TEST-HTTP-DEL' });
    await User.deleteMany({ userId: 'test_http_del_uid' });
    await StudentProfile.deleteMany({ studentId: 'test_http_del_sid' });

    const testClass = await Class.create({
      institution: institution._id,
      name: 'B.Tech - Computer Science and Engineering',
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      academicYear: '2026-2027',
      semester: '5th',
      section: 'TEST-HTTP-DEL',
      yearOfStudy: 'Third Year',
      isActive: true
    });

    const studentUser = await User.create({
      institution: institution._id,
      userId: 'test_http_del_uid',
      username: 'test_http_del_username',
      password: 'HashedTestPassword123!',
      role: 'student',
      name: 'HTTP Test Student',
      email: 'http_student@example.com',
      isActive: true
    });

    const studentProfile = await StudentProfile.create({
      institution: institution._id,
      user: studentUser._id,
      studentId: 'test_http_del_sid',
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      academicYear: '2026-2027',
      semester: '5th',
      yearOfStudy: 'Third Year',
      section: 'TEST-HTTP-DEL',
      classRef: testClass._id,
      personalInfo: { email: 'http_student@example.com' }
    });

    await TeachingAssignment.create({
      institution: institution._id,
      classRef: testClass._id,
      subject: subject._id,
      teacher: teacher._id,
      academicYear: '2026-2027',
      title: 'TEST-HTTP-DEL Assignment',
      isActive: true
    });

    // 3. Test unconfirmed delete request over HTTP (should return 400 with requiresConfirmation: true)
    console.log('\n--- 3. Testing DELETE without confirmation flag ---');
    const unconfRes = await fetch(`${API_BASE}/admin/classes/${testClass._id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    const unconfData = await unconfRes.json().catch(() => ({}));

    const passUnconf = unconfRes.status === 400 && unconfData?.requiresConfirmation === true;
    results.push({
      test: 'HTTP API: DELETE without confirmation is blocked and requires confirmation',
      status: passUnconf ? 'PASS' : 'FAIL',
      details: { status: unconfRes.status, requiresConfirmation: unconfData?.requiresConfirmation, error: unconfData?.error }
    });

    // 4. Test confirmed delete request over HTTP (should return 200 and succeed)
    console.log('\n--- 4. Testing DELETE with confirm=true flag ---');
    const delRes = await fetch(`${API_BASE}/admin/classes/${testClass._id}?confirm=true`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    const delData = await delRes.json().catch(() => ({}));

    const passConfirmed = delRes.status === 200 && delData?.success === true;
    const classCheck = await Class.findById(testClass._id);
    const stuCheck = await StudentProfile.findById(studentProfile._id);
    const usrCheck = await User.findById(studentUser._id);
    const asgnCheck = await TeachingAssignment.find({ classRef: testClass._id });

    results.push({
      test: 'HTTP API: DELETE with confirm=true succeeds and safely disassociates students',
      status: (passConfirmed && !classCheck && stuCheck && !stuCheck.classRef && usrCheck && asgnCheck.length === 0) ? 'PASS' : 'FAIL',
      details: {
        httpStatus: delRes.status,
        successMessage: delData?.message,
        sectionGone: !classCheck,
        studentPreserved: !!stuCheck,
        studentUnassigned: !stuCheck?.classRef,
        userAccountActive: usrCheck?.isActive,
        assignmentsRemoved: asgnCheck.length === 0
      }
    });

    // 5. Test unauthenticated delete request (should return 401)
    console.log('\n--- 5. Testing unauthenticated DELETE request ---');
    const unauthRes = await fetch(`${API_BASE}/admin/classes/${testClass._id}?confirm=true`, {
      method: 'DELETE'
    });
    const unauthData = await unauthRes.json().catch(() => ({}));

    const passAuth = unauthRes.status === 401;
    results.push({
      test: 'HTTP API: Unauthorized user cannot delete section',
      status: passAuth ? 'PASS' : 'FAIL',
      details: { httpStatus: unauthRes.status, response: unauthData }
    });

    // Cleanup test student
    await StudentProfile.findByIdAndDelete(studentProfile._id);
    await User.findByIdAndDelete(studentUser._id);
    console.log('\nCleanup completed.');

  } catch (err) {
    console.error('Test error:', err.message);
    results.push({
      test: 'Execution Error',
      status: 'FAIL',
      details: err.message
    });
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n======================================================');
  console.log('       HTTP API DELETION VERIFICATION REPORT          ');
  console.log('======================================================');
  results.forEach(r => {
    console.log(`[${r.status}] ${r.test}`);
    console.log(`     Details: ${JSON.stringify(r.details)}`);
  });
  console.log('======================================================\n');
}

testHttpApi();
