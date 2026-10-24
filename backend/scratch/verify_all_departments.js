const mongoose = require('mongoose');
require('dotenv').config();

const Department = require('../models/Department');
const Institution = require('../models/Institution');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const Subject = require('../models/Subject');
const Class = require('../models/Class');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/studypoint');
  console.log('Connected to MongoDB');

  const institution = await Institution.findOne();
  if (!institution) {
    console.error('No institution found');
    process.exit(1);
  }
  console.log('Using institution:', institution.name, institution._id);

  const adminController = require('../controllers/adminController');
  await adminController.ensureDepartmentsForInstitution(institution._id);

  // 1. Verify Departments collection
  const departments = await Department.find({ institution: institution._id });
  console.log(`Found ${departments.length} departments in MongoDB:`);
  departments.forEach(d => {
    console.log(`  - [${d.code}] ${d.name} (_id: ${d._id})`);
  });

  if (departments.length === 0) {
    console.error('FAIL: No departments in MongoDB!');
    process.exit(1);
  }

  const dept1 = departments[0];
  const dept2 = departments.length > 1 ? departments[1] : departments[0];

  // 2. Verify Student Profile creation & departmentRef linking
  console.log('\n--- Testing Student Profile ---');
  let testUser = await User.findOne({ email: 'test_dept_student@example.com' });
  if (testUser) {
    await StudentProfile.deleteOne({ user: testUser._id });
    await User.deleteOne({ _id: testUser._id });
  }

  testUser = new User({
    institution: institution._id,
    userId: 'STU_DEPT_TEST',
    name: 'Dept Test Student',
    email: 'test_dept_student@example.com',
    password: 'Password@123',
    role: 'student',
    isActive: true
  });
  await testUser.save();

  const testStudent = new StudentProfile({
    institution: institution._id,
    user: testUser._id,
    studentId: 'STU_DEPT_TEST',
    rollNumber: 'ROLL_TEST_01',
    course: 'B.Tech',
    department: dept1.name,
    departmentRef: dept1._id,
    semester: '1st',
    academicYear: '2026-2027',
    yearOfStudy: 'First Year'
  });
  await testStudent.save();

  const fetchedStudent = await StudentProfile.findById(testStudent._id).populate('departmentRef', 'name code');
  console.log('Student created with departmentRef:', fetchedStudent.departmentRef?.name, 'code:', fetchedStudent.departmentRef?.code);
  if (String(fetchedStudent.departmentRef?._id) !== String(dept1._id)) {
    console.error('FAIL: Student departmentRef mismatch');
  } else {
    console.log('PASS: Student departmentRef stored and populated correctly');
  }

  // Update student department to dept2
  fetchedStudent.department = dept2.name;
  fetchedStudent.departmentRef = dept2._id;
  await fetchedStudent.save();
  const updatedStudent = await StudentProfile.findById(testStudent._id).populate('departmentRef', 'name code');
  console.log('Student updated with new departmentRef:', updatedStudent.departmentRef?.name);
  if (String(updatedStudent.departmentRef?._id) !== String(dept2._id)) {
    console.error('FAIL: Student departmentRef update mismatch');
  } else {
    console.log('PASS: Student departmentRef updated and persisted correctly');
  }

  // 3. Verify Teacher Profile creation & departmentRef linking
  console.log('\n--- Testing Teacher Profile ---');
  let teacherUser = await User.findOne({ email: 'test_dept_teacher@example.com' });
  if (teacherUser) {
    await TeacherProfile.deleteOne({ user: teacherUser._id });
    await User.deleteOne({ _id: teacherUser._id });
  }

  teacherUser = new User({
    institution: institution._id,
    userId: 'TCH_DEPT_TEST',
    name: 'Dept Test Teacher',
    email: 'test_dept_teacher@example.com',
    password: 'Password@123',
    role: 'teacher',
    isActive: true
  });
  await teacherUser.save();

  const testTeacher = new TeacherProfile({
    institution: institution._id,
    user: teacherUser._id,
    teacherId: 'TCH_DEPT_TEST',
    department: dept1.name,
    departmentRef: dept1._id,
    designation: 'Associate Professor',
    qualification: 'Ph.D. in Computer Science',
    professionalInfo: {
      highestQualification: 'Ph.D.',
      yearsOfExperience: 8,
      specialization: 'Artificial Intelligence'
    }
  });
  await testTeacher.save();

  const fetchedTeacher = await TeacherProfile.findById(testTeacher._id).populate('departmentRef', 'name code');
  console.log('Teacher created with departmentRef:', fetchedTeacher.departmentRef?.name, 'designation:', fetchedTeacher.designation);
  if (String(fetchedTeacher.departmentRef?._id) !== String(dept1._id)) {
    console.error('FAIL: Teacher departmentRef mismatch');
  } else {
    console.log('PASS: Teacher departmentRef stored and populated correctly');
  }

  // Update teacher department and verify existing fields are preserved
  fetchedTeacher.department = dept2.name;
  fetchedTeacher.departmentRef = dept2._id;
  await fetchedTeacher.save();

  const updatedTeacher = await TeacherProfile.findById(testTeacher._id).populate('departmentRef', 'name code');
  if (
    String(updatedTeacher.departmentRef?._id) === String(dept2._id) &&
    updatedTeacher.designation === 'Associate Professor' &&
    updatedTeacher.professionalInfo?.specialization === 'Artificial Intelligence' &&
    updatedTeacher.professionalInfo?.yearsOfExperience === 8
  ) {
    console.log('PASS: Teacher department updated and all existing fields preserved intact');
  } else {
    console.error('FAIL: Teacher update failed or lost fields');
  }

  // 4. Verify Subject creation & departmentRef linking
  console.log('\n--- Testing Subject ---');
  const testSubj = new Subject({
    institution: institution._id,
    name: 'Advanced Algorithms Test',
    code: 'CS_TEST_99',
    department: dept1.name,
    departmentRef: dept1._id,
    semester: '1st',
    academicYear: '2026-2027',
    credits: 4,
    subjectType: 'Theory',
    isActive: true
  });
  await testSubj.save();

  const fetchedSubj = await Subject.findById(testSubj._id).populate('departmentRef', 'name code');
  if (String(fetchedSubj.departmentRef?._id) === String(dept1._id)) {
    console.log('PASS: Subject departmentRef stored and populated correctly');
  } else {
    console.error('FAIL: Subject departmentRef mismatch');
  }

  // 5. Verify Class / Section creation & departmentRef linking
  console.log('\n--- Testing Class / Section ---');
  let testClass = await Class.findOne({ code: 'TEST_SEC_XYZ', institution: institution._id });
  if (testClass) {
    await Class.deleteOne({ _id: testClass._id });
  }

  testClass = new Class({
    institution: institution._id,
    name: `B.Tech - ${dept1.name} (Sem 1st, Sec TEST_XYZ)`,
    course: 'B.Tech',
    department: dept1.name,
    departmentRef: dept1._id,
    academicYear: '2026-2027',
    semester: '1st',
    section: 'TEST_XYZ',
    yearOfStudy: 'First Year',
    isActive: true
  });
  await testClass.save();

  const fetchedClass = await Class.findById(testClass._id).populate('departmentRef', 'name code');
  if (String(fetchedClass.departmentRef?._id) === String(dept1._id)) {
    console.log('PASS: Class departmentRef stored and populated correctly');
  } else {
    console.error('FAIL: Class departmentRef mismatch');
  }

  // Cleanup test artifacts
  await StudentProfile.deleteOne({ _id: testStudent._id });
  await User.deleteOne({ _id: testUser._id });
  await TeacherProfile.deleteOne({ _id: testTeacher._id });
  await User.deleteOne({ _id: teacherUser._id });
  await Subject.deleteOne({ _id: testSubj._id });
  await Class.deleteOne({ _id: testClass._id });

  console.log('\n--- All Database Model Tests PASSED ---');
  process.exit(0);
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
