const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const http = require('http');

const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const authRoutes = require('../routes/authRoutes');

const runSuite = async () => {
  console.log('================================================================');
  console.log(' STARTING TEACHER LOGIN DIAGNOSTIC & VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  let testCount = 0;
  let passCount = 0;

  const assert = (title, condition, details = '') => {
    testCount++;
    if (condition) {
      console.log(`[PASS] Test ${testCount}: ${title}`);
      passCount++;
    } else {
      console.error(`[FAIL] Test ${testCount}: ${title}`);
      if (details) console.error(`       Details: ${details}`);
    }
  };

  // Create test express app
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test_session_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  app.use('/api/auth', authRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const request = (method, path, body = null, cookie = null) => {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const headers = { 'Content-Type': 'application/json' };
      if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
      if (cookie) headers['Cookie'] = cookie;

      const req = http.request({ hostname: 'localhost', port, path, method, headers }, (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
          const setCookie = res.headers['set-cookie'];
          const extractedCookie = setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : null;
          resolve({ status: res.statusCode, headers: res.headers, cookie: extractedCookie, body: parsed });
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  };

  // Set up mock data
  const teacherPassword = 'TeacherSecretPassword123!';
  const hashedPassword = await bcrypt.hash(teacherPassword, 10);
  const institutionId = new mongoose.Types.ObjectId();

  const mockTeacherUser = new User({
    _id: new mongoose.Types.ObjectId(),
    userId: 't001',
    password: hashedPassword,
    role: 'teacher',
    name: 'Dr. Jane Teacher',
    email: 'jane.teacher@studypoint.edu',
    institution: institutionId,
    isActive: true,
    mustChangePassword: false
  });

  const mockInactiveTeacherUser = new User({
    _id: new mongoose.Types.ObjectId(),
    userId: 't002_inactive',
    password: hashedPassword,
    role: 'teacher',
    name: 'Inactive Teacher',
    email: 'inactive.teacher@studypoint.edu',
    institution: institutionId,
    isActive: false,
    mustChangePassword: false
  });

  const mockAdminUser = new User({
    _id: new mongoose.Types.ObjectId(),
    userId: '0001',
    password: hashedPassword,
    role: 'admin',
    name: 'System Admin',
    email: 'admin@studypoint.edu',
    institution: institutionId,
    isActive: true,
    mustChangePassword: false
  });

  const mockStudentUser = new User({
    _id: new mongoose.Types.ObjectId(),
    userId: 's1001',
    password: hashedPassword,
    role: 'student',
    name: 'Alex Student',
    email: 'alex.student@studypoint.edu',
    institution: institutionId,
    isActive: true,
    mustChangePassword: false
  });

  // Mock TeacherProfile linking to mockTeacherUser
  const mockTeacherProfile = {
    _id: new mongoose.Types.ObjectId(),
    institution: institutionId,
    user: mockTeacherUser,
    teacherId: 'TCH-1001',
    department: 'Computer Science and Engineering',
    designation: 'Associate Professor',
    personalInfo: {
      name: 'Dr. Jane Teacher',
      email: 'jane.teacher@studypoint.edu'
    }
  };

  // Original stubs
  const originalReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  const originalUserFindOne = User.findOne;
  const originalUserFindById = User.findById;
  const originalTeacherProfileFindOne = TeacherProfile.findOne;

  // Set DB connected
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

  User.findOne = function (query) {
    if (query.$or) {
      for (const item of query.$or) {
        if (item.userId === 't001' || item.email === 't001' || item.email === 'jane.teacher@studypoint.edu') return Promise.resolve(mockTeacherUser);
        if (item.userId === 't002_inactive' || item.email === 't002_inactive') return Promise.resolve(mockInactiveTeacherUser);
        if (item.userId === '0001' || item.email === '0001') return Promise.resolve(mockAdminUser);
        if (item.userId === 's1001' || item.email === 's1001') return Promise.resolve(mockStudentUser);
      }
      return Promise.resolve(null);
    }
    if (query.userId === 't001') return Promise.resolve(mockTeacherUser);
    if (query.userId === 't002_inactive') return Promise.resolve(mockInactiveTeacherUser);
    if (query.userId === '0001') return Promise.resolve(mockAdminUser);
    if (query.userId === 's1001') return Promise.resolve(mockStudentUser);
    return Promise.resolve(null);
  };

  User.findById = function (id) {
    const idStr = id.toString();
    if (idStr === mockTeacherUser._id.toString()) return { populate: () => Promise.resolve(mockTeacherUser) };
    if (idStr === mockAdminUser._id.toString()) return { populate: () => Promise.resolve(mockAdminUser) };
    if (idStr === mockStudentUser._id.toString()) return { populate: () => Promise.resolve(mockStudentUser) };
    return { populate: () => Promise.resolve(null) };
  };

  TeacherProfile.findOne = function (query) {
    if (query.$or) {
      for (const item of query.$or) {
        if (item.teacherId === 'tch-1001' || item.teacherId === 'TCH-1001') {
          return { populate: () => Promise.resolve(mockTeacherProfile) };
        }
        if (item['personalInfo.email'] === 'jane.teacher@studypoint.edu') {
          return { populate: () => Promise.resolve(mockTeacherProfile) };
        }
      }
    }
    if (query.user && query.user.toString() === mockTeacherUser._id.toString()) {
      return Promise.resolve(mockTeacherProfile);
    }
    return { populate: () => Promise.resolve(null) };
  };

  try {
    // -------------------------------------------------------------
    // Test Case 1: Valid teacher account with correct password
    // -------------------------------------------------------------
    console.log('--- TEST 1: Valid Teacher Account with Correct Password ---');
    const res1a = await request('POST', '/api/auth/login', {
      userId: 't001',
      password: teacherPassword,
      role: 'teacher'
    });
    assert(
      'Valid teacher login via User.userId returns HTTP 200, sets session cookie, and returns user payload',
      res1a.status === 200 && res1a.body.success === true && res1a.body.user?.role === 'teacher' && Boolean(res1a.cookie),
      JSON.stringify(res1a.body)
    );

    // Verify session restoration
    const sessionRes = await request('GET', '/api/auth/me', null, res1a.cookie);
    assert(
      'Active teacher session is recognized via GET /api/auth/me with role "teacher"',
      sessionRes.status === 200 && sessionRes.body.user?.role === 'teacher',
      JSON.stringify(sessionRes.body)
    );

    // Teacher ID entered via TeacherProfile relationship (e.g. 'TCH-1001')
    const res1b = await request('POST', '/api/auth/login', {
      userId: 'TCH-1001',
      password: teacherPassword,
      role: 'teacher'
    });
    assert(
      'Teacher login via TeacherProfile.teacherId (TCH-1001) resolves linked user and returns HTTP 200',
      res1b.status === 200 && res1b.body.success === true && res1b.body.user?.userId === 't001',
      JSON.stringify(res1b.body)
    );

    // -------------------------------------------------------------
    // Test Case 2: Incorrect password
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Incorrect Password ---');
    const res2 = await request('POST', '/api/auth/login', {
      userId: 't001',
      password: 'WrongPassword999!',
      role: 'teacher'
    });
    assert(
      'Incorrect password returns HTTP 401 with safe error message',
      res2.status === 401 && res2.body.success === false && res2.body.error === 'Invalid credentials. Please verify your ID and password.',
      JSON.stringify(res2.body)
    );

    // -------------------------------------------------------------
    // Test Case 3: Nonexistent Teacher ID
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Nonexistent Teacher ID ---');
    const res3 = await request('POST', '/api/auth/login', {
      userId: 'nonexistent_teacher_9999',
      password: 'SomePassword123!',
      role: 'teacher'
    });
    assert(
      'Nonexistent Teacher ID returns HTTP 401 without revealing internal state',
      res3.status === 401 && res3.body.success === false && res3.body.error === 'Invalid credentials. Please verify your ID and password.',
      JSON.stringify(res3.body)
    );

    // -------------------------------------------------------------
    // Test Case 4: Inactive teacher account
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Inactive Teacher Account ---');
    const res4 = await request('POST', '/api/auth/login', {
      userId: 't002_inactive',
      password: teacherPassword,
      role: 'teacher'
    });
    assert(
      'Inactive teacher account returns HTTP 403 with deactivation message',
      res4.status === 403 && res4.body.success === false && res4.body.error.includes('deactivated'),
      JSON.stringify(res4.body)
    );

    // -------------------------------------------------------------
    // Test Case 5: Account with incorrect role
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Account with Incorrect Role ---');
    // Admin attempting to login on Teacher card
    const res5a = await request('POST', '/api/auth/login', {
      userId: '0001',
      password: teacherPassword,
      role: 'teacher'
    });
    assert(
      'Admin ID submitted on Teacher card returns HTTP 401 with role mismatch message',
      res5a.status === 401 && res5a.body.success === false && res5a.body.error.includes('does not match'),
      JSON.stringify(res5a.body)
    );

    // Student attempting to login on Teacher card
    const res5b = await request('POST', '/api/auth/login', {
      userId: 's1001',
      password: teacherPassword,
      role: 'teacher'
    });
    assert(
      'Student ID submitted on Teacher card returns HTTP 401 with role mismatch message',
      res5b.status === 401 && res5b.body.success === false && res5b.body.error.includes('does not match'),
      JSON.stringify(res5b.body)
    );

    // -------------------------------------------------------------
    // Test Case 6: Database connection failure handling
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Database Connection Failure Handling ---');
    // Simulate database disconnected state (readyState: 0)
    Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

    const res6 = await request('POST', '/api/auth/login', {
      userId: 't001',
      password: teacherPassword,
      role: 'teacher'
    });
    assert(
      'Database connection failure returns HTTP 503 Service Unavailable with friendly message instead of 500 error',
      res6.status === 503 && res6.body.success === false && res6.body.error === 'Database service is temporarily unavailable. Please try again in a few moments.',
      JSON.stringify(res6.body)
    );

    // Restore readyState for subsequent tests
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    // -------------------------------------------------------------
    // Test Case 7: Redirection logic verification
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Redirection to Teacher Dashboard ---');
    // In App.jsx, handleLoginSuccess checks res.user.role:
    // if (res.user.role === 'teacher') navigate('/teacher/dashboard', { replace: true });
    const teacherLoginRes = await request('POST', '/api/auth/login', {
      userId: 't001',
      password: teacherPassword,
      role: 'teacher'
    });
    const destinationMap = {
      admin: '/admin/dashboard',
      teacher: '/teacher/dashboard',
      student: '/student/dashboard'
    };
    const targetDashboard = destinationMap[teacherLoginRes.body.user?.role];
    assert(
      'Authenticated teacher response maps to destination "/teacher/dashboard"',
      teacherLoginRes.status === 200 && targetDashboard === '/teacher/dashboard',
      `Mapped destination: ${targetDashboard}`
    );

    // -------------------------------------------------------------
    // Test Case 8: Student and Admin Login still work
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Student and Admin Login Integrity ---');
    // Admin login
    const adminRes = await request('POST', '/api/auth/login', {
      userId: '0001',
      password: teacherPassword,
      role: 'admin'
    });
    assert(
      'Admin login functions properly with HTTP 200 and role "admin"',
      adminRes.status === 200 && adminRes.body.success === true && adminRes.body.user?.role === 'admin',
      JSON.stringify(adminRes.body)
    );

    // Student login
    const studentRes = await request('POST', '/api/auth/login', {
      userId: 's1001',
      password: teacherPassword,
      role: 'student'
    });
    assert(
      'Student login functions properly with HTTP 200 and role "student"',
      studentRes.status === 200 && studentRes.body.success === true && studentRes.body.user?.role === 'student',
      JSON.stringify(studentRes.body)
    );

    // Input validation: empty credentials
    const emptyCreds = await request('POST', '/api/auth/login', {
      userId: '',
      password: '',
      role: 'teacher'
    });
    assert(
      'Empty credentials rejected with HTTP 400',
      emptyCreds.status === 400 && emptyCreds.body.success === false,
      JSON.stringify(emptyCreds.body)
    );

    // Invalid role enumeration
    const invalidRole = await request('POST', '/api/auth/login', {
      userId: 't001',
      password: teacherPassword,
      role: 'superhacker'
    });
    assert(
      'Invalid role enum rejected with HTTP 400',
      invalidRole.status === 400 && invalidRole.body.success === false,
      JSON.stringify(invalidRole.body)
    );

    console.log('\n================================================================');
    console.log(` SUITE SUMMARY: ${passCount}/${testCount} TESTS PASSED`);
    console.log('================================================================\n');

    if (passCount === testCount) {
      console.log('ALL VERIFICATION CRITERIA SUCCESSFULLY SATISFIED.\n');
    } else {
      throw new Error(`Only ${passCount}/${testCount} tests passed.`);
    }
  } finally {
    // Restore stubs
    if (originalReadyState) {
      Object.defineProperty(mongoose.connection, 'readyState', originalReadyState);
    }
    User.findOne = originalUserFindOne;
    User.findById = originalUserFindById;
    TeacherProfile.findOne = originalTeacherProfileFindOne;

    await new Promise((resolve) => server.close(resolve));
  }
};

runSuite().catch((err) => {
  console.error('Suite error:', err);
  process.exit(1);
});
