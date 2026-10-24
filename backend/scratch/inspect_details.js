const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('=== All Students ===');
  const students = await db.collection('studentprofiles').find({}).toArray();
  for (const s of students) {
    const user = await db.collection('users').findOne({ _id: s.user });
    console.log(`Student ID: ${s.studentId}, User: ${user?.userId}, Name: ${user?.name || s.personalInfo?.name}, classRef: ${s.classRef}, course: ${s.course}, dept: ${s.department}, sec: ${s.section}, inst: ${s.institution}`);
  }

  console.log('\n=== All Classes ===');
  const classes = await db.collection('classes').find({}).toArray();
  for (const c of classes) {
    console.log(`Class ID: ${c._id}, name: ${c.name}, course: ${c.course}, dept: ${c.department}, year: ${c.academicYear}, sem: ${c.semester}, sec: ${c.section}, inst: ${c.institution}`);
  }

  console.log('\n=== All Teaching Assignments ===');
  const asgns = await db.collection('teachingassignments').find({}).toArray();
  for (const a of asgns) {
    console.log(`Asgn ID: ${a._id}, teacher: ${a.teacher}, subject: ${a.subject}, classRef: ${a.classRef}, year: ${a.academicYear}, inst: ${a.institution}, active: ${a.isActive}`);
  }

  console.log('\n=== All Academic Records ===');
  const records = await db.collection('academicrecords').find({}).toArray();
  for (const r of records) {
    console.log(`Record ID: ${r._id}, student: ${r.student}, subject: ${r.subject}, year: ${r.academicYear}, marks: ${r.marksObtained}/${r.totalMarks}, att: ${r.attendancePercentage}`);
  }

  console.log('\n=== All Subjects ===');
  const subjects = await db.collection('subjects').find({}).toArray();
  for (const sub of subjects) {
    console.log(`Subject ID: ${sub._id}, code: ${sub.code}, name: ${sub.name}, dept: ${sub.department}, inst: ${sub.institution}`);
  }

  console.log('\n=== All Teachers ===');
  const teachers = await db.collection('teacherprofiles').find({}).toArray();
  for (const t of teachers) {
    const user = await db.collection('users').findOne({ _id: t.user });
    console.log(`Teacher ID: ${t.teacherId}, User: ${user?.userId}, Name: ${user?.name || t.personalInfo?.name}, Profile ID: ${t._id}, inst: ${t.institution}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
