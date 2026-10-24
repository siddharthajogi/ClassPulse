const mongoose = require('mongoose');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const StudentProfile = require('../models/StudentProfile');
const AcademicRecord = require('../models/AcademicRecord');
const RiskPrediction = require('../models/RiskPrediction');
const AcademicYear = require('../models/AcademicYear');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const Department = require('../models/Department');
const Institution = require('../models/Institution');

/**
 * @route   GET /api/teacher/dashboard/analytics
 * @desc    Get teacher-specific dashboard analytics: 4 summary cards & 3 analytics charts
 * @access  Private (Teacher only, verified session)
 */
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;

    // 1. Resolve TeacherProfile for the authenticated user and institution
    const teacherProfile = await TeacherProfile.findOne({
      user: userId,
      institution: institutionId
    }).populate('departmentRef', 'name code');

    const teacherName = req.currentUser.name || teacherProfile?.personalInfo?.name || 'Teacher';
    const departmentName = teacherProfile?.department || req.currentUser.department || '';
    const designation = teacherProfile?.designation || req.currentUser.designation || 'Faculty';

    // Resolve Institution to get accurate branding (name and logo)
    let institution = req.currentUser.institution;
    if ((!institution || !institution.name || !institution.logoUrl) && institutionId) {
      const fetchedInst = await Institution.findById(institutionId);
      if (fetchedInst) institution = fetchedInst;
    }

    const institutionName = institution?.name || req.currentUser.institution?.name || '';
    const rawLogoUrl = institution?.logoUrl || req.currentUser.institution?.logoUrl || '';
    const logoUrl = (typeof rawLogoUrl === 'string' && rawLogoUrl.trim()) ? rawLogoUrl.trim() : null;

    // If teacher profile doesn't exist, return empty data gracefully
    if (!teacherProfile) {
      return res.status(200).json({
        success: true,
        stats: {
          mySubjects: 0,
          myClasses: 0,
          totalStudents: 0,
          studentsAtRisk: 0,
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 0
        },
        riskAnalytics: {
          data: [
            { name: 'Low Risk', value: 0, color: '#10b981' },
            { name: 'Medium Risk', value: 0, color: '#f59e0b' },
            { name: 'High Risk', value: 0, color: '#ef4444' }
          ],
          total: 0,
          isAvailable: false
        },
        attendanceAnalytics: {
          attendance: [],
          overallAverageAttendance: null,
          hasData: false
        },
        scoreAnalytics: {
          performance: [],
          overallAverageScore: null,
          hasData: false
        },
        context: {
          teacherName,
          teacherId: '',
          departmentName,
          designation,
          institutionName,
          logoUrl
        }
      });
    }

    // 2. Fetch all active TeachingAssignments for this teacher in this institution
    const assignments = await TeachingAssignment.find({
      teacher: teacherProfile._id,
      institution: institutionId,
      isActive: true
    })
      .populate('subject', 'name code department isActive')
      .populate('classRef', 'name course department academicYear semester section isActive');

    // 3. Card 1: Distinct subjects assigned to the authenticated teacher
    const distinctSubjectMap = new Map();
    assignments.forEach(a => {
      if (a.subject && a.subject._id && a.subject.isActive !== false) {
        distinctSubjectMap.set(a.subject._id.toString(), a.subject);
      }
    });
    const mySubjectsCount = distinctSubjectMap.size;
    const assignedSubjectObjIds = Array.from(distinctSubjectMap.keys()).map(id => new mongoose.Types.ObjectId(id));

    // 4. Card 2: Distinct class / section combinations assigned to the teacher
    const distinctClassMap = new Map();
    assignments.forEach(a => {
      if (a.classRef && a.classRef._id && a.classRef.isActive !== false) {
        distinctClassMap.set(a.classRef._id.toString(), a.classRef);
      }
    });
    const myClassesCount = distinctClassMap.size;
    const assignedClassObjIds = Array.from(distinctClassMap.keys()).map(id => new mongoose.Types.ObjectId(id));

    // 5. Card 3: Total Students - Unique students belonging to the teacher's assigned classes & sections
    let assignedStudentObjIds = [];
    let totalStudentsCount = 0;

    if (assignedClassObjIds.length > 0) {
      const students = await StudentProfile.find({
        institution: institutionId,
        classRef: { $in: assignedClassObjIds }
      }).select('_id user studentId classRef');

      const distinctStudentIds = new Set(students.map(s => s._id.toString()));
      totalStudentsCount = distinctStudentIds.size;
      assignedStudentObjIds = Array.from(distinctStudentIds).map(id => new mongoose.Types.ObjectId(id));
    }

    // 6. Card 4 & Graph 1: Students at Risk & Student Risk Analysis
    let lowRiskCount = 0;
    let mediumRiskCount = 0;
    let highRiskCount = 0;
    let totalRiskPredictions = 0;
    let isRiskAvailable = false;

    if (assignedStudentObjIds.length > 0) {
      const predictions = await RiskPrediction.find({
        institution: institutionId,
        student: { $in: assignedStudentObjIds }
      });

      const seenStudents = new Set();
      predictions.forEach(p => {
        if (!p.student) return;
        const sKey = p.student.toString();
        if (seenStudents.has(sKey)) return;

        const level = (p.riskLevel || '').toLowerCase().trim();
        if (level === 'low' || level === 'medium' || level === 'high') {
          seenStudents.add(sKey);
          if (level === 'low') lowRiskCount++;
          else if (level === 'medium') mediumRiskCount++;
          else if (level === 'high') highRiskCount++;
        }
      });

      totalRiskPredictions = seenStudents.size;
      isRiskAvailable = totalRiskPredictions > 0;
    }

    // 7. Graph 2: Average Attendance & Graph 3: Overall Average Score
    let performance = [];
    let attendance = [];
    let overallAverageScore = null;
    let overallAverageAttendance = null;
    let hasPerformanceData = false;
    let hasAttendanceData = false;

    if (assignedStudentObjIds.length > 0 && assignedSubjectObjIds.length > 0) {
      const records = await AcademicRecord.find({
        institution: institutionId,
        student: { $in: assignedStudentObjIds },
        subject: { $in: assignedSubjectObjIds }
      })
        .populate('academicYear', 'year isActive startDate endDate')
        .populate('student', '_id isActive');

      // Sort by updatedAt / createdAt descending to keep latest record for same composite key
      const sortedRecords = [...records].sort((a, b) =>
        new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
      );

      const seenAssessmentKeys = new Set();
      const uniqueAssessmentRecords = [];
      const seenAttendanceKeys = new Set();
      const uniqueAttendanceRecords = [];

      sortedRecords.forEach(r => {
        // Exclude records with missing student or academic year
        if (!r.student || !r.academicYear || !r.academicYear.year) return;
        const yearStr = r.academicYear.year;
        const termKey = r.termId ? r.termId.toString() : 'no-term';
        const studentKey = r.student._id ? r.student._id.toString() : r.student.toString();
        const subjectKey = r.subject ? r.subject.toString() : 'no-subject';
        const compositeKey = `${yearStr}_${studentKey}_${subjectKey}_${termKey}`;

        // Check valid assessment marks (must have numeric marksObtained >= 0 and totalMarks > 0)
        const hasValidMarks = typeof r.marksObtained === 'number' &&
          !isNaN(r.marksObtained) &&
          r.marksObtained !== null &&
          typeof r.totalMarks === 'number' &&
          !isNaN(r.totalMarks) &&
          r.totalMarks !== null &&
          r.totalMarks > 0 &&
          r.marksObtained >= 0;

        if (hasValidMarks && !seenAssessmentKeys.has(compositeKey)) {
          seenAssessmentKeys.add(compositeKey);
          uniqueAssessmentRecords.push({
            year: yearStr,
            marksObtained: r.marksObtained,
            totalMarks: r.totalMarks,
            normalizedScore: Math.min(100, Math.max(0, (r.marksObtained / r.totalMarks) * 100))
          });
        }

        // Check valid attendance (must have numeric attendance percentage between 0 and 100)
        const hasValidAttendance = typeof r.attendancePercentage === 'number' &&
          !isNaN(r.attendancePercentage) &&
          r.attendancePercentage !== null &&
          r.attendancePercentage >= 0 &&
          r.attendancePercentage <= 100;

        if (hasValidAttendance && !seenAttendanceKeys.has(compositeKey)) {
          seenAttendanceKeys.add(compositeKey);
          uniqueAttendanceRecords.push({
            year: yearStr,
            attendancePercentage: r.attendancePercentage
          });
        }
      });

      // Group Performance by Academic Year
      const yearPerfMap = {};
      const yearPerfCount = {};
      uniqueAssessmentRecords.forEach(r => {
        yearPerfMap[r.year] = (yearPerfMap[r.year] || 0) + r.normalizedScore;
        yearPerfCount[r.year] = (yearPerfCount[r.year] || 0) + 1;
      });

      performance = Object.keys(yearPerfMap).map(year => ({
        year,
        averageScore: Math.round(yearPerfMap[year] / yearPerfCount[year]),
        count: yearPerfCount[year]
      })).sort((a, b) => a.year.localeCompare(b.year));

      // Group Attendance by Academic Year
      const yearAttMap = {};
      const yearAttCount = {};
      uniqueAttendanceRecords.forEach(r => {
        yearAttMap[r.year] = (yearAttMap[r.year] || 0) + r.attendancePercentage;
        yearAttCount[r.year] = (yearAttCount[r.year] || 0) + 1;
      });

      attendance = Object.keys(yearAttMap).map(year => ({
        year,
        averageAttendance: Math.round(yearAttMap[year] / yearAttCount[year]),
        count: yearAttCount[year]
      })).sort((a, b) => a.year.localeCompare(b.year));

      // Overall average score
      const overallScoreSum = uniqueAssessmentRecords.reduce((acc, r) => acc + r.normalizedScore, 0);
      overallAverageScore = uniqueAssessmentRecords.length > 0
        ? Math.round(overallScoreSum / uniqueAssessmentRecords.length)
        : null;

      // Overall average attendance
      const overallAttSum = uniqueAttendanceRecords.reduce((acc, r) => acc + r.attendancePercentage, 0);
      overallAverageAttendance = uniqueAttendanceRecords.length > 0
        ? Math.round(overallAttSum / uniqueAttendanceRecords.length)
        : null;

      hasPerformanceData = performance.length > 0;
      hasAttendanceData = attendance.length > 0;
    }

    return res.status(200).json({
      success: true,
      stats: {
        mySubjects: mySubjectsCount,
        myClasses: myClassesCount,
        totalStudents: totalStudentsCount,
        studentsAtRisk: totalRiskPredictions,
        highRisk: highRiskCount,
        mediumRisk: mediumRiskCount,
        lowRisk: lowRiskCount
      },
      riskAnalytics: {
        data: [
          { name: 'Low Risk', value: lowRiskCount, color: '#10b981' },
          { name: 'Medium Risk', value: mediumRiskCount, color: '#f59e0b' },
          { name: 'High Risk', value: highRiskCount, color: '#ef4444' }
        ],
        total: totalRiskPredictions,
        isAvailable: isRiskAvailable
      },
      attendanceAnalytics: {
        attendance,
        overallAverageAttendance,
        hasData: hasAttendanceData
      },
      scoreAnalytics: {
        performance,
        overallAverageScore,
        hasData: hasPerformanceData
      },
      context: {
        teacherName,
        teacherId: teacherProfile.teacherId,
        departmentName,
        designation,
        institutionName,
        logoUrl
      }
    });

  } catch (error) {
    console.error('getTeacherDashboardAnalytics error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch teacher dashboard analytics.'
    });
  }
};

