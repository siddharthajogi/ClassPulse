const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');

const test = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({}, 'userId role institution');
  console.log(users);
  process.exit();
}
test();
