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

async function runYearOfStudyVerification() {
  console.log('================================================================');
  console.log(' Verification: Year of Study on My Subjects Cards');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.\n');

  const institution = await Institution.findOne({ name: /Study Point/i }) || await Institution.findOne();
  if (!institution) throw new Error('No institution found');

  const teacher = await TeacherProfile.findOne({ institution: institution._id }).populate('user');
  if (!teacher || !teacher.user) throw new Error('No valid teacher found');

  console.log(`Using Teacher: ${teacher.personalInfo?.name || teacher.teacherId} (${teacher.user._id})`);

  // Create temporary subject
  const subjectCode = `YOS-TEST-${Date.now().toString().slice(-4)}`;
  const testSubject = await Subject.create({
    institution: institution._id,
    name: 'Operating Systems & Architecture',
    code: subjectCode,
    department: 'Computer Science and Engineering',
    subjectType: 'Theory',
    credits: 3,
    academicYear: '2026-2027',
    isActive: true
  });
  console.log(`Created test subject: ${testSubject.code} - ${testSubject.name}`);

  // Create classes in different Years of Study:
  // Class 1: Third Year, Sem 5th, Sec YOS-3A
  // Class 2: Third Year, Sem 5th, Sec YOS-3B
  // Class 3: Fourth Year, Sem 7th, Sec YOS-4A
  // Class 4: Custom class without yearOfStudy or recognizable semester
  const class3A = await Class.create({
    institution: institution._id,
    name: 'B.Tech - Computer Science and Engineering (Sem 5th, Sec YOS-3A)',
    course: 'B.Tech',
    department: 'Computer Science and Engineering',
    academicYear: '2026-2027',
    semester: '5th',
    section: 'YOS-3A',
    yearOfStudy: 'Third Year',
    isActive: true
  });

  const class3B = await Class.create({
    institution: institution._id,
    name: 'B.Tech - Computer Science and Engineering (Sem 5th, Sec YOS-3B)',
    course: 'B.Tech',
    department: 'Computer Science and Engineering',
    academicYear: '2026-2027',
    semester: '5th',
    section: 'YOS-3B',
    yearOfStudy: 'Third Year',
    isActive: true
  });

  const class4A = await Class.create({
    institution: institution._id,
    name: 'B.Tech - Computer Science and Engineering (Sem 7th, Sec YOS-4A)',
    course: 'B.Tech',
    department: 'Computer Science and Engineering',
    academicYear: '2026-2027',
    semester: '7th',
    section: 'YOS-4A',
    yearOfStudy: 'Fourth Year',
    isActive: true
  });

  const classUnknown = await Class.create({
    institution: institution._id,
    name: 'B.Tech - Computer Science and Engineering (Sec YOS-UNK)',
    course: 'B.Tech',
    department: 'Computer Science and Engineering',
    academicYear: '2026-2027',
    semester: 'Special',
    section: 'YOS-UNK',
    yearOfStudy: '', // empty
    isActive: true
  });

  console.log('Created test classes for Third Year (2 sections), Fourth Year (1 section), and Unknown Year (1 section).\n');

  try {
    const adminUser = await User.findOne({ role: 'admin', institution: institution._id }) || { _id: new mongoose.Types.ObjectId(), institution };

    // Assign test subject to all 4 classes for Teacher
    console.log('--- Step 1: Assigning subject across multiple sections and years of study ---');
    for (const cls of [class3A, class3B, class4A, classUnknown]) {
      const adminReq = {
        params: { id: cls._id.toString() },
        currentUser: adminUser,
        body: {
          assignments: [
            { subjectId: testSubject._id.toString(), teacherId: teacher._id.toString() }
          ]
        }
      };
      const adminRes = createMockRes();
      await adminController.updateClassAssignments(adminReq, adminRes);
      if (adminRes.statusCode !== 200 || !adminRes.body?.success) {
        throw new Error(`Failed to assign to class ${cls.section}`);
      }
    }
    console.log('✓ Successfully assigned subject to all 4 sections via admin controller.\n');

    // Query teacher's subjects
    console.log('--- Step 2: Querying getMySubjects for Teacher ---');
    const teacherReq = { currentUser: teacher.user };
    const teacherRes = createMockRes();
    await teacherController.getMySubjects(teacherReq, teacherRes);

    if (teacherRes.statusCode !== 200 || !teacherRes.body?.success) {
      throw new Error(`getMySubjects failed: ${JSON.stringify(teacherRes.body)}`);
    }

    const testSubjectCards = teacherRes.body.subjects.filter(s => s.subjectId.toString() === testSubject._id.toString());
    console.log(`Total subject cards for ${testSubject.name}: ${testSubjectCards.length}`);

    // Requirement: Sections in Third Year (YOS-3A, YOS-3B) must merge into 1 card
    // Sections in Fourth Year (YOS-4A) must be a separate card
    // Section with unknown year must be a separate card with yearOfStudy: '—'
    if (testSubjectCards.length !== 3) {
      throw new Error(`Expected exactly 3 distinct cards (3rd Year, 4th Year, Unknown Year), got ${testSubjectCards.length}`);
    }

    const thirdYearCard = testSubjectCards.find(c => c.yearOfStudy === '3rd Year');
    if (!thirdYearCard) {
      throw new Error(`Missing 3rd Year subject card! Available: ${testSubjectCards.map(c => c.yearOfStudy)}`);
    }
    console.log('\n3rd Year Subject Card:');
    console.log(`  - Name: ${thirdYearCard.name}`);
    console.log(`  - Code: ${thirdYearCard.code}`);
    console.log(`  - Academic Year: ${thirdYearCard.academicYear}`);
    console.log(`  - Year of Study: ${thirdYearCard.yearOfStudy}`);
    console.log(`  - Semester: ${thirdYearCard.semester}`);
    console.log(`  - Assigned Sections: [${thirdYearCard.sections.join(', ')}]`);
    console.log(`  - Section Count: ${thirdYearCard.sectionCount}`);

    if (thirdYearCard.sectionCount !== 2 || !thirdYearCard.sections.includes('YOS-3A') || !thirdYearCard.sections.includes('YOS-3B')) {
      throw new Error(`Expected 3rd Year card to contain sections YOS-3A and YOS-3B, got [${thirdYearCard.sections.join(', ')}]`);
    }
    console.log('✓ PASS: Sections YOS-3A and YOS-3B correctly merged into one 3rd Year card.');

    const fourthYearCard = testSubjectCards.find(c => c.yearOfStudy === '4th Year');
    if (!fourthYearCard) {
      throw new Error(`Missing 4th Year subject card! Available: ${testSubjectCards.map(c => c.yearOfStudy)}`);
    }
    console.log('\n4th Year Subject Card:');
    console.log(`  - Name: ${fourthYearCard.name}`);
    console.log(`  - Academic Year: ${fourthYearCard.academicYear}`);
    console.log(`  - Year of Study: ${fourthYearCard.yearOfStudy}`);
    console.log(`  - Semester: ${fourthYearCard.semester}`);
    console.log(`  - Assigned Sections: [${fourthYearCard.sections.join(', ')}]`);
    console.log(`  - Section Count: ${fourthYearCard.sectionCount}`);

    if (fourthYearCard.sectionCount !== 1 || !fourthYearCard.sections.includes('YOS-4A')) {
      throw new Error(`Expected 4th Year card to contain section YOS-4A only, got [${fourthYearCard.sections.join(', ')}]`);
    }
    console.log('✓ PASS: 4th Year assignment kept separate from 3rd Year rather than incorrectly merging incompatible years.');

    const unknownCard = testSubjectCards.find(c => c.yearOfStudy === '—');
    if (!unknownCard) {
      throw new Error(`Missing Unknown Year subject card! Available: ${testSubjectCards.map(c => c.yearOfStudy)}`);
    }
    console.log('\nUnknown Year Subject Card:');
    console.log(`  - Year of Study: ${unknownCard.yearOfStudy} (dash)`);
    console.log(`  - Sections: [${unknownCard.sections.join(', ')}]`);
    console.log('✓ PASS: Unavailable year of study displays dash (—) without failing or inventing false data.');

    console.log('\n================================================================');
    console.log(' ALL YEAR OF STUDY VERIFICATION CHECKS PASSED SUCCESSFULLY! ');
    console.log('================================================================');
  } finally {
    // Cleanup
    await Class.deleteMany({ _id: { $in: [class3A._id, class3B._id, class4A._id, classUnknown._id] } });
    await TeachingAssignment.deleteMany({ classRef: { $in: [class3A._id, class3B._id, class4A._id, classUnknown._id] } });
    await Subject.deleteOne({ _id: testSubject._id });
    console.log('Test cleanup complete.');
    process.exit(0);
  }
}

runYearOfStudyVerification().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