// Helper to format academic year of study (1st Year, 2nd Year, 3rd Year, 4th Year)
const formatYearOfStudy = (yearOfStudy, semester) => {
  if (yearOfStudy && typeof yearOfStudy === 'string') {
    const y = yearOfStudy.trim().toLowerCase();
    if (y.includes('1st') || y.includes('first') || y === '1' || y.includes('year 1') || y.includes('1st year')) return '1st Year';
    if (y.includes('2nd') || y.includes('second') || y === '2' || y.includes('year 2') || y.includes('2nd year')) return '2nd Year';
    if (y.includes('3rd') || y.includes('third') || y === '3' || y.includes('year 3') || y.includes('3rd year')) return '3rd Year';
    if (y.includes('4th') || y.includes('fourth') || y === '4' || y.includes('year 4') || y.includes('4th year')) return '4th Year';
    return yearOfStudy.trim();
  }
  if (semester !== undefined && semester !== null) {
    const clean = String(semester).trim().toLowerCase();
    const match = clean.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num === 1 || num === 2) return '1st Year';
      if (num === 3 || num === 4) return '2nd Year';
      if (num === 5 || num === 6) return '3rd Year';
      if (num === 7 || num === 8) return '4th Year';
    }
  }
  return '—';
};

/**
 * @route   GET /api/teacher/subjects
 * @desc    Get all unique subjects assigned to the authenticated teacher with associated sections
 * @access  Private (Teacher only, verified session)
 */
