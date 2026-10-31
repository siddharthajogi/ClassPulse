const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const AcademicRecord = require('../models/AcademicRecord');
const TeachingAssignment = require('../models/TeachingAssignment');
const AcademicYear = require('../models/AcademicYear');
const Subject = require('../models/Subject');
const Class = require('../models/Class');

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);

  const StudentProfile = require('../models/StudentProfile');
  const students = await StudentProfile.find().populate('classRef');
  console.log(`Found ${students.length} students:`);
  students.forEach(s => {
    console.log(`- ${s.studentId}: Class "${s.classRef?.name}" (${s.classRef?._id})`);
  });

  const asgns = await TeachingAssignment.find().populate('subject').populate('classRef').limit(5);
  console.log('Sample TeachingAssignments:');
  asgns.forEach(a => {
    console.log(`- ID: ${a._id}, Title: "${a.title || ''}", Subject: "${a.subject?.name || ''}", Class: "${a.classRef?.name || ''}"`);
  });

  const recs = await AcademicRecord.find().populate('subject').populate('academicYear').limit(5);
  console.log('Sample AcademicRecords:');
  recs.forEach(r => {
    console.log(`- ID: ${r._id}, Subject: "${r.subject?.name || ''}", Marks: ${r.marksObtained}/${r.totalMarks}, Year: "${r.academicYear?.year || ''}", TermId: ${r.termId}`);
  });

  await mongoose.disconnect();
}

inspect().catch(console.error);
