const http = require('http');
const fs = require('fs');
const path = require('path');

const request = (reqPath, method = 'GET', data = null, cookie = null) => {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: reqPath,
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
  console.log('======================================================================');
  console.log('  VERIFICATION TEST SUITE: HEADER, BREADCRUMBS, THEME & NOTIFICATIONS ');
  console.log('======================================================================\n');

  let totalTests = 0;
  let passedTests = 0;

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

  // 1. Authenticate as Admin
  console.log('--- 1. Authenticating as Administrator ---');
  const loginRes = await request('/api/auth/login', 'POST', {
    userId: '0001',
    password: 'StudyPoint@Admin2026',
    role: 'admin'
  });
  const cookie = loginRes.cookie;
  assert(Boolean(cookie), 'Admin authentication successful and session established');

  // 2. Verify Notifications API Integration
  console.log('\n--- 2. Verifying Notifications Backend Integration ---');
  const unreadRes = await request('/api/admin/notifications/unread-count', 'GET', null, cookie);
  assert(unreadRes.statusCode === 200, 'GET /api/admin/notifications/unread-count returns 200');
  assert(typeof unreadRes.body.unreadCount === 'number', 'unreadCount is a valid number');

  const notifListRes = await request('/api/admin/notifications?page=1&limit=5', 'GET', null, cookie);
  assert(notifListRes.statusCode === 200, 'GET /api/admin/notifications returns 200 OK');
  assert(Array.isArray(notifListRes.body.notifications), 'Notifications list is returned');

  // 3. Verify College Settings API Still Functional
  console.log('\n--- 3. Verifying College Settings Integration ---');
  const settingsRes = await request('/api/admin/institution/status', 'GET', null, cookie);
  assert(settingsRes.statusCode === 200, 'GET /api/admin/institution/status returns 200 OK');
  assert(settingsRes.body.success === true, 'College Settings API remains fully functional');

  // 4. Codebase Verification: Breadcrumbs removed
  console.log('\n--- 4. Codebase Inspection: Breadcrumb Removal ---');
  const adminLayoutPath = path.resolve(__dirname, '../../frontend/src/components/AdminLayout.jsx');
  const adminLayoutContent = fs.readFileSync(adminLayoutPath, 'utf8');

  assert(!adminLayoutContent.includes('aria-label="Breadcrumb"'), 'Breadcrumb navigation component completely removed from AdminLayout.jsx');
  assert(!adminLayoutContent.includes('Admin Portal >'), 'No "Admin Portal >" breadcrumb text remains in AdminLayout.jsx');
  assert(adminLayoutContent.includes('currentPageName'), 'Page title (currentPageName) preserved in top header');

  // 5. Codebase Verification: Top Header Notifications Control
  console.log('\n--- 5. Codebase Inspection: Top Header Notifications Control ---');
  assert(adminLayoutContent.includes('to="/admin/notifications"'), 'Notifications Link control exists in AdminLayout.jsx header');
  assert(adminLayoutContent.includes('<span>Notifications</span>'), 'Notifications label text accompanies bell icon');
  assert(adminLayoutContent.includes('<Bell'), 'Bell icon is rendered in Notifications navigation control');
  assert(adminLayoutContent.includes('unreadCount > 0'), 'Unread count badge rendered beside Notifications label/icon');

  // 6. Codebase Verification: College Info Card Notifications Button Removed
  console.log('\n--- 6. Codebase Inspection: College Info Card Notifications Button ---');
  const dashboardStatsPath = path.resolve(__dirname, '../../frontend/src/components/DashboardStats.jsx');
  const dashboardStatsContent = fs.readFileSync(dashboardStatsPath, 'utf8');

  assert(!dashboardStatsContent.includes('to="/admin/notifications"'), 'Notifications button completely removed from College Info Card');
  assert(dashboardStatsContent.includes('to="/admin/college-settings"'), 'College Settings button preserved in College Info Card');
  assert(dashboardStatsContent.includes('institutionName'), 'College name and info remain intact');

  // 7. Codebase Verification: Theme Dropdown Selector
  console.log('\n--- 7. Codebase Inspection: Theme Selector & Dropdown ---');
  assert(adminLayoutContent.includes('<span>Theme</span>'), 'Theme label displayed beside theme icon in top header');
  assert(adminLayoutContent.includes('isThemeOpen'), 'Theme dropdown state managed');
  assert(adminLayoutContent.includes('Light Mode') && adminLayoutContent.includes('Dark Mode'), 'Dropdown contains Light Mode and Dark Mode options');
  assert(adminLayoutContent.includes("setTheme('light')") && adminLayoutContent.includes("setTheme('dark')"), 'Dropdown triggers existing setTheme for Light and Dark');
  assert(adminLayoutContent.includes('<Check'), 'Active theme indicator (Check icon) present for selected theme');
  assert(adminLayoutContent.includes('Escape'), 'Escape key closes Theme dropdown');
  assert(adminLayoutContent.includes('handleClickOutside'), 'Click outside dismisses Theme dropdown');

  // 8. Theme Context Persistence Verification
  console.log('\n--- 8. Codebase Inspection: Theme Context & Persistence ---');
  const themeContextPath = path.resolve(__dirname, '../../frontend/src/context/ThemeContext.jsx');
  const themeContextContent = fs.readFileSync(themeContextPath, 'utf8');
  assert(themeContextContent.includes('study_point_theme'), 'Shared localStorage key study_point_theme used for persistence');
  assert(themeContextContent.includes('classList.add(\'dark\')'), 'Document root class updated dynamically on theme change');

  console.log('\n======================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('======================================================================\n');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});
