require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  require('../models/User');
  require('../models/Department');
  const Class = require('../models/Class');
  const StudentProfile = require('../models/StudentProfile');

  const students = await StudentProfile.find().populate('user').populate('classRef');
  console.log(`=== ALL STUDENTS (${students.length}) ===`);
  students.forEach(s => {
    console.log(`- ${s.user?.name || 'No Name'} | ID: ${s.studentId} | Dept: ${s.department} | Class: ${s.classRef?.name} | Sec: ${s.section || s.classRef?.section} | Year: ${s.classRef?.yearOfStudy || s.yearOfStudy} | AcadYear: ${s.academicYear}`);
  });
  process.exit(0);
}

run().catch(console.error);
