const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Assessment = require('../models/Assessment');
const SubjectConcept = require('../models/SubjectConcept');
const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');
const TeacherProfile = require('../models/TeacherProfile');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');
const Class = require('../models/Class');
const KnowledgeGapFollowUp = require('../models/KnowledgeGapFollowUp');

const diagnosisController = require('../controllers/diagnosisController');

function createMockReqRes(user, params = {}, query = {}, body = {}) {
  const req = {
    currentUser: user,
    params,
    query,
    body
  };

  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };

  return { req, res };
}

async function runVerification() {
  console.log('--- STARTING STAGE 3 KNOWLEDGE-GAP DIAGNOSIS VERIFICATION ---');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  // Track created artifacts for guaranteed cleanup
  const cleanupConceptIds = [];
  const cleanupAssessmentIds = [];
  const cleanupFollowUpIds = [];

  try {
    // 1. Locate active teaching assignment with a valid teacher and class
    const assignment = await TeachingAssignment.findOne({
      isActive: true,
      teacher: { $ne: null }
    })
      .populate('teacher')
      .populate('subject')
      .populate('classRef');

    if (!assignment || !assignment.teacher) {
      throw new Error('No active teaching assignment with an assigned teacher found.');
    }

    const institutionId = assignment.institution;
    const teacherProfile = assignment.teacher;
    const teacherUser = await User.findById(teacherProfile.user);
    if (!teacherUser) {
      throw new Error('Teacher user account not found for profile: ' + teacherProfile._id);
    }
    teacherUser.institution = institutionId;

    console.log(`✓ Active Teacher: ${teacherUser.name} (${teacherUser.email})`);
    console.log(`✓ Assigned Subject: ${assignment.subject.name} (${assignment.subject.code})`);

    // 2. Find students in this class
    let students = await StudentProfile.find({
      institution: institutionId,
      classRef: assignment.classRef ? assignment.classRef._id : { $exists: true }
    }).limit(4);

    if (students.length < 2) {
      console.log('Searching for any students in institution...');
      students = await StudentProfile.find({ institution: institutionId }).limit(4);
    }

    if (students.length === 0) {
      throw new Error('No students found in institution to run diagnosis verification.');
    }

    console.log(`✓ Cohort Students Found: ${students.length} student(s) (e.g. ${students[0].studentId})`);

    // 3. Create test concepts: Concept 1 (Foundational) and Concept 2 (Advanced, depends on Concept 1)
    const concept1 = await SubjectConcept.create({
      institution: institutionId,
      subject: assignment.subject._id,
      name: 'Stage3 Test Concept 1: Foundations',
      difficultyLevel: 'Fundamental',
      orderIndex: 1,
      createdBy: teacherUser._id
    });
    cleanupConceptIds.push(concept1._id);

    const concept2 = await SubjectConcept.create({
      institution: institutionId,
      subject: assignment.subject._id,
      name: 'Stage3 Test Concept 2: Advanced Topics',
      difficultyLevel: 'Advanced',
      orderIndex: 2,
      prerequisites: [concept1._id],
      createdBy: teacherUser._id
    });
    cleanupConceptIds.push(concept2._id);

    console.log(`✓ Created test concepts: "${concept1.name}" and "${concept2.name}" (with prerequisite link)`);

    // 4. Create test Assessment with questions mapped to concepts
    // Question 1 (10 marks) -> maps to Concept 1
    // Question 2 (10 marks) -> maps to Concept 1
    // Question 3 (20 marks) -> maps to Concept 2
    const sA = students[0]; // Student A: Needs Attention on Concept 1 (4/20 = 20%) & Concept 2 (5/20 = 25%)
    const sB = students[1] || students[0]; // Student B: Developing on Concept 1 (12/20 = 60%)
    const sC = students[2] || students[0]; // Student C: On Track on Concept 1 (18/20 = 90%)
    // Student D (if exists) will have NO scores recorded -> Insufficient Data

    const testAssessment = await Assessment.create({
      institution: institutionId,
      title: 'Stage 3 Diagnosis Verification Exam',
      subject: assignment.subject._id,
      classRef: assignment.classRef ? assignment.classRef._id : undefined,
      teachingAssignment: assignment._id,
      assessmentType: 'Continuous Assessment',
      academicYear: assignment.academicYear || '2025-2026',
      totalMarks: 40,
      questions: [
        { questionNumber: 'Q1', text: 'Foundation part 1', maxMarks: 10, concepts: [concept1._id] },
        { questionNumber: 'Q2', text: 'Foundation part 2', maxMarks: 10, concepts: [concept1._id] },
        { questionNumber: 'Q3', text: 'Advanced problem', maxMarks: 20, concepts: [concept2._id] }
      ],
      studentScores: [],
      createdBy: teacherUser._id,
      isActive: true
    });
    cleanupAssessmentIds.push(testAssessment._id);

    // Patch exact question IDs in studentScores
    const q1 = testAssessment.questions[0];
    const q2 = testAssessment.questions[1];
    const q3 = testAssessment.questions[2];

    const scoresList = [
      // Student A: Q1=2/10, Q2=2/10 (Total Concept 1 = 4/20 = 20% -> NEEDS_ATTENTION)
      //            Q3=5/20 (Total Concept 2 = 5/20 = 25% -> NEEDS_ATTENTION)
      { student: sA._id, questionId: q1._id, marksObtained: 2 },
      { student: sA._id, questionId: q2._id, marksObtained: 2 },
      { student: sA._id, questionId: q3._id, marksObtained: 5 }
    ];

    if (students.length > 1) {
      // Student B: Q1=6/10, Q2=6/10 (Total Concept 1 = 12/20 = 60% -> DEVELOPING)
      scoresList.push(
        { student: sB._id, questionId: q1._id, marksObtained: 6 },
        { student: sB._id, questionId: q2._id, marksObtained: 6 }
      );
    }

    if (students.length > 2) {
      // Student C: Q1=9/10, Q2=9/10 (Total Concept 1 = 18/20 = 90% -> ON_TRACK)
      scoresList.push(
        { student: sC._id, questionId: q1._id, marksObtained: 9 },
        { student: sC._id, questionId: q2._id, marksObtained: 9 }
      );
    }

    testAssessment.studentScores = scoresList;
    await testAssessment.save();
    console.log(`✓ Created test assessment with ${scoresList.length} empirical question scores`);

    // TEST 1: Run Knowledge-Gap Diagnosis
    console.log('\n--- TEST 1: Generate Knowledge-Gap Diagnosis & Verify Mathematical Classifications ---');
    const { req: diagReq, res: diagRes } = createMockReqRes(
      teacherUser,
      {},
      { subjectId: assignment.subject._id.toString() },
      {}
    );

    await diagnosisController.getKnowledgeGapDiagnosis(diagReq, diagRes);
    if (diagRes.statusCode !== 200 || !diagRes.data.success) {
      throw new Error(`Diagnosis generation failed: ${JSON.stringify(diagRes.data)}`);
    }

    const { summary, heatmap, findings } = diagRes.data;
    console.log(`✓ Diagnosis Generated. Summary:`, summary);

    // Verify Student A on Concept 1: Expected 20% -> NEEDS_ATTENTION
    const sA_c1 = findings.find(f => f.student._id.toString() === sA._id.toString() && f.concept._id.toString() === concept1._id.toString());
    if (!sA_c1) throw new Error('Finding for Student A and Concept 1 not found');
    console.log(`✓ Student A - Concept 1: Score=${sA_c1.performance}%, Classification=${sA_c1.classification} (Expected: NEEDS_ATTENTION)`);
    if (sA_c1.performance !== 20 || sA_c1.classification !== 'NEEDS_ATTENTION') {
      throw new Error(`Student A Concept 1 calculation incorrect! Got: ${sA_c1.performance}%, ${sA_c1.classification}`);
    }

    // Verify Student A on Concept 2: Expected 25% -> NEEDS_ATTENTION with Prerequisite Warning!
    const sA_c2 = findings.find(f => f.student._id.toString() === sA._id.toString() && f.concept._id.toString() === concept2._id.toString());
    if (!sA_c2) throw new Error('Finding for Student A and Concept 2 not found');
    console.log(`✓ Student A - Concept 2: Score=${sA_c2.performance}%, Classification=${sA_c2.classification}, PrereqGap=${sA_c2.hasPrerequisiteGap}`);
    if (sA_c2.performance !== 25 || sA_c2.classification !== 'NEEDS_ATTENTION' || !sA_c2.hasPrerequisiteGap) {
      throw new Error(`Student A Concept 2 calculation or prerequisite warning failed!`);
    }
    console.log(`✓ Prerequisite finding reason: "${sA_c2.prerequisiteFindings[0].note}"`);

    // Verify Student B on Concept 1 (if available): Expected 60% -> DEVELOPING
    if (students.length > 1) {
      const sB_c1 = findings.find(f => f.student._id.toString() === sB._id.toString() && f.concept._id.toString() === concept1._id.toString());
      console.log(`✓ Student B - Concept 1: Score=${sB_c1.performance}%, Classification=${sB_c1.classification} (Expected: DEVELOPING)`);
      if (sB_c1.performance !== 60 || sB_c1.classification !== 'DEVELOPING') {
        throw new Error(`Student B Concept 1 calculation incorrect! Got: ${sB_c1.performance}%, ${sB_c1.classification}`);
      }
    }

    // Verify Student C on Concept 1 (if available): Expected 90% -> ON_TRACK
    if (students.length > 2) {
      const sC_c1 = findings.find(f => f.student._id.toString() === sC._id.toString() && f.concept._id.toString() === concept1._id.toString());
      console.log(`✓ Student C - Concept 1: Score=${sC_c1.performance}%, Classification=${sC_c1.classification} (Expected: ON_TRACK)`);
      if (sC_c1.performance !== 90 || sC_c1.classification !== 'ON_TRACK') {
        throw new Error(`Student C Concept 1 calculation incorrect! Got: ${sC_c1.performance}%, ${sC_c1.classification}`);
      }
    }

    // TEST 2: Safeguard Verification - Missing Marks are NOT treated as Zero
    console.log('\n--- TEST 2: Verify Safeguards (Missing Marks Not Treated as Zero) ---');
    // Student B has NO scores recorded for Concept 2 (Question 3)
    if (students.length > 1) {
      const sB_c2 = findings.find(f => f.student._id.toString() === sB._id.toString() && f.concept._id.toString() === concept2._id.toString());
      console.log(`✓ Student B - Concept 2: Performance=${sB_c2.performance}, Classification=${sB_c2.classification} (Expected: INSUFFICIENT_DATA)`);
      if (sB_c2.performance !== null || sB_c2.classification !== 'INSUFFICIENT_DATA') {
        throw new Error('Safeguard violation: Missing marks were treated as zero or classified without data!');
      }
    }

    // TEST 3: Heatmap Matrix Dimensions and Accessibility
    console.log('\n--- TEST 3: Verify Heatmap Data Grid Structure ---');
    if (!heatmap.concepts || !heatmap.students) {
      throw new Error('Heatmap grid missing concepts or students!');
    }
    console.log(`✓ Heatmap dimensions: ${heatmap.students.length} student rows × ${heatmap.concepts.length} concept columns`);
    const studentRowA = heatmap.students.find(r => r.student._id.toString() === sA._id.toString());
    const cellA1 = studentRowA.cells.find(c => c.conceptId.toString() === concept1._id.toString());
    console.log(`✓ Heatmap Cell [Student A, Concept 1]: Score=${cellA1.performance}%, Classification=${cellA1.classification}`);
    if (cellA1.performance !== 20 || cellA1.classification !== 'NEEDS_ATTENTION') {
      throw new Error('Heatmap cell data mismatch with evaluated findings!');
    }

    // TEST 4: Student-Concept Detailed Evidence Audit Endpoint
    console.log('\n--- TEST 4: Student-Concept Detailed Audit Endpoint ---');
    const { req: detailReq, res: detailRes } = createMockReqRes(
      teacherUser,
      { studentId: sA._id.toString(), conceptId: concept2._id.toString() },
      { subjectId: assignment.subject._id.toString() },
      {}
    );

    await diagnosisController.getStudentConceptDetail(detailReq, detailRes);
    if (detailRes.statusCode !== 200 || !detailRes.data.success) {
      throw new Error(`getStudentConceptDetail failed: ${JSON.stringify(detailRes.data)}`);
    }

    const { detail } = detailRes.data;
    console.log(`✓ Audit details for ${detail.student.name} on "${detail.concept.name}":`);
    console.log(`  - Earned Marks: ${detail.earnedMarks}/${detail.possibleMarks} (${detail.performance}%)`);
    console.log(`  - Question Evidence: ${detail.evidenceQuestions.length} question(s) [${detail.evidenceQuestions[0].questionNumber}: ${detail.evidenceQuestions[0].marksEarned}/${detail.evidenceQuestions[0].maxMarks}]`);
    console.log(`  - Prerequisite Audit: ${detail.prerequisites.length} prerequisite concept(s)`);
    if (detail.evidenceQuestions.length !== 1 || detail.earnedMarks !== 5 || detail.possibleMarks !== 20) {
      throw new Error('Detailed question breakdown mismatch!');
    }

    // TEST 5: Teacher Follow-Up Review Note & Status Persistence
    console.log('\n--- TEST 5: Save and Retrieve Teacher Follow-Up Note ---');
    const { req: noteReq, res: noteRes } = createMockReqRes(
      teacherUser,
      {},
      {},
      {
        studentId: sA._id.toString(),
        conceptId: concept2._id.toString(),
        subjectId: assignment.subject._id.toString(),
        reviewStatus: 'Under Review',
        notes: 'Assigned targeted review worksheet on recurrence base cases.'
      }
    );

    await diagnosisController.saveFollowUpNote(noteReq, noteRes);
    if (noteRes.statusCode !== 200 || !noteRes.data.success) {
      throw new Error(`saveFollowUpNote failed: ${JSON.stringify(noteRes.data)}`);
    }
    console.log(`✓ Saved follow-up note. Review Status: "${noteRes.data.followUp.reviewStatus}"`);

    // Verify it persists by re-fetching detail
    const { req: verifyDetailReq, res: verifyDetailRes } = createMockReqRes(
      teacherUser,
      { studentId: sA._id.toString(), conceptId: concept2._id.toString() },
      { subjectId: assignment.subject._id.toString() },
      {}
    );
    await diagnosisController.getStudentConceptDetail(verifyDetailReq, verifyDetailRes);
    const persistedNote = verifyDetailRes.data.detail.followUp;
    console.log(`✓ Verified persisted note: Status="${persistedNote.reviewStatus}", Notes="${persistedNote.notes}"`);
    if (persistedNote.reviewStatus !== 'Under Review' || !persistedNote.notes.includes('recurrence base cases')) {
      throw new Error('Follow-up note was not correctly persisted or retrieved!');
    }

    // TEST 6: Authorization Guard - Reject Unauthorized Teachers
    console.log('\n--- TEST 6: Reject Unauthorized Teacher Access ---');
    const fakeTeacher = {
      _id: new mongoose.Types.ObjectId(),
      role: 'teacher',
      institution: institutionId,
      name: 'Unassigned Teacher'
    };

    const { req: unauthReq, res: unauthRes } = createMockReqRes(
      fakeTeacher,
      {},
      { subjectId: assignment.subject._id.toString() },
      {}
    );

    await diagnosisController.getKnowledgeGapDiagnosis(unauthReq, unauthRes);
    console.log(`✓ Unauthorized diagnosis request status: ${unauthRes.statusCode} (Expected: 403)`);
    if (unauthRes.statusCode !== 403) {
      throw new Error('Security violation: Unauthorized teacher request was not rejected with 403!');
    }

    console.log('\n✓ ALL STAGE 3 DIAGNOSIS TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Guaranteed cleanup
    console.log('\n--- CLEANING UP TEST ARTIFACTS ---');
    if (cleanupAssessmentIds.length > 0) {
      await Assessment.deleteMany({ _id: { $in: cleanupAssessmentIds } });
      console.log(`✓ Cleaned up ${cleanupAssessmentIds.length} test assessment(s)`);
    }
    if (cleanupConceptIds.length > 0) {
      await SubjectConcept.deleteMany({ _id: { $in: cleanupConceptIds } });
      console.log(`✓ Cleaned up ${cleanupConceptIds.length} test concept(s)`);
    }
    await KnowledgeGapFollowUp.deleteMany({
      concept: { $in: cleanupConceptIds }
    });
    console.log(`✓ Cleaned up test follow-up notes`);

    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  }
}

runVerification().catch(err => {
  console.error('\n❌ STAGE 3 VERIFICATION FAILED:', err);
  process.exit(1);
});
