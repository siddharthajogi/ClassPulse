const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('=== Collections Count ===');
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`${c.name.padEnd(25)}: ${count}`);
  }

  console.log('\n=== Teaching Assignments ===');
  const assignments = await db.collection('teachingassignments').find({}).toArray();
  console.log(`Total teaching assignments: ${assignments.length}`);
  assignments.forEach((a, i) => {
    console.log(`[${i}] teacher: ${a.teacher}, subject: ${a.subject}, classRef: ${a.classRef}, year: ${a.academicYear}, active: ${a.isActive}`);
  });

  console.log('\n=== Academic Records ===');
  const records = await db.collection('academicrecords').find({}).toArray();
  console.log(`Total academic records: ${records.length}`);
  records.slice(0, 10).forEach((r, i) => {
    console.log(`[${i}] student: ${r.student}, subject: ${r.subject}, marks: ${r.marksObtained}/${r.totalMarks}, att: ${r.attendancePercentage}%`);
  });

  console.log('\n=== Risk Predictions ===');
  const predictions = await db.collection('riskpredictions').find({}).toArray();
  console.log(`Total risk predictions: ${predictions.length}`);
  predictions.forEach((p, i) => {
    console.log(`[${i}] student: ${p.student}, riskLevel: ${p.riskLevel}, score: ${p.score}, date: ${p.predictionDate}`);
  });

  console.log('\n=== Teachers List ===');
  const teachers = await db.collection('teacherprofiles').find({}).toArray();
  for (const t of teachers) {
    const user = await db.collection('users').findOne({ _id: t.user });
    console.log(`TeacherProfile _id: ${t._id}, teacherId: ${t.teacherId}, userId: ${user?.userId}, name: ${t.personalInfo?.name || user?.name}, inst: ${t.institution}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
