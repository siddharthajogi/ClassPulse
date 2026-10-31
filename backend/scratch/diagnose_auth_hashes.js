const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');

async function testCredentials() {
  await mongoose.connect(process.env.MONGODB_URI);

  console.log('--- Checking Admin Users ---');
  const admins = await User.find({ role: 'admin' });
  for (const admin of admins) {
    const matchesDefaultSeed = await bcrypt.compare('StudyPoint@Admin2026', admin.password);
    const matchesTestPass = await bcrypt.compare('AdminSecurePass@2026', admin.password);
    console.log(`Admin userId="${admin.userId}", isActive=${admin.isActive}, mustChangePassword=${admin.mustChangePassword}`);
    console.log(`  matches 'StudyPoint@Admin2026': ${matchesDefaultSeed}`);
    console.log(`  matches 'AdminSecurePass@2026': ${matchesTestPass}`);
  }

  console.log('\n--- Checking Teacher Users ---');
  const teachers = await User.find({ role: 'teacher' });
  for (const teacher of teachers) {
    const matchesSeed = await bcrypt.compare('StudyPoint@Teacher2026', teacher.password);
    const matchesTest1 = await bcrypt.compare('Teacher@Test1234', teacher.password);
    const matchesPerm = await bcrypt.compare('PermanentPass@UmaDevi2026!', teacher.password);
    const matchesTemp = await bcrypt.compare('TempFacultyPassword@2026', teacher.password);
    console.log(`Teacher userId="${teacher.userId}", name="${teacher.name}", isActive=${teacher.isActive}, mustChangePassword=${teacher.mustChangePassword}`);
    console.log(`  matches 'StudyPoint@Teacher2026': ${matchesSeed}`);
    console.log(`  matches 'Teacher@Test1234': ${matchesTest1}`);
    console.log(`  matches 'PermanentPass@UmaDevi2026!': ${matchesPerm}`);
    console.log(`  matches 'TempFacultyPassword@2026': ${matchesTemp}`);
  }

  await mongoose.disconnect();
}

testCredentials().catch(err => {
  console.error(err);
  process.exit(1);
});
