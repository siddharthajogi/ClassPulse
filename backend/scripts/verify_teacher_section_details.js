const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const http = require('http');

// Models
const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const StudentProfile = require('../models/StudentProfile');
const Department = require('../models/Department');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');
const AcademicYear = require('../models/AcademicYear');

// Routes
const teacherRoutes = require('../routes/teacherRoutes');

const runSuite = async () => {
  console.log('================================================================');
  console.log(' STARTING TEACHER SECTION CARDS & DETAILS PAGE TEST SUITE');
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

  const institutionId = new mongoose.Types.ObjectId();

  // Create mock teachers
  const teacherUser1 = {
    _id: new mongoose.Types.ObjectId(),
    userId: 'tch_001',
    role: 'teacher',
    name: 'Dr. Alan Turing',
    email: 'alan@studypoint.edu',
    institution: institutionId,
    isActive: true,
    mustChangePassword: false
  };

  const teacherUser2 = {
    _id: new mongoose.Types.ObjectId(),
    userId: 'tch_002',
    role: 'teacher',
    name: 'Dr. Ada Lovelace',
    email: 'ada@studypoint.edu',
    institution: institutionId,
    isActive: true,
    mustChangePassword: false
  };

  const teacherProfile1 = {
    _id: new mongoose.Types.ObjectId(),
    user: teacherUser1._id,
    teacherId: 'TCH-001',
    department: 'Computer Science and Engineering',
    designation: 'Professor',
    institution: institutionId,
    personalInfo: { name: 'Dr. Alan Turing', email: 'alan@studypoint.edu' }
  };

  const teacherProfile2 = {
    _id: new mongoose.Types.ObjectId(),
    user: teacherUser2._id,
    teacherId: 'TCH-002',
    department: 'Computer Science and Engineering',
    designation: 'Associate Professor',
    institution: institutionId,
    personalInfo: { name: 'Dr. Ada Lovelace', email: 'ada@studypoint.edu' }
  };

  // Create mock classes (sections)
  const classA = {
    _id: new mongoose.Types.ObjectId(),
    name: 'B.Tech - Computer Science and Engineering',
    course: 'B.Tech',
    department: 'Computer Science and Engineering',
    academicYear: '2026-2027',
    semester: '1',
    section: 'A',
    yearOfStudy: 'First Year',
    institution: institutionId,
    isActive: true,
    toObject() { return { ...this }; }
  };

  const classB = {
    _id: new mongoose.Types.ObjectId(),
    name: 'B.Tech - Computer Science and Engineering',
    course: 'B.Tech',
    department: 'Computer Science and Engineering',
    academicYear: '2026-2027',
    semester: '1',
    section: 'B',
    yearOfStudy: 'First Year',
    institution: institutionId,
    isActive: true,
    toObject() { return { ...this }; }
  };

  const classEmpty = {
    _id: new mongoose.Types.ObjectId(),
    name: 'B.Tech - Information Technology',
    course: 'B.Tech',
    department: 'Information Technology',
    academicYear: '2026-2027',
    semester: '3',
    section: 'C',
    yearOfStudy: 'Second Year',
    institution: institutionId,
    isActive: true,
    toObject() { return { ...this }; }
  };

  // Mock subjects
  const subjectAlgo = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Data Structures and Algorithms',
    code: 'CS101',
    credits: 4,
    subjectType: 'Theory',
    institution: institutionId,
    isActive: true
  };

  const subjectAlgoLab = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Algorithms Laboratory',
    code: 'CS101L',
    credits: 2,
    subjectType: 'Practical',
    institution: institutionId,
    isActive: true
  };

  const subjectMath = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Discrete Mathematics',
    code: 'MA102',
    credits: 3,
    subjectType: 'Theory',
    institution: institutionId,
    isActive: true
  };

  // In-memory assignment store for scenarios
  let activeAssignments = [];
  let activeStudents = [];

  // Setup Express server with session
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test_secret_for_section_details',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));

  // Session inject middleware for testing
  let currentSessionUser = teacherUser1;
  app.use((req, res, next) => {
    req.currentUser = currentSessionUser;
    req.session.userId = currentSessionUser._id;
    req.session.user = currentSessionUser;
    next();
  });

  app.use('/api/teacher', teacherRoutes);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  const request = (path, user = teacherUser1) => {
    return new Promise((resolve, reject) => {
      currentSessionUser = user;
      const req = http.request({
        hostname: 'localhost',
        port,
        path,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', reject);
      req.end();
    });
  };

  // Mock Mongoose calls
  const origUserFindById = User.findById;
  const origTeacherProfileFindOne = TeacherProfile.findOne;
  const origTeachingAssignmentFind = TeachingAssignment.find;
  const origTeachingAssignmentExists = TeachingAssignment.exists;
  const origClassFind = Class.find;
  const origClassFindOne = Class.findOne;
  const origStudentProfileFind = StudentProfile.find;
  const origStudentProfileDistinct = StudentProfile.distinct;
  const origStudentProfileAggregate = StudentProfile.aggregate;
  const origDepartmentFind = Department.find;
  const origAcademicYearFind = AcademicYear.find;

  // Stubs
  User.findById = (id) => {
    const found = [teacherUser1, teacherUser2].find(u => String(u._id) === String(id));
    const chain = {
      populate: () => chain,
      then: (resolve) => resolve(found || null)
    };
    return chain;
  };

  // Stubs
  TeacherProfile.findOne = ({ user }) => {
    const uid = user?._id || user;
    if (String(uid) === String(teacherUser1._id)) return Promise.resolve(teacherProfile1);
    if (String(uid) === String(teacherUser2._id)) return Promise.resolve(teacherProfile2);
    return Promise.resolve(null);
  };

  TeachingAssignment.exists = (query) => {
    const matches = activeAssignments.some(a => {
      const matchTeacher = !query.teacher || String(a.teacher?._id || a.teacher) === String(query.teacher);
      const matchClass = !query.classRef || String(a.classRef?._id || a.classRef) === String(query.classRef);
      const matchInst = !query.institution || String(a.institution) === String(query.institution);
      const matchActive = query.isActive === undefined || a.isActive === query.isActive;
      return matchTeacher && matchClass && matchInst && matchActive;
    });
    return Promise.resolve(matches ? { _id: new mongoose.Types.ObjectId() } : null);
  };

  TeachingAssignment.find = (query) => {
    let result = activeAssignments.filter(a => {
      if (query.teacher && String(a.teacher?._id || a.teacher) !== String(query.teacher)) return false;
      if (query.classRef && query.classRef.$in) {
        const inIds = query.classRef.$in.map(String);
        if (!inIds.includes(String(a.classRef?._id || a.classRef))) return false;
      } else if (query.classRef) {
        if (String(a.classRef?._id || a.classRef) !== String(query.classRef)) return false;
      }
      if (query.isActive !== undefined && a.isActive !== query.isActive) return false;
      return true;
    });

    const chain = {
      populate: () => chain,
      then: (resolve) => resolve(result)
    };
    return chain;
  };

  Class.find = (query) => {
    let result = [classA, classB, classEmpty].filter(c => {
      if (query._id && query._id.$in) {
        const inIds = query._id.$in.map(String);
        if (!inIds.includes(String(c._id))) return false;
      }
      return true;
    });
    const chain = {
      populate: () => chain,
      sort: () => chain,
      then: (resolve) => resolve(result)
    };
    return chain;
  };

  Class.findOne = (query) => {
    const found = [classA, classB, classEmpty].find(c => String(c._id) === String(query._id));
    const chain = {
      populate: () => chain,
      then: (resolve) => resolve(found || null)
    };
    return chain;
  };

  StudentProfile.find = (query) => {
    const list = activeStudents.filter(s => {
      if (query.classRef && String(s.classRef) !== String(query.classRef)) return false;
      return true;
    });
    const chain = {
      populate: () => chain,
      sort: () => chain,
      then: (resolve) => resolve(list)
    };
    return chain;
  };

  StudentProfile.distinct = (field, query) => {
    const list = activeStudents.filter(s => {
      if (query.classRef && query.classRef.$in) {
        const inIds = query.classRef.$in.map(String);
        if (!inIds.includes(String(s.classRef))) return false;
      }
      return true;
    });
    return Promise.resolve([...new Set(list.map(s => String(s._id)))]);
  };

  StudentProfile.aggregate = (pipeline) => {
    const map = {};
    activeStudents.forEach(s => {
      const cid = String(s.classRef);
      map[cid] = (map[cid] || 0) + 1;
    });
    return Promise.resolve(Object.keys(map).map(cid => ({ _id: cid, count: map[cid] })));
  };

  Department.find = () => ({
    select: () => Promise.resolve([
      { _id: new mongoose.Types.ObjectId(), name: 'Computer Science and Engineering', code: 'CSE' }
    ])
  });

  AcademicYear.find = () => ({
    sort: () => Promise.resolve([{ year: '2026-2027', isActive: true }])
  });

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: A section with one assigned subject
    // -------------------------------------------------------------
    console.log('--- SCENARIO 1: A section with one assigned subject ---');
    activeAssignments = [
      {
        _id: new mongoose.Types.ObjectId(),
        classRef: classA,
        subject: subjectAlgo,
        teacher: teacherProfile1,
        institution: institutionId,
        isActive: true
      }
    ];
    activeStudents = [
      {
        _id: new mongoose.Types.ObjectId(),
        studentId: 'STU-1001',
        classRef: classA._id,
        institution: institutionId,
        user: { name: 'Bob Student', email: 'bob@example.com', isActive: true },
        department: 'Computer Science and Engineering',
        section: 'A',
        academicYear: '2026-2027',
        yearOfStudy: 'First Year'
      }
    ];

    let res = await request('/api/teacher/classes', teacherUser1);
    assert('getMyClasses returns HTTP 200 with 1 assigned section', res.status === 200 && res.body.classes.length === 1);
    assert('Section card shows subjectsCount: 1', res.body.classes[0].subjectsCount === 1);
    assert('Section card shows studentCount: 1', res.body.classes[0].studentCount === 1);

    let detailsRes = await request(`/api/teacher/classes/${classA._id}`, teacherUser1);
    assert('getClassDetails returns HTTP 200 for assigned section', detailsRes.status === 200 && detailsRes.body.success);
    assert('Details page displays totalSubjectsCount: 1', detailsRes.body.class.totalSubjectsCount === 1);
    assert('Subject assignments table has 1 assignment', detailsRes.body.class.assignments.length === 1);
    assert('Subject is CS101 Data Structures and Algorithms', detailsRes.body.class.assignments[0].subject.code === 'CS101');
    assert('Subject has valid Name, Code, Course Type, and Credits',
      detailsRes.body.class.assignments[0].subject.name === 'Data Structures and Algorithms' &&
      detailsRes.body.class.assignments[0].subject.code === 'CS101' &&
      detailsRes.body.class.assignments[0].subject.subjectType === 'Theory' &&
      detailsRes.body.class.assignments[0].subject.credits === 4
    );
    assert('Enrolled students count is 1', detailsRes.body.class.students.length === 1);
    assert('Student ID is STU-1001', detailsRes.body.class.students[0].studentId === 'STU-1001');

    // -------------------------------------------------------------
    // SCENARIO 2: Multiple subjects assigned to the same teacher in the same section
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Multiple subjects assigned to same teacher in same section ---');
    activeAssignments = [
      {
        _id: new mongoose.Types.ObjectId(),
        classRef: classA,
        subject: subjectAlgo,
        teacher: teacherProfile1,
        institution: institutionId,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId(),
        classRef: classA,
        subject: subjectAlgoLab,
        teacher: teacherProfile1,
        institution: institutionId,
        isActive: true
      }
    ];

    res = await request('/api/teacher/classes', teacherUser1);
    assert('Section hierarchy contains Section A only ONCE', res.body.classes.length === 1);
    assert('Section A displays distinct subjectsCount: 2 for teacher', res.body.classes[0].subjectsCount === 2);

    detailsRes = await request(`/api/teacher/classes/${classA._id}`, teacherUser1);
    assert('Details page displays totalSubjectsCount: 2', detailsRes.body.class.totalSubjectsCount === 2);
    assert('Each subject is displayed as a separate row (2 assignments)', detailsRes.body.class.assignments.length === 2);
    const codes = detailsRes.body.class.assignments.map(a => a.subject.code);
    assert('Both CS101 and CS101L are present in table', codes.includes('CS101') && codes.includes('CS101L'));

    // -------------------------------------------------------------
    // SCENARIO 3: Multiple subjects assigned to different teachers
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Multiple subjects assigned to different teachers ---');
    activeAssignments = [
      {
        _id: new mongoose.Types.ObjectId(),
        classRef: classA,
        subject: subjectAlgo,
        teacher: teacherProfile1,
        institution: institutionId,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId(),
        classRef: classA,
        subject: subjectMath,
        teacher: teacherProfile2,
        institution: institutionId,
        isActive: true
      }
    ];

    res = await request('/api/teacher/classes', teacherUser1);
    assert('Teacher 1 section card still only counts their subjects (subjectsCount: 1)', res.body.classes[0].subjectsCount === 1);

    detailsRes = await request(`/api/teacher/classes/${classA._id}`, teacherUser1);
    assert('Section details page includes ALL assigned subjects for section (total 2)', detailsRes.body.class.assignments.length === 2);
    const teacherNames = detailsRes.body.class.assignments.map(a => a.teacher.personalInfo.name);
    assert('Displays Dr. Alan Turing for CS101 and Dr. Ada Lovelace for MA102',
      teacherNames.includes('Dr. Alan Turing') && teacherNames.includes('Dr. Ada Lovelace')
    );

    // -------------------------------------------------------------
    // SCENARIO 4: Teacher assigned to multiple sections
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Teacher assigned to multiple sections ---');
    activeAssignments = [
      {
        _id: new mongoose.Types.ObjectId(),
        classRef: classA,
        subject: subjectAlgo,
        teacher: teacherProfile1,
        institution: institutionId,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId(),
        classRef: classB,
        subject: subjectAlgo,
        teacher: teacherProfile1,
        institution: institutionId,
        isActive: true
      }
    ];

    res = await request('/api/teacher/classes', teacherUser1);
    assert('Teacher 1 sees both Section A and Section B', res.body.classes.length === 2);
    const sectionNames = res.body.classes.map(c => c.section);
    assert('Contains Section A and Section B', sectionNames.includes('A') && sectionNames.includes('B'));

    // -------------------------------------------------------------
    // SCENARIO 5: Section with no subjects or no enrolled students
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Section with no enrolled students ---');
    activeAssignments = [
      {
        _id: new mongoose.Types.ObjectId(),
        classRef: classEmpty,
        subject: subjectMath,
        teacher: teacherProfile1,
        institution: institutionId,
        isActive: true
      }
    ];
    activeStudents = []; // No students

    detailsRes = await request(`/api/teacher/classes/${classEmpty._id}`, teacherUser1);
    assert('Empty section returns HTTP 200 with studentCount: 0', detailsRes.status === 200 && detailsRes.body.class.studentCount === 0);
    assert('Students array is empty ([])', Array.isArray(detailsRes.body.class.students) && detailsRes.body.class.students.length === 0);

    // -------------------------------------------------------------
    // SCENARIO 6: Unauthorized teacher attempting to access another teacher's section
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 6: Unauthorized teacher attempting to access another teacher section ---');
    // Assign Section A only to Teacher 1
    activeAssignments = [
      {
        _id: new mongoose.Types.ObjectId(),
        classRef: classA,
        subject: subjectAlgo,
        teacher: teacherProfile1,
        institution: institutionId,
        isActive: true
      }
    ];

    // Teacher 2 tries to access Section A
    const unauthRes = await request(`/api/teacher/classes/${classA._id}`, teacherUser2);
    assert('Teacher 2 receives HTTP 403 Forbidden', unauthRes.status === 403);
    assert('Error message denies access', unauthRes.body.error && unauthRes.body.error.includes('Unauthorized'));

    // -------------------------------------------------------------
    // SCENARIO 7: Administrator updating assignment and teacher portal reflecting change
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 7: Admin updates assignment and teacher portal reflects change ---');
    // Initially Teacher 1 only has CS101 in Section A
    activeAssignments = [
      {
        _id: new mongoose.Types.ObjectId(),
        classRef: classA,
        subject: subjectAlgo,
        teacher: teacherProfile1,
        institution: institutionId,
        isActive: true
      }
    ];
    let initialRes = await request('/api/teacher/classes', teacherUser1);
    assert('Initial subject count for Teacher 1 in Section A is 1', initialRes.body.classes[0].subjectsCount === 1);

    // Admin assigns second subject (CS101L) to Teacher 1 in Section A
    activeAssignments.push({
      _id: new mongoose.Types.ObjectId(),
      classRef: classA,
      subject: subjectAlgoLab,
      teacher: teacherProfile1,
      institution: institutionId,
      isActive: true
    });

    let updatedRes = await request('/api/teacher/classes', teacherUser1);
    assert('After admin assignment update, refetch reflects subjectsCount: 2', updatedRes.body.classes[0].subjectsCount === 2);

    let updatedDetails = await request(`/api/teacher/classes/${classA._id}`, teacherUser1);
    assert('Details page immediately displays updated 2 subjects', updatedDetails.body.class.assignments.length === 2);

  } finally {
    // Restore stubs
    User.findById = origUserFindById;
    TeacherProfile.findOne = origTeacherProfileFindOne;
    TeachingAssignment.find = origTeachingAssignmentFind;
    TeachingAssignment.exists = origTeachingAssignmentExists;
    Class.find = origClassFind;
    Class.findOne = origClassFindOne;
    StudentProfile.find = origStudentProfileFind;
    StudentProfile.distinct = origStudentProfileDistinct;
    StudentProfile.aggregate = origStudentProfileAggregate;
    Department.find = origDepartmentFind;
    AcademicYear.find = origAcademicYearFind;

    server.close();
  }

  console.log('\n================================================================');
  console.log(` TEST RESULTS: ${passCount} / ${testCount} PASSED (${passCount === testCount ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'})`);
  console.log('================================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
};

runSuite().catch(err => {
  console.error('Test suite runner failed with unhandled error:', err);
  process.exit(1);
});
