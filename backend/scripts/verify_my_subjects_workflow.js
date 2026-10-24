const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Institution = require('../models/Institution');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const teacherController = require('../controllers/teacherController');
const adminController = require('../controllers/adminController');

const createMockRes = () => {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
};

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log(' End-to-End Workflow Verification: Section Curriculum Mapping');
  console.log('              -> Teacher My Subjects Page');
  console.log('================================================================\n');

  console.log('1. Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  const institution = await Institution.findOne({ name: /Study Point/i }) || await Institution.findOne();
  if (!institution) throw new Error('No institution found');
  console.log(`Using Institution: ${institution.name} (${institution._id})`);

  // Find or select two teachers
  const teachers = await TeacherProfile.find({ institution: institution._id }).populate('user');
  if (teachers.length < 2) throw new Error('Need at least 2 teachers in DB for test');
  const teacherA = teachers[0];
  const teacherB = teachers[1];

  console.log(`Teacher A: ${teacherA.personalInfo?.name || teacherA.teacherId} (User ID: ${teacherA.user?._id}, Profile: ${teacherA._id})`);
  console.log(`Teacher B: ${teacherB.personalInfo?.name || teacherB.teacherId} (User ID: ${teacherB.user?._id}, Profile: ${teacherB._id})`);

  // Find or create test subject
  let testSubject = await Subject.findOne({ institution: institution._id, code: 'E2E-SUB-101' });
  if (!testSubject) {
    testSubject = await Subject.create({
      institution: institution._id,
      name: 'Advanced Algorithms & Data Structures',
      code: 'E2E-SUB-101',
      department: 'Computer Science and Engineering',
      subjectType: 'Theory',
      credits: 4,
      semester: '5th',
      academicYear: '2026-2027',
      isActive: true
    });
    console.log(`Created test subject: ${testSubject.code} - ${testSubject.name}`);
  } else {
    console.log(`Using existing test subject: ${testSubject.code} - ${testSubject.name}`);
  }

  // Setup three test sections: Section E2E-A, Section E2E-B, Section E2E-C
  const academicYear = '2026-2027';
  const department = 'Computer Science and Engineering';

  await Class.deleteMany({ institution: institution._id, section: { $in: ['E2E-A', 'E2E-B', 'E2E-C'] } });
  await TeachingAssignment.deleteMany({ institution: institution._id, subject: testSubject._id });

  const classA = await Class.create({
    institution: institution._id,
    name: 'B.Tech - Computer Science and Engineering (Sem 5th, Sec E2E-A)',
    course: 'B.Tech',
    department,
    academicYear,
    semester: '5th',
    section: 'E2E-A',
    yearOfStudy: 'Third Year',
    isActive: true
  });

  const classB = await Class.create({
    institution: institution._id,
    name: 'B.Tech - Computer Science and Engineering (Sem 5th, Sec E2E-B)',
    course: 'B.Tech',
    department,
    academicYear,
    semester: '5th',
    section: 'E2E-B',
    yearOfStudy: 'Third Year',
    isActive: true
  });

  const classC = await Class.create({
    institution: institution._id,
    name: 'B.Tech - Computer Science and Engineering (Sem 5th, Sec E2E-C)',
    course: 'B.Tech',
    department,
    academicYear,
    semester: '5th',
    section: 'E2E-C',
    yearOfStudy: 'Third Year',
    isActive: true
  });

  console.log(`Created 3 test classes: Sec E2E-A (${classA._id}), Sec E2E-B (${classB._id}), Sec E2E-C (${classC._id})\n`);

  // Admin user context for calling admin endpoints
  const adminUser = await User.findOne({ role: 'admin', institution: institution._id }) || { _id: new mongoose.Types.ObjectId(), institution };

  // ============================================================
  // TEST STEP 1: Verify Initial Empty State for Teacher A
  // ============================================================
  console.log('--- TEST STEP 1: Verify Initial Empty State for Teacher A ---');
  let reqA = { currentUser: teacherA.user };
  let resA = createMockRes();
  await teacherController.getMySubjects(reqA, resA);

  console.log(`HTTP ${resA.statusCode}: ${JSON.stringify(resA.body?.subjects?.map(s => s.name))}`);
  if (resA.statusCode !== 200 || !resA.body?.success) {
    throw new Error('getMySubjects failed on initial call');
  }
  const teacherAInitialSubjects = resA.body.subjects.filter(s => s.subjectId.toString() === testSubject._id.toString());
  if (teacherAInitialSubjects.length !== 0) {
    throw new Error(`Expected 0 assignments of test subject for Teacher A, found ${teacherAInitialSubjects.length}`);
  }
  console.log('✓ PASS: Teacher A initially has 0 assignments for test subject.\n');

  // ============================================================
  // TEST STEP 2: Admin assigns Subject to Section E2E-A with Teacher A
  // ============================================================
  console.log('--- TEST STEP 2: Admin assigns Subject to Section E2E-A with Teacher A ---');
  let adminReq = {
    params: { id: classA._id.toString() },
    currentUser: adminUser,
    body: {
      assignments: [
        { subjectId: testSubject._id.toString(), teacherId: teacherA._id.toString() }
      ]
    }
  };
  let adminRes = createMockRes();
  await adminController.updateClassAssignments(adminReq, adminRes);
  if (adminRes.statusCode !== 200 || !adminRes.body?.success) {
    throw new Error(`Admin assignment to Section A failed: ${JSON.stringify(adminRes.body)}`);
  }
  console.log(`✓ Admin saved: ${adminRes.body.message}`);

  // Query Teacher A's subjects
  resA = createMockRes();
  await teacherController.getMySubjects(reqA, resA);
  const subjAfterStep2 = resA.body.subjects.find(s => s.subjectId.toString() === testSubject._id.toString());
  if (!subjAfterStep2) {
    throw new Error('Teacher A does not see the assigned subject in Section A');
  }
  console.log(`Teacher A Subject: "${subjAfterStep2.name}" | Sections: [${subjAfterStep2.sections.join(', ')}] | Count: ${subjAfterStep2.sectionCount}`);
  if (subjAfterStep2.sectionCount !== 1 || !subjAfterStep2.sections.includes('E2E-A')) {
    throw new Error(`Expected sections ['E2E-A'], got [${subjAfterStep2.sections.join(', ')}]`);
  }
  console.log('✓ PASS: Subject correctly appears in Teacher A view with Section E2E-A.\n');

  // ============================================================
  // TEST STEP 3: Assign Same Subject to Section E2E-B with Teacher A (Deduplication Check)
  // ============================================================
  console.log('--- TEST STEP 3: Assign Same Subject to Section E2E-B with Teacher A (Deduplication Check) ---');
  adminReq = {
    params: { id: classB._id.toString() },
    currentUser: adminUser,
    body: {
      assignments: [
        { subjectId: testSubject._id.toString(), teacherId: teacherA._id.toString() }
      ]
    }
  };
  adminRes = createMockRes();
  await adminController.updateClassAssignments(adminReq, adminRes);
  if (adminRes.statusCode !== 200 || !adminRes.body?.success) {
    throw new Error(`Admin assignment to Section B failed: ${JSON.stringify(adminRes.body)}`);
  }
  console.log(`✓ Admin saved: ${adminRes.body.message}`);

  // Query Teacher A's subjects: must appear ONLY ONCE with sections ['E2E-A', 'E2E-B']
  resA = createMockRes();
  await teacherController.getMySubjects(reqA, resA);
  const matchedSubjectsTeacherA = resA.body.subjects.filter(s => s.subjectId.toString() === testSubject._id.toString());
  console.log(`Teacher A unique subject matches count: ${matchedSubjectsTeacherA.length}`);
  if (matchedSubjectsTeacherA.length !== 1) {
    throw new Error(`DEDUPLICATION FAILED: Expected exactly 1 subject entry for Teacher A, got ${matchedSubjectsTeacherA.length}`);
  }
  const deduplicatedEntry = matchedSubjectsTeacherA[0];
  console.log(`Sections listed: [${deduplicatedEntry.sections.join(', ')}] | Count: ${deduplicatedEntry.sectionCount}`);
  if (deduplicatedEntry.sectionCount !== 2 || !deduplicatedEntry.sections.includes('E2E-A') || !deduplicatedEntry.sections.includes('E2E-B')) {
    throw new Error(`Expected sections ['E2E-A', 'E2E-B'], got [${deduplicatedEntry.sections.join(', ')}]`);
  }
  console.log('✓ PASS: Same subject across Section E2E-A and E2E-B displays ONLY ONCE with all sections listed!\n');

  // ============================================================
  // TEST STEP 4: Assign Same Subject to Section E2E-C with Teacher B (Teacher Isolation Check)
  // ============================================================
  console.log('--- TEST STEP 4: Assign Same Subject to Section E2E-C with Teacher B (Teacher Isolation Check) ---');
  adminReq = {
    params: { id: classC._id.toString() },
    currentUser: adminUser,
    body: {
      assignments: [
        { subjectId: testSubject._id.toString(), teacherId: teacherB._id.toString() }
      ]
    }
  };
  adminRes = createMockRes();
  await adminController.updateClassAssignments(adminReq, adminRes);
  if (adminRes.statusCode !== 200 || !adminRes.body?.success) {
    throw new Error(`Admin assignment to Section C failed: ${JSON.stringify(adminRes.body)}`);
  }
  console.log(`✓ Admin saved: ${adminRes.body.message}`);

  // Verify Teacher B's view
  let reqB = { currentUser: teacherB.user };
  let resB = createMockRes();
  await teacherController.getMySubjects(reqB, resB);
  const teacherBSubj = resB.body.subjects.find(s => s.subjectId.toString() === testSubject._id.toString());
  if (!teacherBSubj) {
    throw new Error('Teacher B does not see the assigned subject in Section C');
  }
  console.log(`Teacher B Subject: "${teacherBSubj.name}" | Sections: [${teacherBSubj.sections.join(', ')}] | Count: ${teacherBSubj.sectionCount}`);
  if (teacherBSubj.sectionCount !== 1 || teacherBSubj.sections[0] !== 'E2E-C') {
    throw new Error(`Expected Teacher B to only have Section E2E-C, got [${teacherBSubj.sections.join(', ')}]`);
  }

  // Verify Teacher A still only has Sections A & B (NOT C)
  resA = createMockRes();
  await teacherController.getMySubjects(reqA, resA);
  const teacherASubjCheck = resA.body.subjects.find(s => s.subjectId.toString() === testSubject._id.toString());
  if (teacherASubjCheck.sections.includes('E2E-C')) {
    throw new Error('LEAK: Teacher A sees Section E2E-C which belongs to Teacher B!');
  }
  console.log(`✓ PASS: Teacher B sees ONLY Section E2E-C. Teacher A retains Sections [${teacherASubjCheck.sections.join(', ')}]. Clean isolation!\n`);

  // ============================================================
  // TEST STEP 5: Reassign Section E2E-B from Teacher A to Teacher B
  // ============================================================
  console.log('--- TEST STEP 5: Reassign Section E2E-B from Teacher A to Teacher B ---');
  adminReq = {
    params: { id: classB._id.toString() },
    currentUser: adminUser,
    body: {
      assignments: [
        { subjectId: testSubject._id.toString(), teacherId: teacherB._id.toString() }
      ]
    }
  };
  adminRes = createMockRes();
  await adminController.updateClassAssignments(adminReq, adminRes);
  if (adminRes.statusCode !== 200 || !adminRes.body?.success) {
    throw new Error(`Reassignment failed: ${JSON.stringify(adminRes.body)}`);
  }
  console.log(`✓ Admin saved reassignment: ${adminRes.body.message}`);

  // Verify Teacher A now only has Section E2E-A
  resA = createMockRes();
  await teacherController.getMySubjects(reqA, resA);
  const teacherASubjAfterReassign = resA.body.subjects.find(s => s.subjectId.toString() === testSubject._id.toString());
  console.log(`Teacher A Sections now: [${teacherASubjAfterReassign.sections.join(', ')}] | Count: ${teacherASubjAfterReassign.sectionCount}`);
  if (teacherASubjAfterReassign.sectionCount !== 1 || teacherASubjAfterReassign.sections[0] !== 'E2E-A') {
    throw new Error(`Expected Teacher A to only have ['E2E-A'], got [${teacherASubjAfterReassign.sections.join(', ')}]`);
  }

  // Verify Teacher B now has Sections E2E-B and E2E-C (deduplicated!)
  resB = createMockRes();
  await teacherController.getMySubjects(reqB, resB);
  const teacherBSubjAfterReassign = resB.body.subjects.find(s => s.subjectId.toString() === testSubject._id.toString());
  console.log(`Teacher B Sections now: [${teacherBSubjAfterReassign.sections.join(', ')}] | Count: ${teacherBSubjAfterReassign.sectionCount}`);
  if (teacherBSubjAfterReassign.sectionCount !== 2 || !teacherBSubjAfterReassign.sections.includes('E2E-B') || !teacherBSubjAfterReassign.sections.includes('E2E-C')) {
    throw new Error(`Expected Teacher B to have ['E2E-B', 'E2E-C'], got [${teacherBSubjAfterReassign.sections.join(', ')}]`);
  }
  console.log('✓ PASS: Reassignment reflected in both teachers instantly. Teacher A has [E2E-A], Teacher B has [E2E-B, E2E-C].\n');

  // ============================================================
  // TEST STEP 6: Remove Assignment from Section E2E-A
  // ============================================================
  console.log('--- TEST STEP 6: Remove Assignment from Section E2E-A ---');
  adminReq = {
    params: { id: classA._id.toString() },
    currentUser: adminUser,
    body: {
      assignments: [] // empty array = remove all assignments for Section A
    }
  };
  adminRes = createMockRes();
  await adminController.updateClassAssignments(adminReq, adminRes);
  if (adminRes.statusCode !== 200 || !adminRes.body?.success) {
    throw new Error(`Remove assignment failed: ${JSON.stringify(adminRes.body)}`);
  }
  console.log(`✓ Admin saved removal: ${adminRes.body.message}`);

  // Verify Teacher A no longer has this subject at all!
  resA = createMockRes();
  await teacherController.getMySubjects(reqA, resA);
  const teacherASubjAfterRemoval = resA.body.subjects.find(s => s.subjectId.toString() === testSubject._id.toString());
  if (teacherASubjAfterRemoval) {
    throw new Error(`Expected subject to disappear from Teacher A, but it was found with sections [${teacherASubjAfterRemoval.sections.join(', ')}]`);
  }
  console.log('✓ PASS: Subject cleanly removed from Teacher A view after assignment deletion.\n');

  // ============================================================
  // TEST STEP 7: Unassigned Subject Check (teacherId: null / unassigned)
  // ============================================================
  console.log('--- TEST STEP 7: Unassigned Subject in Section E2E-A (Must not appear for any teacher) ---');
  adminReq = {
    params: { id: classA._id.toString() },
    currentUser: adminUser,
    body: {
      assignments: [
        { subjectId: testSubject._id.toString(), teacherId: null } // unassigned
      ]
    }
  };
  adminRes = createMockRes();
  await adminController.updateClassAssignments(adminReq, adminRes);
  console.log(`✓ Admin saved unassigned subject row: ${adminRes.body.message}`);

  // Verify neither Teacher A nor Teacher B sees this unassigned section
  resA = createMockRes();
  await teacherController.getMySubjects(reqA, resA);
  const teacherAUnassignedCheck = resA.body.subjects.find(s => s.subjectId.toString() === testSubject._id.toString());
  if (teacherAUnassignedCheck) {
    throw new Error(`Unassigned subject incorrectly shown for Teacher A: ${JSON.stringify(teacherAUnassignedCheck)}`);
  }

  resB = createMockRes();
  await teacherController.getMySubjects(reqB, resB);
  const teacherBUnassignedCheck = resB.body.subjects.find(s => s.subjectId.toString() === testSubject._id.toString());
  if (teacherBUnassignedCheck.sections.includes('E2E-A')) {
    throw new Error(`Unassigned section E2E-A incorrectly shown for Teacher B: [${teacherBUnassignedCheck.sections.join(', ')}]`);
  }
  console.log('✓ PASS: Unassigned subject row does NOT appear in any teacher\'s view.\n');

  // ============================================================
  // TEST STEP 8: Clean up test classes & assignments
  // ============================================================
  console.log('--- TEST STEP 8: Clean up test classes & assignments ---');
  await Class.deleteMany({ _id: { $in: [classA._id, classB._id, classC._id] } });
  await TeachingAssignment.deleteMany({ classRef: { $in: [classA._id, classB._id, classC._id] } });
  await Subject.deleteOne({ _id: testSubject._id });
  console.log('✓ Cleaned up test data.\n');

  console.log('================================================================');
  console.log(' ALL END-TO-END VERIFICATION TESTS PASSED SUCCESSFULLY! (8/8)');
  console.log('================================================================');
  process.exit(0);
}

runEndToEndVerification().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
