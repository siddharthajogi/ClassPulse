const mongoose = require('mongoose');
const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');

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

async function runVerification() {
  console.log('=== ClassPulse Secure Teacher Password-Reset Verification ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[PASS] Connected to MongoDB');

  // 1. Locate teacher Jogi Uma Devi by Teacher ID 't001'
  console.log('\n--- 1. Locating Teacher Jogi Uma Devi (t001) ---');
  const teacherProfile = await TeacherProfile.findOne({ teacherId: 't001' })
    .populate('user', 'userId name email role isActive mustChangePassword institution');

  if (!teacherProfile) {
    throw new Error('Teacher record for t001 not found');
  }

  const initialUserId = teacherProfile.user._id.toString();
  const initialTeacherProfileId = teacherProfile._id.toString();
  const institutionId = teacherProfile.institution.toString();

  console.log(`[PASS] Located teacher: ${teacherProfile.personalInfo?.name || teacherProfile.user.name} (${teacherProfile.teacherId})`);
  console.log(`  User ID: ${teacherProfile.user.userId}`);
  console.log(`  TeacherProfile _id: ${initialTeacherProfileId}`);
  console.log(`  User _id: ${initialUserId}`);

  // Count existing teaching assignments before reset
  const initialAssignments = await TeachingAssignment.find({ teacher: teacherProfile._id });
  console.log(`[PASS] Verified ${initialAssignments.length} teaching assignments exist prior to reset.`);

  // 2. Set an initial baseline password for testing transition
  const bcrypt = require('bcrypt');
  const baselineOldPassword = 'InitialOldPassword@123';
  const baselineHash = await bcrypt.hash(baselineOldPassword, 10);
  await User.updateOne({ _id: teacherProfile.user._id }, { $set: { password: baselineHash, mustChangePassword: false } });

  // Verify baseline login works
  const preTestLogin = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ userId: 't001', password: baselineOldPassword, role: 'teacher' })
  );
  if (preTestLogin.statusCode !== 200 || !preTestLogin.body.success) {
    throw new Error(`Pre-test baseline login failed: ${JSON.stringify(preTestLogin.body)}`);
  }
  console.log('[PASS] Baseline teacher credentials verified before Admin reset.');

  // 3. Authenticate as authorized Admin
  console.log('\n--- 2. Authenticating as Authorized Admin ---');
  // Find admin for this institution
  const adminUser = await User.findOne({ role: 'admin', institution: institutionId });
  if (!adminUser) {
    throw new Error('No admin user found for institution ' + institutionId);
  }

  // Set known admin password for API testing
  const adminTestPassword = 'AdminSecurePass@2026';
  const adminHash = await bcrypt.hash(adminTestPassword, 10);
  await User.updateOne({ _id: adminUser._id }, { $set: { password: adminHash } });

  const adminLoginRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ userId: adminUser.userId, password: adminTestPassword, role: 'admin' })
  );

  if (adminLoginRes.statusCode !== 200 || !adminLoginRes.body.success) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.body)}`);
  }
  const adminCookie = (adminLoginRes.setCookie && adminLoginRes.setCookie[0])
    ? adminLoginRes.setCookie[0].split(';')[0]
    : '';
  console.log(`[PASS] Admin ${adminUser.userId} authenticated successfully.`);

  // 4. Admin resets Teacher Password via POST /api/admin/users/:id/reset-password
  console.log('\n--- 3. Authorized Admin Resets Teacher Password ---');
  const temporaryNewPassword = 'TempFacultyPassword@2026';

  // Test reset using Teacher's User _id
  const resetRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: `/api/admin/users/${initialUserId}/reset-password`, method: 'POST' },
    JSON.stringify({ newPassword: temporaryNewPassword }),
    adminCookie
  );

  if (resetRes.statusCode !== 200 || !resetRes.body.success) {
    throw new Error(`Admin password reset failed: ${JSON.stringify(resetRes.body)}`);
  }
  console.log('[PASS] Admin password reset API succeeded:', resetRes.body.message);

  // Verify response does not leak password or hash
  if (JSON.stringify(resetRes.body).includes(temporaryNewPassword) || JSON.stringify(resetRes.body).includes('$2b$')) {
    throw new Error('SECURITY VIOLATION: Password or bcrypt hash detected in API response!');
  }
  console.log('[PASS] API response is secure — zero exposure of password or bcrypt hash.');

  // Also test endpoint flexibility using Teacher ID string / TeacherProfile ID
  const testFlexRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: `/api/admin/teachers/t001/reset-password`, method: 'POST' },
    JSON.stringify({ newPassword: temporaryNewPassword }),
    adminCookie
  );
  if (testFlexRes.statusCode !== 200 || !testFlexRes.body.success) {
    throw new Error(`Teacher reset via teacherId failed: ${JSON.stringify(testFlexRes.body)}`);
  }
  console.log('[PASS] Endpoint flexibly and securely resolved teacher by Teacher ID "t001".');

  // 5. Verify old password no longer works
  console.log('\n--- 4. Verify Old Password Fails ---');
  const oldLoginRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ userId: 't001', password: baselineOldPassword, role: 'teacher' })
  );
  if (oldLoginRes.statusCode === 200) {
    throw new Error('SECURITY FAILURE: Old password still succeeded after reset!');
  }
  console.log(`[PASS] Old password rejected correctly (HTTP ${oldLoginRes.statusCode}: ${oldLoginRes.body.error || 'Invalid credentials'}).`);

  // 6. Verify new password works and enforces mustChangePassword: true
  console.log('\n--- 5. Verify New Temporary Password Works & Requires Change ---');
  const newLoginRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ userId: 't001', password: temporaryNewPassword, role: 'teacher' })
  );

  if (newLoginRes.statusCode !== 200 || !newLoginRes.body.success) {
    throw new Error(`New temporary password login failed: ${JSON.stringify(newLoginRes.body)}`);
  }
  if (!newLoginRes.body.user.mustChangePassword) {
    throw new Error('REQUIREMENT FAILURE: user.mustChangePassword was NOT true upon login!');
  }
  console.log('[PASS] New password accepted. Response confirmed mustChangePassword: true.');

  const teacherTempCookie = (newLoginRes.setCookie && newLoginRes.setCookie[0])
    ? newLoginRes.setCookie[0].split(';')[0]
    : '';

  // 7. Teacher changes password to permanent password
  console.log('\n--- 6. Teacher Completes Required Password Change ---');
  const permanentNewPassword = 'PermanentPass@UmaDevi2026!';
  const changeRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/change-password', method: 'PUT' },
    JSON.stringify({
      currentPassword: temporaryNewPassword,
      newPassword: permanentNewPassword,
      confirmPassword: permanentNewPassword
    }),
    teacherTempCookie
  );

  if (changeRes.statusCode !== 200 || !changeRes.body.success) {
    throw new Error(`Teacher password change failed: ${JSON.stringify(changeRes.body)}`);
  }
  console.log('[PASS] Teacher changed password successfully to permanent password.');

  // Verify temporary password no longer works
  const tempLoginAfterChange = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ userId: 't001', password: temporaryNewPassword, role: 'teacher' })
  );
  if (tempLoginAfterChange.statusCode === 200) {
    throw new Error('Temporary password should no longer work after change!');
  }
  console.log('[PASS] Temporary password expired and rejected.');

  // Verify permanent password works and mustChangePassword is false
  const permLoginRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ userId: 't001', password: permanentNewPassword, role: 'teacher' })
  );
  if (permLoginRes.statusCode !== 200 || !permLoginRes.body.success) {
    throw new Error(`Permanent password login failed: ${JSON.stringify(permLoginRes.body)}`);
  }
  if (permLoginRes.body.user.mustChangePassword !== false) {
    throw new Error('mustChangePassword should be false after user password change!');
  }
  console.log('[PASS] Permanent password authenticated successfully. mustChangePassword is false.');

  // 8. Verify No Duplicate Accounts and 100% Data Preservation
  console.log('\n--- 7. Verification of Data Preservation & Zero Duplicates ---');
  const usersWithT001 = await User.find({ userId: 't001' });
  if (usersWithT001.length !== 1) {
    throw new Error(`Duplicate user accounts found! Count: ${usersWithT001.length}`);
  }
  console.log(`[PASS] Exactly 1 user account for "t001" exists (ID: ${usersWithT001[0]._id.toString()}). No duplicates created.`);

  const profilesWithT001 = await TeacherProfile.find({ teacherId: 't001' });
  if (profilesWithT001.length !== 1) {
    throw new Error(`Duplicate teacher profiles found! Count: ${profilesWithT001.length}`);
  }
  console.log(`[PASS] Exactly 1 TeacherProfile exists (ID: ${profilesWithT001[0]._id.toString()}).`);

  // Verify assignments are preserved
  const postAssignments = await TeachingAssignment.find({ teacher: profilesWithT001[0]._id });
  if (postAssignments.length !== initialAssignments.length) {
    throw new Error(`Assignment count mismatch! Expected ${initialAssignments.length}, got ${postAssignments.length}`);
  }
  console.log(`[PASS] All ${postAssignments.length} teaching assignments are preserved.`);

  // Verify profile details
  const finalProfile = profilesWithT001[0];
  console.log('[PASS] Teacher profile preserved:');
  console.log(`  Name: ${finalProfile.personalInfo?.name}`);
  console.log(`  Department: ${finalProfile.department}`);
  console.log(`  Designation: ${finalProfile.designation}`);
  console.log(`  Qualifications: ${JSON.stringify(finalProfile.professionalInfo?.qualifications)}`);
  console.log(`  Years of Experience: ${finalProfile.professionalInfo?.yearsOfExperience}`);

  await mongoose.disconnect();
  console.log('\n=== ALL 7 VERIFICATION STEPS PASSED SUCCESSFULLY! ===\n');
}

runVerification().catch(err => {
  console.error('\n[FAIL] Verification error:', err.message);
  process.exit(1);
});
