const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

async function findAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admins = await User.find({ role: 'admin' }).select('userId name email role isActive');
  console.log('Admins found:', admins);
  await mongoose.disconnect();
}
findAdmin();
