const http = require('http');

const request = (path, method = 'GET', data = null, cookie = null) => {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
          ...(cookie ? { 'Cookie': cookie } : {})
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(body); } catch (_) { parsed = body; }
          const setCookie = res.headers['set-cookie'];
          const extractedCookie = setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : null;
          resolve({ statusCode: res.statusCode, body: parsed, cookie: extractedCookie });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
};

async function runTestSuite() {
  console.log('===============================================================');
  console.log('   MANDATORY VERIFICATION TEST SUITE: ADMIN MY PROFILE PAGE    ');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Unauthorized Access Test
  console.log('\n--- 1. Testing Security & Unauthorized Access ---');
  const unauthGet = await request('/api/admin/profile', 'GET');
  assert(unauthGet.statusCode === 401, 'Unauthenticated GET /api/admin/profile is rejected with 401');

  const unauthPut = await request('/api/admin/profile', 'PUT', { name: 'Hacker' });
  assert(unauthPut.statusCode === 401, 'Unauthenticated PUT /api/admin/profile is rejected with 401');

  // 2. Authenticate as Administrator
  console.log('\n--- 2. Authenticating as Administrator ---');
  const loginRes = await request('/api/auth/login', 'POST', {
    userId: '0001',
    password: 'StudyPoint@Admin2026',
    role: 'admin'
  });
  const cookie = loginRes.cookie;
  assert(Boolean(cookie), 'Admin authentication successful and session cookie established');

  // 3. Fetch Admin Profile
  console.log('\n--- 3. Testing GET /api/admin/profile ---');
  const profileRes = await request('/api/admin/profile', 'GET', null, cookie);
  assert(profileRes.statusCode === 200, 'GET /api/admin/profile returns 200 OK');
  assert(profileRes.body.success === true, 'Response indicates success: true');
  assert(profileRes.body.profile.userId === '0001', 'Admin ID is "0001"');
  assert(profileRes.body.profile.role === 'admin', 'Role is "admin"');
  assert(profileRes.body.profile.isActive === true, 'Account Status is active');
  assert(!profileRes.body.profile.password, 'Password and password hash are NOT exposed');
  assert(Array.isArray(profileRes.body.qualifications), 'Standard qualifications list is returned');
  assert(profileRes.body.qualifications.includes('B.Tech / B.E.') && profileRes.body.qualifications.includes('Ph.D.'), 'Qualifications list contains standard degrees');
  assert(Array.isArray(profileRes.body.departments), 'Departments list is returned');

  // 4. Test Validation Rejections
  console.log('\n--- 4. Testing Required Fields & Input Validation ---');
  
  // Empty name
  const emptyNameRes = await request('/api/admin/profile', 'PUT', {
    name: '   ',
    email: 'admin@valid.com'
  }, cookie);
  assert(emptyNameRes.statusCode === 400 && emptyNameRes.body.errors?.name, 'Empty full name is rejected with 400 and validation error');

  // Invalid email
  const invalidEmailRes = await request('/api/admin/profile', 'PUT', {
    name: 'Valid Name',
    email: 'not-an-email'
  }, cookie);
  assert(invalidEmailRes.statusCode === 400 && invalidEmailRes.body.errors?.email, 'Invalid email format is rejected with 400');

  // Invalid phone (letters or wrong length)
  const invalidPhoneRes = await request('/api/admin/profile', 'PUT', {
    name: 'Valid Name',
    email: 'valid@example.com',
    phone: '12345'
  }, cookie);
  assert(invalidPhoneRes.statusCode === 400 && invalidPhoneRes.body.errors?.phone, 'Invalid 5-digit phone is rejected with 400');

  // 5. Test Email Uniqueness / Duplicate Email
  console.log('\n--- 5. Testing Duplicate Email Prevention ---');
  // Set another user's email to test conflict
  const mongoose = require('mongoose');
  const path = require('path');
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  const User = require('../models/User');
  await mongoose.connect(process.env.MONGODB_URI);
  
  await User.findOneAndUpdate(
    { userId: 'test_prof_1' },
    { $set: { email: 'turing.alan@example.com' } }
  );

  const dupEmailRes = await request('/api/admin/profile', 'PUT', {
    name: 'Valid Admin Name',
    email: 'turing.alan@example.com'
  }, cookie);

  assert(dupEmailRes.statusCode === 400, 'Attempt to reuse another user\'s email returns 400');
  assert(dupEmailRes.body.errors?.email === 'Email address is already in use by another account', 'Appropriate duplicate email error message returned');

  // 6. Test Valid Profile Update
  console.log('\n--- 6. Testing Permitted Profile Fields Update ---');
  const validPayload = {
    name: 'Dr. Evelyn Reed',
    email: 'admin.evelyn@studypoint.edu',
    phone: '9876543210',
    designation: 'Dean of Academic Affairs',
    highestQualification: 'Ph.D.',
    department: 'Computer Science',
    specialization: 'Artificial Intelligence & Machine Learning',
    profilePhoto: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  };

  const updateRes = await request('/api/admin/profile', 'PUT', validPayload, cookie);
  assert(updateRes.statusCode === 200, 'PUT /api/admin/profile returns 200 OK');
  assert(updateRes.body.success === true, 'Response indicates success: true');
  assert(updateRes.body.profile.name === validPayload.name, 'Name updated successfully');
  assert(updateRes.body.profile.email === validPayload.email, 'Email updated successfully');
  assert(updateRes.body.profile.phone === validPayload.phone, 'Phone updated successfully');
  assert(updateRes.body.profile.designation === validPayload.designation, 'Designation updated successfully');
  assert(updateRes.body.profile.highestQualification === validPayload.highestQualification, 'Highest Qualification updated successfully');
  assert(updateRes.body.profile.department === validPayload.department, 'Department updated successfully');
  assert(updateRes.body.profile.specialization === validPayload.specialization, 'Specialization updated successfully');
  assert(updateRes.body.profile.profilePhoto === validPayload.profilePhoto, 'Profile photo updated successfully');

  // 7. Test Custom Qualification ("Other")
  console.log('\n--- 7. Testing Custom ("Other") Qualification ---');
  const otherPayload = {
    ...validPayload,
    highestQualification: 'Other',
    customQualification: 'Post-Doctoral Fellow in Computing'
  };
  const otherRes = await request('/api/admin/profile', 'PUT', otherPayload, cookie);
  assert(otherRes.statusCode === 200, 'Custom qualification update returns 200 OK');
  assert(otherRes.body.profile.highestQualification === 'Post-Doctoral Fellow in Computing', 'Custom qualification correctly stored as highestQualification');

  // 8. Test Protected-Field Security Immunity
  console.log('\n--- 8. Testing Protected-Field Security ---');
  const maliciousPayload = {
    name: 'Dr. Evelyn Reed',
    email: 'admin.evelyn@studypoint.edu',
    userId: '9999-HACKED',
    role: 'superadmin',
    isActive: false,
    password: 'NewHackedPassword123!',
    createdAt: '1970-01-01T00:00:00.000Z',
    institution: '666666666666666666666666'
  };

  const tamperRes = await request('/api/admin/profile', 'PUT', maliciousPayload, cookie);
  assert(tamperRes.statusCode === 200, 'Update request succeeds for permitted fields');
  assert(tamperRes.body.profile.userId === '0001', 'CRITICAL SECURITY: userId was NOT changed');
  assert(tamperRes.body.profile.role === 'admin', 'CRITICAL SECURITY: role was NOT changed');
  assert(tamperRes.body.profile.isActive === true, 'CRITICAL SECURITY: isActive was NOT changed');
  assert(new Date(tamperRes.body.profile.createdAt).getFullYear() >= 2024, 'CRITICAL SECURITY: createdAt was NOT changed');

  // Verify that password was NOT changed by logging in with original credentials
  const reloginOriginal = await request('/api/auth/login', 'POST', {
    userId: '0001',
    password: 'StudyPoint@Admin2026',
    role: 'admin'
  });
  assert(reloginOriginal.statusCode === 200 && reloginOriginal.cookie, 'CRITICAL SECURITY: Original admin password remains valid');

  // 9. Test Persistence Across Sessions
  console.log('\n--- 9. Testing Persistence Across Fresh Session ---');
  const freshGet = await request('/api/admin/profile', 'GET', null, reloginOriginal.cookie);
  assert(freshGet.statusCode === 200, 'Fresh session GET /api/admin/profile returns 200');
  assert(freshGet.body.profile.name === 'Dr. Evelyn Reed', 'Persisted name verified');
  assert(freshGet.body.profile.email === 'admin.evelyn@studypoint.edu', 'Persisted email verified');
  assert(freshGet.body.profile.highestQualification === 'Post-Doctoral Fellow in Computing', 'Persisted custom qualification verified');

  console.log('\n===============================================================');
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! `);
  console.log('===============================================================\n');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});
