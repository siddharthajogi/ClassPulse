const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('=== All Collections and Document Counts in study_point ===');
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`${c.name}: ${count}`);
  }

  console.log('\n=== USERS COLLECTION ANALYSIS ===');
  const users = await db.collection('users').find({}).toArray();
  console.log(`Total users: ${users.length}`);
  const roleGroups = {};
  users.forEach(u => {
    const k = `${u.role} (isActive: ${u.isActive}, inst: ${u.institution})`;
    roleGroups[k] = (roleGroups[k] || 0) + 1;
  });
  console.log(roleGroups);

  console.log('\n=== STUDENTPROFILES COLLECTION ANALYSIS ===');
  const sps = await db.collection('studentprofiles').find({}).toArray();
  console.log(`Total StudentProfiles: ${sps.length}`);
  sps.forEach(s => {
    console.log(`ID: ${s.studentId}, Name: ${s.personalInfo?.name}, Inst: ${s.institution}, Dept: ${s.department}, Class: ${s.classRef}`);
  });

  console.log('\n=== TEACHERPROFILES COLLECTION ANALYSIS ===');
  const tps = await db.collection('teacherprofiles').find({}).toArray();
  console.log(`Total TeacherProfiles: ${tps.length}`);
  tps.forEach(t => {
    console.log(`ID: ${t.teacherId}, Name: ${t.personalInfo?.name}, Inst: ${t.institution}, Dept: ${t.department}`);
  });

  console.log('\n=== AUDITLOGS CHECK ===');
  const deletedStudents = await db.collection('auditlogs').find({ action: /DELETE_STUDENT/i }).toArray();
  console.log(`Audit log records for DELETE_STUDENT: ${deletedStudents.length}`);
  deletedStudents.forEach(l => console.log(l));

  const createdStudents = await db.collection('auditlogs').find({ action: /CREATE_STUDENT/i }).toArray();
  console.log(`Audit log records for CREATE_STUDENT: ${createdStudents.length}`);

  process.exit(0);
}

run().catch(console.error);
