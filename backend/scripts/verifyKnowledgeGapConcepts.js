const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const Subject = require('../models/Subject');
const SubjectConcept = require('../models/SubjectConcept');
const conceptController = require('../controllers/conceptController');

const createMockRes = () => ({
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
});

async function runTests() {
  console.log('=== Running Knowledge-Gap Stage 1 Concept & Prerequisite Verification ===\n');
  await mongoose.connect(process.env.MONGODB_URI);

  const testConceptIds = [];

  try {
    // 1. Locate an active teacher
    const teacherUsers = await User.find({ role: 'teacher', isActive: true });
    if (teacherUsers.length === 0) {
      throw new Error('No active teacher users found in database.');
    }

    let selectedTeacherUser = null;
    let selectedAssignment = null;

    for (const t of teacherUsers) {
      const prof = await TeacherProfile.findOne({ user: t._id, institution: t.institution });
      if (prof) {
        const asgn = await TeachingAssignment.findOne({
          teacher: prof._id,
          institution: t.institution,
          isActive: true
        }).populate('subject');
        if (asgn && asgn.subject) {
          selectedTeacherUser = t;
          selectedAssignment = asgn;
          break;
        }
      }
    }

    if (!selectedTeacherUser || !selectedAssignment) {
      throw new Error('No teacher with active teaching assignments found.');
    }

    const institutionId = selectedTeacherUser.institution;
    const subjectId = selectedAssignment.subject._id;
    const subjectName = selectedAssignment.subject.name;

    console.log(`Teacher: ${selectedTeacherUser.userId} (Inst: ${institutionId})`);
    console.log(`Testing with Subject: ${subjectName} (${selectedAssignment.subject.code || subjectId})`);

    // TEST 1: Retrieve Scope Filters
    console.log('\n--- TEST 1: Retrieve Scope Filters ---');
    const filterReq = { currentUser: selectedTeacherUser };
    const filterRes = createMockRes();
    await conceptController.getKnowledgeGapFilters(filterReq, filterRes);

    if (filterRes.statusCode !== 200 || !filterRes.body?.success) {
      throw new Error(`getKnowledgeGapFilters failed: ${JSON.stringify(filterRes.body)}`);
    }
    const { filters } = filterRes.body;
    console.log('✓ Scope filters retrieved:');
    console.log(`  - Departments: ${filters.departments.length}`);
    console.log(`  - Academic Years: ${filters.academicYears.length}`);
    console.log(`  - Semesters: ${filters.semesters.length}`);
    console.log(`  - Sections: ${filters.sections.length}`);
    console.log(`  - Subjects: ${filters.subjects.length}`);

    // TEST 2: List concepts for subject
    console.log('\n--- TEST 2: List Concepts for Subject ---');
    const listReq = {
      currentUser: selectedTeacherUser,
      query: { subjectId: subjectId.toString() }
    };
    const listRes = createMockRes();
    await conceptController.getConcepts(listReq, listRes);

    if (listRes.statusCode !== 200 || !listRes.body?.success) {
      throw new Error(`getConcepts failed: ${JSON.stringify(listRes.body)}`);
    }
    console.log(`✓ Retrieved ${listRes.body.concepts.length} existing concepts for subject.`);

    // TEST 3: Create Concept A (Foundational)
    console.log('\n--- TEST 3: Create Concept A (Foundational, 0 prerequisites) ---');
    const conceptAName = `__TEST_Concept_Alpha_${Date.now()}`;
    const createReqA = {
      currentUser: selectedTeacherUser,
      body: {
        subjectId: subjectId.toString(),
        name: conceptAName,
        description: 'Foundational programming fundamentals',
        difficultyLevel: 'Fundamental',
        orderIndex: 1,
        prerequisites: []
      }
    };
    const createResA = createMockRes();
    await conceptController.createConcept(createReqA, createResA);

    if (createResA.statusCode !== 201 || !createResA.body?.success) {
      throw new Error(`Failed to create Concept A: ${JSON.stringify(createResA.body)}`);
    }
    const conceptA = createResA.body.concept;
    testConceptIds.push(conceptA._id);
    console.log(`✓ Concept A created: ID ${conceptA._id}, Name: "${conceptA.name}"`);

    // TEST 4: Create Concept B with Concept A as prerequisite
    console.log('\n--- TEST 4: Create Concept B (Depends on Concept A) ---');
    const conceptBName = `__TEST_Concept_Beta_${Date.now()}`;
    const createReqB = {
      currentUser: selectedTeacherUser,
      body: {
        subjectId: subjectId.toString(),
        name: conceptBName,
        description: 'Intermediate logic control flows',
        difficultyLevel: 'Intermediate',
        orderIndex: 2,
        prerequisites: [conceptA._id.toString()]
      }
    };
    const createResB = createMockRes();
    await conceptController.createConcept(createReqB, createResB);

    if (createResB.statusCode !== 201 || !createResB.body?.success) {
      throw new Error(`Failed to create Concept B: ${JSON.stringify(createResB.body)}`);
    }
    const conceptB = createResB.body.concept;
    testConceptIds.push(conceptB._id);
    console.log(`✓ Concept B created: ID ${conceptB._id}, Name: "${conceptB.name}" with Prerequisite: [${conceptA.name}]`);

    // TEST 5: Create Concept C with Concept B as prerequisite (A -> B -> C)
    console.log('\n--- TEST 5: Create Concept C (Depends on Concept B: A -> B -> C) ---');
    const conceptCName = `__TEST_Concept_Gamma_${Date.now()}`;
    const createReqC = {
      currentUser: selectedTeacherUser,
      body: {
        subjectId: subjectId.toString(),
        name: conceptCName,
        description: 'Advanced data transformation structures',
        difficultyLevel: 'Advanced',
        orderIndex: 3,
        prerequisites: [conceptB._id.toString()]
      }
    };
    const createResC = createMockRes();
    await conceptController.createConcept(createReqC, createResC);

    if (createResC.statusCode !== 201 || !createResC.body?.success) {
      throw new Error(`Failed to create Concept C: ${JSON.stringify(createResC.body)}`);
    }
    const conceptC = createResC.body.concept;
    testConceptIds.push(conceptC._id);
    console.log(`✓ Concept C created: ID ${conceptC._id}, Name: "${conceptC.name}" with Prerequisite: [${conceptB.name}]`);

    // TEST 6: Prevent Concept from being its own prerequisite (Self-Reference check)
    console.log('\n--- TEST 6: Reject Self-Prerequisite ---');
    const selfReq = {
      currentUser: selectedTeacherUser,
      params: { id: conceptA._id.toString() },
      body: {
        prerequisites: [conceptA._id.toString()]
      }
    };
    const selfRes = createMockRes();
    await conceptController.updateConcept(selfReq, selfRes);

    if (selfRes.statusCode === 400 && selfRes.body?.error?.includes('own prerequisite')) {
      console.log(`✓ Correctly rejected self-prerequisite: "${selfRes.body.error}"`);
    } else {
      throw new Error(`Expected 400 rejection for self-prerequisite, got status ${selfRes.statusCode}: ${JSON.stringify(selfRes.body)}`);
    }

    // TEST 7: Prevent Circular Dependency (Attempt to make Concept A depend on Concept C, forming A -> B -> C -> A)
    console.log('\n--- TEST 7: Circular Dependency Detection (A -> B -> C -> A) ---');
    const cycleReq = {
      currentUser: selectedTeacherUser,
      params: { id: conceptA._id.toString() },
      body: {
        prerequisites: [conceptC._id.toString()]
      }
    };
    const cycleRes = createMockRes();
    await conceptController.updateConcept(cycleReq, cycleRes);

    if (cycleRes.statusCode === 400 && cycleRes.body?.error?.includes('Circular dependency')) {
      console.log(`✓ Correctly detected and rejected circular dependency: "${cycleRes.body.error}"`);
    } else {
      throw new Error(`Expected 400 rejection for circular dependency, got status ${cycleRes.statusCode}: ${JSON.stringify(cycleRes.body)}`);
    }

    // TEST 8: Safe Deletion - Prevent deleting Concept A while Concept B depends on it
    console.log('\n--- TEST 8: Safe Deletion Prevention (Concept A is required by Concept B) ---');
    const deleteReqA = {
      currentUser: selectedTeacherUser,
      params: { id: conceptA._id.toString() }
    };
    const deleteResA = createMockRes();
    await conceptController.deleteConcept(deleteReqA, deleteResA);

    if (deleteResA.statusCode === 400 && deleteResA.body?.error?.includes('prerequisite')) {
      console.log(`✓ Correctly blocked deletion of required prerequisite: "${deleteResA.body.error}"`);
    } else {
      throw new Error(`Expected 400 rejection for deleting required prerequisite, got status ${deleteResA.statusCode}: ${JSON.stringify(deleteResA.body)}`);
    }

    // TEST 9: Safe Deletion - Deleting leaf Concept C (no other concept depends on C)
    console.log('\n--- TEST 9: Delete Leaf Concept C ---');
    const deleteReqC = {
      currentUser: selectedTeacherUser,
      params: { id: conceptC._id.toString() }
    };
    const deleteResC = createMockRes();
    await conceptController.deleteConcept(deleteReqC, deleteResC);

    if (deleteResC.statusCode === 200 && deleteResC.body?.success) {
      console.log(`✓ Successfully deleted terminal concept: "${deleteResC.body.message}"`);
      const idxC = testConceptIds.indexOf(conceptC._id);
      if (idxC !== -1) testConceptIds.splice(idxC, 1);
    } else {
      throw new Error(`Failed to delete leaf concept: ${JSON.stringify(deleteResC.body)}`);
    }

    // TEST 10: Authorization Guard - Unassigned teacher cannot manage subject concepts
    console.log('\n--- TEST 10: Authorization Guard ---');
    // Create mock user with different ID
    const unauthorizedUser = {
      _id: new mongoose.Types.ObjectId(),
      institution: institutionId,
      role: 'teacher'
    };
    const unauthReq = {
      currentUser: unauthorizedUser,
      query: { subjectId: subjectId.toString() }
    };
    const unauthRes = createMockRes();
    await conceptController.getConcepts(unauthReq, unauthRes);

    if (unauthRes.statusCode === 403) {
      console.log(`✓ Correctly rejected unauthorized teacher request with 403 Forbidden.`);
    } else {
      throw new Error(`Expected 403 for unauthorized teacher, got status ${unauthRes.statusCode}`);
    }

    console.log('\n======================================================');
    console.log('✓ ALL 10 KNOWLEDGE-GAP CONCEPTS & PREREQUISITE TESTS PASSED');
    console.log('======================================================\n');
  } finally {
    // Cleanup any remaining test concepts created during the run
    if (testConceptIds.length > 0) {
      await SubjectConcept.deleteMany({ _id: { $in: testConceptIds } });
      console.log(`Cleaned up ${testConceptIds.length} temporary test concepts.`);
    }
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
