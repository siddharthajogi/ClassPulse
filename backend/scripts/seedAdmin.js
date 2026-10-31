const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

const seedAdmin = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const adminId = (process.env.SEED_ADMIN_ID || '0001').trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'StudyPoint@Admin2026';

  if (!mongoUri) {
    console.error('[Seed Error] MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    console.log('[Seed] Connecting to MongoDB database...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log('[Seed] Database connection established.');

    // 1. Check if admin account with target ID already exists
    const existingTargetAdmin = await User.findOne({ userId: adminId, role: 'admin' });

    if (existingTargetAdmin) {
      console.log(`[Seed Info] Admin account "${adminId}" already exists in the database.`);
      console.log(`[Seed Sync] Synchronizing password with SEED_ADMIN_PASSWORD from .env...`);
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
      existingTargetAdmin.password = hashedPassword;
      existingTargetAdmin.isActive = true;
      await existingTargetAdmin.save();
      console.log(`[Seed Success] Admin account "${adminId}" password updated successfully.`);
      await mongoose.disconnect();
      console.log('[Seed] Database connection closed.');
      process.exit(0);
    }

    // 2. Check if legacy admin account with ID 'admin' exists for safe migration
    const legacyAdmin = await User.findOne({ userId: 'admin', role: 'admin' });
    if (legacyAdmin) {
      console.log(`[Seed Migration] Found legacy Admin account with ID "admin".`);
      console.log(`[Seed Migration] Safely migrating Admin ID to "${adminId}" without changing password hash.`);
      legacyAdmin.userId = adminId;
      await legacyAdmin.save();
      console.log(`[Seed Migration] Migration completed successfully. Admin ID is now "${adminId}".`);
      await mongoose.disconnect();
      console.log('[Seed] Database connection closed.');
      process.exit(0);
    }

    // 3. If neither exists, create initial Admin account
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

    const newAdmin = new User({
      userId: adminId,
      password: hashedPassword,
      role: 'admin',
      name: 'System Administrator',
      isActive: true,
      mustChangePassword: true
    });

    await newAdmin.save();
    console.log(`[Seed Success] Initial Admin account "${adminId}" created successfully.`);
    console.log('[Seed Success] Initial flag set: mustChangePassword = true.');

    await mongoose.disconnect();
    console.log('[Seed] Database connection closed cleanly.');
    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] Failed to seed or migrate admin account: ${error.message}`);
    try {
      await mongoose.disconnect();
    } catch (_) {
      // Ignore disconnect error on failure
    }
    process.exit(1);
  }
};

seedAdmin();
