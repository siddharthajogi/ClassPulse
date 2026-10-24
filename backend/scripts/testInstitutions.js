const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const Institution = require('../models/Institution');

const test = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const institutions = await Institution.find({});
  console.log(JSON.stringify(institutions, null, 2));
  process.exit();
}
test();