exports.getMySubjects = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;

    // 1. Resolve TeacherProfile for the authenticated user and institution
    const teacherProfile = await TeacherProfile.findOne({
      user: userId,
      institution: institutionId
    }).populate('departmentRef', 'name code');

    const teacherName = req.currentUser.name || teacherProfile?.personalInfo?.name || 'Teacher';
    const departmentName = teacherProfile?.department || req.currentUser.department || '';
    const designation = teacherProfile?.designation || req.currentUser.designation || 'Faculty';
    const institutionName = req.currentUser.institution?.name || '';

    // If teacher profile doesn't exist, return empty array gracefully
    if (!teacherProfile) {
      return res.status(200).json({
        success: true,
        subjects: [],
        totalUniqueSubjects: 0,
        totalSections: 0,
        totalAssignments: 0,
        context: {
          teacherName,
          teacherId: '',
          departmentName,
          designation,
          institutionName
        }
      });
    }

    // 2. Fetch all active TeachingAssignments explicitly assigned to this teacher in this institution
    // Excludes unassigned subjects or other teachers' assignments automatically by teacher filter
    const assignments = await TeachingAssignment.find({
      teacher: teacherProfile._id,
      institution: institutionId,
      isActive: true
    })
      .populate({
        path: 'subject',
        select: 'name code department departmentRef description subjectType credits semester academicYear isActive'
      })
      .populate({
        path: 'classRef',
        select: 'name course department departmentRef academicYear semester section yearOfStudy isActive'
      })
      .sort({ createdAt: -1 });

    // 3. Deduplication and Grouping
    // A subject may be assigned across multiple sections (e.g. Sections A, B, C).
    // The same subject assigned to the same teacher across multiple sections in the same year of study
    // appears as ONE subject entry, with all applicable sections listed under it.
    // If a subject is offered in different academic years, departments, or years of study, those distinctions are preserved.
    const groupedMap = new Map();
    let totalAssignmentsCount = 0;

    for (const a of assignments) {
      // Handle missing, deleted, or deactivated subjects and classes safely
      if (!a.subject || a.subject.isActive === false) continue;
      if (!a.classRef || a.classRef.isActive === false) continue;

      totalAssignmentsCount++;

      const subjectId = a.subject._id.toString();
      const academicYear = (a.academicYear || a.classRef.academicYear || a.subject.academicYear || '—').trim();
      const department = (a.classRef.department || a.subject.department || '—').trim();
      const yearOfStudy = formatYearOfStudy(a.classRef.yearOfStudy, a.classRef.semester);
      const groupKey = `${subjectId}__${academicYear}__${department}__${yearOfStudy}`;

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          id: groupKey,
          subjectId: a.subject._id,
          name: a.subject.name || 'Untitled Subject',
          code: a.subject.code || '—',
          department: department || '—',
          academicYear: academicYear || '—',
          yearOfStudy: yearOfStudy || '—',
          subjectType: a.subject.subjectType || 'Theory',
          credits: typeof a.subject.credits === 'number' ? a.subject.credits : null,
          semester: a.classRef.semester || a.subject.semester || '—',
          course: a.classRef.course || '',
          description: a.subject.description || '',
          sections: [],
          sectionDetails: [],
          assignmentIds: [],
          _seenSections: new Set()
        });
      }

      const entry = groupedMap.get(groupKey);
      const sectionLabel = (a.classRef.section || '').trim();

      entry.assignmentIds.push(a._id);

      // Avoid duplicate section labels
      if (sectionLabel && !entry._seenSections.has(sectionLabel)) {
        entry._seenSections.add(sectionLabel);
        entry.sections.push(sectionLabel);
        entry.sectionDetails.push({
          section: sectionLabel,
          classId: a.classRef._id,
          className: a.classRef.name || `${a.classRef.course || ''} - ${department} Section ${sectionLabel}`,
          course: a.classRef.course || '',
          semester: a.classRef.semester || '',
          yearOfStudy: yearOfStudy || '—',
          academicYear: a.classRef.academicYear || academicYear,
          assignmentId: a._id
        });
      }
    }

    // Convert map to array, sort sections naturally, and clean internal set
    let totalSectionsAssigned = 0;
    const uniqueSubjects = Array.from(groupedMap.values()).map(entry => {
      // Natural alphanumeric sort for section labels: e.g. A, B, C or 1, 2, 10
      entry.sections.sort((s1, s2) => s1.localeCompare(s2, undefined, { numeric: true, sensitivity: 'base' }));
      entry.sectionDetails.sort((d1, d2) => d1.section.localeCompare(d2.section, undefined, { numeric: true, sensitivity: 'base' }));
      entry.sectionCount = entry.sections.length;
      totalSectionsAssigned += entry.sectionCount;

      delete entry._seenSections;
      return entry;
    });

    // Sort unique subjects alphabetically by name
    uniqueSubjects.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      success: true,
      subjects: uniqueSubjects,
      totalUniqueSubjects: uniqueSubjects.length,
      totalSections: totalSectionsAssigned,
      totalAssignments: totalAssignmentsCount,
      context: {
        teacherName,
        teacherId: teacherProfile.teacherId,
        departmentName,
        designation,
        institutionName
      }
    });

  } catch (error) {
    console.error('getMySubjects error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch assigned subjects.'
    });
  }
};

