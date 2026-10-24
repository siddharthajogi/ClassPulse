const http = require('http');

function req(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      ...(cookie ? { 'Cookie': cookie } : {})
    };

    const r = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) { json = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          setCookie: res.headers['set-cookie'],
          body: json
        });
      });
    });

    r.on('error', reject);
    if (postData) r.write(postData);
    r.end();
  });
}

function getCookie(res) {
  if (!res.setCookie || !res.setCookie.length) return '';
  return res.setCookie[0].split(';')[0];
}

async function runVerification() {
  console.log('===============================================================');
  console.log('   STUDY POINT AUTHENTICATION & ROUTE VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title, condition, details = '') {
    total++;
    if (condition) {
      console.log(`[PASS] #${total}: ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] #${total}: ${title} -> ${details}`);
    }
  }

  // 1. Unauthenticated root request
  const unauthMe = await req('GET', '/api/auth/me');
  assert('Unauthenticated user receives 401 on /api/auth/me',
    unauthMe.status === 401 && unauthMe.body.success === false,
    JSON.stringify(unauthMe.body)
  );

  // 2. Direct Admin Dashboard API access while logged out
  const unauthAdmin = await req('GET', '/api/admin/dashboard/stats');
  assert('Direct Admin Dashboard access while logged out is blocked with 401',
    unauthAdmin.status === 401 && unauthAdmin.body.success === false,
    JSON.stringify(unauthAdmin.body)
  );

  // 3. Invalid credentials test
  const invalidLogin = await req('POST', '/api/auth/login', {
    userId: '0001',
    password: 'WrongPassword999!',
    role: 'admin'
  });
  assert('Invalid credentials rejected with 401',
    invalidLogin.status === 401 && invalidLogin.body.success === false,
    JSON.stringify(invalidLogin.body)
  );

  // 4. Role mismatch rejection
  const roleMismatch = await req('POST', '/api/auth/login', {
    userId: '0001',
    password: 'StudyPoint@Admin2026',
    role: 'student'
  });
  assert('Role mismatch rejected with 401',
    roleMismatch.status === 401 && roleMismatch.body.error && roleMismatch.body.error.includes('role'),
    JSON.stringify(roleMismatch.body)
  );

  // 5. Successful Admin login
  const adminLogin = await req('POST', '/api/auth/login', {
    userId: '0001',
    password: 'StudyPoint@Admin2026',
    role: 'admin'
  });
  const adminCookie = getCookie(adminLogin);
  assert('Admin login succeeds with 200 and issues session cookie',
    adminLogin.status === 200 && adminLogin.body.success === true && adminLogin.body.user.role === 'admin' && Boolean(adminCookie),
    JSON.stringify(adminLogin.body)
  );

  // 6. Authenticated Admin session verification (refresh simulation)
  const adminMe = await req('GET', '/api/auth/me', null, adminCookie);
  assert('Authenticated Admin session verified on refresh via /api/auth/me',
    adminMe.status === 200 && adminMe.body.user.role === 'admin' && adminMe.body.user.userId === '0001',
    JSON.stringify(adminMe.body)
  );

  // 7. Admin Dashboard stats accessible with valid admin session
  const adminStats = await req('GET', '/api/admin/dashboard/stats', null, adminCookie);
  assert('Admin Dashboard stats accessible with valid session',
    adminStats.status === 200 && adminStats.body.success === true,
    JSON.stringify(adminStats.body)
  );

  // 8. Logout test - verifies cookie cleared with matching attributes
  const logoutRes = await req('POST', '/api/auth/logout', {}, adminCookie);
  const clearedCookieHeader = logoutRes.setCookie ? logoutRes.setCookie[0] : '';
  assert('Logout destroys session and sends proper Set-Cookie clear header with HttpOnly and SameSite',
    logoutRes.status === 200 &&
    clearedCookieHeader.includes('Expires=Thu, 01 Jan 1970') &&
    clearedCookieHeader.toLowerCase().includes('httponly') &&
    clearedCookieHeader.toLowerCase().includes('samesite'),
    clearedCookieHeader
  );

  // 9. Reopening /api/auth/me after logout
  const meAfterLogout = await req('GET', '/api/auth/me', null, adminCookie);
  assert('Reopening after logout returns 401 Authentication required',
    meAfterLogout.status === 401 && meAfterLogout.body.success === false,
    JSON.stringify(meAfterLogout.body)
  );

  // 10. Direct Admin Dashboard access after logout
  const adminAfterLogout = await req('GET', '/api/admin/dashboard/stats', null, adminCookie);
  assert('Accessing Admin Dashboard after logout is rejected with 401',
    adminAfterLogout.status === 401 && adminAfterLogout.body.success === false,
    JSON.stringify(adminAfterLogout.body)
  );

  console.log('\n===============================================================');
  console.log(`RESULTS: ${passed} / ${total} tests passed.`);
  console.log('===============================================================');
}

runVerification().catch(console.error);
