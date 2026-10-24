const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Institution = require('../models/Institution');
const AcademicYear = require('../models/AcademicYear');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');
const AcademicRecord = require('../models/AcademicRecord');
const RiskPrediction = require('../models/RiskPrediction');
const AuditLog = require('../models/AuditLog');

const migrateMultiTenant = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('[Migration] Connected to MongoDB database.');

    // 1. Get or create the default Institution
    let defaultInstitution = await Institution.findOne();
    if (!defaultInstitution) {
      defaultInstitution = new Institution({
        name: 'Default Study Point Institution',
        isSetupComplete: false
      });
      await defaultInstitution.save();
      console.log('[Migration] Created default Institution.');
    } else {
      console.log(`[Migration] Found default Institution: ${defaultInstitution.name}`);
    }

    const institutionId = defaultInstitution._id;

    // 2. Migrate Users
    // Only 'student', 'teacher', and legacy 'admin' need an institution.
    // Wait, the prompt says "Do not silently grant platform-level privileges to existing college administrators."
    // So the existing 'admin' stays 'admin' (College Administrator) for the default institution.
    const userResult = await User.updateMany(
      { institution: { $exists: false } },
      { $set: { institution: institutionId } }
    );
    console.log(`[Migration] Updated Users: ${userResult.modifiedCount}`);

    // If we want a platform-level superadmin, we can create one, or just let the seedAdmin script do it later.
    // For now, let's keep the existing admin as College Admin for this default institution.

    // 3. Migrate all other collections
    const modelsToMigrate = [
      { name: 'AcademicYear', model: AcademicYear },
      { name: 'StudentProfile', model: StudentProfile },
      { name: 'TeacherProfile', model: TeacherProfile },
      { name: 'Class', model: Class },
      { name: 'Subject', model: Subject },
      { name: 'TeachingAssignment', model: TeachingAssignment },
      { name: 'AcademicRecord', model: AcademicRecord },
      { name: 'RiskPrediction', model: RiskPrediction },
      { name: 'AuditLog', model: AuditLog }
    ];

    for (const { name, model } of modelsToMigrate) {
      if (model.schema.paths.institution) {
        const res = await model.updateMany(
          { institution: { $exists: false } },
          { $set: { institution: institutionId } }
        );
        console.log(`[Migration] Updated ${name}: ${res.modifiedCount}`);
      } else {
        // Fallback for models without strict schema (Mongoose schema doesn't have it yet, but we will add it)
        // Since we update schemas next, let's just use strict: false for migration if needed.
        const res = await model.collection.updateMany(
          { institution: { $exists: false } },
          { $set: { institution: institutionId } }
        );
        console.log(`[Migration] Updated collection ${name} natively: ${res.modifiedCount}`);
      }
    }

    console.log('[Migration] Multi-tenant migration completed successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Migration Error]:', error);
    process.exit(1);
  }
};

migrateMultiTenant();