/**
 * Helper to normalize academic year of study (First Year, Second Year, Third Year, Fourth Year)
 */
const normalizeYearOfStudy = (yearOfStudy, semester) => {
  if (yearOfStudy && typeof yearOfStudy === 'string') {
    const y = yearOfStudy.trim().toLowerCase();
    if (y.includes('first') || y === '1' || y.startsWith('1st') || y.includes('year 1') || y.includes('1st year')) return 'First Year';
    if (y.includes('second') || y === '2' || y.startsWith('2nd') || y.includes('year 2') || y.includes('2nd year')) return 'Second Year';
    if (y.includes('third') || y === '3' || y.startsWith('3rd') || y.includes('year 3') || y.includes('3rd year')) return 'Third Year';
    if (y.includes('fourth') || y === '4' || y.startsWith('4th') || y.includes('year 4') || y.includes('4th year')) return 'Fourth Year';
  }
  if (semester !== undefined && semester !== null) {
    const clean = String(semester).trim().toLowerCase();
    const match = clean.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num === 1 || num === 2) return 'First Year';
      if (num === 3 || num === 4) return 'Second Year';
      if (num === 5 || num === 6) return 'Third Year';
      if (num === 7 || num === 8) return 'Fourth Year';
    }
  }
  return 'First Year';
};

