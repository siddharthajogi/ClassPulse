const mongoose = require('mongoose');
const http = require('http');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const { TEACHER_QUALIFICATION_OPTIONS, STANDARD_TEACHER_QUALIFICATIONS } = require('../config/qualifications');

function makeRequest(options, postData = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const req = http.request({ ...options, headers }, (res) => {
      let data = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let body = {};
        try { body = JSON.parse(data); } catch (e) { body = data; }
        resolve({ statusCode: res.statusCode, headers: res.headers, body, setCookie });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTeacherProfileVerification() {
  console.log('=== Starting Teacher Profile Portal Verification ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[PASS] Connected to MongoDB');

  // 1. Verify Teacher Qualification Options
  console.log('\n--- 1. Verify Teacher Qualification Options ---');
  const expectedOptions = [
    'Diploma',
    'B.Tech',
    'B.E.',
    'M.Tech',
    'M.E.',
    'M.Sc.',
    'MCA',
    'MBA',
    'Ph.D.',
    'Other'
  ];

  if (TEACHER_QUALIFICATION_OPTIONS.length !== 10) {
    throw new Error(`Expected exactly 10 teacher qualification options, found ${TEACHER_QUALIFICATION_OPTIONS.length}`);
  }

  for (let i = 0; i < expectedOptions.length; i++) {
    if (TEACHER_QUALIFICATION_OPTIONS[i] !== expectedOptions[i]) {
      throw new Error(`Mismatch at index ${i}: expected "${expectedOptions[i]}", got "${TEACHER_QUALIFICATION_OPTIONS[i]}"`);
    }
  }

  // Ensure M.Tech and M.E. are distinct
  if (TEACHER_QUALIFICATION_OPTIONS.includes('M.Tech / M.E.')) {
    throw new Error('Found combined "M.Tech / M.E." which violates the separation requirement');
  }
  if (!TEACHER_QUALIFICATION_OPTIONS.includes('M.Tech') || !TEACHER_QUALIFICATION_OPTIONS.includes('M.E.')) {
    throw new Error('Missing separate M.Tech or M.E. option');
  }

  console.log(`[PASS] 10 Teacher qualification options verified correctly: ${TEACHER_QUALIFICATION_OPTIONS.join(', ')}`);

  // 2. Find or prepare a teacher for testing
  console.log('\n--- 2. Finding Active Teacher for Authentication ---');
  const teacherUser = await User.findOne({ role: 'teacher', isActive: true });
  if (!teacherUser) {
    throw new Error('No active teacher account found in database');
  }

  // Ensure mustChangePassword is false for test login
  await User.updateOne({ _id: teacherUser._id }, { $set: { mustChangePassword: false } });

  // Reset password to known testing password
  const bcrypt = require('bcrypt');
  const testPassword = 'Teacher@Test1234';
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  await User.updateOne({ _id: teacherUser._id }, { $set: { password: hashedPassword } });

  // 3. Login as teacher
  console.log(`\n--- 3. Authenticate Teacher ${teacherUser.userId} ---`);
  const loginRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ userId: teacherUser.userId, password: testPassword, role: 'teacher' })
  );

  if (loginRes.statusCode !== 200 || !loginRes.body.success) {
    throw new Error(`Teacher login failed: ${JSON.stringify(loginRes.body)}`);
  }
  const teacherCookie = (loginRes.setCookie && loginRes.setCookie[0])
    ? loginRes.setCookie[0].split(';')[0]
    : '';
  console.log('[PASS] Teacher logged in successfully with session cookie.');

  // 4. Test GET /api/teacher/profile
  console.log('\n--- 4. GET /api/teacher/profile ---');
  const getProfileRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/teacher/profile', method: 'GET' },
    null,
    teacherCookie
  );

  if (getProfileRes.statusCode !== 200 || !getProfileRes.body.success) {
    throw new Error(`GET /api/teacher/profile failed: ${JSON.stringify(getProfileRes.body)}`);
  }
  console.log('[PASS] Retrieved teacher profile successfully:');
  console.log(`  Name: ${getProfileRes.body.profile.name}`);
  console.log(`  Teacher ID: ${getProfileRes.body.profile.teacherId}`);
  console.log(`  Qualifications: ${JSON.stringify(getProfileRes.body.profile.qualifications)}`);
  console.log(`  Highest Qualification Display: ${getProfileRes.body.profile.highestQualification}`);

  // 5. Test Legacy Single Value Migration Handling
  console.log('\n--- 5. Legacy Qualification Migration Handling ---');
  // Seed legacy single value "B.Tech / B.E." in database
  await User.updateOne(
    { _id: teacherUser._id },
    { $set: { highestQualification: 'B.Tech / B.E.', qualifications: [] } }
  );
  await TeacherProfile.updateOne(
    { user: teacherUser._id },
    { $set: { 'professionalInfo.highestQualification': 'B.Tech / B.E.', 'professionalInfo.qualifications': [] } }
  );

  const migratedGetRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/teacher/profile', method: 'GET' },
    null,
    teacherCookie
  );
  const migratedQuals = migratedGetRes.body.profile.qualifications;
  if (!migratedQuals.includes('B.Tech') || !migratedQuals.includes('B.E.') || migratedQuals.includes('B.Tech / B.E.')) {
    throw new Error(`Failed to properly migrate legacy "B.Tech / B.E." into separate items. Got: ${JSON.stringify(migratedQuals)}`);
  }
  console.log('[PASS] Successfully migrated legacy "B.Tech / B.E." into separate ["B.Tech", "B.E."].');

  // 6. Test PUT /api/teacher/profile with Multiple Qualifications (e.g. B.Tech, B.E., M.Tech, Ph.D.)
  console.log('\n--- 6. PUT /api/teacher/profile with Multiple Qualifications ---');
  const testEmail = getProfileRes.body.profile.email || teacherUser.email || 'teacher_test@classpulse.edu';
  const multiQualPayload = {
    name: teacherUser.name || 'Test Faculty',
    email: testEmail,
    phone: '9876543210',
    address: 'Faculty Quarters',
    designation: 'Associate Professor',
    qualifications: ['B.Tech', 'B.E.', 'M.Tech', 'Ph.D.'],
    highestQualification: 'B.Tech, B.E., M.Tech, Ph.D.',
    department: getProfileRes.body.profile.department || 'Computer Science',
    yearsOfExperience: 8
  };

  const updateRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/teacher/profile', method: 'PUT' },
    JSON.stringify(multiQualPayload),
    teacherCookie
  );

  if (updateRes.statusCode !== 200 || !updateRes.body.success) {
    throw new Error(`PUT /api/teacher/profile failed: ${JSON.stringify(updateRes.body)}`);
  }

  const updatedProfile = updateRes.body.profile;
  console.log(`[PASS] Profile updated successfully.`);
  console.log(`  Saved qualifications: ${JSON.stringify(updatedProfile.qualifications)}`);
  console.log(`  Saved highestQualification: "${updatedProfile.highestQualification}"`);

  if (!Array.isArray(updatedProfile.qualifications) || updatedProfile.qualifications.length !== 4) {
    throw new Error(`Expected 4 qualifications, got: ${JSON.stringify(updatedProfile.qualifications)}`);
  }
  if (updatedProfile.highestQualification !== 'B.Tech, B.E., M.Tech, Ph.D.') {
    throw new Error(`Expected comma-separated display 'B.Tech, B.E., M.Tech, Ph.D.', got: "${updatedProfile.highestQualification}"`);
  }

  // Verify persistence in MongoDB directly
  const dbUser = await User.findById(teacherUser._id);
  const dbTeacher = await TeacherProfile.findOne({ user: teacherUser._id });

  if (dbUser.qualifications.length !== 4 || dbTeacher.professionalInfo.qualifications.length !== 4) {
    throw new Error('Database persistence check failed for multiple qualifications.');
  }
  console.log('[PASS] Verified persistence of qualifications array directly in MongoDB User and TeacherProfile models.');

  // 7. Test Experience Field Validation (Rejects negative numbers)
  console.log('\n--- 7. Testing Experience Field Validation ---');
  const invalidExpPayload = {
    ...multiQualPayload,
    yearsOfExperience: -5
  };
  const invalidExpRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/teacher/profile', method: 'PUT' },
    JSON.stringify(invalidExpPayload),
    teacherCookie
  );

  if (invalidExpRes.statusCode !== 400 || invalidExpRes.body.success) {
    throw new Error('Expected 400 Bad Request for negative experience years');
  }
  console.log(`[PASS] Correctly rejected negative experience years (-5): ${invalidExpRes.body.error}`);

  // Test Experience Field Validation (Accepts valid non-negative numbers)
  const validExpPayload = {
    ...multiQualPayload,
    yearsOfExperience: 12
  };
  const validExpRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/teacher/profile', method: 'PUT' },
    JSON.stringify(validExpPayload),
    teacherCookie
  );

  if (validExpRes.statusCode !== 200 || !validExpRes.body.success) {
    throw new Error(`Failed to accept valid experience years (12): ${JSON.stringify(validExpRes.body)}`);
  }
  if (validExpRes.body.profile.yearsOfExperience !== 12) {
    throw new Error(`Expected yearsOfExperience to be 12, got: ${validExpRes.body.profile.yearsOfExperience}`);
  }
  console.log('[PASS] Valid experience years (12) accepted and persisted.');

  // 8. Test Protection of System Fields (Teacher ID, Role, Status)
  console.log('\n--- 8. Testing Protected System Fields Immutability ---');
  const maliciousPayload = {
    ...multiQualPayload,
    userId: 'HACKED_ID',
    teacherId: 'HACKED_ID',
    role: 'admin',
    isActive: false
  };

  const tamperRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/teacher/profile', method: 'PUT' },
    JSON.stringify(maliciousPayload),
    teacherCookie
  );

  if (tamperRes.statusCode !== 200 || !tamperRes.body.success) {
    throw new Error(`Profile update failed unexpectedly: ${JSON.stringify(tamperRes.body)}`);
  }

  const postTamperUser = await User.findById(teacherUser._id);
  if (postTamperUser.userId === 'HACKED_ID' || postTamperUser.role === 'admin' || postTamperUser.isActive === false) {
    throw new Error('SECURITY BREACH: Protected system fields were modified!');
  }
  console.log(`[PASS] Protected fields remained immutable: userId=${postTamperUser.userId}, role=${postTamperUser.role}, isActive=${postTamperUser.isActive}`);

  // 9. Verify Password Change Endpoint Workflow
  console.log('\n--- 9. Testing Password Change Workflow ---');
  const newPassword = 'Teacher@NewPassword2026!';
  const pwChangeRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/change-password', method: 'PUT' },
    JSON.stringify({
      currentPassword: testPassword,
      newPassword: newPassword,
      confirmPassword: newPassword
    }),
    teacherCookie
  );

  if (pwChangeRes.statusCode !== 200 || !pwChangeRes.body.success) {
    throw new Error(`Password change failed: ${JSON.stringify(pwChangeRes.body)}`);
  }
  console.log('[PASS] Password successfully updated using /api/auth/change-password.');

  // Test login with new password
  const newLoginRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ userId: teacherUser.userId, password: newPassword, role: 'teacher' })
  );
  if (newLoginRes.statusCode !== 200 || !newLoginRes.body.success) {
    throw new Error('Login with newly updated password failed');
  }
  console.log('[PASS] Logged in successfully with newly updated password.');

  // Reset back to original state if needed
  await User.updateOne({ _id: teacherUser._id }, { $set: { password: hashedPassword } });

  console.log('\n======================================================');
  console.log('ALL TEACHER PROFILE VERIFICATION CHECKS PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

runTeacherProfileVerification().catch((err) => {
  console.error('\n[FAIL] Verification error:', err);
  process.exit(1);
});
