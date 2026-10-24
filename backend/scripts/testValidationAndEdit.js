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
  console.log('=== STARTING COMPREHENSIVE VALIDATION & TEACHER EDIT VERIFICATION ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  try {
    // 1. Authenticate Admin
    console.log('--- Step 1: Admin Authentication ---');
    let adminLoginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: '0001', password: 'StudyPoint@NewAdmin2026', role: 'admin' })
    );

    if (adminLoginRes.statusCode !== 200) {
      adminLoginRes = await makeRequest(
        { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
        JSON.stringify({ userId: '0001', password: 'StudyPoint@Admin2026', role: 'admin' })
      );
    }

    if (adminLoginRes.statusCode !== 200 || !adminLoginRes.cookie) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.body)}`);
    }
    const adminCookie = adminLoginRes.cookie;
    console.log('[PASS] Admin authenticated successfully.\n');

    if (adminLoginRes.body.user?.mustChangePassword) {
      await User.updateOne({ userId: '0001' }, { mustChangePassword: false });
    }

    // -------------------------------------------------------------------------
    // 2. Student Creation Validation Tests
    // -------------------------------------------------------------------------
    console.log('--- Step 2: Student Creation Validation Tests ---');

    // 2a. Reject completely empty payload
    const emptyStudentRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/students', method: 'POST' },
      JSON.stringify({}),
      adminCookie
    );
    console.log('Empty student status:', emptyStudentRes.statusCode, 'errors:', Object.keys(emptyStudentRes.body.errors || {}));
    if (emptyStudentRes.statusCode !== 400 || !emptyStudentRes.body.errors?.name || !emptyStudentRes.body.errors?.studentId) {
      throw new Error('Failed to reject empty student creation');
    }
    console.log('[PASS] Empty student creation rejected with field-specific errors.\n');

    // 2b. Reject invalid email & whitespace fields
    const invalidEmailStudentRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/students', method: 'POST' },
      JSON.stringify({
        studentId: '   ',
        name: '   ',
        email: 'invalid-email-string',
        course: 'B.Tech',
        department: 'CSE',
        semester: 1,
        academicYear: '2025-2026',
        section: 'A',
        password: 'Password123!'
      }),
      adminCookie
    );
    console.log('Invalid email/whitespace status:', invalidEmailStudentRes.statusCode, 'errors:', invalidEmailStudentRes.body.errors);
    if (invalidEmailStudentRes.statusCode !== 400 || !invalidEmailStudentRes.body.errors?.email || !invalidEmailStudentRes.body.errors?.studentId) {
      throw new Error('Failed to validate email format and whitespace in student creation');
    }
    console.log('[PASS] Whitespace and invalid email in student creation properly rejected.\n');

    // 2c. Successful creation of valid student
    const testStudentId = `stu_val_${Date.now()}`;
    const testStudentEmail = `stu_${Date.now()}@studypoint.edu`;
    const testStudentPassword = 'StudentPass123!';

    const validStudentPayload = {
      studentId: testStudentId,
      name: 'Alice Verification Student',
      email: testStudentEmail,
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      semester: 3,
      academicYear: '2025-2026',
      section: 'B',
      password: testStudentPassword
    };

    const createStudentRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/students', method: 'POST' },
      JSON.stringify(validStudentPayload),
      adminCookie
    );
    console.log('Valid student creation status:', createStudentRes.statusCode);
    if (createStudentRes.statusCode !== 201 || !createStudentRes.body.success) {
      throw new Error(`Valid student creation failed: ${JSON.stringify(createStudentRes.body)}`);
    }
    console.log('[PASS] Valid student created successfully in database.\n');

    // 2d. Reject duplicate student ID
    const dupStudentRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/students', method: 'POST' },
      JSON.stringify({
        ...validStudentPayload,
        email: `other_${Date.now()}@studypoint.edu`
      }),
      adminCookie
    );
    if (dupStudentRes.statusCode !== 400 || (!dupStudentRes.body.error?.includes('Student Login ID already exists') && !dupStudentRes.body.error?.includes('Student ID already exists'))) {
      throw new Error(`Failed to reject duplicate student ID: ${JSON.stringify(dupStudentRes.body)}`);
    }
    console.log('[PASS] Duplicate student ID rejected.\n');

    // 2e. Verify student login
    const studentLoginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: testStudentId, password: testStudentPassword, role: 'student' })
    );
    if (studentLoginRes.statusCode !== 200 || !studentLoginRes.body.success) {
      throw new Error('Created student failed to log in');
    }
    console.log('[PASS] Newly created student logged in successfully.\n');

    // -------------------------------------------------------------------------
    // 3. Teacher Creation Validation Tests
    // -------------------------------------------------------------------------
    console.log('--- Step 3: Teacher Creation Validation Tests ---');

    // 3a. Reject empty teacher payload
    const emptyTeacherRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/teachers', method: 'POST' },
      JSON.stringify({}),
      adminCookie
    );
    console.log('Empty teacher status:', emptyTeacherRes.statusCode, 'errors:', Object.keys(emptyTeacherRes.body.errors || {}));
    if (emptyTeacherRes.statusCode !== 400 || !emptyTeacherRes.body.errors?.name || !emptyTeacherRes.body.errors?.phone || !emptyTeacherRes.body.errors?.address) {
      throw new Error('Failed to reject empty teacher payload with field errors');
    }
    console.log('[PASS] Empty teacher creation rejected with all mandatory field errors.\n');

    // 3b. Reject invalid phone number and experience
    const invalidPhoneTeacherRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/teachers', method: 'POST' },
      JSON.stringify({
        teacherId: `tch_bad_${Date.now()}`,
        password: 'ValidPass123!',
        department: 'CSE',
        designation: 'Professor',
        personalInfo: {
          name: 'Invalid Data Teacher',
          email: 'validemail@studypoint.edu',
          phone: '12345', // invalid length
          address: 'Main Campus'
        },
        professionalInfo: {
          highestQualification: 'Ph.D.',
          specialization: 'Cybersecurity',
          yearsOfExperience: -5 // negative experience
        }
      }),
      adminCookie
    );
    console.log('Invalid phone/experience status:', invalidPhoneTeacherRes.statusCode, 'errors:', invalidPhoneTeacherRes.body.errors);
    if (invalidPhoneTeacherRes.statusCode !== 400 || !invalidPhoneTeacherRes.body.errors?.phone || !invalidPhoneTeacherRes.body.errors?.yearsOfExperience) {
      throw new Error('Failed to validate phone format and negative experience');
    }
    console.log('[PASS] Invalid phone format and negative experience properly rejected.\n');

    // 3c. Successful creation of valid teacher (without teaching assignments)
    const testTeacherId = `tch_val_${Date.now()}`;
    const testTeacherEmail = `tch_${Date.now()}@studypoint.edu`;
    const testTeacherPassword = 'TeacherPass123!';

    const validTeacherPayload = {
      teacherId: testTeacherId,
      password: testTeacherPassword,
      department: 'Computer Science and Engineering',
      designation: 'Associate Professor',
      isActive: true,
      personalInfo: {
        name: 'Dr. Robert Oppenheimer',
        email: testTeacherEmail,
        phone: '9876543210',
        address: '42 Academic Avenue, Campus Quarters'
      },
      professionalInfo: {
        highestQualification: 'Ph.D.',
        specialization: 'Quantum Computing',
        yearsOfExperience: 12
      }
    };

    const createTeacherRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/teachers', method: 'POST' },
      JSON.stringify(validTeacherPayload),
      adminCookie
    );
    console.log('Valid teacher creation status:', createTeacherRes.statusCode);
    if (createTeacherRes.statusCode !== 201 || !createTeacherRes.body.success) {
      throw new Error(`Valid teacher creation failed: ${JSON.stringify(createTeacherRes.body)}`);
    }
    const createdTeacherProfile = createTeacherRes.body.teacher || (await TeacherProfile.findOne({ teacherId: testTeacherId }));
    const createdTeacherProfileId = createdTeacherProfile._id;
    console.log(`[PASS] Valid teacher created successfully (id: ${createdTeacherProfileId}).\n`);

    // 3d. Verify teacher login
    const teacherLoginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: testTeacherId, password: testTeacherPassword, role: 'teacher' })
    );
    if (teacherLoginRes.statusCode !== 200 || !teacherLoginRes.body.success) {
      throw new Error('Created teacher failed to log in');
    }
    console.log('[PASS] Newly created teacher logged in successfully.\n');

    // -------------------------------------------------------------------------
    // 4. Teacher Edit Functionality Tests (GET & PUT)
    // -------------------------------------------------------------------------
    console.log('--- Step 4: Teacher Edit Functionality Tests ---');

    // 4a. Fetch teacher by ID
    const getTeacherRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/teachers/${createdTeacherProfileId}`, method: 'GET' },
      null,
      adminCookie
    );
    console.log('GET teacher status:', getTeacherRes.statusCode);
    if (getTeacherRes.statusCode !== 200 || !getTeacherRes.body.success) {
      throw new Error('Failed to fetch teacher by ID');
    }
    const fetchedTeacher = getTeacherRes.body.teacher;
    const fetchedName = fetchedTeacher.user?.name || fetchedTeacher.personalInfo?.name;
    if (fetchedTeacher.teacherId !== testTeacherId || fetchedName !== 'Dr. Robert Oppenheimer') {
      throw new Error(`Fetched teacher data does not match saved details: id=${fetchedTeacher.teacherId}, name=${fetchedName}`);
    }
    console.log('[PASS] GET teacher by ID loaded complete and accurate profile.\n');

    // 4b. Reject invalid edit (e.g. missing address and invalid phone)
    const invalidEditRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/teachers/${createdTeacherProfileId}`, method: 'PUT' },
      JSON.stringify({
        department: 'CSE',
        designation: 'Professor',
        personalInfo: {
          name: 'Updated Name',
          email: testTeacherEmail,
          phone: '999', // invalid
          address: '   ' // empty address
        },
        professionalInfo: {
          highestQualification: 'Ph.D.',
          specialization: 'Physics',
          yearsOfExperience: 14
        }
      }),
      adminCookie
    );
    console.log('Invalid edit status:', invalidEditRes.statusCode, 'errors:', invalidEditRes.body.errors);
    if (invalidEditRes.statusCode !== 400 || !invalidEditRes.body.errors?.phone || !invalidEditRes.body.errors?.address) {
      throw new Error('Failed to reject invalid teacher edit payload');
    }
    console.log('[PASS] Invalid teacher edit payload properly rejected with field errors.\n');

    // 4c. Reject duplicate email from another teacher
    // We already have teacher t001 with its email or admin email
    const existingUserWithEmail = await User.findOne({ role: 'admin' });
    if (existingUserWithEmail?.email) {
      const dupEmailEditRes = await makeRequest(
        { hostname: 'localhost', port: 5000, path: `/api/admin/teachers/${createdTeacherProfileId}`, method: 'PUT' },
        JSON.stringify({
          department: 'CSE',
          designation: 'Professor',
          personalInfo: {
            name: 'Updated Name',
            email: existingUserWithEmail.email,
            phone: '9876543210',
            address: 'Valid Address'
          },
          professionalInfo: {
            highestQualification: 'Ph.D.',
            specialization: 'Physics',
            yearsOfExperience: 14
          }
        }),
        adminCookie
      );
      console.log('Duplicate email edit status:', dupEmailEditRes.statusCode, dupEmailEditRes.body);
      if (dupEmailEditRes.statusCode !== 400 || !dupEmailEditRes.body.error?.includes('Email already in use')) {
        throw new Error('Failed to reject duplicate email on teacher edit');
      }
      console.log('[PASS] Duplicate email edit properly rejected.\n');
    }

    // 4d. Successful Teacher Edit
    const updatedName = 'Dr. Robert J. Oppenheimer';
    const updatedEmail = `updated_${Date.now()}@studypoint.edu`;
    const updatedPhone = '9123456789';
    const updatedAddress = '100 Institute Boulevard, Science Block';
    const updatedDepartment = 'Physics and Advanced Computing';
    const updatedDesignation = 'Senior Professor';
    const updatedQualification = 'D.Sc. / Ph.D.';
    const updatedSpecialization = 'Theoretical and Quantum Computing';
    const updatedExp = 15;

    // Get original user password hash and isActive status to ensure they don't change
    const userBeforeEdit = await User.findOne({ userId: testTeacherId });
    const originalPasswordHash = userBeforeEdit.password;
    const originalIsActive = userBeforeEdit.isActive;

    const validEditPayload = {
      department: updatedDepartment,
      designation: updatedDesignation,
      personalInfo: {
        name: updatedName,
        email: updatedEmail,
        phone: updatedPhone,
        address: updatedAddress
      },
      professionalInfo: {
        highestQualification: updatedQualification,
        specialization: updatedSpecialization,
        yearsOfExperience: updatedExp
      }
    };

    const editRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/teachers/${createdTeacherProfileId}`, method: 'PUT' },
      JSON.stringify(validEditPayload),
      adminCookie
    );
    console.log('Valid edit status:', editRes.statusCode);
    if (editRes.statusCode !== 200 || !editRes.body.success) {
      throw new Error(`Valid teacher edit failed: ${JSON.stringify(editRes.body)}`);
    }
    console.log('[PASS] Teacher edit API returned 200 Success.\n');

    // 4e. Verify DB persistence and integrity
    const userAfterEdit = await User.findOne({ userId: testTeacherId });
    const profileAfterEdit = await TeacherProfile.findById(createdTeacherProfileId);

    if (userAfterEdit.name !== updatedName || profileAfterEdit.personalInfo.email !== updatedEmail) {
      throw new Error(`Record was not updated with edited name or email: userName=${userAfterEdit.name}, profileEmail=${profileAfterEdit.personalInfo?.email}`);
    }
    if (userAfterEdit.password !== originalPasswordHash) {
      throw new Error('User password hash was unintentionally modified during teacher edit!');
    }
    if (userAfterEdit.isActive !== originalIsActive) {
      throw new Error('User isActive status was unintentionally modified during teacher edit!');
    }
    if (profileAfterEdit.teacherId !== testTeacherId) {
      throw new Error('Teacher ID was modified during edit!');
    }
    if (
      profileAfterEdit.department !== updatedDepartment ||
      profileAfterEdit.designation !== updatedDesignation ||
      profileAfterEdit.personalInfo.phone !== updatedPhone ||
      profileAfterEdit.personalInfo.address !== updatedAddress ||
      profileAfterEdit.professionalInfo.highestQualification !== updatedQualification ||
      profileAfterEdit.professionalInfo.specialization !== updatedSpecialization ||
      profileAfterEdit.professionalInfo.yearsOfExperience !== updatedExp
    ) {
      throw new Error('TeacherProfile fields do not match edited values');
    }
    console.log('[PASS] DB verification confirmed all edited fields updated without affecting password or account status.\n');

    // 4f. Verify teacher login still works with original password!
    const teacherLoginAfterEditRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: testTeacherId, password: testTeacherPassword, role: 'teacher' })
    );
    if (teacherLoginAfterEditRes.statusCode !== 200 || !teacherLoginAfterEditRes.body.success) {
      throw new Error('Teacher cannot log in with original password after edit');
    }
    console.log('[PASS] Teacher logged in successfully with original password after profile edit.\n');

    // -------------------------------------------------------------------------
    // 5. Verify Deactivate / Activate & Reset Password Actions
    // -------------------------------------------------------------------------
    console.log('--- Step 5: Verify Deactivate, Activate, and Reset Password ---');

    // 5a. Deactivate teacher
    const deactRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/users/${userBeforeEdit._id}/status`, method: 'PATCH' },
      JSON.stringify({ isActive: false }),
      adminCookie
    );
    if (deactRes.statusCode !== 200) {
      throw new Error(`Failed to deactivate teacher: ${JSON.stringify(deactRes.body)}`);
    }
    console.log('[PASS] Teacher deactivated successfully.');

    // 5b. Verify login is blocked when deactivated
    const deactLoginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: testTeacherId, password: testTeacherPassword, role: 'teacher' })
    );
    if (deactLoginRes.statusCode === 200 && deactLoginRes.body.success) {
      throw new Error('Deactivated teacher was able to log in!');
    }
    console.log('[PASS] Deactivated teacher login blocked.\n');

    // 5c. Reactivate teacher
    const actRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/users/${userBeforeEdit._id}/status`, method: 'PATCH' },
      JSON.stringify({ isActive: true }),
      adminCookie
    );
    if (actRes.statusCode !== 200) {
      throw new Error('Failed to reactivate teacher');
    }
    console.log('[PASS] Teacher reactivated successfully.');

    // 5d. Reset Password
    const newResetPassword = 'NewTeacherPass456!';
    const resetRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/users/${userBeforeEdit._id}/reset-password`, method: 'POST' },
      JSON.stringify({ newPassword: newResetPassword }),
      adminCookie
    );
    if (resetRes.statusCode !== 200) {
      throw new Error(`Failed to reset teacher password: ${JSON.stringify(resetRes.body)}`);
    }
    console.log('[PASS] Teacher password reset successfully.');

    // 5e. Login with new password
    const resetLoginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: testTeacherId, password: newResetPassword, role: 'teacher' })
    );
    if (resetLoginRes.statusCode !== 200 || !resetLoginRes.body.success) {
      throw new Error('Teacher failed to log in with reset temporary password');
    }
    console.log('[PASS] Teacher logged in successfully with reset password.\n');

    // -------------------------------------------------------------------------
    // 6. Cleanup test records & verify legacy records
    // -------------------------------------------------------------------------
    console.log('--- Step 6: Cleanup & Legacy Integrity ---');

    await User.deleteMany({ userId: { $in: [testStudentId, testTeacherId] } });
    await StudentProfile.deleteOne({ studentId: testStudentId });
    await TeacherProfile.deleteOne({ _id: createdTeacherProfileId });
    console.log('[PASS] Cleaned up temporary test student and teacher.');

    // Check legacy records
    const legacyTeacher = await TeacherProfile.findOne({ teacherId: 't001' });
    const legacyStudent = await StudentProfile.findOne({ studentId: 's001' });
    if (!legacyTeacher || !legacyStudent) {
      throw new Error('Legacy teacher t001 or student s001 missing!');
    }
    console.log(`[PASS] Legacy teacher (t001) and student (s001) are intact in database.\n`);

    console.log('===========================================================');
    console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('===========================================================');
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((err) => {
  console.error('\n[TEST RUN FAILED]:', err);
  process.exit(1);
});