/**
 * Helper to calculate section assignment metrics consistently
 */
const calculateAssignmentMetrics = (assignments = []) => {
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
    isAssigned,
    hasPendingAssignments: !isAssigned
  };
};

/**
 * @route   GET /api/teacher/classes
 * @desc    Get all assigned departments and sections for the authenticated teacher organized by academic hierarchy
 * @access  Private (Teacher only, verified session)
 */
exports.getMyClasses = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;

    // 1. Resolve TeacherProfile for the authenticated user and institution
    const teacherProfile = await TeacherProfile.findOne({
      user: userId,
      institution: institutionId
    });

    if (!teacherProfile) {
      return res.status(200).json({
        success: true,
        classes: [],
        totalEnrolledStudents: 0,
        departments: [],
        academicYears: []
      });
    }

    // 2. Fetch all active TeachingAssignments for this teacher in this institution
    const teacherAssignments = await TeachingAssignment.find({
      teacher: teacherProfile._id,
      institution: institutionId,
      isActive: true
    })
      .populate('subject', 'name code credits department subjectType semester isActive')
      .populate('classRef', 'name course department academicYear semester section yearOfStudy isActive');

    // 3. Extract unique active class IDs assigned to this teacher
    const assignedClassMap = new Map();
    for (const a of teacherAssignments) {
      if (a.classRef && a.classRef.isActive !== false) {
        const cid = a.classRef._id ? a.classRef._id.toString() : a.classRef.toString();
        if (!assignedClassMap.has(cid)) {
          assignedClassMap.set(cid, []);
        }
        assignedClassMap.get(cid).push(a);
      }
    }

    const assignedClassIds = Array.from(assignedClassMap.keys()).map(id => new mongoose.Types.ObjectId(id));

    if (assignedClassIds.length === 0) {
      return res.status(200).json({
        success: true,
        classes: [],
        totalEnrolledStudents: 0,
        departments: [],
        academicYears: []
      });
    }

    // 4. Fetch the assigned Class documents
    const classes = await Class.find({
      _id: { $in: assignedClassIds },
      institution: institutionId,
      isActive: { $ne: false }
    })
      .populate('departmentRef', 'name code')
      .sort({ academicYear: -1, course: 1, department: 1, semester: 1, section: 1 });

    // 5. Count students enrolled in each assigned class
    const studentCounts = await StudentProfile.aggregate([
      { $match: { institution: institutionId, classRef: { $in: assignedClassIds } } },
      { $group: { _id: '$classRef', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    studentCounts.forEach(sc => {
      if (sc._id) countMap[sc._id.toString()] = sc.count;
    });

    // 6. Fetch all active assignments for these classes to determine overall section status
    const allClassAssignments = await TeachingAssignment.find({
      institution: institutionId,
      classRef: { $in: assignedClassIds },
      isActive: true
    })
      .populate('subject', 'name code credits department subjectType semester isActive')
      .populate({
        path: 'teacher',
        select: 'teacherId department designation personalInfo professionalInfo user',
        populate: { path: 'user', select: 'name email isActive' }
      });

    const allAssignmentsMap = {};
    allClassAssignments.forEach(a => {
      const cid = a.classRef.toString();
      if (!allAssignmentsMap[cid]) allAssignmentsMap[cid] = [];
      allAssignmentsMap[cid].push(a);
    });

    // 7. Enrich classes with student counts, assignments, metrics, and teacher-specific subject count
    const enrichedClasses = classes.map(c => {
      const cid = c._id.toString();
      const groupAssignments = allAssignmentsMap[cid] || [];
      const teacherSpecificAssignments = assignedClassMap.get(cid) || [];
      const derivedYear = normalizeYearOfStudy(c.yearOfStudy, c.semester);
      const metrics = calculateAssignmentMetrics(groupAssignments);

      // Distinct subjects taught by this teacher in this section
      const teacherSubjectIds = new Set();
      const teacherSubjectList = [];
      teacherSpecificAssignments.forEach(a => {
        if (a.subject && a.subject._id && a.subject.isActive !== false) {
          const sid = a.subject._id.toString();
          if (!teacherSubjectIds.has(sid)) {
            teacherSubjectIds.add(sid);
            teacherSubjectList.push({
              _id: a.subject._id,
              name: a.subject.name,
              code: a.subject.code,
              credits: a.subject.credits,
              subjectType: a.subject.subjectType
            });
          }
        }
      });

      return {
        ...c.toObject(),
        yearOfStudy: c.yearOfStudy || derivedYear,
        studentCount: countMap[cid] || 0,
        assignments: groupAssignments,
        teacherAssignments: teacherSpecificAssignments,
        teacherSubjects: teacherSubjectList,
        assignmentCount: groupAssignments.length,
        subjectsCount: teacherSubjectIds.size, // Number of subjects assigned to that section relevant to teacher
        totalSubjectsCount: metrics.subjectsCount,
        teachersCount: metrics.teachersCount,
        hasPendingAssignments: metrics.hasPendingAssignments,
        status: metrics.status
      };
    });

    // 8. Deduplicated enrolled students across all assigned classes
    const enrolledStudentIds = await StudentProfile.distinct('_id', {
      institution: institutionId,
      classRef: { $in: assignedClassIds }
    });

    // 9. Department and Academic Year metadata for filter dropdowns
    const departments = await Department.find({ institution: institutionId, isActive: { $ne: false } }).select('name code');
    const academicYears = await AcademicYear.find({ institution: institutionId, isActive: { $ne: false } }).sort({ year: -1 });

    return res.status(200).json({
      success: true,
      classes: enrichedClasses,
      totalEnrolledStudents: enrolledStudentIds.length,
      departments,
      academicYears
    });
  } catch (error) {
    console.error('getMyClasses error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch assigned classes and sections.'
    });
  }
};

/**
 * @route   GET /api/teacher/classes/:id
 * @desc    Get details and enrolled students roster for an assigned section
 * @access  Private (Teacher only, verified session)
 */
exports.getClassDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid class ID' });
    }

    // 1. Resolve TeacherProfile for the authenticated user and institution
    const teacherProfile = await TeacherProfile.findOne({
      user: userId,
      institution: institutionId
    });

    if (!teacherProfile) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Teacher profile not found.' });
    }

    // 2. Strict Access Control: Verify teacher is assigned to this section
    const isAssigned = await TeachingAssignment.exists({
      teacher: teacherProfile._id,
      classRef: id,
      institution: institutionId,
      isActive: true
    });

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You do not have permission to access this section or its student roster.'
      });
    }

    // 3. Fetch Class document
    const classDoc = await Class.findOne({ _id: id, institution: institutionId }).populate('departmentRef', 'name code');
    if (!classDoc) {
      return res.status(404).json({ success: false, error: 'Section not found.' });
    }

    // 4. Fetch enrolled students in this section
    const students = await StudentProfile.find({ classRef: id, institution: institutionId })
      .populate('user', 'userId name email role isActive createdAt')
      .populate('departmentRef', 'name code')
      .sort({ studentId: 1, 'personalInfo.name': 1 });

    // 5. Fetch all active assignments for this section
    const assignments = await TeachingAssignment.find({
      classRef: id,
      institution: institutionId,
      isActive: true
    })
      .populate('subject', 'name code credits department subjectType semester isActive')
      .populate({
        path: 'teacher',
        select: 'teacherId department designation personalInfo professionalInfo user',
        populate: { path: 'user', select: 'name email isActive' }
      });

    const metrics = calculateAssignmentMetrics(assignments);
    const teacherAssignments = assignments.filter(
      a => a.teacher?._id?.toString() === teacherProfile._id.toString()
    );

    const teacherSubjectIds = new Set();
    const teacherSubjectList = [];
    teacherAssignments.forEach(a => {
      if (a.subject && a.subject._id && a.subject.isActive !== false) {
        const sid = a.subject._id.toString();
        if (!teacherSubjectIds.has(sid)) {
          teacherSubjectIds.add(sid);
          teacherSubjectList.push({
            _id: a.subject._id,
            name: a.subject.name,
            code: a.subject.code,
            credits: a.subject.credits,
            subjectType: a.subject.subjectType
          });
        }
      }
    });

    const normalizedYear = normalizeYearOfStudy(classDoc.yearOfStudy, classDoc.semester);

    return res.status(200).json({
      success: true,
      class: {
        ...classDoc.toObject(),
        yearOfStudy: classDoc.yearOfStudy || normalizedYear,
        normalizedYearOfStudy: normalizedYear,
        studentCount: students.length,
        students,
        assignments,
        teacherAssignments,
        teacherSubjects: teacherSubjectList,
        assignmentCount: assignments.length,
        subjectsCount: teacherSubjectIds.size,
        totalSubjectsCount: metrics.subjectsCount,
        teachersCount: metrics.teachersCount,
        hasPendingAssignments: metrics.hasPendingAssignments,
        status: metrics.status
      }
    });
  } catch (error) {
    console.error('getClassDetails error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch section details.'
    });
  }
};


