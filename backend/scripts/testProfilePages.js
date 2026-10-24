const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');

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
  console.log('=== VERIFYING STUDENT & TEACHER PROFILE ENDPOINTS & DATA PRESERVATION ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  try {
    // 1. Authenticate Admin
    console.log('--- Step 1: Admin Authentication ---');
    let adminLoginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: '0001', password: 'StudyPoint@Admin2026', role: 'admin' })
    );

    if (adminLoginRes.statusCode !== 200) {
      adminLoginRes = await makeRequest(
        { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
        JSON.stringify({ userId: '0001', password: 'StudyPoint@NewAdmin2026', role: 'admin' })
      );
    }

    if (adminLoginRes.statusCode !== 200 || !adminLoginRes.cookie) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.body)}`);
    }
    const adminCookie = adminLoginRes.cookie;
    console.log('[PASS] Admin authenticated successfully.\n');

    // 2. Test Unauthorized Access (Security Check)
    console.log('--- Step 2: Unauthorized Access Check ---');
    const unauthStudentRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/students', method: 'GET' }
    );
    if (unauthStudentRes.statusCode !== 401) {
      throw new Error(`Expected 401 Unauthorized without session cookie, got ${unauthStudentRes.statusCode}`);
    }
    console.log('[PASS] Unauthenticated student profile request rejected with 401.\n');

    // 3. Test Student Profile Fetching & Data Preservation
    console.log('--- Step 3: Student Profile Retrieval & Data Integrity ---');
    const existingStudent = await StudentProfile.findOne({ studentId: 's001' }).populate('user');
    if (!existingStudent) {
      throw new Error('Legacy student s001 not found in database');
    }

    // Capture state before API call to ensure zero data mutation
    const studentUserBefore = await User.findById(existingStudent.user._id);
    const studentProfileBefore = await StudentProfile.findById(existingStudent._id);

    const getStudentRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/students/${existingStudent._id}`, method: 'GET' },
      null,
      adminCookie
    );

    console.log('GET student status:', getStudentRes.statusCode);
    if (getStudentRes.statusCode !== 200 || !getStudentRes.body.success || !getStudentRes.body.student) {
      throw new Error(`Failed to fetch student by ID: ${JSON.stringify(getStudentRes.body)}`);
    }

    const fetchedStudent = getStudentRes.body.student;
    console.log('Fetched student fields:', {
      id: fetchedStudent._id,
      studentId: fetchedStudent.studentId,
      name: fetchedStudent.user?.name,
      department: fetchedStudent.department,
      course: fetchedStudent.course,
      semester: fetchedStudent.semester,
      academicYear: fetchedStudent.academicYear,
      section: fetchedStudent.section,
      phone: fetchedStudent.personalInfo?.phone,
      address: fetchedStudent.personalInfo?.address,
      user_password: fetchedStudent.user?.password // MUST BE UNDEFINED
    });

    if (fetchedStudent.user?.password) {
      throw new Error('SECURITY VIOLATION: Password hash leaked in student profile response!');
    }
    if (fetchedStudent.studentId !== 's001') {
      throw new Error(`Expected studentId s001, got ${fetchedStudent.studentId}`);
    }

    // Verify DB was NOT mutated
    const studentUserAfter = await User.findById(existingStudent.user._id);
    const studentProfileAfter = await StudentProfile.findById(existingStudent._id);

    if (studentUserBefore.updatedAt.getTime() !== studentUserAfter.updatedAt.getTime() ||
        studentProfileBefore.updatedAt.getTime() !== studentProfileAfter.updatedAt.getTime()) {
      throw new Error('Data mutation occurred while viewing student profile!');
    }
    console.log('[PASS] Student profile retrieved accurately with zero DB mutation and no password exposure.\n');

    // 4. Test Teacher Profile Fetching & Data Preservation
    console.log('--- Step 4: Teacher Profile Retrieval & Data Integrity ---');
    const existingTeacher = await TeacherProfile.findOne({ teacherId: 't001' }).populate('user');
    if (!existingTeacher) {
      throw new Error('Legacy teacher t001 not found in database');
    }

    // Capture state before API call
    const teacherUserBefore = await User.findById(existingTeacher.user._id);
    const teacherProfileBefore = await TeacherProfile.findById(existingTeacher._id);

    const getTeacherRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/teachers/${existingTeacher._id}`, method: 'GET' },
      null,
      adminCookie
    );

    console.log('GET teacher status:', getTeacherRes.statusCode);
    if (getTeacherRes.statusCode !== 200 || !getTeacherRes.body.success || !getTeacherRes.body.teacher) {
      throw new Error(`Failed to fetch teacher by ID: ${JSON.stringify(getTeacherRes.body)}`);
    }

    const fetchedTeacher = getTeacherRes.body.teacher;
    console.log('Fetched teacher fields:', {
      id: fetchedTeacher._id,
      teacherId: fetchedTeacher.teacherId,
      name: fetchedTeacher.user?.name,
      department: fetchedTeacher.department,
      designation: fetchedTeacher.designation,
      qualification: fetchedTeacher.professionalInfo?.highestQualification,
      specialization: fetchedTeacher.professionalInfo?.specialization,
      experience: fetchedTeacher.professionalInfo?.yearsOfExperience,
      phone: fetchedTeacher.personalInfo?.phone,
      address: fetchedTeacher.personalInfo?.address,
      user_password: fetchedTeacher.user?.password // MUST BE UNDEFINED
    });

    if (fetchedTeacher.user?.password) {
      throw new Error('SECURITY VIOLATION: Password hash leaked in teacher profile response!');
    }
    if (fetchedTeacher.teacherId !== 't001') {
      throw new Error(`Expected teacherId t001, got ${fetchedTeacher.teacherId}`);
    }

    // Verify DB was NOT mutated
    const teacherUserAfter = await User.findById(existingTeacher.user._id);
    const teacherProfileAfter = await TeacherProfile.findById(existingTeacher._id);

    if (teacherUserBefore.updatedAt.getTime() !== teacherUserAfter.updatedAt.getTime() ||
        teacherProfileBefore.updatedAt.getTime() !== teacherProfileAfter.updatedAt.getTime()) {
      throw new Error('Data mutation occurred while viewing teacher profile!');
    }
    console.log('[PASS] Teacher profile retrieved accurately with zero DB mutation and no password exposure.\n');

    // 5. Test Invalid ID and 404 Handling
    console.log('--- Step 5: Invalid ID and 404 Handling ---');
    // Nonexistent valid ObjectId
    const fakeId = new mongoose.Types.ObjectId();
    const notFoundStudentRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/students/${fakeId}`, method: 'GET' },
      null,
      adminCookie
    );
    if (notFoundStudentRes.statusCode !== 404) {
      throw new Error(`Expected 404 for nonexistent student ID, got ${notFoundStudentRes.statusCode}`);
    }
    console.log('[PASS] Nonexistent student ID returns 404 Not Found.');

    const notFoundTeacherRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/teachers/${fakeId}`, method: 'GET' },
      null,
      adminCookie
    );
    if (notFoundTeacherRes.statusCode !== 404) {
      throw new Error(`Expected 404 for nonexistent teacher ID, got ${notFoundTeacherRes.statusCode}`);
    }
    console.log('[PASS] Nonexistent teacher ID returns 404 Not Found.');

    // Malformed ID string
    const malformedStudentRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/students/malformed-id-12345', method: 'GET' },
      null,
      adminCookie
    );
    if (malformedStudentRes.statusCode !== 404) {
      throw new Error(`Expected 404 for malformed student ID, got ${malformedStudentRes.statusCode}`);
    }
    console.log('[PASS] Malformed student ID returns 404 Not Found.');

    const malformedTeacherRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/teachers/malformed-id-12345', method: 'GET' },
      null,
      adminCookie
    );
    if (malformedTeacherRes.statusCode !== 404) {
      throw new Error(`Expected 404 for malformed teacher ID, got ${malformedTeacherRes.statusCode}`);
    }
    console.log('[PASS] Malformed teacher ID returns 404 Not Found.\n');

    console.log('===========================================================');
    console.log('ALL PROFILE RETRIEVAL & INTEGRITY CHECKS PASSED!');
    console.log('===========================================================');
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((err) => {
  console.error('\n[PROFILE TEST RUN FAILED]:', err);
  process.exit(1);
});
