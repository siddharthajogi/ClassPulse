const http = require('http');

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

const runTests = async () => {
  console.log('=== STARTING AUTOMATED AUTH VERIFICATION SUITE (ADMIN ID: 0001) ===\n');
  let testCount = 0;
  let passedCount = 0;

  const assert = (name, condition, details = '') => {
    testCount++;
    if (condition) {
      console.log(`[PASS] Test ${testCount}: ${name}`);
      passedCount++;
    } else {
      console.error(`[FAIL] Test ${testCount}: ${name} - ${details}`);
    }
  };

  try {
    // 1. Health check
    const health = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
    assert('Health-check endpoint returns status 200 and connected DB',
      health.statusCode === 200 && health.body.database?.connected === true,
      JSON.stringify(health.body)
    );

    // 2. Reject missing credentials
    const missingCreds = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST'
    }, JSON.stringify({ userId: '', password: '', role: 'admin' }));
    assert('Reject empty credentials with 400', missingCreds.statusCode === 400);

    // 3. Reject invalid role
    const invalidRole = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST'
    }, JSON.stringify({ userId: '0001', password: 'StudyPoint@Admin2026', role: 'superadmin' }));
    assert('Reject invalid role enum with 400', invalidRole.statusCode === 400);

    // 4. Reject non-existent student ID
    const nonExistent = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST'
    }, JSON.stringify({ userId: 'student_ghost_999', password: 'SomePassword123!', role: 'student' }));
    assert('Reject non-existent student ID with 401', nonExistent.statusCode === 401);

    // 5. Verify old/legacy Admin ID "admin" no longer works after migration
    const legacyAdminAttempt = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST'
    }, JSON.stringify({ userId: 'admin', password: 'StudyPoint@Admin2026', role: 'admin' }));
    assert('Legacy Admin ID "admin" is rejected with 401 after migration', legacyAdminAttempt.statusCode === 401);

    // 6. Reject role mismatch (using Admin ID 0001 on teacher card)
    const roleMismatch = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST'
    }, JSON.stringify({ userId: '0001', password: 'StudyPoint@Admin2026', role: 'teacher' }));
    assert('Reject role mismatch (Admin ID 0001 submitted on teacher card) with 401',
      roleMismatch.statusCode === 401 && roleMismatch.body.error?.includes('role'),
      JSON.stringify(roleMismatch.body)
    );

    // 7. Reject incorrect password for Admin ID 0001
    const wrongPass = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST'
    }, JSON.stringify({ userId: '0001', password: 'IncorrectPassword999!', role: 'admin' }));
    assert('Reject incorrect password for 0001 with 401', wrongPass.statusCode === 401);

    // 8. Successful initial login with Admin ID 0001
    const adminLogin = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST'
    }, JSON.stringify({ userId: '0001', password: 'StudyPoint@Admin2026', role: 'admin' }));
    const sessionCookie = adminLogin.cookie;
    assert('Admin 0001 logs in with 200, session cookie set, and mustChangePassword=true',
      adminLogin.statusCode === 200 &&
      adminLogin.body.user?.userId === '0001' &&
      adminLogin.body.user?.role === 'admin' &&
      adminLogin.body.user?.mustChangePassword === true &&
      Boolean(sessionCookie),
      JSON.stringify(adminLogin.body)
    );

    // 9. Session check (/api/auth/me) restores 0001
    const meCheck = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/me',
      method: 'GET'
    }, null, sessionCookie);
    assert('GET /api/auth/me restores authenticated user session with userId 0001',
      meCheck.statusCode === 200 && meCheck.body.user?.userId === '0001',
      JSON.stringify(meCheck.body)
    );

    // 10. Block Admin Dashboard access before password change
    const blockedDashboard = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/dashboard',
      method: 'GET'
    }, null, sessionCookie);
    assert('Admin Dashboard access blocked with 403 when mustChangePassword=true',
      blockedDashboard.statusCode === 403 && blockedDashboard.body.mustChangePassword === true,
      JSON.stringify(blockedDashboard.body)
    );

    // 11. Reject password change with incorrect current password
    const wrongCurrent = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/change-password',
      method: 'PUT'
    }, JSON.stringify({
      currentPassword: 'WrongOldPassword123!',
      newPassword: 'AdminNewPassword2026#',
      confirmPassword: 'AdminNewPassword2026#'
    }), sessionCookie);
    assert('Reject password change when current password is wrong (400)',
      wrongCurrent.statusCode === 400 && wrongCurrent.body.error?.toLowerCase().includes('current'),
      JSON.stringify(wrongCurrent.body)
    );

    // 12. Reject password change with mismatched confirmation
    const mismatchConfirm = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/change-password',
      method: 'PUT'
    }, JSON.stringify({
      currentPassword: 'StudyPoint@Admin2026',
      newPassword: 'AdminNewPassword2026#',
      confirmPassword: 'DifferentPassword2026#'
    }), sessionCookie);
    assert('Reject mismatched password confirmation (400)',
      mismatchConfirm.statusCode === 400 && mismatchConfirm.body.error?.includes('match'),
      JSON.stringify(mismatchConfirm.body)
    );

    // 13. Reject weak new password failing policy check
    const weakPass = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/change-password',
      method: 'PUT'
    }, JSON.stringify({
      currentPassword: 'StudyPoint@Admin2026',
      newPassword: 'short',
      confirmPassword: 'short'
    }), sessionCookie);
    assert('Reject weak new password failing policy check (400)',
      weakPass.statusCode === 400,
      JSON.stringify(weakPass.body)
    );

    // 14. Successful password change
    const changeSuccess = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/change-password',
      method: 'PUT'
    }, JSON.stringify({
      currentPassword: 'StudyPoint@Admin2026',
      newPassword: 'StudyPoint@NewAdmin2026',
      confirmPassword: 'StudyPoint@NewAdmin2026'
    }), sessionCookie);
    assert('Successfully change admin password, clearing mustChangePassword',
      changeSuccess.statusCode === 200 && changeSuccess.body.user?.mustChangePassword === false,
      JSON.stringify(changeSuccess.body)
    );

    // 15. Access Admin Dashboard now allowed and returns "Welcome, Admin!"
    const allowedDashboard = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/dashboard',
      method: 'GET'
    }, null, sessionCookie);
    assert('Admin Dashboard granted with 200 and message "Welcome, Admin!"',
      allowedDashboard.statusCode === 200 && allowedDashboard.body.message === 'Welcome, Admin!',
      JSON.stringify(allowedDashboard.body)
    );

    // 16. Verify old password no longer works
    const oldLoginFail = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST'
    }, JSON.stringify({ userId: '0001', password: 'StudyPoint@Admin2026', role: 'admin' }));
    assert('Old password rejected after password change (401)', oldLoginFail.statusCode === 401);

    // 17. Verify new password works for login with 0001
    const newLoginSuccess = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST'
    }, JSON.stringify({ userId: '0001', password: 'StudyPoint@NewAdmin2026', role: 'admin' }));
    const newSessionCookie = newLoginSuccess.cookie;
    assert('New password successfully logs in 0001 (200) with mustChangePassword=false',
      newLoginSuccess.statusCode === 200 && newLoginSuccess.body.user?.mustChangePassword === false,
      JSON.stringify(newLoginSuccess.body)
    );

    // 18. Logout destroys session
    const logoutRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/logout',
      method: 'POST'
    }, null, newSessionCookie);
    assert('Logout returns 200 and destroys session', logoutRes.statusCode === 200);

    // 19. Accessing protected endpoint after logout is rejected
    const postLogoutCheck = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/dashboard',
      method: 'GET'
    }, null, newSessionCookie);
    assert('Admin Dashboard access rejected with 401 after logout', postLogoutCheck.statusCode === 401);

    // Reset password back to initial seed password so fresh dev testing and user credentials match exact specification!
    const reLogin = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST'
    }, JSON.stringify({ userId: '0001', password: 'StudyPoint@NewAdmin2026', role: 'admin' }));
    await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/change-password',
      method: 'PUT'
    }, JSON.stringify({
      currentPassword: 'StudyPoint@NewAdmin2026',
      newPassword: 'StudyPoint@Admin2026',
      confirmPassword: 'StudyPoint@Admin2026'
    }), reLogin.cookie);

    // Re-set mustChangePassword = true in database for fresh user testing
    const mongoose = require('mongoose');
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('../models/User');
    await User.updateOne({ userId: '0001' }, { mustChangePassword: true });
    await mongoose.disconnect();
    console.log('[Setup] Admin 0001 reset back to initial seed credentials with mustChangePassword=true for user testing.');

    console.log(`\n=== SUITE COMPLETE: ${passedCount}/${testCount} TESTS PASSED ===\n`);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
};

runTests();
