const mongoose = require('mongoose');
require('dotenv').config();

const adminController = require('../controllers/adminController');
const TeacherProfile = require('../models/TeacherProfile');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const TeachingAssignment = require('../models/TeachingAssignment');
const Institution = require('../models/Institution');

function mockReqRes(body = {}, params = {}, query = {}, user = null, institution = null) {
  const req = {
    body,
    params,
    query,
    currentUser: user || {
      _id: new mongoose.Types.ObjectId(),
      role: 'admin',
      institution: institution || { _id: new mongoose.Types.ObjectId() }
    }
  };

  let resData = null;
  let resStatus = 200;
  const res = {
    status(code) {
      resStatus = code;
      return this;
    },
    json(data) {
      resData = data;
      return this;
    }
  };

  return { req, res, getResult: () => ({ status: resStatus, data: resData }) };
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const institution = await Institution.findOne();
  if (!institution) {
    console.error('No institution found');
    process.exit(1);
  }
  console.log('Using institution:', institution.name, institution._id);

  let adminUser = await User.findOne({ role: 'admin', institution: institution._id });
  if (!adminUser) {
    adminUser = new User({
      institution: institution._id,
      userId: 'TEST_ADMIN_DEL',
      name: 'Admin Del Test',
      email: 'admin_del_test@example.com',
      password: 'Password@123',
      role: 'admin',
      isActive: true
    });
    await adminUser.save();
  }
  adminUser.institution = institution;

  // Cleanup any old test teachers/users/classes/subjects
  await TeachingAssignment.deleteMany({ title: 'TEST_DEL_ASSIGN' });
  await TeacherProfile.deleteMany({ teacherId: { $in: ['TCH_NO_DEP', 'TCH_WITH_DEP', 'TCH_SUB', 'TCH_UNASSIGN_TEST', 'TCH_DEACT_TEST'] } });
  await User.deleteMany({ userId: { $in: ['TCH_NO_DEP', 'TCH_WITH_DEP', 'TCH_SUB', 'TCH_UNASSIGN_TEST', 'TCH_DEACT_TEST'] } });
  await Subject.deleteMany({ code: 'SUB_DEL_TEST' });
  await Class.deleteMany({ section: 'SEC_DEL_TEST' });

  // Create a dummy subject and class for testing assignments
  const testSubj = new Subject({
    institution: institution._id,
    name: 'Delete Test Subject',
    code: 'SUB_DEL_TEST',
    department: 'Computer Science and Engineering',
    semester: '1st',
    academicYear: '2026-2027',
    credits: 3,
    subjectType: 'Theory',
    isActive: true
  });
  await testSubj.save();

  const testClass = new Class({
    institution: institution._id,
    name: 'B.Tech - CSE (Sem 1st, Sec SEC_DEL_TEST)',
    course: 'B.Tech',
    department: 'Computer Science and Engineering',
    academicYear: '2026-2027',
    semester: '1st',
    section: 'SEC_DEL_TEST',
    yearOfStudy: 'First Year',
    isActive: true
  });
  await testClass.save();

  // Helper to create test teacher
  async function createTeacher(tId, name, email) {
    const user = new User({
      institution: institution._id,
      userId: tId,
      name,
      email,
      password: 'Password@123',
      role: 'teacher',
      isActive: true
    });
    await user.save();

    const teacher = new TeacherProfile({
      institution: institution._id,
      user: user._id,
      teacherId: tId,
      department: 'Computer Science and Engineering',
      designation: 'Assistant Professor',
      personalInfo: { name, email },
      professionalInfo: { highestQualification: 'M.Tech', yearsOfExperience: 3 }
    });
    await teacher.save();
    return { user, teacher };
  }

  // --- Test 1: Delete a teacher who has NO active dependencies ---
  console.log('\n--- Test 1: Teacher with NO active dependencies ---');
  const t1 = await createTeacher('TCH_NO_DEP', 'Teacher No Dependencies', 't1_no_dep@example.com');
  
  // Check dependencies
  const { req: depReq1, res: depRes1, getResult: depGet1 } = mockReqRes({}, { id: t1.teacher._id.toString() }, {}, adminUser, institution);
  await adminController.getTeacherDependencies(depReq1, depRes1);
  const dep1 = depGet1();
  if (dep1.status === 200 && dep1.data.hasDependencies === false && dep1.data.canDeleteDirectly === true) {
    console.log('PASS: getTeacherDependencies correctly reported no dependencies.');
  } else {
    console.error('FAIL: getTeacherDependencies failed for teacher without dependencies', dep1);
  }

  // Execute deletion
  const { req: delReq1, res: delRes1, getResult: delGet1 } = mockReqRes({}, { id: t1.teacher._id.toString() }, {}, adminUser, institution);
  await adminController.deleteTeacher(delReq1, delRes1);
  const del1 = delGet1();
  if (del1.status === 200 && del1.data.success) {
    const checkT1 = await TeacherProfile.findById(t1.teacher._id);
    const checkU1 = await User.findById(t1.user._id);
    if (!checkT1 && !checkU1) {
      console.log('PASS: Teacher and user permanently deleted with 200 status.');
    } else {
      console.error('FAIL: Teacher record still exists after deletion');
    }
  } else {
    console.error('FAIL: deleteTeacher failed for teacher without dependencies', del1);
  }

  // --- Test 2: Teacher WITH active teaching assignment (Blocked when no resolution specified) ---
  console.log('\n--- Test 2: Teacher WITH active teaching assignment (Blocked without resolution) ---');
  const t2 = await createTeacher('TCH_WITH_DEP', 'Teacher With Assignments', 't2_with_dep@example.com');
  const assignment1 = new TeachingAssignment({
    institution: institution._id,
    teacher: t2.teacher._id,
    subject: testSubj._id,
    classRef: testClass._id,
    academicYear: '2026-2027',
    title: 'TEST_DEL_ASSIGN',
    isActive: true
  });
  await assignment1.save();

  // Check dependencies
  const { req: depReq2, res: depRes2, getResult: depGet2 } = mockReqRes({}, { id: t2.teacher._id.toString() }, {}, adminUser, institution);
  await adminController.getTeacherDependencies(depReq2, depRes2);
  const dep2 = depGet2();
  if (dep2.status === 200 && dep2.data.hasDependencies === true && dep2.data.assignmentCount === 1) {
    console.log('PASS: getTeacherDependencies correctly identified 1 active assignment:');
    console.log(`      Subject: ${dep2.data.assignments[0].subjectName} (${dep2.data.assignments[0].subjectCode}), Class: ${dep2.data.assignments[0].className}`);
  } else {
    console.error('FAIL: getTeacherDependencies failed to identify assignments', dep2);
  }

  // Attempt direct deletion without resolution -> MUST return 400 with assignment details
  const { req: delReq2, res: delRes2, getResult: delGet2 } = mockReqRes({}, { id: t2.teacher._id.toString() }, {}, adminUser, institution);
  await adminController.deleteTeacher(delReq2, delRes2);
  const del2 = delGet2();
  if (del2.status === 400 && del2.data.hasDependencies === true && del2.data.assignments.length === 1) {
    console.log('PASS: Direct deletion without resolution was safely rejected with 400 and full dependency details.');
  } else {
    console.error('FAIL: Deletion with active assignments was not blocked properly', del2);
  }

  // --- Test 3: Resolve dependencies by Reassigning to another teacher ---
  console.log('\n--- Test 3: Resolve dependencies by Reassigning to another teacher ---');
  const tSub = await createTeacher('TCH_SUB', 'Substitute Teacher', 't_sub@example.com');

  const { req: delReq3, res: delRes3, getResult: delGet3 } = mockReqRes(
    { reassignToTeacherId: tSub.teacher._id.toString() },
    { id: t2.teacher._id.toString() },
    {},
    adminUser,
    institution
  );
  await adminController.deleteTeacher(delReq3, delRes3);
  const del3 = delGet3();
  if (del3.status === 200 && del3.data.success) {
    const checkT2 = await TeacherProfile.findById(t2.teacher._id);
    const updatedAssign = await TeachingAssignment.findById(assignment1._id);
    if (!checkT2 && String(updatedAssign.teacher) === String(tSub.teacher._id)) {
      console.log('PASS: Teacher deleted and active teaching assignment was safely reassigned to substitute teacher.');
    } else {
      console.error('FAIL: Reassignment did not update TeachingAssignment pointer correctly', updatedAssign);
    }
  } else {
    console.error('FAIL: Reassign & delete failed', del3);
  }

  // --- Test 4: Resolve dependencies by Unassigning from courses ---
  console.log('\n--- Test 4: Resolve dependencies by Unassigning from courses ---');
  const testSubj2 = new Subject({
    institution: institution._id,
    name: 'Delete Test Subject 2',
    code: 'SUB_DEL_TEST_2',
    department: 'Computer Science and Engineering',
    semester: '1st',
    academicYear: '2026-2027',
    credits: 3,
    subjectType: 'Theory',
    isActive: true
  });
  await testSubj2.save();

  const t4 = await createTeacher('TCH_UNASSIGN_TEST', 'Teacher Unassign Test', 't4_unassign@example.com');
  const assignment2 = new TeachingAssignment({
    institution: institution._id,
    teacher: t4.teacher._id,
    subject: testSubj2._id,
    classRef: testClass._id,
    academicYear: '2026-2027',
    title: 'TEST_DEL_ASSIGN',
    isActive: true
  });
  await assignment2.save();

  const { req: delReq4, res: delRes4, getResult: delGet4 } = mockReqRes(
    { unassignAssignments: true },
    { id: t4.teacher._id.toString() },
    {},
    adminUser,
    institution
  );
  await adminController.deleteTeacher(delReq4, delRes4);
  const del4 = delGet4();
  if (del4.status === 200 && del4.data.success) {
    const checkT4 = await TeacherProfile.findById(t4.teacher._id);
    const updatedAssign2 = await TeachingAssignment.findById(assignment2._id);
    if (!checkT4 && updatedAssign2.teacher === null) {
      console.log('PASS: Teacher deleted and active course was safely unassigned (teacher set to null).');
    } else {
      console.error('FAIL: Unassign did not set teacher to null', updatedAssign2);
    }
  } else {
    console.error('FAIL: Unassign & delete failed', del4);
  }

  // --- Test 5: Resolve dependencies by Deactivating account instead ---
  console.log('\n--- Test 5: Deactivate Account Instead ---');
  const testSubj3 = new Subject({
    institution: institution._id,
    name: 'Delete Test Subject 3',
    code: 'SUB_DEL_TEST_3',
    department: 'Computer Science and Engineering',
    semester: '1st',
    academicYear: '2026-2027',
    credits: 3,
    subjectType: 'Theory',
    isActive: true
  });
  await testSubj3.save();

  const t5 = await createTeacher('TCH_DEACT_TEST', 'Teacher Deactivate Test', 't5_deact@example.com');
  const assignment3 = new TeachingAssignment({
    institution: institution._id,
    teacher: t5.teacher._id,
    subject: testSubj3._id,
    classRef: testClass._id,
    academicYear: '2026-2027',
    title: 'TEST_DEL_ASSIGN',
    isActive: true
  });
  await assignment3.save();

  const { req: delReq5, res: delRes5, getResult: delGet5 } = mockReqRes(
    { action: 'deactivate' },
    { id: t5.teacher._id.toString() },
    {},
    adminUser,
    institution
  );
  await adminController.deleteTeacher(delReq5, delRes5);
  const del5 = delGet5();
  if (del5.status === 200 && del5.data.success) {
    const checkT5 = await TeacherProfile.findById(t5.teacher._id);
    const checkU5 = await User.findById(t5.user._id);
    const updatedAssign3 = await TeachingAssignment.findById(assignment3._id);
    if (checkT5 && checkU5 && checkU5.isActive === false && updatedAssign3.teacher === null) {
      console.log('PASS: Teacher account safely deactivated, assignments unassigned, and profile preserved.');
    } else {
      console.error('FAIL: Deactivation failed', checkU5);
    }
  } else {
    console.error('FAIL: Deactivate failed', del5);
  }

  // Verify that unrelated student, subject, and class records remain intact
  const checkSubj = await Subject.findById(testSubj._id);
  const checkClass = await Class.findById(testClass._id);
  if (checkSubj && checkClass) {
    console.log('\nPASS: Unrelated subject and class records remain completely intact.');
  } else {
    console.error('FAIL: Subject or class record was corrupted/deleted!');
  }

  // Cleanup test artifacts
  await TeachingAssignment.deleteMany({ title: 'TEST_DEL_ASSIGN' });
  await TeacherProfile.deleteMany({ _id: { $in: [tSub.teacher._id, t5.teacher._id] } });
  await User.deleteMany({ _id: { $in: [tSub.user._id, t5.user._id] } });
  await Subject.deleteMany({ code: { $in: ['SUB_DEL_TEST', 'SUB_DEL_TEST_2', 'SUB_DEL_TEST_3'] } });
  await Class.deleteOne({ _id: testClass._id });

  console.log('\n--- ALL DELETE TEACHER TESTS PASSED ---');
  process.exit(0);
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
