const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const adminController = require('../controllers/adminController');

async function testActiveAccounts() {
  console.log('=== Testing Active Accounts Calculation Including Admin ===\n');
  await mongoose.connect(process.env.MONGODB_URI);

  const adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) throw new Error('No admin user found');
  const institutionId = adminUser.institution;

  const mockReq = { currentUser: adminUser };
  const getStats = async () => {
    let result = null;
    const mockRes = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { result = d; return this; }
    };
    await adminController.getDashboardStats(mockReq, mockRes);
    return result?.stats;
  };

  const getAccountsList = async () => {
    let result = null;
    const mockRes = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { result = d; return this; }
    };
    await adminController.getActiveAccounts(mockReq, mockRes);
    return result?.accounts;
  };

  // STEP 1: Verify Baseline Counts
  console.log('--- Step 1: Baseline Active Accounts Inspection ---');
  const stats1 = await getStats();
  const accounts1 = await getAccountsList();

  console.log('Dashboard Stats:', stats1);
  console.log(`Active Accounts returned from list: ${accounts1.length}`);

  if (stats1.activeAccounts !== accounts1.length) {
    throw new Error(`Mismatch between summary card count (${stats1.activeAccounts}) and list count (${accounts1.length})`);
  }

  const expectedSum = stats1.activeStudents + stats1.activeTeachers + stats1.activeAdmins;
  if (stats1.activeAccounts !== expectedSum) {
    throw new Error(`activeAccounts (${stats1.activeAccounts}) does not equal sum of parts (${expectedSum})`);
  }

  // Check that admin is included in activeAdmins and accounts list
  if (stats1.activeAdmins < 1) {
    throw new Error(`Expected at least 1 active admin account, found: ${stats1.activeAdmins}`);
  }
  const adminInList = accounts1.find(a => a.userId === adminUser.userId || a.role === 'admin');
  if (!adminInList) {
    throw new Error('Admin user is missing from active accounts list');
  }

  console.log(`✓ PASS: Active accounts (${stats1.activeAccounts}) correctly includes:`);
  console.log(`   - Students: ${stats1.activeStudents}`);
  console.log(`   - Teachers: ${stats1.activeTeachers}`);
  console.log(`   - Admins: ${stats1.activeAdmins}`);
  console.log('   - No double counting, exactly 1-to-1 match with active accounts list.\n');

  // STEP 2: Dynamic Update - Create a new account
  console.log('--- Step 2: Dynamic Count Update on Account Creation ---');
  const initialActive = stats1.activeAccounts;
  const initialAdmins = stats1.activeAdmins;
  const testUserId = `test_admin_${Date.now()}`;
  const hashedPassword = await bcrypt.hash('TestPass@123', 10);

  const testAdmin = await User.create({
    userId: testUserId,
    password: hashedPassword,
    role: 'admin',
    name: 'Temporary Test Admin',
    email: `${testUserId}@example.com`,
    institution: institutionId,
    isActive: true
  });

  const stats2 = await getStats();
  console.log(`After creating new active admin: activeAccounts = ${stats2.activeAccounts}, activeAdmins = ${stats2.activeAdmins}`);
  if (stats2.activeAccounts !== initialActive + 1) {
    throw new Error(`Expected activeAccounts to increase by 1 to ${initialActive + 1}, got ${stats2.activeAccounts}`);
  }
  if (stats2.activeAdmins !== initialAdmins + 1) {
    throw new Error(`Expected activeAdmins to increase by 1 to ${initialAdmins + 1}, got ${stats2.activeAdmins}`);
  }
  console.log('✓ PASS: Active accounts count dynamically incremented by 1 upon account creation.\n');

  // STEP 3: Dynamic Update - Deactivate the account
  console.log('--- Step 3: Dynamic Count Update on Account Deactivation ---');
  testAdmin.isActive = false;
  await testAdmin.save();

  const stats3 = await getStats();
  console.log(`After deactivating test admin: activeAccounts = ${stats3.activeAccounts}, activeAdmins = ${stats3.activeAdmins}`);
  if (stats3.activeAccounts !== initialActive) {
    throw new Error(`Expected activeAccounts to decrease back to ${initialActive}, got ${stats3.activeAccounts}`);
  }
  if (stats3.activeAdmins !== initialAdmins) {
    throw new Error(`Expected activeAdmins to decrease back to ${initialAdmins}, got ${stats3.activeAdmins}`);
  }
  console.log('✓ PASS: Inactive/disabled account is properly excluded; count decremented.\n');

  // STEP 4: Dynamic Update - Reactivate the account
  console.log('--- Step 4: Dynamic Count Update on Account Reactivation ---');
  testAdmin.isActive = true;
  await testAdmin.save();

  const stats4 = await getStats();
  console.log(`After reactivating test admin: activeAccounts = ${stats4.activeAccounts}`);
  if (stats4.activeAccounts !== initialActive + 1) {
    throw new Error(`Expected activeAccounts to be ${initialActive + 1}, got ${stats4.activeAccounts}`);
  }
  console.log('✓ PASS: Reactivated account is included in count.\n');

  // STEP 5: Dynamic Update - Delete the account (Cleanup)
  console.log('--- Step 5: Dynamic Count Update on Account Deletion & Cleanup ---');
  await User.findByIdAndDelete(testAdmin._id);

  const stats5 = await getStats();
  console.log(`After deleting test admin: activeAccounts = ${stats5.activeAccounts}`);
  if (stats5.activeAccounts !== initialActive) {
    throw new Error(`Expected activeAccounts to return to ${initialActive}, got ${stats5.activeAccounts}`);
  }
  console.log('✓ PASS: Deleted account removed from count; baseline restored cleanly.\n');

  console.log('========================================================');
  console.log(' ALL ACTIVE ACCOUNTS AUDIT & DYNAMIC TESTS PASSED (100%)');
  console.log('========================================================');
  process.exit(0);
}

testActiveAccounts().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
