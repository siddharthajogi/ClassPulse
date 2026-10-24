const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');

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

const run = async () => {
  console.log('=== VERIFYING TEACHER CREATION (NO TEACHING ASSIGNMENTS) ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  try {
    // 1. Login as Admin
    console.log('Step 1: Authenticating as Admin...');
    let adminLoginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: '0001', password: 'StudyPoint@NewAdmin2026', role: 'admin' })
    );

    if (adminLoginRes.statusCode !== 200) {
      adminLoginRes = await makeRequest(
        { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
        JSON.stringify({ userId: '0001', password: 'StudyPoint@Admin2026', role: 'admin' })
      );
    }

    if (adminLoginRes.statusCode !== 200 || !adminLoginRes.cookie) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.body)}`);
    }
    let adminCookie = adminLoginRes.cookie;
    console.log('[PASS] Admin login successful.\n');

    if (adminLoginRes.body.user?.mustChangePassword) {
      console.log('Admin mustChangePassword is true. Changing password to complete onboarding...');
      const cpRes = await makeRequest(
        { hostname: 'localhost', port: 5000, path: '/api/auth/change-password', method: 'PUT' },
        JSON.stringify({
          currentPassword: 'StudyPoint@Admin2026',
          newPassword: 'StudyPoint@Admin2026',
          confirmPassword: 'StudyPoint@Admin2026'
        }),
        adminCookie
      );
      if (cpRes.statusCode === 200) {
        console.log('[PASS] Admin password updated; mustChangePassword is now false.\n');
      } else {
        // Direct DB update fallback for testing
        await User.updateOne({ userId: '0001' }, { mustChangePassword: false });
        console.log('[PASS] mustChangePassword set to false in DB.\n');
      }
    }

    // Clean up test teacher if already exists
    const testTeacherId = `tch_test_${Date.now()}`;
    const testEmail = `teacher_${Date.now()}@studypoint.edu`;
    const testPassword = 'TeacherPass123!';

    // 2. Create Teacher WITHOUT teaching assignments
    console.log(`Step 2: Creating teacher "${testTeacherId}" with NO teaching assignments...`);
    const teacherPayload = {
      teacherId: testTeacherId,
      password: testPassword,
      department: 'CSE',
      designation: 'Assistant Professor',
      isActive: true,
      personalInfo: {
        name: 'Dr. Jane Smith',
        email: testEmail,
        phone: '9876543210',
        address: 'Faculty Quarters B-12'
      },
      professionalInfo: {
        highestQualification: 'Ph.D.',
        specialization: 'Artificial Intelligence',
        yearsOfExperience: 5
      }
      // Note: NO teachingAssignments property in payload!
    };

    const createRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/teachers', method: 'POST' },
      JSON.stringify(teacherPayload),
      adminCookie
    );

    console.log('Teacher create response status:', createRes.statusCode);
    console.log('Teacher create response body:', createRes.body);

    if (createRes.statusCode !== 201 || !createRes.body.success) {
      throw new Error(`Teacher creation failed: ${JSON.stringify(createRes.body)}`);
    }
    console.log('[PASS] Teacher account created successfully via admin API (201 Created).\n');

    // 3. Verify persistence in MongoDB
    console.log('Step 3: Verifying persistence in MongoDB...');
    const savedUser = await User.findOne({ userId: testTeacherId });
    if (!savedUser) {
      throw new Error('User record not found in MongoDB!');
    }
    console.log(`[PASS] User record found: id=${savedUser._id}, userId=${savedUser.userId}, role=${savedUser.role}, isActive=${savedUser.isActive}`);

    const savedProfile = await TeacherProfile.findOne({ teacherId: testTeacherId });
    if (!savedProfile) {
      throw new Error('TeacherProfile record not found in MongoDB!');
    }
    console.log(`[PASS] TeacherProfile found: id=${savedProfile._id}, department=${savedProfile.department}, designation=${savedProfile.designation}, email=${savedProfile.personalInfo?.email}`);

    const assignmentCount = await TeachingAssignment.countDocuments({ teacher: savedProfile._id });
    console.log(`[PASS] Teaching assignments count in DB for teacher: ${assignmentCount} (expected 0)`);
    if (assignmentCount !== 0) {
      throw new Error(`Expected 0 assignments, found ${assignmentCount}`);
    }

    // 4. Test Teacher Login
    console.log('\nStep 4: Testing Teacher Login with newly created credentials...');
    const teacherLoginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: testTeacherId, password: testPassword, role: 'teacher' })
    );

    console.log('Teacher login status:', teacherLoginRes.statusCode);
    console.log('Teacher login body:', teacherLoginRes.body);

    if (teacherLoginRes.statusCode !== 200 || !teacherLoginRes.body.success) {
      throw new Error(`Teacher login failed: ${JSON.stringify(teacherLoginRes.body)}`);
    }
    console.log(`[PASS] Teacher successfully logged in as "${testTeacherId}"!\n`);

    // 5. Test Duplicate Teacher ID Rejection
    console.log('Step 5: Testing duplicate Teacher ID rejection...');
    const dupIdRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/teachers', method: 'POST' },
      JSON.stringify({
        ...teacherPayload,
        personalInfo: { ...teacherPayload.personalInfo, email: `diff_${Date.now()}@studypoint.edu` }
      }),
      adminCookie
    );
    console.log('Duplicate ID status:', dupIdRes.statusCode, dupIdRes.body);
    if (dupIdRes.statusCode !== 400 || !dupIdRes.body.error?.includes('Teacher ID already exists')) {
      throw new Error(`Expected 400 with "Teacher ID already exists", got ${dupIdRes.statusCode}`);
    }
    console.log('[PASS] Duplicate Teacher ID properly rejected.\n');

    // 6. Test Duplicate Email Rejection
    console.log('Step 6: Testing duplicate Email rejection...');
    const dupEmailRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/teachers', method: 'POST' },
      JSON.stringify({
        ...teacherPayload,
        teacherId: `tch_diff_${Date.now()}`
      }),
      adminCookie
    );
    console.log('Duplicate Email status:', dupEmailRes.statusCode, dupEmailRes.body);
    if (dupEmailRes.statusCode !== 400 || !dupEmailRes.body.error?.includes('Email already exists')) {
      throw new Error(`Expected 400 with "Email already exists", got ${dupEmailRes.statusCode}`);
    }
    console.log('[PASS] Duplicate Email properly rejected.\n');

    // 7. Clean up test records
    console.log('Step 7: Cleaning up test data...');
    await User.deleteOne({ _id: savedUser._id });
    await TeacherProfile.deleteOne({ _id: savedProfile._id });
    console.log('[PASS] Test records cleaned up.\n');

    console.log('=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===');
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((err) => {
  console.error('\n[TEST RUN FAILED]:', err);
  process.exit(1);
});
