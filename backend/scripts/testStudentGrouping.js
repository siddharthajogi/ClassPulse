const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');
const AcademicRecord = require('../models/AcademicRecord');

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
  console.log('=== STARTING COMPLETE AUTOMATIC STUDENT GROUPING & ASSIGNMENTS TEST ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB database.\n');

  try {
    // -------------------------------------------------------------
    // Step 0: Authenticate Admin
    // -------------------------------------------------------------
    console.log('--- Step 0: Admin Login ---');
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

    const adminUser = await User.findOne({ userId: '0001' });
    const institutionId = adminUser.institution;

    // Ensure we have active teachers and subjects
    console.log('--- Step 0b: Verifying / Creating Active Subjects & Teachers for Testing ---');
    let subject1 = await Subject.findOne({ institution: institutionId, code: 'TEST_SUB_1' });
    if (!subject1) {
      subject1 = await Subject.create({
        institution: institutionId,
        name: 'Distributed Systems',
        code: 'TEST_SUB_1',
        department: 'Computer Science and Engineering',
        credits: 4,
        subjectType: 'Theory',
        isActive: true
      });
    }

    let subject2 = await Subject.findOne({ institution: institutionId, code: 'TEST_SUB_2' });
    if (!subject2) {
      subject2 = await Subject.create({
        institution: institutionId,
        name: 'Machine Learning Lab',
        code: 'TEST_SUB_2',
        department: 'Computer Science and Engineering',
        credits: 2,
        subjectType: 'Practical',
        isActive: true
      });
    }

    // Teacher 1
    let teacherUser1 = await User.findOne({ userId: 'test_prof_1' });
    if (!teacherUser1) {
      const bcrypt = require('bcrypt');
      const hp = await bcrypt.hash('StudyPoint@Teacher2026', 10);
      teacherUser1 = await User.create({
        userId: 'test_prof_1',
        password: hp,
        role: 'teacher',
        institution: institutionId,
        name: 'Dr. Alan Turing',
        isActive: true
      });
    }
    let teacherProfile1 = await TeacherProfile.findOne({ user: teacherUser1._id });
    if (!teacherProfile1) {
      teacherProfile1 = await TeacherProfile.create({
        institution: institutionId,
        user: teacherUser1._id,
        teacherId: 'test_prof_1',
        department: 'Computer Science and Engineering',
        designation: 'Professor',
        personalInfo: { name: 'Dr. Alan Turing', email: 'alan.turing@example.com' }
      });
    }

    // Teacher 2
    let teacherUser2 = await User.findOne({ userId: 'test_prof_2' });
    if (!teacherUser2) {
      const bcrypt = require('bcrypt');
      const hp = await bcrypt.hash('StudyPoint@Teacher2026', 10);
      teacherUser2 = await User.create({
        userId: 'test_prof_2',
        password: hp,
        role: 'teacher',
        institution: institutionId,
        name: 'Dr. Grace Hopper',
        isActive: true
      });
    }
    let teacherProfile2 = await TeacherProfile.findOne({ user: teacherUser2._id });
    if (!teacherProfile2) {
      teacherProfile2 = await TeacherProfile.create({
        institution: institutionId,
        user: teacherUser2._id,
        teacherId: 'test_prof_2',
        department: 'Computer Science and Engineering',
        designation: 'Associate Professor',
        personalInfo: { name: 'Dr. Grace Hopper', email: 'grace.hopper@example.com' }
      });
    }

    console.log('[PASS] Test subjects and faculty verified.\n');

    // Generate unique student IDs for this test run
    const ts = Date.now();
    const studentId1 = `grp_stu_a1_${ts}`;
    const studentId2 = `grp_stu_a2_${ts}`;
    const studentId3 = `grp_stu_b1_${ts}`;
    const password = 'TestPass@2026';
    const sectionA = `A_${ts}`;
    const sectionB = `B_${ts}`;

    const academicDetailsGroupA = {
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      academicYear: '2025-2026',
      semester: '5th',
      section: sectionA
    };

    // -------------------------------------------------------------
    // Requirement 1 & 3: Automatic Grouping & Student 1 Creation
    // -------------------------------------------------------------
    console.log('--- Step 1: Create Student 1 (Group A) -> Group should be created automatically ---');
    const createStu1Res = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/students', method: 'POST' },
      JSON.stringify({
        studentId: studentId1,
        password,
        ...academicDetailsGroupA,
        personalInfo: { name: 'Alice Student', email: `alice_${ts}@example.com` }
      }),
      adminCookie
    );

    if (createStu1Res.statusCode !== 201 || !createStu1Res.body.success) {
      throw new Error(`Failed to create student 1: ${JSON.stringify(createStu1Res.body)}`);
    }
    console.log('[PASS] Student 1 created successfully.');
    console.log('Group returned on creation:', createStu1Res.body.group);

    const stuProfile1 = await StudentProfile.findOne({ studentId: studentId1 });
    if (!stuProfile1 || !stuProfile1.classRef) {
      throw new Error('Student 1 does not have classRef assigned!');
    }
    const groupAId = stuProfile1.classRef.toString();
    console.log(`[PASS] Student 1 associated with group ID: ${groupAId}\n`);

    // Verify group was created automatically in DB
    const groupADoc = await Class.findById(groupAId);
    if (!groupADoc || groupADoc.section !== sectionA || groupADoc.course !== 'B.Tech') {
      throw new Error('Group A document in DB is missing or invalid!');
    }
    console.log(`[PASS] Group automatically created in database: ${groupADoc.name} (Section: ${groupADoc.section})\n`);

    // -------------------------------------------------------------
    // Requirement 1 & 2: Create Student 2 with Matching Academic Details
    // Must be placed in the EXACT SAME GROUP
    // -------------------------------------------------------------
    console.log('--- Step 2: Create Student 2 (Same academic details) -> Must reuse Group A ---');
    const createStu2Res = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/students', method: 'POST' },
      JSON.stringify({
        studentId: studentId2,
        password,
        ...academicDetailsGroupA,
        personalInfo: { name: 'Bob Student', email: `bob_${ts}@example.com` }
      }),
      adminCookie
    );

    if (createStu2Res.statusCode !== 201 || !createStu2Res.body.success) {
      throw new Error(`Failed to create student 2: ${JSON.stringify(createStu2Res.body)}`);
    }

    const stuProfile2 = await StudentProfile.findOne({ studentId: studentId2 });
    if (!stuProfile2 || !stuProfile2.classRef) {
      throw new Error('Student 2 does not have classRef assigned!');
    }
    const groupAId2 = stuProfile2.classRef.toString();

    if (groupAId !== groupAId2) {
      throw new Error(`Students with matching academic details were placed in different groups! Group 1: ${groupAId}, Group 2: ${groupAId2}`);
    }
    console.log(`[PASS] Both Student 1 and Student 2 belong to identical group ID: ${groupAId}\n`);

    // -------------------------------------------------------------
    // Requirement 1 & 2: Create Student 3 with Different Section (Section B)
    // Must create or reuse a DIFFERENT group
    // -------------------------------------------------------------
    console.log('--- Step 3: Create Student 3 with Section B -> Must create a different group (Group B) ---');
    const createStu3Res = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/students', method: 'POST' },
      JSON.stringify({
        studentId: studentId3,
        password,
        ...academicDetailsGroupA,
        section: sectionB,
        personalInfo: { name: 'Charlie Student', email: `charlie_${ts}@example.com` }
      }),
      adminCookie
    );

    if (createStu3Res.statusCode !== 201 || !createStu3Res.body.success) {
      throw new Error(`Failed to create student 3: ${JSON.stringify(createStu3Res.body)}`);
    }

    const stuProfile3 = await StudentProfile.findOne({ studentId: studentId3 });
    const groupBId = stuProfile3.classRef.toString();

    if (groupAId === groupBId) {
      throw new Error('Student 3 with Section B was incorrectly placed into Section A group!');
    }
    const groupBDoc = await Class.findById(groupBId);
    if (!groupBDoc || groupBDoc.section !== sectionB) {
      throw new Error('Group B document in DB invalid!');
    }
    console.log(`[PASS] Student 3 with Section B correctly placed in distinct group: ${groupBDoc.name} (ID: ${groupBId})\n`);

    // -------------------------------------------------------------
    // Requirement 5: Check Pending Status for newly created group
    // -------------------------------------------------------------
    console.log('--- Step 4: Verify Newly Created Group Has "Pending" Status ---');
    const getClassesRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/admin/classes', method: 'GET' },
      null,
      adminCookie
    );
    if (getClassesRes.statusCode !== 200 || !getClassesRes.body.success) {
      throw new Error('Failed to fetch classes list');
    }

    const fetchedGroupA = getClassesRes.body.classes.find(c => c._id === groupAId);
    if (!fetchedGroupA) {
      throw new Error(`Group A (${groupAId}) not found in getClasses response!`);
    }
    if (fetchedGroupA.status !== 'Pending' || !fetchedGroupA.hasPendingAssignments || fetchedGroupA.assignmentCount !== 0) {
      throw new Error(`Expected Group A to have Pending status, but got status: ${fetchedGroupA.status}`);
    }
    if (fetchedGroupA.studentCount !== 2) {
      throw new Error(`Expected Group A to report 2 enrolled students, got: ${fetchedGroupA.studentCount}`);
    }
    console.log(`[PASS] Group A correctly reports: Status: Pending, Student Count: ${fetchedGroupA.studentCount}, Assignments: 0\n`);

    // -------------------------------------------------------------
    // Requirement 3: Admin Manually Assigns Multiple Subjects & Teachers to Group A
    // -------------------------------------------------------------
    console.log('--- Step 5: Admin Manually Assigns Multiple Subjects & Teachers to Group A ---');
    const assignPayload = {
      assignments: [
        { subjectId: subject1._id.toString(), teacherId: teacherProfile1._id.toString() },
        { subjectId: subject2._id.toString(), teacherId: teacherProfile2._id.toString() }
      ]
    };

    const updateAssignRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/classes/${groupAId}/assignments`, method: 'PUT' },
      JSON.stringify(assignPayload),
      adminCookie
    );

    if (updateAssignRes.statusCode !== 200 || !updateAssignRes.body.success) {
      throw new Error(`Failed to assign subjects to group: ${JSON.stringify(updateAssignRes.body)}`);
    }
    if (updateAssignRes.body.assignmentCount !== 2 || updateAssignRes.body.status !== 'Assigned') {
      throw new Error(`Unexpected assignment result: ${JSON.stringify(updateAssignRes.body)}`);
    }
    console.log('[PASS] Assigned 2 subjects and teachers to Group A successfully.\n');

    // -------------------------------------------------------------
    // Requirement 4: Student 1 & Student 2 Dashboard Inherits Assignments
    // -------------------------------------------------------------
    console.log('--- Step 6: Verify Student 1 & Student 2 Inherit Group A Assignments on Dashboard ---');

    // Remove mustChangePassword for student 1 & student 2 to allow direct login
    await User.updateMany({ userId: { $in: [studentId1, studentId2] } }, { mustChangePassword: false });

    // Login as Student 1
    const stu1LoginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: studentId1, password, role: 'student' })
    );
    if (stu1LoginRes.statusCode !== 200 || !stu1LoginRes.cookie) {
      throw new Error(`Student 1 login failed: ${JSON.stringify(stu1LoginRes.body)}`);
    }
    const stu1Cookie = stu1LoginRes.cookie;

    // Call Student Dashboard
    const stu1DashRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/student/dashboard', method: 'GET' },
      null,
      stu1Cookie
    );
    if (stu1DashRes.statusCode !== 200 || !stu1DashRes.body.success) {
      throw new Error(`Student 1 dashboard failed: ${JSON.stringify(stu1DashRes.body)}`);
    }

    if (stu1DashRes.body.assignmentsPending !== false || stu1DashRes.body.assignmentCount !== 2) {
      throw new Error(`Student 1 did not inherit 2 assignments: ${JSON.stringify(stu1DashRes.body)}`);
    }
    const stu1Subjects = stu1DashRes.body.assignments.map(a => a.subject.code);
    if (!stu1Subjects.includes('TEST_SUB_1') || !stu1Subjects.includes('TEST_SUB_2')) {
      throw new Error(`Student 1 missing expected subjects: ${stu1Subjects.join(', ')}`);
    }
    console.log(`[PASS] Student 1 dashboard displays ${stu1DashRes.body.assignmentCount} inherited subjects: ${stu1Subjects.join(', ')}`);

    // Login as Student 2
    const stu2LoginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: studentId2, password, role: 'student' })
    );
    const stu2Cookie = stu2LoginRes.cookie;
    const stu2DashRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/student/dashboard', method: 'GET' },
      null,
      stu2Cookie
    );
    if (stu2DashRes.statusCode !== 200 || stu2DashRes.body.assignmentCount !== 2) {
      throw new Error(`Student 2 did not inherit group assignments!`);
    }
    console.log(`[PASS] Student 2 in the same group also inherits identical ${stu2DashRes.body.assignmentCount} subjects.\n`);

    // -------------------------------------------------------------
    // Requirement 4: Assignment changes reflected for all students in group
    // -------------------------------------------------------------
    console.log('--- Step 7: Update Group A Assignments -> Changes automatically reflect for all students ---');
    // Change assignment: only subject 1 assigned to teacher 2
    const updateAssignPayload2 = {
      assignments: [
        { subjectId: subject1._id.toString(), teacherId: teacherProfile2._id.toString() }
      ]
    };
    const updateAssignRes2 = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/classes/${groupAId}/assignments`, method: 'PUT' },
      JSON.stringify(updateAssignPayload2),
      adminCookie
    );
    if (updateAssignRes2.statusCode !== 200 || updateAssignRes2.body.assignmentCount !== 1) {
      throw new Error(`Failed to update group assignments: ${JSON.stringify(updateAssignRes2.body)}`);
    }

    // Check Student 1 Dashboard again
    const stu1UpdatedDash = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/student/dashboard', method: 'GET' },
      null,
      stu1Cookie
    );
    if (stu1UpdatedDash.body.assignmentCount !== 1 || stu1UpdatedDash.body.assignments[0].teacher.teacherId !== 'test_prof_2') {
      throw new Error(`Updated assignment not reflected on Student 1 dashboard: ${JSON.stringify(stu1UpdatedDash.body)}`);
    }
    console.log(`[PASS] Student 1 dashboard automatically updated to new assignment count (1) and new teacher (Dr. Grace Hopper).\n`);

    // -------------------------------------------------------------
    // Requirement 4 & 7: Move Student 1 to Group B by editing section
    // Must update group membership and show Group B's assignments
    // while preserving historical academic records
    // -------------------------------------------------------------
    console.log('--- Step 8: Edit Student 1 Academic Grouping Details (Move from Section A to Section B) ---');
    
    // First, let's create a historical academic record for Student 1 to verify it is preserved
    const AcademicYear = require('../models/AcademicYear');
    let ayDoc = await AcademicYear.findOne({ institution: institutionId });
    if (!ayDoc) {
      ayDoc = await AcademicYear.create({
        institution: institutionId,
        year: '2025-2026',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true
      });
    }

    const testRecord = await AcademicRecord.create({
      institution: institutionId,
      student: stuProfile1._id,
      subject: subject1._id,
      academicYear: ayDoc._id,
      marksObtained: 85,
      totalMarks: 100,
      attendancePercentage: 92
    });
    console.log(`Created historical academic record ID: ${testRecord._id} for Student 1.`);

    // Now edit student 1 section to 'B'
    const editStu1Res = await makeRequest(
      { hostname: 'localhost', port: 5000, path: `/api/admin/students/${stuProfile1._id}`, method: 'PUT' },
      JSON.stringify({
        ...academicDetailsGroupA,
        section: sectionB
      }),
      adminCookie
    );
    if (editStu1Res.statusCode !== 200 || !editStu1Res.body.success) {
      throw new Error(`Failed to edit student 1 section: ${JSON.stringify(editStu1Res.body)}`);
    }

    const movedStu1Profile = await StudentProfile.findById(stuProfile1._id);
    if (movedStu1Profile.classRef.toString() !== groupBId) {
      throw new Error(`Student 1 classRef was not updated to Group B! Got: ${movedStu1Profile.classRef}`);
    }
    console.log(`[PASS] Student 1 successfully moved to Group B (ID: ${groupBId}).`);

    // Verify historical academic record is intact!
    const checkRecord = await AcademicRecord.findById(testRecord._id);
    if (!checkRecord || checkRecord.marksObtained !== 85) {
      throw new Error('Historical academic record was deleted or corrupted during student group edit!');
    }
    console.log('[PASS] Historical academic record preserved completely intact.');

    // Check Student 1 Dashboard now: should reflect Group B
    const stu1MovedDash = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/student/dashboard', method: 'GET' },
      null,
      stu1Cookie
    );
    if (stu1MovedDash.body.student.section !== sectionB || stu1MovedDash.body.student.group._id !== groupBId) {
      throw new Error(`Student 1 dashboard not showing Group B!`);
    }
    if (stu1MovedDash.body.academicRecords.length !== 1) {
      throw new Error(`Preserved academic record not visible on student dashboard!`);
    }
    // Clean up test academic record so it doesn't pollute real dashboard analytics
    await AcademicRecord.findByIdAndDelete(testRecord._id);
    console.log(`[PASS] Cleaned up temporary test academic record ${testRecord._id}.\n`);

    // -------------------------------------------------------------
    // Requirement 2: Concurrent Student Creation Deduplication
    // -------------------------------------------------------------
    console.log('--- Step 9: Test Concurrent Student Creation Group Deduplication ---');
    const concurrentSection = `CONC_${ts}`;
    const concurrentStudent1 = `conc_s1_${ts}`;
    const concurrentStudent2 = `conc_s2_${ts}`;

    const [concRes1, concRes2] = await Promise.all([
      makeRequest(
        { hostname: 'localhost', port: 5000, path: '/api/admin/students', method: 'POST' },
        JSON.stringify({
          studentId: concurrentStudent1,
          password,
          ...academicDetailsGroupA,
          section: concurrentSection,
          personalInfo: { name: 'Concurrent 1', email: `c1_${ts}@example.com` }
        }),
        adminCookie
      ),
      makeRequest(
        { hostname: 'localhost', port: 5000, path: '/api/admin/students', method: 'POST' },
        JSON.stringify({
          studentId: concurrentStudent2,
          password,
          ...academicDetailsGroupA,
          section: concurrentSection,
          personalInfo: { name: 'Concurrent 2', email: `c2_${ts}@example.com` }
        }),
        adminCookie
      )
    ]);

    if (concRes1.statusCode !== 201 || concRes2.statusCode !== 201) {
      throw new Error(`Concurrent creation failed: Res1: ${concRes1.statusCode}, Res2: ${concRes2.statusCode}`);
    }

    const cStu1 = await StudentProfile.findOne({ studentId: concurrentStudent1 });
    const cStu2 = await StudentProfile.findOne({ studentId: concurrentStudent2 });

    if (cStu1.classRef.toString() !== cStu2.classRef.toString()) {
      throw new Error(`Concurrent student creation resulted in duplicate groups! ${cStu1.classRef} vs ${cStu2.classRef}`);
    }

    // Verify exactly ONE class exists in the database for this section
    const matchingGroups = await Class.find({ institution: institutionId, section: concurrentSection });
    if (matchingGroups.length !== 1) {
      throw new Error(`Expected exactly 1 group in DB for concurrent creation, found: ${matchingGroups.length}`);
    }
    console.log(`[PASS] Concurrent student creation safely created exactly 1 group (${matchingGroups[0]._id}) without duplication.\n`);

    console.log('========================================================================');
    console.log(' ALL 8 REQUIREMENTS AND TEST SCENARIOS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================');

    process.exit(0);
  } catch (err) {
    console.error('\n[TEST FAILURE]:', err);
    process.exit(1);
  }
};

run();
