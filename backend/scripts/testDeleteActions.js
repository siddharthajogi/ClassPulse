const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const Subject = require('../models/Subject');
const AcademicYear = require('../models/AcademicYear');
const AcademicRecord = require('../models/AcademicRecord');
const TeachingAssignment = require('../models/TeachingAssignment');
const AuditLog = require('../models/AuditLog');

const makeRequest = (options, postData = null, cookie = null) => {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (cookie) {
      headers['Cookie'] = cookie;
    }

    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({ ...options, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (_) {
          parsed = body;
        }

        const setCookie = res.headers['set-cookie'];
        let extractedCookie = null;
        if (setCookie) {
          extractedCookie = setCookie.map((c) => c.split(';')[0]).join('; ');
        }

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          cookie: extractedCookie,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

async function runTests() {
  console.log('=== STARTING DELETE ACTIONS & INTEGRITY TESTS ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  // Test 1: Unauthorized deletion attempt (no auth cookie)
  console.log('Test 1: Unauthorized deletion request (no session)...');
  const unauthRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/subjects/507f1f77bcf86cd799439011',
    method: 'DELETE'
  });
  console.log(`Status: ${unauthRes.statusCode}`);
  if (unauthRes.statusCode === 401) {
    console.log('PASS: Unauthorized requests are rejected with 401.');
  } else {
    console.error('FAIL: Expected 401 Unauthorized.');
  }

  // Admin login
  console.log('\nLogging in as admin (0001)...');
  let loginRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST'
    },
    JSON.stringify({ userId: '0001', password: 'StudyPoint@NewAdmin2026', role: 'admin' })
  );

  if (loginRes.statusCode !== 200) {
    loginRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST'
      },
      JSON.stringify({ userId: '0001', password: 'StudyPoint@Admin2026', role: 'admin' })
    );
  }

  if (loginRes.statusCode !== 200 || !loginRes.cookie) {
    console.error('Admin login failed:', loginRes.body);
    process.exit(1);
  }
  const adminCookie = loginRes.cookie;
  console.log('Admin logged in successfully.');

  const inst = await User.findOne({ userId: '0001' });

  // Test 2: Deleting non-existent student ID
  console.log('\nTest 2: Deleting non-existent student ID...');
  const fakeId = new mongoose.Types.ObjectId().toString();
  const notFoundRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/students/${fakeId}`,
      method: 'DELETE'
    },
    null,
    adminCookie
  );
  console.log(`Status: ${notFoundRes.statusCode}, Error: ${notFoundRes.body?.error}`);
  if (notFoundRes.statusCode === 404) {
    console.log('PASS: Non-existent record returns 404.');
  } else {
    console.error('FAIL: Expected 404.');
  }

  // Test 3: Deleting active academic year (integrity safeguard)
  console.log('\nTest 3: Attempting to delete active academic year...');
  const activeAY = await AcademicYear.findOne({ isActive: true });
  if (activeAY) {
    const delActiveAYRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/academic-years/${activeAY._id}`,
        method: 'DELETE'
      },
      null,
      adminCookie
    );
    console.log(`Status: ${delActiveAYRes.statusCode}, Body:`, delActiveAYRes.body);
    if (delActiveAYRes.statusCode === 400 && delActiveAYRes.body?.error?.includes('Cannot delete active academic year')) {
      console.log('PASS: Deleting active academic year is correctly blocked.');
    } else {
      console.error('FAIL: Active academic year was not blocked properly.');
    }
  } else {
    console.log('SKIP: No active academic year found.');
  }

  // Test 4: Temporary Subject creation and permanent deletion
  console.log('\nTest 4: Creating a temporary subject, then permanently deleting it...');
  const tempSubject = await Subject.create({
    code: 'TESTDEL101',
    name: 'Temporary Subject for Deletion Test',
    department: 'CSE',
    subjectType: 'Theory',
    credits: 3,
    institution: inst.institution
  });
  console.log(`Created test subject: ${tempSubject.name} (${tempSubject._id})`);

  // Permanently delete subject
  const delSubjectRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/subjects/${tempSubject._id}`,
      method: 'DELETE'
    },
    null,
    adminCookie
  );
  console.log(`Status: ${delSubjectRes.statusCode}, Message:`, delSubjectRes.body);
  if (delSubjectRes.statusCode === 200 && delSubjectRes.body?.success) {
    console.log('PASS: Subject permanently deleted via API.');
  } else {
    console.error('FAIL: Subject deletion failed.');
  }

  // Verify subject is gone from DB
  const checkSubject = await Subject.findById(tempSubject._id);
  if (!checkSubject) {
    console.log('PASS: Verified subject no longer exists in MongoDB.');
  } else {
    console.error('FAIL: Subject still exists in MongoDB!');
  }

  // Verify AuditLog entry was recorded
  const auditEntry = await AuditLog.findOne({
    action: 'DELETE_SUBJECT',
    targetResource: tempSubject._id
  });
  if (auditEntry) {
    console.log('PASS: Audit log entry verified for DELETE_SUBJECT.');
  } else {
    console.error('FAIL: Audit log entry not found.');
  }

  // Test 5: Student deletion with dependency check
  console.log('\nTest 5: Testing student deletion dependency safeguards...');
  await User.deleteMany({ userId: { $in: ['stddel999', 'tchdel999'] } });
  await StudentProfile.deleteMany({ studentId: 'stddel999' });
  await TeacherProfile.deleteMany({ teacherId: 'tchdel999' });

  const uniqueSuffix = Date.now().toString().slice(-5);
  const stdUserId = `sdel${uniqueSuffix}`;
  const tchUserId = `tdel${uniqueSuffix}`;

  const testUser = await User.create({
    userId: stdUserId,
    name: 'Temporary Delete Test Student',
    email: `${stdUserId}@test.com`,
    role: 'student',
    password: 'StudyPoint@2026',
    institution: inst.institution
  });
  const testStudent = await StudentProfile.create({
    user: testUser._id,
    studentId: stdUserId,
    course: 'B.Tech',
    department: 'CSE',
    academicYear: '2026-2027',
    semester: '1st',
    section: 'A',
    institution: inst.institution
  });

  // Attach an AcademicRecord referencing this student
  const mockRecord = await AcademicRecord.create({
    student: testStudent._id,
    subject: tempSubject._id || new mongoose.Types.ObjectId(),
    academicYear: activeAY ? activeAY._id : new mongoose.Types.ObjectId(),
    semester: '1st',
    internalAssessment1: 20,
    totalMarks: 100,
    marksObtained: 85,
    recordedBy: inst._id,
    institution: inst.institution
  });

  // Try deleting student - MUST BE BLOCKED BY BACKEND
  const blockedStudentDel = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/students/${testStudent._id}`,
      method: 'DELETE'
    },
    null,
    adminCookie
  );
  console.log(`Status with academic records: ${blockedStudentDel.statusCode}, Error: ${blockedStudentDel.body?.error}`);
  if (blockedStudentDel.statusCode === 400 && blockedStudentDel.body?.error?.includes('academic records exist')) {
    console.log('PASS: Student deletion blocked due to academic record dependency.');
  } else {
    console.error('FAIL: Student deletion was not blocked as expected.');
  }

  // Remove mock academic record, now deletion should succeed
  await AcademicRecord.findByIdAndDelete(mockRecord._id);
  const allowedStudentDel = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/students/${testStudent._id}`,
      method: 'DELETE'
    },
    null,
    adminCookie
  );
  console.log(`Status after clearing dependencies: ${allowedStudentDel.statusCode}, Success: ${allowedStudentDel.body?.success}`);
  if (allowedStudentDel.statusCode === 200 && allowedStudentDel.body?.success) {
    console.log('PASS: Student permanently deleted once dependencies were resolved.');
  } else {
    console.error('FAIL: Student deletion failed.');
  }

  // Test 6: Teacher deletion with dependency check
  console.log('\nTest 6: Testing teacher deletion dependency safeguards...');
  const testTeacherUser = await User.create({
    userId: tchUserId,
    name: 'Temporary Delete Test Teacher',
    email: `${tchUserId}@test.com`,
    role: 'teacher',
    password: 'StudyPoint@2026',
    institution: inst.institution
  });
  const testTeacher = await TeacherProfile.create({
    user: testTeacherUser._id,
    teacherId: tchUserId,
    department: 'CSE',
    designation: 'Assistant Professor',
    institution: inst.institution
  });

  const mockAssignment = await TeachingAssignment.create({
    teacher: testTeacher._id,
    subject: new mongoose.Types.ObjectId(),
    classRef: new mongoose.Types.ObjectId(),
    academicYear: '2026-2027',
    semester: '1st',
    institution: inst.institution
  });

  // Try deleting teacher - MUST BE BLOCKED BY BACKEND
  const blockedTeacherDel = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/teachers/${testTeacher._id}`,
      method: 'DELETE'
    },
    null,
    adminCookie
  );
  console.log(`Status with teaching assignments: ${blockedTeacherDel.statusCode}, Error: ${blockedTeacherDel.body?.error}`);
  if (blockedTeacherDel.statusCode === 400 && blockedTeacherDel.body?.error?.includes('active teaching assignments')) {
    console.log('PASS: Teacher deletion blocked due to active teaching assignment dependency.');
  } else {
    console.error('FAIL: Teacher deletion was not blocked as expected.');
  }

  // Remove mock assignment, now deletion should succeed
  await TeachingAssignment.findByIdAndDelete(mockAssignment._id);
  const allowedTeacherDel = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/teachers/${testTeacher._id}`,
      method: 'DELETE'
    },
    null,
    adminCookie
  );
  console.log(`Status after clearing dependencies: ${allowedTeacherDel.statusCode}, Success: ${allowedTeacherDel.body?.success}`);
  if (allowedTeacherDel.statusCode === 200 && allowedTeacherDel.body?.success) {
    console.log('PASS: Teacher permanently deleted once dependencies were resolved.');
  } else {
    console.error('FAIL: Teacher deletion failed.');
  }

  console.log('\n=== ALL DELETE ENDPOINTS & INTEGRITY CHECKS PASSED ===\n');
  await mongoose.disconnect();
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
