const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const Subject = require('../models/Subject');
const Class = require('../models/Class');

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  await StudentProfile.deleteMany({ studentId: { $in: ['STU_DEPT_TEST', 'stu_ctr_99', 'STU_CTR_99'] } });
  await TeacherProfile.deleteMany({ teacherId: { $in: ['TCH_DEPT_TEST', 'TCH_CTR_99'] } });
  await User.deleteMany({ email: { $in: ['test_dept_student@example.com', 'test_dept_teacher@example.com', 'stu_ctr_test@example.com', 'tch_ctr_test@example.com', 'test_admin_ctr@example.com'] } });
  await Subject.deleteMany({ code: 'CS_TEST_99' });
  await Class.deleteMany({ section: { $in: ['TEST_XYZ'] } });
  console.log('Test cleanup completed successfully');
  process.exit(0);
}
clean();
