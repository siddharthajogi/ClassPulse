const mongoose = require('mongoose');
const http = require('http');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const Institution = require('../models/Institution');
const { QUALIFICATION_OPTIONS, STANDARD_QUALIFICATIONS } = require('../config/qualifications');

function makeRequest(options, postData = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const req = http.request({ ...options, headers }, (res) => {
      let data = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let body = {};
        try { body = JSON.parse(data); } catch (e) { body = data; }
        resolve({ statusCode: res.statusCode, headers: res.headers, body, setCookie });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Multiple Qualifications End-to-End Tests ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[PASS] Connected to MongoDB');

  // Verify centralized config
  console.log('\n--- 1. Testing Centralized Qualifications Config ---');
  const expectedList = [
    'B.Tech / B.E.', 'B.Sc.', 'BCA', 'B.Com.', 'B.A.',
    'M.Tech / M.E.', 'M.Sc.', 'MCA', 'M.Com.', 'M.A.',
    'MBA', 'Ph.D.', 'M.Phil.', 'Other'
  ];
  if (QUALIFICATION_OPTIONS.length !== 14) {
    throw new Error(`Expected 14 qualification options, got ${QUALIFICATION_OPTIONS.length}`);
  }
  for (const opt of expectedList) {
    if (!QUALIFICATION_OPTIONS.includes(opt)) {
      throw new Error(`Missing expected qualification option: ${opt}`);
    }
  }
  console.log(`[PASS] Centralized options verified: ${QUALIFICATION_OPTIONS.join(', ')}`);

  // Login as admin
  console.log('\n--- 2. Admin Authentication ---');
  let loginRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ userId: '0001', password: 'StudyPoint@NewAdmin2026', role: 'admin' })
  );
  if (loginRes.statusCode !== 200) {
    loginRes = await makeRequest(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' },
      JSON.stringify({ userId: '0001', password: 'StudyPoint@Admin2026', role: 'admin' })
    );
  }
  if (loginRes.statusCode !== 200 || !loginRes.body.success) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginRes.body)}`);
  }
  const adminCookie = (loginRes.setCookie && loginRes.setCookie[0])
    ? loginRes.setCookie[0].split(';')[0]
    : '';
  console.log('[PASS] Admin logged in successfully.');

  const timestamp = Date.now();

  // Test 3: Validation - Reject teacher creation without qualification
  console.log('\n--- 3. Testing Validation: Reject Empty Qualifications ---');
  const emptyQualPayload = {
    teacherId: `T_TEST_EMPTY_${timestamp}`,
    password: 'Password123!',
    department: 'CSE',
    designation: 'Assistant Professor',
    personalInfo: {
      name: 'No Qual Teacher',
      email: `noqual_${timestamp}@test.edu`,
      phone: '9876543210',
      address: 'Test Street 1'
    },
    professionalInfo: {
      qualifications: [],
      specialization: 'Computer Science',
      yearsOfExperience: 3
    }
  };
  const emptyRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/admin/teachers', method: 'POST' },
    JSON.stringify(emptyQualPayload),
    adminCookie
  );
  if (emptyRes.statusCode !== 400 || emptyRes.body.success) {
    throw new Error(`Expected 400 Bad Request for empty qualifications, got ${emptyRes.statusCode}`);
  }
  if (!emptyRes.body.errors || (!emptyRes.body.errors.qualifications && !emptyRes.body.errors.highestQualification)) {
    throw new Error(`Expected qualifications validation error, got: ${JSON.stringify(emptyRes.body)}`);
  }
  console.log('[PASS] Correctly rejected teacher with empty qualifications with error:', emptyRes.body.errors);

  // Test 4: Create teacher with single qualification
  console.log('\n--- 4. Testing Create Teacher with Single Qualification ---');
  const singleQualId = `T_SINGLE_${timestamp}`;
  const singleQualEmail = `single_${timestamp}@test.edu`;
  const singleQualPayload = {
    teacherId: singleQualId,
    password: 'Password123!',
    department: 'CSE',
    designation: 'Assistant Professor',
    personalInfo: {
      name: 'Dr. Single Degree',
      email: singleQualEmail,
      phone: '9876543211',
      address: 'Room 101'
    },
    professionalInfo: {
      qualifications: ['B.Tech / B.E.'],
      specialization: 'Computer Science',
      yearsOfExperience: 4
    }
  };
  const singleRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/admin/teachers', method: 'POST' },
    JSON.stringify(singleQualPayload),
    adminCookie
  );
  if (singleRes.statusCode !== 201 || !singleRes.body.success) {
    throw new Error(`Single qualification teacher creation failed: ${JSON.stringify(singleRes.body)}`);
  }
  const singleTeacherDoc = await TeacherProfile.findOne({ teacherId: singleQualId.toLowerCase() });
  if (!singleTeacherDoc || !Array.isArray(singleTeacherDoc.professionalInfo.qualifications) || singleTeacherDoc.professionalInfo.qualifications.length !== 1) {
    throw new Error(`Single qualification not persisted as array: ${JSON.stringify(singleTeacherDoc?.professionalInfo)}`);
  }
  if (singleTeacherDoc.professionalInfo.qualifications[0] !== 'B.Tech / B.E.') {
    throw new Error(`Expected 'B.Tech / B.E.', got: ${singleTeacherDoc.professionalInfo.qualifications[0]}`);
  }
  if (singleTeacherDoc.professionalInfo.highestQualification !== 'B.Tech / B.E.') {
    throw new Error(`Expected highestQualification synchronized, got: ${singleTeacherDoc.professionalInfo.highestQualification}`);
  }
  console.log('[PASS] Single qualification saved and synchronized successfully:', singleTeacherDoc.professionalInfo.qualifications);

  // Test 5: Create teacher with multiple qualifications (e.g. B.Tech / B.E. + M.Tech / M.E. + Ph.D.)
  console.log('\n--- 5. Testing Create Teacher with Multiple Qualifications (e.g. B.Tech + M.Tech + Ph.D.) ---');
  const multiQualId = `T_MULTI_${timestamp}`;
  const multiQualEmail = `multi_${timestamp}@test.edu`;
  const multiQualifications = ['B.Tech / B.E.', 'M.Tech / M.E.', 'Ph.D.'];
  const multiQualPayload = {
    teacherId: multiQualId,
    password: 'Password123!',
    department: 'ECE',
    designation: 'Associate Professor',
    personalInfo: {
      name: 'Dr. Multi Degree',
      email: multiQualEmail,
      phone: '9876543212',
      address: 'Room 202'
    },
    professionalInfo: {
      qualifications: multiQualifications,
      specialization: 'VLSI Design',
      yearsOfExperience: 8
    }
  };
  const multiRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/admin/teachers', method: 'POST' },
    JSON.stringify(multiQualPayload),
    adminCookie
  );
  if (multiRes.statusCode !== 201 || !multiRes.body.success) {
    throw new Error(`Multiple qualification teacher creation failed: ${JSON.stringify(multiRes.body)}`);
  }
  const multiTeacherDoc = await TeacherProfile.findOne({ teacherId: multiQualId.toLowerCase() });
  if (!multiTeacherDoc || !Array.isArray(multiTeacherDoc.professionalInfo.qualifications) || multiTeacherDoc.professionalInfo.qualifications.length !== 3) {
    throw new Error(`Multiple qualifications not persisted properly: ${JSON.stringify(multiTeacherDoc?.professionalInfo)}`);
  }
  for (let i = 0; i < multiQualifications.length; i++) {
    if (multiTeacherDoc.professionalInfo.qualifications[i] !== multiQualifications[i]) {
      throw new Error(`Mismatch at index ${i}: expected ${multiQualifications[i]}, got ${multiTeacherDoc.professionalInfo.qualifications[i]}`);
    }
  }
  if (multiTeacherDoc.professionalInfo.highestQualification !== multiQualifications.join(', ')) {
    throw new Error(`highestQualification string not synced: ${multiTeacherDoc.professionalInfo.highestQualification}`);
  }
  console.log('[PASS] Multiple qualifications saved and persisted in MongoDB:', multiTeacherDoc.professionalInfo.qualifications);

  // Test 6: Create teacher with custom "Other" qualification
  console.log('\n--- 6. Testing Create Teacher with Custom "Other" Qualification ---');
  const otherQualId = `T_OTHER_${timestamp}`;
  const otherQualEmail = `other_${timestamp}@test.edu`;
  const customQualList = ['B.Tech / B.E.', 'Post Graduate Diploma in AI & Robotics'];
  const otherQualPayload = {
    teacherId: otherQualId,
    password: 'Password123!',
    department: 'AI & DS',
    designation: 'Assistant Professor',
    personalInfo: {
      name: 'Prof. Custom Degree',
      email: otherQualEmail,
      phone: '9876543213',
      address: 'AI Lab Block C'
    },
    professionalInfo: {
      qualifications: customQualList,
      specialization: 'Robotics',
      yearsOfExperience: 5
    }
  };
  const otherRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/admin/teachers', method: 'POST' },
    JSON.stringify(otherQualPayload),
    adminCookie
  );
  if (otherRes.statusCode !== 201 || !otherRes.body.success) {
    throw new Error(`Other qualification teacher creation failed: ${JSON.stringify(otherRes.body)}`);
  }
  const otherTeacherDoc = await TeacherProfile.findOne({ teacherId: otherQualId.toLowerCase() });
  if (!otherTeacherDoc.professionalInfo.qualifications.includes('Post Graduate Diploma in AI & Robotics')) {
    throw new Error(`Custom qualification missing: ${JSON.stringify(otherTeacherDoc.professionalInfo.qualifications)}`);
  }
  console.log('[PASS] Custom "Other" qualification saved successfully:', otherTeacherDoc.professionalInfo.qualifications);

  // Test 7: Legacy Single String Backward Compatibility
  console.log('\n--- 7. Testing Legacy Single String Compatibility ---');
  const legacyQualId = `T_LEGACY_${timestamp}`;
  const legacyQualEmail = `legacy_${timestamp}@test.edu`;
  const legacyPayload = {
    teacherId: legacyQualId,
    password: 'Password123!',
    department: 'MECH',
    designation: 'Professor',
    personalInfo: {
      name: 'Prof. Legacy Data',
      email: legacyQualEmail,
      phone: '9876543214',
      address: 'Mech Dept Office'
    },
    professionalInfo: {
      highestQualification: 'M.Tech / M.E.', // Legacy single string key
      specialization: 'Thermodynamics',
      yearsOfExperience: 15
    }
  };
  const legacyRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: '/api/admin/teachers', method: 'POST' },
    JSON.stringify(legacyPayload),
    adminCookie
  );
  if (legacyRes.statusCode !== 201 || !legacyRes.body.success) {
    throw new Error(`Legacy payload teacher creation failed: ${JSON.stringify(legacyRes.body)}`);
  }
  const legacyTeacherDoc = await TeacherProfile.findOne({ teacherId: legacyQualId.toLowerCase() });
  if (!Array.isArray(legacyTeacherDoc.professionalInfo.qualifications) || !legacyTeacherDoc.professionalInfo.qualifications.includes('M.Tech / M.E.')) {
    throw new Error(`Legacy highestQualification was not converted into qualifications array: ${JSON.stringify(legacyTeacherDoc.professionalInfo)}`);
  }
  console.log('[PASS] Legacy string automatically normalized into qualifications array:', legacyTeacherDoc.professionalInfo.qualifications);

  // Test 8: Reading legacy record via API returns normalized qualifications array
  console.log('\n--- 8. Testing API GET /teachers/:id Normalization for Legacy DB Records ---');
  // Directly insert a legacy record with highestQualification string and empty qualifications array
  const rawLegacyId = `T_RAWLEGACY_${timestamp}`;
  const rawLegacyUser = new User({
    institution: singleTeacherDoc.institution,
    userId: rawLegacyId,
    password: 'hashedpassword',
    role: 'teacher',
    name: 'Raw Legacy Teacher'
  });
  await rawLegacyUser.save();
  const rawLegacyProfile = new TeacherProfile({
    institution: singleTeacherDoc.institution,
    user: rawLegacyUser._id,
    teacherId: rawLegacyId,
    department: 'CSE',
    designation: 'Assistant Professor',
    personalInfo: { name: 'Raw Legacy Teacher', email: `rawlegacy_${timestamp}@test.edu`, phone: '9876543215', address: 'Block A' },
    professionalInfo: {
      highestQualification: 'BCA, MCA',
      qualifications: [], // explicitly empty like an unmigrated old record
      specialization: 'Software Development',
      yearsOfExperience: 6
    }
  });
  await rawLegacyProfile.save();

  const getLegacyRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: `/api/admin/teachers/${rawLegacyProfile._id}`, method: 'GET' },
    null,
    adminCookie
  );
  if (getLegacyRes.statusCode !== 200 || !getLegacyRes.body.success) {
    throw new Error(`Failed to GET teacher by ID: ${JSON.stringify(getLegacyRes.body)}`);
  }
  const fetchedLegacy = getLegacyRes.body.teacher;
  if (!Array.isArray(fetchedLegacy.professionalInfo.qualifications) || fetchedLegacy.professionalInfo.qualifications.length !== 2) {
    throw new Error(`Legacy record was not normalized on GET: ${JSON.stringify(fetchedLegacy.professionalInfo)}`);
  }
  if (!fetchedLegacy.professionalInfo.qualifications.includes('BCA') || !fetchedLegacy.professionalInfo.qualifications.includes('MCA')) {
    throw new Error(`Legacy normalized qualifications mismatch: ${JSON.stringify(fetchedLegacy.professionalInfo.qualifications)}`);
  }
  console.log('[PASS] Legacy database record without qualifications array normalized on GET:', fetchedLegacy.professionalInfo.qualifications);

  // Test 9: Edit teacher qualifications (Updating multiple qualifications)
  console.log('\n--- 9. Testing Edit Teacher Qualifications Persistence ---');
  const updatedQualifications = ['B.Tech / B.E.', 'M.Tech / M.E.', 'MBA', 'Ph.D.'];
  const updatePayload = {
    department: 'CSE',
    designation: 'Professor & Head',
    personalInfo: {
      name: 'Dr. Multi Degree Edited',
      email: multiQualEmail,
      phone: '9876543212',
      address: 'Room 202'
    },
    professionalInfo: {
      qualifications: updatedQualifications,
      specialization: 'VLSI & AI Systems',
      yearsOfExperience: 10
    }
  };
  const updateRes = await makeRequest(
    { hostname: 'localhost', port: 5000, path: `/api/admin/teachers/${multiTeacherDoc._id}`, method: 'PUT' },
    JSON.stringify(updatePayload),
    adminCookie
  );
  if (updateRes.statusCode !== 200 || !updateRes.body.success) {
    throw new Error(`Update teacher failed: ${JSON.stringify(updateRes.body)}`);
  }

  // Verify in MongoDB
  const updatedDoc = await TeacherProfile.findById(multiTeacherDoc._id);
  if (updatedDoc.professionalInfo.qualifications.length !== 4) {
    throw new Error(`Expected 4 qualifications after edit, got ${updatedDoc.professionalInfo.qualifications.length}`);
  }
  for (let i = 0; i < updatedQualifications.length; i++) {
    if (updatedDoc.professionalInfo.qualifications[i] !== updatedQualifications[i]) {
      throw new Error(`Edited qualification mismatch: expected ${updatedQualifications[i]}, got ${updatedDoc.professionalInfo.qualifications[i]}`);
    }
  }
  if (updatedDoc.professionalInfo.highestQualification !== updatedQualifications.join(', ')) {
    throw new Error(`highestQualification string not updated: ${updatedDoc.professionalInfo.highestQualification}`);
  }
  console.log('[PASS] Teacher qualifications successfully updated and persisted:', updatedDoc.professionalInfo.qualifications);

  // Clean up test documents
  const allTestIds = [singleQualId, multiQualId, otherQualId, legacyQualId, rawLegacyId].map(s => s.toLowerCase());
  await TeacherProfile.deleteMany({
    teacherId: { $in: allTestIds }
  });
  await User.deleteMany({
    userId: { $in: allTestIds }
  });
  console.log('[PASS] Cleaned up temporary test documents.');

  await mongoose.disconnect();
  console.log('\n======================================================');
  console.log('ALL MULTIPLE QUALIFICATIONS END-TO-END TESTS PASSED!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n[FAIL] Test suite failed with error:', err);
  process.exit(1);
});
