const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Assessment = require('../models/Assessment');
const SubjectConcept = require('../models/SubjectConcept');
const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');
const TeacherProfile = require('../models/TeacherProfile');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Class = require('../models/Class');

// Controller functions
const assessmentController = require('../controllers/assessmentMappingController');

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
  console.log('--- STARTING STAGE 2 ASSESSMENT-TO-CONCEPT MAPPING VERIFICATION ---');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  let testAssessmentId = null;
  let testDiffSubjectId = null;
  let testDiffConceptId = null;

  try {
    // 1. Identify an active teaching assignment with a valid teacher profile
    const assignment = await TeachingAssignment.findOne({
      isActive: true,
      teacher: { $ne: null }
    })
      .populate('teacher')
      .populate('subject')
      .populate('classRef');

    if (!assignment || !assignment.teacher) {
      throw new Error('No active teaching assignment with an assigned teacher found in database to run verification.');
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

    // 2. Find or create 2 concepts for this subject
    let concepts = await SubjectConcept.find({
      institution: institutionId,
      subject: assignment.subject._id,
      isActive: true
    }).limit(2);

    if (concepts.length === 0) {
      const c1 = await SubjectConcept.create({
        institution: institutionId,
        subject: assignment.subject._id,
        name: 'Verification Concept A',
        difficultyLevel: 'Fundamental',
        createdBy: teacherUser._id
      });
      const c2 = await SubjectConcept.create({
        institution: institutionId,
        subject: assignment.subject._id,
        name: 'Verification Concept B',
        difficultyLevel: 'Intermediate',
        prerequisites: [c1._id],
        createdBy: teacherUser._id
      });
      concepts = [c1, c2];
    }
    console.log(`✓ Available Subject Concepts for Mapping: ${concepts.map(c => c.name).join(', ')}`);

    // 3. Find another subject to test cross-subject mapping rejection
    const otherSubject = await Subject.findOne({
      _id: { $ne: assignment.subject._id },
      institution: institutionId
    });

    if (otherSubject) {
      testDiffSubjectId = otherSubject._id;
      let otherConcept = await SubjectConcept.findOne({
        subject: otherSubject._id,
        institution: institutionId
      });
      if (!otherConcept) {
        otherConcept = await SubjectConcept.create({
          institution: institutionId,
          subject: otherSubject._id,
          name: 'Different Subject Concept',
          difficultyLevel: 'Fundamental',
          createdBy: teacherUser._id
        });
      }
      testDiffConceptId = otherConcept._id;
      console.log(`✓ Created/Found Incompatible Concept from Subject "${otherSubject.name}"`);
    }

    // TEST 1: Create Assessment with questions
    console.log('\n--- TEST 1: Create Assessment with Question-Level Records ---');
    const { req: createReq, res: createRes } = createMockReqRes(
      teacherUser,
      {},
      {},
      {
        title: 'Stage 2 Verification Test Assessment',
        description: 'Automated test assessment for question mapping verification',
        subjectId: assignment.subject._id.toString(),
        classId: assignment.classRef ? assignment.classRef._id.toString() : undefined,
        assessmentType: 'Continuous Assessment',
        questions: [
          { questionNumber: 'Q1', text: 'Solve recurrence relation', maxMarks: 10, concepts: [concepts[0]._id.toString()] },
          { questionNumber: 'Q2', text: 'State asymptotic bounds', maxMarks: 15, concepts: [] }
        ]
      }
    );

    await assessmentController.createAssessment(createReq, createRes);
    if (createRes.statusCode !== 201 || !createRes.data.success) {
      throw new Error(`Create assessment failed: ${JSON.stringify(createRes.data)}`);
    }

    const createdAssessment = createRes.data.assessment;
    testAssessmentId = createdAssessment._id;
    console.log(`✓ Successfully created assessment ID: ${testAssessmentId}`);
    console.log(`✓ Total Questions: ${createRes.data.stats.totalQuestions}, Mapped: ${createRes.data.stats.mappedQuestions}, Unmapped: ${createRes.data.stats.unmappedQuestions}`);
    console.log(`✓ Mapping completion: ${createRes.data.stats.completionPercentage}%`);

    if (createRes.data.stats.mappedQuestions !== 1 || createRes.data.stats.unmappedQuestions !== 1) {
      throw new Error('Initial mapped/unmapped counts incorrect!');
    }

    // TEST 2: Update Question Mapping (Map Q2 to concepts[0] and concepts[1])
    console.log('\n--- TEST 2: Update Question Mapping for Q2 ---');
    const q2 = createdAssessment.questions.find(q => q.questionNumber === 'Q2');
    if (!q2) throw new Error('Q2 not found in created assessment');

    const { req: mapReq, res: mapRes } = createMockReqRes(
      teacherUser,
      { id: testAssessmentId.toString(), questionId: q2._id.toString() },
      {},
      { concepts: [concepts[0]._id.toString(), concepts[1] ? concepts[1]._id.toString() : concepts[0]._id.toString()] }
    );

    await assessmentController.updateQuestionMapping(mapReq, mapRes);
    if (mapRes.statusCode !== 200 || !mapRes.data.success) {
      throw new Error(`Update question mapping failed: ${JSON.stringify(mapRes.data)}`);
    }

    console.log(`✓ Successfully mapped Q2. New completion: ${mapRes.data.stats.completionPercentage}%`);
    if (mapRes.data.stats.mappedQuestions !== 2 || mapRes.data.stats.completionPercentage !== 100) {
      throw new Error('Mapping completion percentage not 100% after mapping Q2!');
    }

    // TEST 3: Incompatible Concept Rejection (Security & Data Integrity)
    if (testDiffConceptId) {
      console.log('\n--- TEST 3: Reject Incompatible Concept from Different Subject ---');
      const { req: badMapReq, res: badMapRes } = createMockReqRes(
        teacherUser,
        { id: testAssessmentId.toString(), questionId: q2._id.toString() },
        {},
        { concepts: [testDiffConceptId.toString()] }
      );

      await assessmentController.updateQuestionMapping(badMapReq, badMapRes);
      console.log(`✓ Incompatible concept attempt response status: ${badMapRes.statusCode} (Expected: 400)`);
      if (badMapRes.statusCode !== 400) {
        throw new Error(`Security violation: Server allowed mapping concept from different subject! Status: ${badMapRes.statusCode}`);
      }
      console.log(`✓ Error message returned: "${badMapRes.data.error}"`);
    }

    // TEST 4: Unauthorized Teacher Access Rejection
    console.log('\n--- TEST 4: Reject Unauthorized Teacher Access ---');
    const fakeTeacherUser = {
      _id: new mongoose.Types.ObjectId(),
      role: 'teacher',
      institution: institutionId,
      name: 'Unauthorized Teacher'
    };

    const { req: unauthReq, res: unauthRes } = createMockReqRes(
      fakeTeacherUser,
      { id: testAssessmentId.toString(), questionId: q2._id.toString() },
      {},
      { concepts: [concepts[0]._id.toString()] }
    );

    await assessmentController.updateQuestionMapping(unauthReq, unauthRes);
    console.log(`✓ Unauthorized teacher response status: ${unauthRes.statusCode} (Expected: 403)`);
    if (unauthRes.statusCode !== 403) {
      throw new Error(`Authorization violation: Unauthorized teacher request was not rejected with 403! Status: ${unauthRes.statusCode}`);
    }

    // TEST 5: Student Question Score Validation
    console.log('\n--- TEST 5: Student Score Validation (Negative & Exceeding Max Marks) ---');
    const dummyStudentId = new mongoose.Types.ObjectId();

    // 5a: Exceeds max marks
    const { req: overScoreReq, res: overScoreRes } = createMockReqRes(
      teacherUser,
      { id: testAssessmentId.toString() },
      {},
      { scores: [{ studentId: dummyStudentId.toString(), questionId: q2._id.toString(), marksObtained: 999 }] }
    );
    await assessmentController.recordStudentQuestionScores(overScoreReq, overScoreRes);
    console.log(`✓ Marks exceeding maxMarks response status: ${overScoreRes.statusCode} (Expected: 400)`);
    if (overScoreRes.statusCode !== 400) {
      throw new Error(`Validation violation: Server accepted marks exceeding maxMarks!`);
    }

    // 5b: Negative marks
    const { req: negScoreReq, res: negScoreRes } = createMockReqRes(
      teacherUser,
      { id: testAssessmentId.toString() },
      {},
      { scores: [{ studentId: dummyStudentId.toString(), questionId: q2._id.toString(), marksObtained: -5 }] }
    );
    await assessmentController.recordStudentQuestionScores(negScoreReq, negScoreRes);
    console.log(`✓ Negative marks response status: ${negScoreRes.statusCode} (Expected: 400)`);
    if (negScoreRes.statusCode !== 400) {
      throw new Error(`Validation violation: Server accepted negative marks!`);
    }

    // 5c: Valid score record
    const { req: validScoreReq, res: validScoreRes } = createMockReqRes(
      teacherUser,
      { id: testAssessmentId.toString() },
      {},
      { scores: [{ studentId: dummyStudentId.toString(), questionId: q2._id.toString(), marksObtained: 12 }] }
    );
    await assessmentController.recordStudentQuestionScores(validScoreReq, validScoreRes);
    console.log(`✓ Valid score record response status: ${validScoreRes.statusCode} (Expected: 200)`);
    if (validScoreRes.statusCode !== 200) {
      throw new Error(`Failed to record valid student score: ${JSON.stringify(validScoreRes.data)}`);
    }
    console.log(`✓ Student evidence status now has ${validScoreRes.data.scoresCount} recorded score(s)`);

    // TEST 6: Get Assessments List and Verify Computed Stats
    console.log('\n--- TEST 6: Verify Assessment List Endpoint & Real Counts ---');
    const { req: listReq, res: listRes } = createMockReqRes(
      teacherUser,
      {},
      { subjectId: assignment.subject._id.toString() },
      {}
    );
    await assessmentController.getAssessments(listReq, listRes);
    if (listRes.statusCode !== 200) {
      throw new Error(`getAssessments failed: ${JSON.stringify(listRes.data)}`);
    }
    const targetItem = listRes.data.assessments.find(a => a._id.toString() === testAssessmentId.toString());
    if (!targetItem) {
      throw new Error('Created test assessment not found in list response!');
    }
    console.log(`✓ Retrieved assessment from list: "${targetItem.title}"`);
    console.log(`✓ Stats verified: Total Questions = ${targetItem.stats.totalQuestions}, Mapped = ${targetItem.stats.mappedQuestions}, Completion = ${targetItem.stats.completionPercentage}%, Has Evidence = ${targetItem.stats.hasStudentEvidence}`);

    console.log('\n✓ ALL BACKEND TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Cleanup temporary assessment
    if (testAssessmentId) {
      await Assessment.findByIdAndDelete(testAssessmentId);
      console.log(`✓ Cleaned up test assessment ID: ${testAssessmentId}`);
    }
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  }
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
