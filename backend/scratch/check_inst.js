const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

async function checkInstitutions() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({ userId: { $in: ['0001', 'test_admin_del', 't001'] } }).select('userId institution name');
  console.log('Users and institutions:', users);
  await mongoose.disconnect();
}
checkInstitutions();
