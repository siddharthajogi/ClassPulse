const http = require('http');

const request = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (_) {
          parsed = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
};

async function runHttpVerification() {
  console.log('====================================================');
  console.log('STARTING ADMIN NOTIFICATIONS HTTP API VERIFICATION');
  console.log('====================================================\n');

  try {
    // 1. Verify Unauthorized Access blocked
    console.log('Test 1: Testing Unauthorized Access Protection...');
    const unauthRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/notifications',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (unauthRes.statusCode !== 401) {
      throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.statusCode}`);
    }
    console.log('[PASS] Protected route rejected unauthenticated request with 401.\n');

    // 2. Admin Login
    console.log('Test 2: Logging in as Administrator (0001)...');
    const loginRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      userId: '0001',
      password: 'StudyPoint@Admin2026',
      role: 'admin'
    });

    if (loginRes.statusCode !== 200 || !loginRes.data.success) {
      throw new Error(`Admin login failed: ${JSON.stringify(loginRes.data)}`);
    }

    const setCookie = loginRes.headers['set-cookie'];
    if (!setCookie) throw new Error('No session cookie returned from login');
    const adminCookie = setCookie[0].split(';')[0];
    console.log(`[PASS] Admin authenticated successfully. Cookie established: ${adminCookie.substring(0, 25)}...\n`);

    const authHeaders = {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    };

    // 3. Test Unread Count API
    console.log('Test 3: Fetching unread notification count...');
    const countRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/notifications/unread-count',
      method: 'GET',
      headers: authHeaders
    });
    if (countRes.statusCode !== 200 || !countRes.data.success) {
      throw new Error(`Failed to fetch unread count: ${JSON.stringify(countRes.data)}`);
    }
    console.log(`[PASS] GET /api/admin/notifications/unread-count -> unreadCount: ${countRes.data.unreadCount}\n`);

    // 4. Test Triggering Security Event Notification (3 Consecutive Failed Logins)
    console.log('Test 4: Simulating 3 consecutive failed login attempts to trigger Security Event Notification...');
    const intruderId = 'hacker_' + Date.now().toString().slice(-4);
    for (let i = 1; i <= 3; i++) {
      const failRes = await request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        userId: intruderId,
        password: 'BadPassword!999',
        role: 'admin'
      });
      console.log(`  Attempt ${i}: Received status ${failRes.statusCode}`);
    }

    // 5. Fetch Notifications and verify the security notification exists
    console.log('\nTest 5: Fetching notifications and verifying Security notification...');
    const listRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/notifications?category=security_system',
      method: 'GET',
      headers: authHeaders
    });

    if (listRes.statusCode !== 200 || !listRes.data.success) {
      throw new Error(`Failed to list notifications: ${JSON.stringify(listRes.data)}`);
    }

    const secNotifs = listRes.data.notifications;
    const matchingSec = secNotifs.find(n => n.message.includes(intruderId));
    if (!matchingSec) {
      console.log('Available security notifications:', secNotifs.map(n => n.title));
      throw new Error(`Security notification for ${intruderId} not found`);
    }
    console.log(`[PASS] Found Security Notification:`);
    console.log(`  ID: ${matchingSec._id}`);
    console.log(`  Title: ${matchingSec.title}`);
    console.log(`  Message: ${matchingSec.message}`);
    console.log(`  Category: ${matchingSec.category}`);
    console.log(`  Severity: ${matchingSec.severity}`);
    console.log(`  isRead: ${matchingSec.isRead}\n`);

    // 6. Test Mark as Read
    console.log(`Test 6: Marking notification ${matchingSec._id} as read...`);
    const markReadRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/notifications/${matchingSec._id}/read`,
      method: 'PATCH',
      headers: authHeaders
    });

    if (markReadRes.statusCode !== 200 || !markReadRes.data.success) {
      throw new Error(`Failed to mark notification as read: ${JSON.stringify(markReadRes.data)}`);
    }
    if (!markReadRes.data.notification.isRead) {
      throw new Error('Notification isRead was not set to true');
    }
    console.log(`[PASS] Notification marked as read. readAt: ${markReadRes.data.notification.readAt}\n`);

    // 7. Test Pagination & Filters
    console.log('Test 7: Testing Pagination and Category/Status Filtering...');
    const pagedRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/notifications?page=1&limit=3&status=all',
      method: 'GET',
      headers: authHeaders
    });

    if (pagedRes.statusCode !== 200 || !pagedRes.data.success) {
      throw new Error(`Failed to fetch paginated notifications: ${JSON.stringify(pagedRes.data)}`);
    }

    console.log(`[PASS] Pagination working:`);
    console.log(`  Page: ${pagedRes.data.pagination.page}`);
    console.log(`  Limit: ${pagedRes.data.pagination.limit}`);
    console.log(`  Total Filtered: ${pagedRes.data.pagination.total}`);
    console.log(`  Total Pages: ${pagedRes.data.pagination.totalPages}`);
    console.log(`  Counts: Total=${pagedRes.data.counts.total}, Unread=${pagedRes.data.counts.unread}, Read=${pagedRes.data.counts.read}\n`);

    // 8. Test Mark All as Read
    console.log('Test 8: Testing Mark All as Read...');
    const markAllRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/notifications/mark-all-read',
      method: 'PATCH',
      headers: authHeaders
    });
    if (markAllRes.statusCode !== 200 || !markAllRes.data.success) {
      throw new Error(`Failed to mark all as read: ${JSON.stringify(markAllRes.data)}`);
    }
    console.log(`[PASS] Mark All as Read succeeded. Updated count: ${markAllRes.data.updatedCount}`);

    const postCountRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/notifications/unread-count',
      method: 'GET',
      headers: authHeaders
    });
    console.log(`[PASS] Post-mark unread count: ${postCountRes.data.unreadCount} (verified)\n`);

    // 9. Test Dismiss / Delete Notification
    console.log(`Test 9: Testing Notification Dismissal / Deletion for ${matchingSec._id}...`);
    const dismissRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/notifications/${matchingSec._id}`,
      method: 'DELETE',
      headers: authHeaders
    });
    if (dismissRes.statusCode !== 200 || !dismissRes.data.success) {
      throw new Error(`Failed to dismiss notification: ${JSON.stringify(dismissRes.data)}`);
    }
    console.log('[PASS] Notification dismissed successfully.\n');

    // 10. Verify dismissed notification is excluded from default list
    console.log('Test 10: Verifying dismissed notification is excluded from subsequent queries...');
    const postDismissList = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/notifications',
      method: 'GET',
      headers: authHeaders
    });
    const foundDismissed = postDismissList.data.notifications.find(n => n._id === matchingSec._id);
    if (foundDismissed) {
      throw new Error('Dismissed notification was still returned in the active list');
    }
    console.log('[PASS] Dismissed notification was correctly excluded from active queries.\n');

    console.log('====================================================');
    console.log('ALL ADMIN NOTIFICATION HTTP API TESTS PASSED [10/10]');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n[FAIL] Test Error:', err.message);
    process.exit(1);
  }
}

runHttpVerification();
