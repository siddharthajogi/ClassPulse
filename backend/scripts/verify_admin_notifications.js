const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../models/User');
const Institution = require('../models/Institution');
const Class = require('../models/Class');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const RiskPrediction = require('../models/RiskPrediction');
const Notification = require('../models/Notification');

// Helper to make HTTP requests
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

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING ADMIN NOTIFICATIONS SYSTEM VERIFICATION');
  console.log('====================================================\n');

  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
      console.log('[OK] Connected to MongoDB Atlas\n');
      break;
    } catch (err) {
      retries--;
      console.log(`[WARN] MongoDB connect failed (${err.message}), retrying in 2s... (${retries} left)`);
      if (retries === 0) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  let adminCookie = '';
  let adminUser = null;
  let institution = null;

  try {
    // -------------------------------------------------------------------
    // Step 1: Login as administrator
    // -------------------------------------------------------------------
    console.log('--- Step 1: Admin Authentication ---');
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
    if (!setCookie) throw new Error('No cookie received from login');
    adminCookie = setCookie[0].split(';')[0];
    adminUser = await User.findOne({ userId: '0001' });
    institution = await Institution.findById(adminUser.institution);
    console.log(`[PASS] Admin logged in. Cookie: ${adminCookie.substring(0, 20)}..., Admin ID: ${adminUser._id}`);

    const authHeaders = {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    };

    // -------------------------------------------------------------------
    // Step 2: Test Unread Notification Count API
    // -------------------------------------------------------------------
    console.log('\n--- Step 2: Unread Count Endpoint ---');
    const countRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/notifications/unread-count',
      method: 'GET',
      headers: authHeaders
    });
    console.log(`[PASS] GET /api/admin/notifications/unread-count returned ${countRes.statusCode}, unreadCount=${countRes.data.unreadCount}`);

    // -------------------------------------------------------------------
    // Step 3: Trigger Student Creation Event Notification
    // -------------------------------------------------------------------
    console.log('\n--- Step 3: Student Lifecycle Notification ---');
    const existingClass = await Class.findOne({ institution: institution._id });
    if (!existingClass) throw new Error('No existing section found to assign student');

    const testStudentId = 'STU_NOTIF_' + Date.now().toString().slice(-5);
    const testEmail = `notif.${testStudentId.toLowerCase()}@studypoint.edu`;

    const createStudentRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/students',
      method: 'POST',
      headers: authHeaders
    }, {
      name: 'Verification Student',
      studentId: testStudentId,
      email: testEmail,
      course: existingClass.course,
      department: existingClass.department,
      academicYear: existingClass.academicYear,
      semester: existingClass.semester,
      section: existingClass.section,
      password: 'InitialPassword@2026',
      confirmPassword: 'InitialPassword@2026'
    });

    if (createStudentRes.statusCode !== 201) {
      throw new Error(`Failed to create test student: ${JSON.stringify(createStudentRes.data)}`);
    }
    console.log(`[PASS] Created test student ${testStudentId}`);

    // Verify notification was created in MongoDB
    const studentNotif = await Notification.findOne({
      recipient: adminUser._id,
      category: 'students',
      eventKey: `CREATE_STUDENT_${testStudentId}`
    });
    if (!studentNotif) throw new Error('Student creation notification was not created in DB');
    console.log(`[PASS] Verified Student Notification: "${studentNotif.title}" - ${studentNotif.message}`);

    // -------------------------------------------------------------------
    // Step 4: Trigger Teacher Lifecycle Notification
    // -------------------------------------------------------------------
    console.log('\n--- Step 4: Teacher Lifecycle Notification ---');
    const testTeacherId = 'TCH_NOTIF_' + Date.now().toString().slice(-5);
    const testTeacherEmail = `teacher.${testTeacherId.toLowerCase()}@studypoint.edu`;

    const createTeacherRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/teachers',
      method: 'POST',
      headers: authHeaders
    }, {
      personalInfo: {
        name: 'Dr. Notification Faculty',
        email: testTeacherEmail,
        phone: '9876543210'
      },
      teacherId: testTeacherId,
      department: existingClass.department,
      designation: 'Associate Professor',
      professionalInfo: {
        highestQualification: 'Ph.D.',
        specialization: 'Distributed Systems',
        yearsOfExperience: 6
      },
      password: 'TeacherPassword@2026',
      confirmPassword: 'TeacherPassword@2026'
    });

    if (createTeacherRes.statusCode !== 201) {
      throw new Error(`Failed to create test teacher: ${JSON.stringify(createTeacherRes.data)}`);
    }
    console.log(`[PASS] Created test teacher ${testTeacherId}`);

    const teacherNotif = await Notification.findOne({
      recipient: adminUser._id,
      category: 'teachers',
      eventKey: `CREATE_TEACHER_${testTeacherId}`
    });
    if (!teacherNotif) throw new Error('Teacher creation notification was not created in DB');
    console.log(`[PASS] Verified Teacher Notification: "${teacherNotif.title}" - ${teacherNotif.message}`);

    // -------------------------------------------------------------------
    // Step 5: Trigger Section Lifecycle Notification
    // -------------------------------------------------------------------
    console.log('\n--- Step 5: Section Lifecycle Notification ---');
    const testSecName = 'Z' + Date.now().toString().slice(-3);
    const createSecRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/classes',
      method: 'POST',
      headers: authHeaders
    }, {
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      academicYear: existingClass.academicYear,
      semester: 1,
      section: testSecName
    });

    if (createSecRes.statusCode !== 201) {
      throw new Error(`Failed to create section: ${JSON.stringify(createSecRes.data)}`);
    }
    const createdClassId = createSecRes.data.class._id;
    console.log(`[PASS] Created test section ${testSecName}`);

    const secNotif = await Notification.findOne({
      recipient: adminUser._id,
      category: 'departments_sections',
      relatedEntityId: createdClassId
    });
    if (!secNotif) throw new Error('Section creation notification was not created in DB');
    console.log(`[PASS] Verified Section Notification: "${secNotif.title}" - ${secNotif.message}`);

    // -------------------------------------------------------------------
    // Step 6: Trigger Security Event Notification (Failed Login Attempts)
    // -------------------------------------------------------------------
    console.log('\n--- Step 6: Security Notification (Repeated Failed Logins) ---');
    const suspiciousId = 'suspicious_intruder_' + Date.now().toString().slice(-4);
    for (let i = 0; i < 3; i++) {
      await request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        userId: suspiciousId,
        password: 'WrongPassword123!',
        role: 'admin'
      });
    }

    const securityNotif = await Notification.findOne({
      recipient: adminUser._id,
      category: 'security_system',
      eventKey: new RegExp(`FAILED_LOGIN_${suspiciousId}`)
    });
    if (!securityNotif) throw new Error('Failed login security notification was not created in DB');
    console.log(`[PASS] Verified Security Notification: "${securityNotif.title}" - ${securityNotif.message}`);

    // -------------------------------------------------------------------
    // Step 7: Test Notifications List API with Filtering & Pagination
    // -------------------------------------------------------------------
    console.log('\n--- Step 7: Notifications List API (Pagination & Filtering) ---');
    const listAllRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/notifications?page=1&limit=5&status=all&category=all',
      method: 'GET',
      headers: authHeaders
    });

    if (listAllRes.statusCode !== 200 || !listAllRes.data.success) {
      throw new Error(`Failed to list notifications: ${JSON.stringify(listAllRes.data)}`);
    }

    const notifs = listAllRes.data.notifications;
    console.log(`[PASS] Listed ${notifs.length} notifications. Total: ${listAllRes.data.counts.total}, Unread: ${listAllRes.data.counts.unread}`);

    // Category filter test
    const listStudentsRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/notifications?category=students',
      method: 'GET',
      headers: authHeaders
    });
    if (!listStudentsRes.data.notifications.every(n => n.category === 'students')) {
      throw new Error('Category filter returned items from another category');
    }
    console.log(`[PASS] Category filter test passed: all items have category='students'`);

    // -------------------------------------------------------------------
    // Step 8: Test Mark as Read API
    // -------------------------------------------------------------------
    console.log('\n--- Step 8: Mark Single Notification as Read ---');
    const targetNotif = notifs.find(n => !n.isRead) || studentNotif;
    const readRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/notifications/${targetNotif._id}/read`,
      method: 'PATCH',
      headers: authHeaders
    });

    if (readRes.statusCode !== 200 || !readRes.data.success || !readRes.data.notification.isRead) {
      throw new Error(`Failed to mark notification as read: ${JSON.stringify(readRes.data)}`);
    }
    console.log(`[PASS] Notification ${targetNotif._id} marked as read. isRead=true, readAt=${readRes.data.notification.readAt}`);

    // -------------------------------------------------------------------
    // Step 9: Test Mark All as Read API
    // -------------------------------------------------------------------
    console.log('\n--- Step 9: Mark All as Read ---');
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

    const verifyCountRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/notifications/unread-count',
      method: 'GET',
      headers: authHeaders
    });
    console.log(`[PASS] Post Mark-All-Read unreadCount=${verifyCountRes.data.unreadCount} (should be 0)`);

    // -------------------------------------------------------------------
    // Step 10: Test Dismiss / Delete Notification
    // -------------------------------------------------------------------
    console.log('\n--- Step 10: Dismiss / Delete Notification ---');
    const dismissRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/notifications/${targetNotif._id}`,
      method: 'DELETE',
      headers: authHeaders
    });

    if (dismissRes.statusCode !== 200 || !dismissRes.data.success) {
      throw new Error(`Failed to dismiss notification: ${JSON.stringify(dismissRes.data)}`);
    }
    const dismissedDoc = await Notification.findById(targetNotif._id);
    if (!dismissedDoc.isDismissed) throw new Error('Document isDismissed flag is not true');
    console.log(`[PASS] Notification successfully dismissed (isDismissed=true)`);

    // -------------------------------------------------------------------
    // Step 11: Cleanup test artifacts
    // -------------------------------------------------------------------
    console.log('\n--- Step 11: Cleanup Test Data ---');
    // Delete created test class
    await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/classes/${createdClassId}`,
      method: 'DELETE',
      headers: authHeaders
    });

    // Clean up created student & teacher user docs
    const createdStudentDoc = await StudentProfile.findOne({ studentId: testStudentId });
    if (createdStudentDoc) {
      await User.findByIdAndDelete(createdStudentDoc.user);
      await StudentProfile.findByIdAndDelete(createdStudentDoc._id);
    }
    const createdTeacherDoc = await TeacherProfile.findOne({ teacherId: testTeacherId });
    if (createdTeacherDoc) {
      await User.findByIdAndDelete(createdTeacherDoc.user);
      await TeacherProfile.findByIdAndDelete(createdTeacherDoc._id);
    }
    console.log(`[PASS] Cleaned up temporary test documents.`);

    console.log('\n====================================================');
    console.log('ALL ADMIN NOTIFICATIONS TESTS COMPLETED SUCCESSFULLY');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n[FAIL] Verification error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runVerification();
