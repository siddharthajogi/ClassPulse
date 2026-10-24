const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../models/User');
  const TeacherProfile = require('../models/TeacherProfile');
  const hash = await bcrypt.hash('Teacher@123', 10);
  await User.updateOne({ userId: 't001' }, { $set: { password: hash, mustChangePassword: false, isActive: true } });
  console.log('Successfully set t001 password to Teacher@123');
  const tp = await TeacherProfile.findOne({ teacherId: 't001' }).populate('user');
  console.log('Teacher profile:', tp?.personalInfo?.name, 'teacherId:', tp?.teacherId);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
