require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  require('../models/User');
  require('../models/Subject');
  require('../models/Department');
  const Class = require('../models/Class');
  const StudentProfile = require('../models/StudentProfile');
  const TeachingAssignment = require('../models/TeachingAssignment');
  const TeacherProfile = require('../models/TeacherProfile');

  const classes = await Class.find();
  console.log('=== ALL CLASSES ===');
  for (const c of classes) {
    const studentCount = await StudentProfile.countDocuments({ classRef: c._id });
    const asgns = await TeachingAssignment.find({ classRef: c._id, isActive: true }).populate('teacher').populate('subject');
    console.log(`Class: ${c._id} | ${c.course} - ${c.department} | ${c.yearOfStudy} | Sem: ${c.semester} | Sec: ${c.section} | Students: ${studentCount} | Assignments: ${asgns.length}`);
    asgns.forEach(a => {
      console.log(`   -> Teacher: ${a.teacher?.teacherId} | Subject: ${a.subject?.name}`);
    });
  }
  process.exit(0);
}

run().catch(console.error);
