const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const Institution = require('../models/Institution');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');

async function runVerification() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const results = [];

  try {
    const institution = await Institution.findOne({ name: /Study Point/i }) || await Institution.findOne();
    if (!institution) throw new Error('No institution found');

    const subjects = await Subject.find({ institution: institution._id, isActive: true }).limit(2);
    if (subjects.length < 2) throw new Error('Need at least 2 subjects in DB');

    const teachers = await TeacherProfile.find({ institution: institution._id }).populate('user').limit(2);
    if (teachers.length < 2) throw new Error('Need at least 2 teachers in DB');

    const subj1 = subjects[0];
    const subj2 = subjects[1];
    const tch1 = teachers[0];
    const tch2 = teachers[1];

    console.log(`Using Institution: ${institution.name}`);
    console.log(`Subject 1: ${subj1.code} - ${subj1.name}`);
    console.log(`Subject 2: ${subj2.code} - ${subj2.name}`);
    console.log(`Teacher 1: ${tch1.user?.name || tch1.teacherId}`);
    console.log(`Teacher 2: ${tch2.user?.name || tch2.teacherId}`);

    // Create temporary test class
    await Class.deleteMany({ institution: institution._id, section: 'TEST-Z' });
    await TeachingAssignment.deleteMany({ academicYear: '2026-2027', title: /TEST-Z/ });

    const testClass = await Class.create({
      institution: institution._id,
      name: 'B.Tech - Computer Science and Engineering',
      course: 'B.Tech',
      department: 'Computer Science and Engineering',
      academicYear: '2026-2027',
      semester: '5th',
      section: 'TEST-Z',
      yearOfStudy: 'Third Year',
      isActive: true
    });

    console.log(`Created test class: ID ${testClass._id}, Section: ${testClass.section}`);

    // Helper to evaluate assignments directly using the controller logic
    function evalMetrics(assignments) {
      const activeAssignments = (assignments || []).filter(a => a && a.isActive !== false);
      const subjectMap = new Map();
      const uniqueTeachers = new Set();
      let hasIncompleteOrBroken = false;

      for (const asgn of activeAssignments) {
        const subjectId = asgn.subject?._id?.toString() || (asgn.subject ? asgn.subject.toString() : null);
        const teacherId = asgn.teacher?._id?.toString() || (asgn.teacher ? asgn.teacher.toString() : null);

        const isSubjectValid = Boolean(subjectId && asgn.subject?.isActive !== false);
        const isTeacherValid = Boolean(teacherId && asgn.teacher?.isActive !== false && (asgn.teacher?.user ? asgn.teacher.user.isActive !== false : true));

        if (!isSubjectValid) {
          hasIncompleteOrBroken = true;
          continue;
        }

        if (!subjectMap.has(subjectId)) {
          subjectMap.set(subjectId, {
            subject: asgn.subject,
            teachers: new Set()
          });
        }

        if (isTeacherValid) {
          subjectMap.get(subjectId).teachers.add(teacherId);
          uniqueTeachers.add(teacherId);
        } else {
          hasIncompleteOrBroken = true;
        }
      }

      const subjectsCount = subjectMap.size;
      const teachersCount = uniqueTeachers.size;

      let allSubjectsHaveTeachers = subjectsCount > 0;
      for (const info of subjectMap.values()) {
        if (info.teachers.size === 0) {
          allSubjectsHaveTeachers = false;
          break;
        }
      }

      const isAssigned = (
        subjectsCount > 0 &&
        teachersCount > 0 &&
        allSubjectsHaveTeachers &&
        !hasIncompleteOrBroken
      );

      return {
        subjectsCount,
        teachersCount,
        status: isAssigned ? 'Assigned' : 'Not Assigned',
        isAssigned
      };
    }

    // --- Scenario 1: No subjects and no teachers ---
    {
      const m = evalMetrics([]);
      const pass = m.subjectsCount === 0 && m.teachersCount === 0 && m.status === 'Not Assigned';
      results.push({
        scenario: 'Scenario 1: No subjects and no teachers',
        expected: { subjectsCount: 0, teachersCount: 0, status: 'Not Assigned' },
        actual: m,
        status: pass ? 'PASS' : 'FAIL'
      });
    }

    // --- Scenario 2: Subjects assigned but no teachers assigned ---
    {
      const asgn1 = {
        subject: subj1,
        teacher: null,
        isActive: true
      };
      const m = evalMetrics([asgn1]);
      const pass = m.subjectsCount === 1 && m.teachersCount === 0 && m.status === 'Not Assigned';
      results.push({
        scenario: 'Scenario 2: Subjects assigned but no teachers assigned',
        expected: { subjectsCount: 1, teachersCount: 0, status: 'Not Assigned' },
        actual: m,
        status: pass ? 'PASS' : 'FAIL'
      });
    }

    // --- Scenario 3: Subjects assigned with incomplete teacher assignments ---
    {
      const asgn1 = {
        subject: subj1,
        teacher: null,
        isActive: true
      };
      const asgn2 = {
        subject: subj2,
        teacher: tch1,
        isActive: true
      };
      const m = evalMetrics([asgn1, asgn2]);
      const pass = m.subjectsCount === 2 && m.teachersCount === 1 && m.status === 'Not Assigned';
      results.push({
        scenario: 'Scenario 3: Incomplete teacher assignment (2 subjects, 1 teacher, 1 unassigned)',
        expected: { subjectsCount: 2, teachersCount: 1, status: 'Not Assigned' },
        actual: m,
        status: pass ? 'PASS' : 'FAIL'
      });
    }

    // --- Scenario 4: All required subject and teacher assignments completed ---
    {
      const asgn1 = {
        subject: subj1,
        teacher: tch1,
        isActive: true
      };
      const asgn2 = {
        subject: subj2,
        teacher: tch2,
        isActive: true
      };
      const m = evalMetrics([asgn1, asgn2]);
      const pass = m.subjectsCount === 2 && m.teachersCount === 2 && m.status === 'Assigned';
      results.push({
        scenario: 'Scenario 4: All assignments completed (2 subjects, 2 teachers)',
        expected: { subjectsCount: 2, teachersCount: 2, status: 'Assigned' },
        actual: m,
        status: pass ? 'PASS' : 'FAIL'
      });
    }

    // --- Scenario 5: One teacher assigned to multiple subjects ---
    {
      const asgn1 = {
        subject: subj1,
        teacher: tch1,
        isActive: true
      };
      const asgn2 = {
        subject: subj2,
        teacher: tch1, // same teacher teaches both subjects
        isActive: true
      };
      const m = evalMetrics([asgn1, asgn2]);
      const pass = m.subjectsCount === 2 && m.teachersCount === 1 && m.status === 'Assigned';
      results.push({
        scenario: 'Scenario 5: One teacher assigned to multiple subjects (2 subjects, 1 unique teacher)',
        expected: { subjectsCount: 2, teachersCount: 1, status: 'Assigned' },
        actual: m,
        status: pass ? 'PASS' : 'FAIL'
      });
    }

    // --- Scenario 6: Inactive or broken teacher relationship ---
    {
      const asgn1 = {
        subject: subj1,
        teacher: { _id: tch1._id, isActive: false, user: { isActive: false } },
        isActive: true
      };
      const m = evalMetrics([asgn1]);
      const pass = m.status === 'Not Assigned';
      results.push({
        scenario: 'Scenario 6: Inactive teacher relationship',
        expected: { status: 'Not Assigned' },
        actual: m,
        status: pass ? 'PASS' : 'FAIL'
      });
    }

    // --- Real Database Test via TeachingAssignment documents ---
    console.log('\n--- Testing Real Database Query with TeachingAssignment Documents ---');
    // Save DB TeachingAssignment for testClass
    await TeachingAssignment.create({
      institution: institution._id,
      classRef: testClass._id,
      subject: subj1._id,
      teacher: tch1._id,
      academicYear: '2026-2027',
      title: 'TEST-Z Subject 1',
      isActive: true
    });

    await TeachingAssignment.create({
      institution: institution._id,
      classRef: testClass._id,
      subject: subj2._id,
      teacher: tch1._id, // single teacher for both
      academicYear: '2026-2027',
      title: 'TEST-Z Subject 2',
      isActive: true
    });

    const dbAssignments = await TeachingAssignment.find({
      institution: institution._id,
      classRef: testClass._id,
      isActive: true
    }).populate('subject').populate({
      path: 'teacher',
      populate: { path: 'user', select: 'name email role isActive' }
    });

    const dbMetrics = evalMetrics(dbAssignments);
    console.log('Real DB Metrics for TEST-Z with 2 subjects & 1 teacher:');
    console.log(dbMetrics);

    results.push({
      scenario: 'Database Integration: Persisted TeachingAssignments with populated docs',
      expected: { subjectsCount: 2, teachersCount: 1, status: 'Assigned' },
      actual: dbMetrics,
      status: (dbMetrics.subjectsCount === 2 && dbMetrics.teachersCount === 1 && dbMetrics.status === 'Assigned') ? 'PASS' : 'FAIL'
    });

    // Cleanup test data
    await TeachingAssignment.deleteMany({ classRef: testClass._id });
    await Class.findByIdAndDelete(testClass._id);
    console.log('Cleaned up temporary test documents.');

  } catch (err) {
    console.error('Test error:', err);
    results.push({
      scenario: 'Execution Error',
      error: err.message,
      status: 'FAIL'
    });
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }

  console.log('\n========================================');
  console.log('       TEST VERIFICATION RESULTS        ');
  console.log('========================================');
  results.forEach((r, i) => {
    console.log(`[${r.status}] ${r.scenario}`);
    if (r.expected) console.log(`   Expected: ${JSON.stringify(r.expected)}`);
    if (r.actual) console.log(`   Actual:   ${JSON.stringify(r.actual)}`);
  });
  console.log('========================================\n');
}

runVerification();
