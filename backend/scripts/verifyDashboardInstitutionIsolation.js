const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Department = require('../models/Department');
const adminController = require('../controllers/adminController');

async function runAudit() {
  console.log('=== STUDY POINT INSTITUTION ISOLATION & DASHBOARD STATS AUDIT ===\n');
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Find the active admin and institution
  const activeAdmin = await User.findOne({ userId: '0001' }).populate('institution');
  if (!activeAdmin) {
    throw new Error('Active admin user "0001" not found in database');
  }
  const activeInstId = activeAdmin.institution._id;
  console.log(`Active Admin: ${activeAdmin.userId} (${activeAdmin.name})`);
  console.log(`Active Institution: ${activeInstId} (${activeAdmin.institution.name})\n`);

  // 2. Find any other institutions
  const otherAdmins = await User.find({ role: 'admin', institution: { $ne: activeInstId } });
  console.log(`Found ${otherAdmins.length} admin account(s) belonging to other institutions:`);
  otherAdmins.forEach(oa => {
    console.log(` - User ID: ${oa.userId}, Institution: ${oa.institution}, isActive: ${oa.isActive}`);
  });

  // 3. Direct MongoDB Counts (Active Institution vs Total Database)
  console.log('\n--- Direct MongoDB Verification ---');
  const totalStudentsDb = await StudentProfile.countDocuments({});
  const instStudentsDb = await StudentProfile.countDocuments({ institution: activeInstId });

  const totalTeachersDb = await TeacherProfile.countDocuments({});
  const instTeachersDb = await TeacherProfile.countDocuments({ institution: activeInstId });

  const totalUsersDb = await User.countDocuments({});
  const instUsersDb = await User.countDocuments({ institution: activeInstId });
  const instActiveUsersDb = await User.countDocuments({ institution: activeInstId, isActive: true });

  const totalClassesDb = await Class.countDocuments({});
  const instClassesDb = await Class.countDocuments({ institution: activeInstId });
  const instActiveClassesDb = await Class.countDocuments({ institution: activeInstId, isActive: true });

  const totalDeptsDb = await Department.countDocuments({});
  const instDeptsDb = await Department.countDocuments({ institution: activeInstId });

  const totalSubjectsDb = await Subject.countDocuments({});
  const instSubjectsDb = await Subject.countDocuments({ institution: activeInstId });
  const instActiveSubjectsDb = await Subject.countDocuments({ institution: activeInstId, isActive: true });

  console.log('Metric                     | Total in DB | Active Institution | Active Only');
  console.log('---------------------------|:-----------:|:------------------:|:-----------:');
  console.log(`Student Profiles           |     ${totalStudentsDb}      |         ${instStudentsDb}         |     ${instStudentsDb}`);
  console.log(`Teacher Profiles           |     ${totalTeachersDb}       |         ${instTeachersDb}          |     ${instTeachersDb}`);
  console.log(`User Accounts              |     ${totalUsersDb}      |         ${instUsersDb}         |     ${instActiveUsersDb}`);
  console.log(`Classes                    |     ${totalClassesDb}      |         ${instClassesDb}         |     ${instActiveClassesDb}`);
  console.log(`Departments                |     ${totalDeptsDb}      |         ${instDeptsDb}          |     ${instDeptsDb}`);
  console.log(`Subjects                   |     ${totalSubjectsDb}       |         ${instSubjectsDb}          |     ${instActiveSubjectsDb}`);

  // 4. Test API response from getDashboardStats
  console.log('\n--- Testing getDashboardStats API Response ---');
  let statsResult = null;
  const mockReq = { currentUser: activeAdmin };
  const mockRes = {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(d) { statsResult = d; return this; }
  };

  await adminController.getDashboardStats(mockReq, mockRes);

  if (!statsResult || !statsResult.success) {
    throw new Error('getDashboardStats failed: ' + JSON.stringify(statsResult));
  }

  const s = statsResult.stats;
  console.log('API Returned Stats:', s);

  // Assertions
  if (s.totalStudents !== instStudentsDb) {
    throw new Error(`totalStudents mismatch: API ${s.totalStudents} vs DB ${instStudentsDb}`);
  }
  if (s.totalTeachers !== instTeachersDb) {
    throw new Error(`totalTeachers mismatch: API ${s.totalTeachers} vs DB ${instTeachersDb}`);
  }
  if (s.activeAccounts !== instActiveUsersDb) {
    throw new Error(`activeAccounts mismatch: API ${s.activeAccounts} vs DB ${instActiveUsersDb}`);
  }
  if (s.totalClasses !== instClassesDb) {
    throw new Error(`totalClasses mismatch: API ${s.totalClasses} vs DB ${instClassesDb}`);
  }
  if (s.activeClasses !== instActiveClassesDb) {
    throw new Error(`activeClasses mismatch: API ${s.activeClasses} vs DB ${instActiveClassesDb}`);
  }
  if (s.totalSubjects !== instSubjectsDb) {
    throw new Error(`totalSubjects mismatch: API ${s.totalSubjects} vs DB ${instSubjectsDb}`);
  }
  if (s.departments !== instDeptsDb) {
    throw new Error(`departments mismatch: API ${s.departments} vs DB ${instDeptsDb}`);
  }

  // 5. Test Active Accounts List Isolation
  console.log('\n--- Testing getActiveAccounts API Response & Isolation ---');
  let accountsResult = null;
  const mockAccRes = {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(d) { accountsResult = d; return this; }
  };

  await adminController.getActiveAccounts(mockReq, mockAccRes);

  if (!accountsResult || !accountsResult.success) {
    throw new Error('getActiveAccounts failed: ' + JSON.stringify(accountsResult));
  }

  const accounts = accountsResult.accounts;
  console.log(`getActiveAccounts returned ${accounts.length} accounts.`);

  if (accounts.length !== s.activeAccounts) {
    throw new Error(`Active Accounts list count (${accounts.length}) !== Dashboard stat (${s.activeAccounts})`);
  }

  // Verify other institution's admin is strictly EXCLUDED
  for (const acc of accounts) {
    if (otherAdmins.some(oa => oa.userId === acc.userId || oa._id.toString() === acc._id.toString())) {
      throw new Error(`LEAK DETECTED: Other institution's admin (${acc.userId}) found in active accounts!`);
    }
    if (acc.institution && acc.institution.toString() !== activeInstId.toString()) {
      throw new Error(`LEAK DETECTED: Account ${acc.userId} has institution ${acc.institution} !== ${activeInstId}`);
    }
  }
  console.log('✓ PASS: All other institution accounts strictly excluded.');

  // Verify active institution admin is counted exactly ONCE
  const adminMatches = accounts.filter(a => a.userId === activeAdmin.userId || a.role === 'admin');
  console.log(`Active institution admins in list: ${adminMatches.length}`);
  if (adminMatches.length !== 1) {
    throw new Error(`Expected exactly 1 admin, found ${adminMatches.length}`);
  }
  console.log('✓ PASS: Active institution admin counted exactly once.');

  // 6. Student User vs Profile Discrepancy Investigation
  console.log('\n--- Student User vs Student Profile Discrepancy Audit ---');
  const studentUsers = await User.find({ role: 'student', institution: activeInstId });
  const studentProfiles = await StudentProfile.find({ institution: activeInstId });
  console.log(`Student users with role 'student' in active institution: ${studentUsers.length}`);
  console.log(`Student profiles in active institution: ${studentProfiles.length}`);

  const profileUserIds = new Set(studentProfiles.map(sp => sp.user.toString()));
  const orphanedUsers = studentUsers.filter(su => !profileUserIds.has(su._id.toString()));

  console.log(`Orphaned student users without profile: ${orphanedUsers.length}`);
  orphanedUsers.forEach(ou => {
    console.log(` - Orphaned User: ID=${ou.userId}, Name="${ou.name}", _id=${ou._id}, createdAt=${ou.createdAt}`);
  });

  console.log('\n======================================================');
  console.log(' ALL INSTITUTION ISOLATION & DASHBOARD AUDITS PASSED!');
  console.log('======================================================');
  process.exit(0);
}

runAudit().catch(err => {
  console.error('\nAUDIT FAILED:', err);
  process.exit(1);
});
