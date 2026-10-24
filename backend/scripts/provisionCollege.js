const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Institution = require('../models/Institution');

const provisionCollege = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('[Provision] Connected to MongoDB database.');

    const collegeCode = 'COLLEGE-B';
    const adminId = 'admin-b';
    const password = 'Password123!';

    // Create a new unconfigured institution
    const institution = new Institution({
      name: 'Pending Setup College',
      code: collegeCode,
      isSetupComplete: false
    });
    await institution.save();
    console.log(`[Provision] Created institution with ID: ${institution._id}`);

    // Create the admin user for this institution
    const hashedPassword = await bcrypt.hash(password, 10);
    const adminUser = new User({
      userId: adminId,
      password: hashedPassword,
      role: 'admin',
      institution: institution._id,
      name: 'College B Admin',
      isActive: true,
      mustChangePassword: false
    });
    await adminUser.save();
    console.log(`[Provision] Created admin user: ${adminUser.userId}`);

    console.log('[Provision] Provisioning completed successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Provision Error]:', error);
    process.exit(1);
  }
};

provisionCollege();
