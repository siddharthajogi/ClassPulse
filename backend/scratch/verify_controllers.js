const mongoose = require('mongoose');
require('dotenv').config();

const adminController = require('../controllers/adminController');
const Department = require('../models/Department');
const Institution = require('../models/Institution');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const Class = require('../models/Class');

// Mock Express req and res
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
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/studypoint');
  console.log('Connected to MongoDB');

  const institution = await Institution.findOne({ code: 'SPIT-01' }) || await Institution.findOne();
  console.log('Testing with institution:', institution.name, institution._id);

  const departments = await Department.find({ institution: institution._id });
  console.log(`Found ${departments.length} departments.`);
  const dept1 = departments.find(d => d.code === 'CSE') || departments[0];
  const dept2 = departments.find(d => d.code === 'EEE') || departments[1];

  let adminUser = await User.findOne({ role: 'admin', institution: institution._id });
  if (!adminUser) {
    adminUser = new User({
      institution: institution._id,
      userId: 'TEST_ADMIN_CTR',
      name: 'Test Controller Admin',
      email: 'test_admin_ctr@example.com',
      password: 'Password@123',
      role: 'admin',
      isActive: true
    });
    await adminUser.save();
  }
  adminUser.institution = institution;

  // 1. Test getDepartments
  console.log('\n--- 1. Testing getDepartments ---');
  const { req: gReq, res: gRes, getResult: gGet } = mockReqRes({}, {}, {}, adminUser, institution);
  await adminController.getDepartments(gReq, gRes);
  const gResult = gGet();
  if (gResult.status === 200 && gResult.data.success && Array.isArray(gResult.data.departments)) {
    console.log(`PASS: getDepartments returned ${gResult.data.departments.length} departments.`);
    console.log(`Sample department:`, gResult.data.departments[0]);
  } else {
    console.error('FAIL: getDepartments failed', gResult);
  }

  // 2. Test createStudent with department _id
  console.log('\n--- 2. Testing createStudent with department _id ---');
  const stuEmail = 'stu_ctr_test@example.com';
  await StudentProfile.deleteMany({ $or: [{ studentId: 'stu_ctr_99' }, { rollNumber: 'ROLL_CTR_99' }] });
  await User.deleteMany({ $or: [{ email: stuEmail }, { userId: 'stu_ctr_99' }] });

  // Ensure 5th sem class exists for dept2 as well for update test
  let testClass2 = await Class.findOne({ institution: institution._id, department: dept2.name, semester: '5th', section: 'A' });
  if (!testClass2) {
    testClass2 = new Class({
      institution: institution._id,
      name: `B.Tech - ${dept2.name} (Sem 5th, Sec A)`,
      course: 'B.Tech',
      department: dept2.name,
      departmentRef: dept2._id,
      academicYear: '2026-2027',
      semester: '5th',
      section: 'A',
      yearOfStudy: 'Third Year',
      isActive: true
    });
    await testClass2.save();
  }

  const { req: sReq, res: sRes, getResult: sGet } = mockReqRes({
    studentId: 'STU_CTR_99',
    name: 'Student Controller Test',
    email: stuEmail,
    password: 'Password@123',
    rollNumber: 'ROLL_CTR_99',
    department: dept1._id.toString(),
    course: 'B.Tech',
    section: 'A',
    semester: '5th',
    academicYear: '2026-2027',
    yearOfStudy: 'Third Year'
  }, {}, {}, adminUser, institution);

  await adminController.createStudent(sReq, sRes);
  const sResult = sGet();
  if (sResult.status === 201 && sResult.data.success) {
    console.log('PASS: Student created successfully.');
    const savedStu = await StudentProfile.findOne({ studentId: sResult.data.studentId }).populate('departmentRef', 'name code');
    console.log('Student departmentRef populated:', savedStu.departmentRef?.name, 'department string:', savedStu.department);
    if (String(savedStu.departmentRef?._id) === String(dept1._id) && savedStu.department === dept1.name) {
      console.log('PASS: Student saved with matching departmentRef and name string.');
    } else {
      console.error('FAIL: Student department mismatch');
    }
  } else {
    console.error('FAIL: createStudent failed', sResult);
  }

  // 3. Test invalid department ID rejected with 400
  console.log('\n--- 3. Testing createStudent rejection on invalid department ID ---');
  const { req: invReq, res: invRes, getResult: invGet } = mockReqRes({
    name: 'Invalid Dept Student',
    email: 'invalid_dept_student@example.com',
    rollNumber: 'ROLL_INV_01',
    department: 'nonexistent_id_abc',
    course: 'B.Tech',
    semester: '1st',
    academicYear: '2026-2027'
  }, {}, {}, adminUser, institution);

  await adminController.createStudent(invReq, invRes);
  const invResult = invGet();
  if (invResult.status === 400 && !invResult.data.success) {
    console.log('PASS: Correctly rejected invalid department ID with 400 status:', invResult.data.error);
  } else {
    console.error('FAIL: Invalid department ID was not rejected properly', invResult);
  }

  // 4. Test updateStudent with department _id
  console.log('\n--- 4. Testing updateStudent with department _id ---');
  const stuToUpdate = await StudentProfile.findOne({ studentId: 'stu_ctr_99' });
  const { req: uReq, res: uRes, getResult: uGet } = mockReqRes({
    name: 'Student Controller Test Updated',
    department: dept2._id.toString(),
    course: 'B.Tech',
    semester: '5th',
    academicYear: '2026-2027'
  }, { id: stuToUpdate._id.toString() }, {}, adminUser, institution);

  await adminController.updateStudent(uReq, uRes);
  const uResult = uGet();
  if (uResult.status === 200 && uResult.data.success) {
    const updatedStu = await StudentProfile.findById(stuToUpdate._id).populate('departmentRef', 'name code');
    if (String(updatedStu.departmentRef?._id) === String(dept2._id) && updatedStu.department === dept2.name) {
      console.log('PASS: Student updated with new departmentRef and department string:', updatedStu.department);
    } else {
      console.error('FAIL: Student update mismatch');
    }
  } else {
    console.error('FAIL: updateStudent failed', uResult);
  }

  // 5. Test createTeacher with department _id
  console.log('\n--- 5. Testing createTeacher with department _id ---');
  const tchEmail = 'tch_ctr_test@example.com';
  await TeacherProfile.deleteMany({ teacherId: { $regex: /^tch_ctr_99$/i } });
  await User.deleteMany({ $or: [{ email: tchEmail }, { userId: { $regex: /^tch_ctr_99$/i } }] });

  const { req: tReq, res: tRes, getResult: tGet } = mockReqRes({
    teacherId: 'TCH_CTR_99',
    name: 'Teacher Controller Test',
    email: tchEmail,
    password: 'Password@123',
    phone: '9876543210',
    address: '123 Main St, Hyderabad',
    department: dept1._id.toString(),
    designation: 'Assistant Professor',
    highestQualification: 'M.Tech',
    specialization: 'Cloud Computing',
    yearsOfExperience: 5
  }, {}, {}, adminUser, institution);

  await adminController.createTeacher(tReq, tRes);
  const tResult = tGet();
  if (tResult.status === 201 && tResult.data.success) {
    console.log('PASS: Teacher created successfully.');
    const savedTch = await TeacherProfile.findById(tResult.data.teacher._id).populate('departmentRef', 'name code');
    if (String(savedTch.departmentRef?._id) === String(dept1._id) && savedTch.department === dept1.name) {
      console.log('PASS: Teacher saved with matching departmentRef and name string.');
    } else {
      console.error('FAIL: Teacher department mismatch');
    }
  } else {
    console.error('FAIL: createTeacher failed', tResult);
  }

  // 6. Test updateTeacher with department _id preserving all fields
  console.log('\n--- 6. Testing updateTeacher preserving all teacher fields ---');
  const tchToUpdate = await TeacherProfile.findOne({ teacherId: tResult.data?.teacher?.teacherId });
  const { req: utReq, res: utRes, getResult: utGet } = mockReqRes({
    name: 'Teacher Controller Test Renamed',
    email: tchEmail,
    phone: '9876543210',
    address: '123 Main St, Hyderabad',
    department: dept2._id.toString(),
    designation: 'Professor',
    highestQualification: 'Ph.D.',
    specialization: 'Distributed Systems',
    yearsOfExperience: 10
  }, { id: tchToUpdate._id.toString() }, {}, adminUser, institution);

  await adminController.updateTeacher(utReq, utRes);
  const utResult = utGet();
  if (utResult.status === 200 && utResult.data.success) {
    const updatedTch = await TeacherProfile.findById(tchToUpdate._id).populate('departmentRef', 'name code');
    if (
      String(updatedTch.departmentRef?._id) === String(dept2._id) &&
      updatedTch.department === dept2.name &&
      updatedTch.designation === 'Professor' &&
      updatedTch.professionalInfo?.specialization === 'Distributed Systems' &&
      updatedTch.professionalInfo?.yearsOfExperience === 10
    ) {
      console.log('PASS: Teacher updated with new departmentRef and all fields preserved intact!');
    } else {
      console.error('FAIL: Teacher fields lost during update', updatedTch);
    }
  } else {
    console.error('FAIL: updateTeacher failed', utResult);
  }

  // Cleanup test users and profiles
  const cleanStuUser = await User.findOne({ email: stuEmail });
  if (cleanStuUser) {
    await StudentProfile.deleteOne({ user: cleanStuUser._id });
    await User.deleteOne({ _id: cleanStuUser._id });
  }
  const cleanTchUser = await User.findOne({ email: tchEmail });
  if (cleanTchUser) {
    await TeacherProfile.deleteOne({ user: cleanTchUser._id });
    await User.deleteOne({ _id: cleanTchUser._id });
  }

  console.log('\n--- ALL CONTROLLER TESTS PASSED ---');
  process.exit(0);
}

run().catch(err => {
  console.error('Controller test error:', err);
  process.exit(1);
});
