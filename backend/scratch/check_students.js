const mongoose = require('mongoose');
require('dotenv').config();

async function f() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const instId = new mongoose.Types.ObjectId('6ac9e6c1bb6915a39b1f7380');
  
  const sps = await db.collection('studentprofiles').find({ institution: instId }).toArray();
  const uids = sps.map(s => s.user).filter(Boolean);
  const users = await db.collection('users').find({ _id: { $in: uids } }).toArray();
  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  console.log('--- StudentProfiles ---');
  sps.forEach(s => {
    const u = userMap.get(s.user?.toString());
    console.log(`${s.studentId} | User: ${u?._id} | isActive: ${u?.isActive} | role: ${u?.role}`);
  });
  console.log('Total StudentProfiles:', sps.length);
  console.log('Total active linked Users:', users.filter(u => u.isActive).length);

  const tps = await db.collection('teacherprofiles').find({ institution: instId }).toArray();
  const tuids = tps.map(t => t.user).filter(Boolean);
  const tusers = await db.collection('users').find({ _id: { $in: tuids } }).toArray();
  const tuserMap = new Map(tusers.map(u => [u._id.toString(), u]));

  console.log('\n--- TeacherProfiles ---');
  tps.forEach(t => {
    const u = tuserMap.get(t.user?.toString());
    console.log(`${t.teacherId} | User: ${u?._id} | isActive: ${u?.isActive} | role: ${u?.role}`);
  });
  console.log('Total TeacherProfiles:', tps.length);
  console.log('Total active linked Teacher Users:', tusers.filter(u => u.isActive).length);

  process.exit(0);
}

f().catch(err => {
  console.error(err);
  process.exit(1);
});
