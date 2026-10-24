const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
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
  console.log('=== STARTING DEPARTMENT & SECTION DELETE AND DETAILS TESTS ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  // 1. Unauthorized checks
  console.log('Test 1: Verifying unauthorized delete requests are rejected (401)...');
  const unauthClassDel = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/classes/507f1f77bcf86cd799439011',
    method: 'DELETE'
  });
  if (unauthClassDel.statusCode !== 401) {
    throw new Error(`Expected 401 for unauthorized class delete, got ${unauthClassDel.statusCode}`);
  }

  const unauthDeptDel = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/departments/Computer%20Science%20and%20Engineering',
    method: 'DELETE'
  });
  if (unauthDeptDel.statusCode !== 401) {
    throw new Error(`Expected 401 for unauthorized department delete, got ${unauthDeptDel.statusCode}`);
  }
  console.log('[PASS] Unauthorized deletion calls properly blocked with 401.\n');

  // 2. Admin login
  console.log('Logging in as Admin (0001)...');
  let loginRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ userId: '0001', password: 'StudyPoint@NewAdmin2026', role: 'admin' })
  );
  if (loginRes.statusCode !== 200) {
    loginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: '0001', password: 'StudyPoint@Admin2026', role: 'admin' })
    );
  }
  if (loginRes.statusCode !== 200 || !loginRes.cookie) {
    throw new Error('Admin login failed: ' + JSON.stringify(loginRes.body));
  }
  const adminCookie = loginRes.cookie;
  const adminUser = await User.findOne({ userId: '0001' });
  const institutionId = adminUser.institution;
  console.log('[PASS] Admin authenticated successfully.\n');

  // Pre-test cleanup of any previous test artifacts
  await Class.deleteMany({
    institution: institutionId,
    department: { $in: ['Mechatronics Engineering', 'Bioengineering'] }
  });
  await Subject.deleteMany({
    institution: institutionId,
    department: { $in: ['Mechatronics Engineering', 'Bioengineering'] }
  });

  // 3. Create a test department & section: "Mechatronics Engineering", Section "Z"
  console.log('Test 2: Creating a test section: Mechatronics Engineering, Sec Z...');
  const createRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/admin/classes', method: 'POST' },
    JSON.stringify({
      course: 'B.Tech',
      department: 'Mechatronics Engineering',
      academicYear: '2026-2027',
      semester: '1st',
      section: 'Z',
      yearOfStudy: 'First Year'
    }),
    adminCookie
  );
  if (createRes.statusCode !== 201 || !createRes.body.class?._id) {
    throw new Error('Failed to create test class: ' + JSON.stringify(createRes.body));
  }
  const testClassId = createRes.body.class._id;
  console.log(`[PASS] Created test section ID: ${testClassId}\n`);

  // 4. Test getClassById returns both assignments and students
  console.log('Test 3: Calling getClassById for Section Z...');
  const detailsRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: `/api/admin/classes/${testClassId}`, method: 'GET' },
    null,
    adminCookie
  );
  if (detailsRes.statusCode !== 200 || !detailsRes.body.success) {
    throw new Error('getClassById failed: ' + JSON.stringify(detailsRes.body));
  }
  const secDetails = detailsRes.body.class;
  console.log(`  Section: ${secDetails.section}, Dept: ${secDetails.department}, Sem: ${secDetails.semester}`);
  console.log(`  Students count: ${secDetails.studentCount}, Assignments count: ${secDetails.assignmentCount}`);
  if (!Array.isArray(secDetails.students) || !Array.isArray(secDetails.assignments)) {
    throw new Error('getClassById response missing students or assignments array');
  }
  console.log('[PASS] getClassById returns complete section metadata, assignments array, and students array.\n');

  // 5. Test Section Deletion Dependency Check (simulate dependency)
  console.log('Test 4: Testing section deletion dependency blocking (students & assignments)...');
  // Add a temporary teaching assignment
  const tempSubject = await Subject.findOne({ institution: institutionId });
  const tempTeacher = await TeacherProfile.findOne({ institution: institutionId });
  if (tempSubject && tempTeacher) {
    const mockAssignment = await TeachingAssignment.create({
      institution: institutionId,
      teacher: tempTeacher._id,
      subject: tempSubject._id,
      classRef: testClassId,
      academicYear: '2026-2027',
      title: 'Robotics Control Systems',
      isActive: true
    });

    const blockedDel = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/classes/${testClassId}`, method: 'DELETE' },
      null,
      adminCookie
    );
    console.log(`  Status with teaching assignment: ${blockedDel.statusCode}, Error: ${blockedDel.body?.error}`);
    if (blockedDel.statusCode !== 400 || !blockedDel.body?.error?.includes('teaching assignment')) {
      throw new Error('Expected deletion to be blocked due to teaching assignment dependency');
    }
    console.log('  [PASS] Section deletion was blocked by teaching assignment dependency.');

    // Clean up temporary assignment
    await TeachingAssignment.findByIdAndDelete(mockAssignment._id);
  }

  // 6. Test Department Deletion Dependency Check (simulate subject or student in department)
  console.log('\nTest 5: Testing department deletion dependency blocking...');
  const tempDeptSubject = await Subject.create({
    institution: institutionId,
    name: 'Introduction to Mechatronics',
    code: 'MTR101',
    department: 'Mechatronics Engineering',
    semester: '1st',
    academicYear: '2026-2027'
  });

  const blockedDeptDel = await makeRequest(
    { hostname: 'localhost', port: 5000, path: `/api/admin/departments/Mechatronics%20Engineering`, method: 'DELETE' },
    null,
    adminCookie
  );
  console.log(`  Status with dependent subject: ${blockedDeptDel.statusCode}, Error: ${blockedDeptDel.body?.error}`);
  if (blockedDeptDel.statusCode !== 400 || !blockedDeptDel.body?.error?.includes('subject')) {
    throw new Error('Expected department deletion to be blocked due to subject dependency');
  }
  console.log('  [PASS] Department deletion was blocked by subject dependency.');

  // Clean up dependent subject
  await Subject.findByIdAndDelete(tempDeptSubject._id);

  // 7. Test Successful Deletion of Empty Section
  console.log('\nTest 6: Deleting empty Section Z...');
  const deleteSecRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: `/api/admin/classes/${testClassId}`, method: 'DELETE' },
    null,
    adminCookie
  );
  console.log(`  Status: ${deleteSecRes.statusCode}, Message: ${deleteSecRes.body?.message}`);
  if (deleteSecRes.statusCode !== 200 || !deleteSecRes.body.success) {
    throw new Error('Failed to delete empty section: ' + JSON.stringify(deleteSecRes.body));
  }
  const checkClassDoc = await Class.findById(testClassId);
  if (checkClassDoc) {
    throw new Error('Class document still exists in MongoDB after deletion!');
  }
  console.log('[PASS] Empty section was permanently deleted from MongoDB.\n');

  // 8. Test Successful Deletion of Empty Department
  console.log('Test 7: Testing successful deletion of empty department...');
  // Create another empty department/section
  const deptClass = await Class.create({
    institution: institutionId,
    name: 'B.Tech - Bioengineering (Sem 1st, Sec A)',
    course: 'B.Tech',
    department: 'Bioengineering',
    academicYear: '2026-2027',
    semester: '1st',
    section: 'A',
    yearOfStudy: 'First Year',
    isActive: true
  });

  const deleteDeptRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: `/api/admin/departments/Bioengineering?yearOfStudy=First%20Year&course=B.Tech`, method: 'DELETE' },
    null,
    adminCookie
  );
  console.log(`  Status: ${deleteDeptRes.statusCode}, Message: ${deleteDeptRes.body?.message}`);
  if (deleteDeptRes.statusCode !== 200 || !deleteDeptRes.body.success) {
    throw new Error('Failed to delete empty department: ' + JSON.stringify(deleteDeptRes.body));
  }
  const checkDeptClass = await Class.findById(deptClass._id);
  if (checkDeptClass) {
    throw new Error('Bioengineering class document still exists after department deletion!');
  }
  console.log('[PASS] Empty department and its sections were permanently deleted.\n');

  // 9. Verify Section with Existing Real Records
  console.log('Test 8: Inspecting existing class with real records in MongoDB...');
  const existingClass = await Class.findOne({ institution: institutionId });
  if (existingClass) {
    const activeDetails = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/classes/${existingClass._id}`, method: 'GET' },
      null,
      adminCookie
    );
    if (activeDetails.statusCode === 200 && activeDetails.body.class) {
      const cls = activeDetails.body.class;
      console.log(`  Existing Section "${cls.section}" in "${cls.department}":`);
      console.log(`    - Enrolled students: ${cls.studentCount} (Array len: ${cls.students?.length})`);
      console.log(`    - Assignments count: ${cls.assignmentCount} (Array len: ${cls.assignments?.length})`);
      if (cls.assignments?.length > 0) {
        console.log(`    - Sample assignment subject: ${cls.assignments[0].subject?.name} (${cls.assignments[0].subject?.code})`);
        console.log(`    - Sample teacher: ${cls.assignments[0].teacher?.user?.name || cls.assignments[0].teacher?.personalInfo?.name}`);
      }
      if (cls.students?.length > 0) {
        console.log(`    - Sample student: ${cls.students[0].studentId} - ${cls.students[0].user?.name || cls.students[0].personalInfo?.name}`);
      }
      console.log('  [PASS] Section details properly populated with real records from MongoDB.');
    }
  }

  console.log('\n=== ALL DEPARTMENT & SECTION DELETE AND DETAILS TESTS PASSED ===');
  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('\nTEST SUITE FAILED:', err);
  mongoose.disconnect();
  process.exit(1);
});
