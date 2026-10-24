const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const record = await db.collection('academicrecords').findOne({});
  console.log('Record:', record);

  const student = await db.collection('studentprofiles').findOne({ _id: record.student });
  console.log('Student for record:', student);

  const year = await db.collection('academicyears').findOne({ _id: record.academicYear });
  console.log('AcademicYear for record:', year);

  const subject = await db.collection('subjects').findOne({ _id: record.subject });
  console.log('Subject for record:', subject);

  process.exit(0);
}

run().catch(console.error);
