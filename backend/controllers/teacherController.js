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
const User = require('../models/User');
const {
  calculateAttendanceFromRecords,
  calculateAssessmentFromRecords,
  calculateExplainableRiskScore,
  syncStudentMetricsAndRisk
} = require('../services/studentAnalyticsService');

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

/**
 * @route   GET /api/teacher/profile
 * @desc    Get authenticated teacher's profile details and available departments
 * @access  Private (Teacher only)
 */
exports.getTeacherProfile = async (req, res) => {
  try {
    const userId = req.currentUser._id;
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Teacher account not found' });
    }

    let teacherProfile = await TeacherProfile.findOne({
      user: userId,
      institution: institutionId
    }).populate('departmentRef', 'name code');

    if (!teacherProfile && user.userId) {
      teacherProfile = await TeacherProfile.findOne({
        teacherId: user.userId,
        institution: institutionId
      }).populate('departmentRef', 'name code');
    }

    // Retrieve institution departments
    let departments = [];
    try {
      if (institutionId) {
        const { ensureDepartmentsForInstitution } = require('./adminController');
        departments = await ensureDepartmentsForInstitution(institutionId);
      }
    } catch (_) {}

    if (!departments || departments.length === 0) {
      departments = await Department.find({ institution: institutionId, isActive: true }).sort({ name: 1 });
    }

    const { QUALIFICATION_OPTIONS } = require('../config/qualifications');

    const qual = teacherProfile?.professionalInfo?.highestQualification ||
      user.highestQualification ||
      (Array.isArray(teacherProfile?.professionalInfo?.qualifications) && teacherProfile.professionalInfo.qualifications[0]) ||
      (Array.isArray(user.qualifications) && user.qualifications[0]) || '';

    const qualificationsList = (Array.isArray(teacherProfile?.professionalInfo?.qualifications) && teacherProfile.professionalInfo.qualifications.length > 0)
      ? teacherProfile.professionalInfo.qualifications
      : (Array.isArray(user.qualifications) ? user.qualifications : []);

    const profileData = {
      _id: teacherProfile?._id || user._id,
      userId: user.userId,
      teacherId: teacherProfile?.teacherId || user.userId,
      name: user.name || teacherProfile?.personalInfo?.name || '',
      email: user.email || teacherProfile?.personalInfo?.email || '',
      phone: user.phone || teacherProfile?.personalInfo?.phone || '',
      address: teacherProfile?.personalInfo?.address || '',
      designation: teacherProfile?.designation || user.designation || 'Faculty',
      highestQualification: qual,
      qualifications: qualificationsList,
      department: teacherProfile?.department || user.department || '',
      departmentRef: teacherProfile?.departmentRef || null,
      specialization: teacherProfile?.professionalInfo?.specialization || user.specialization || '',
      yearsOfExperience: teacherProfile?.professionalInfo?.yearsOfExperience ?? 0,
      profilePhoto: user.profilePhoto || '',
      role: user.role || 'teacher',
      isActive: user.isActive !== false,
      createdAt: teacherProfile?.createdAt || user.createdAt,
      updatedAt: teacherProfile?.updatedAt || user.updatedAt
    };

    return res.status(200).json({
      success: true,
      profile: profileData,
      departments: departments.map(d => ({
        _id: d._id,
        name: d.name,
        code: d.code,
        isActive: d.isActive !== false
      })),
      qualifications: QUALIFICATION_OPTIONS,
      qualificationsOptions: QUALIFICATION_OPTIONS
    });
  } catch (error) {
    console.error('getTeacherProfile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve teacher profile' });
  }
};

/**
 * @route   PUT /api/teacher/profile
 * @desc    Update authenticated teacher's profile
 * @access  Private (Teacher only)
 */
exports.updateTeacherProfile = async (req, res) => {
  try {
    const userId = req.currentUser._id;
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Teacher account not found' });
    }

    let teacherProfile = await TeacherProfile.findOne({
      user: userId,
      institution: institutionId
    });

    if (!teacherProfile && user.userId) {
      teacherProfile = await TeacherProfile.findOne({
        teacherId: user.userId,
        institution: institutionId
      });
    }

    const {
      name,
      email,
      phone,
      address,
      designation,
      highestQualification,
      customQualification,
      otherQualification,
      qualifications,
      department,
      specialization,
      yearsOfExperience,
      profilePhoto
    } = req.body;

    const errors = {};

    // 1. Validate Full Name (required, min 2 chars)
    if (name === undefined || typeof name !== 'string' || !name.trim()) {
      errors.name = 'Full Name is required';
    } else if (name.trim().length < 2) {
      errors.name = 'Full Name must be at least 2 characters long';
    }

    // 2. Validate Email (required, valid format)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let cleanEmail = '';
    if (email === undefined || typeof email !== 'string' || !email.trim()) {
      errors.email = 'Official Email Address is required';
    } else {
      cleanEmail = email.trim().toLowerCase();
      if (!emailRegex.test(cleanEmail)) {
        errors.email = 'Please provide a valid email address';
      }
    }

    // 3. Check duplicate email if changed
    if (!errors.email && cleanEmail && cleanEmail !== user.email) {
      const existingUser = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
      if (existingUser) {
        errors.email = 'Email address is already in use by another account';
      }
      if (!errors.email && teacherProfile) {
        const existingTeacherEmail = await TeacherProfile.findOne({
          'personalInfo.email': cleanEmail,
          _id: { $ne: teacherProfile._id }
        });
        if (existingTeacherEmail) {
          errors.email = 'Email address is already in use by another account';
        }
      }
    }

    // 4. Validate Phone if provided
    let cleanPhone = user.phone || teacherProfile?.personalInfo?.phone || '';
    if (phone !== undefined) {
      const phoneStr = String(phone).trim();
      if (phoneStr) {
        const phoneDigits = phoneStr.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
          errors.phone = 'Please provide a valid 10-digit contact number';
        } else {
          cleanPhone = phoneDigits;
        }
      } else {
        cleanPhone = '';
      }
    }

    // 5. Validate profile photo size if provided (max 3MB)
    let cleanPhoto = user.profilePhoto || '';
    if (profilePhoto !== undefined) {
      if (typeof profilePhoto === 'string') {
        if (profilePhoto.startsWith('data:image/')) {
          const approxBytes = profilePhoto.length * 0.75;
          if (approxBytes > 3 * 1024 * 1024) {
            errors.profilePhoto = 'Profile photo file size must not exceed 3MB';
          } else {
            cleanPhoto = profilePhoto;
          }
        } else {
          cleanPhoto = profilePhoto.trim();
        }
      } else if (profilePhoto === null || profilePhoto === '') {
        cleanPhoto = '';
      }
    }

    // 6. Validate Department if provided
    let targetDeptDoc = null;
    let cleanDeptName = teacherProfile?.department || user.department || '';
    if (department !== undefined && typeof department === 'string' && department.trim()) {
      cleanDeptName = department.trim();
      targetDeptDoc = await Department.findOne({
        institution: institutionId,
        $or: [
          { name: cleanDeptName },
          { _id: mongoose.Types.ObjectId.isValid(cleanDeptName) ? cleanDeptName : null }
        ]
      });
      if (targetDeptDoc) {
        cleanDeptName = targetDeptDoc.name;
      }
    }

    // 7. Validate Qualifications
    let finalQual = highestQualification;
    const custom = typeof customQualification === 'string' ? customQualification.trim() : (typeof otherQualification === 'string' ? otherQualification.trim() : '');
    if ((finalQual === 'Other' || !finalQual) && custom) {
      finalQual = custom;
    }

    let normalizedQuals = [];
    if (Array.isArray(qualifications) && qualifications.length > 0) {
      normalizedQuals = qualifications.map(q => (typeof q === 'string' ? q.trim() : '')).filter(Boolean);
    } else if (finalQual && typeof finalQual === 'string' && finalQual.trim()) {
      normalizedQuals = [finalQual.trim()];
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: Object.values(errors)[0],
        errors
      });
    }

    // Whitelist and apply updates to User model (Protected fields: userId, role, isActive, password strictly untouched)
    user.name = name.trim();
    user.email = cleanEmail;
    user.phone = cleanPhone;
    if (designation !== undefined) {
      user.designation = typeof designation === 'string' ? designation.trim() : '';
    }
    if (cleanDeptName) {
      user.department = cleanDeptName;
    }
    if (specialization !== undefined) {
      user.specialization = typeof specialization === 'string' ? specialization.trim() : '';
    }
    if (highestQualification !== undefined || customQualification !== undefined || otherQualification !== undefined || qualifications !== undefined) {
      user.qualifications = normalizedQuals;
      user.highestQualification = (typeof finalQual === 'string' && finalQual.trim()) ? finalQual.trim() : (normalizedQuals[0] || '');
    }
    if (profilePhoto !== undefined) {
      user.profilePhoto = cleanPhoto;
    }

    await user.save();

    // Whitelist and apply updates to TeacherProfile model if present
    if (teacherProfile) {
      teacherProfile.department = cleanDeptName || teacherProfile.department;
      if (targetDeptDoc) {
        teacherProfile.departmentRef = targetDeptDoc._id;
      }
      if (designation !== undefined) {
        teacherProfile.designation = typeof designation === 'string' ? designation.trim() : teacherProfile.designation;
      }
      if (!teacherProfile.personalInfo) teacherProfile.personalInfo = {};
      teacherProfile.personalInfo.name = name.trim();
      teacherProfile.personalInfo.email = cleanEmail;
      teacherProfile.personalInfo.phone = cleanPhone;
      if (address !== undefined) {
        teacherProfile.personalInfo.address = typeof address === 'string' ? address.trim() : '';
      }

      if (!teacherProfile.professionalInfo) teacherProfile.professionalInfo = {};
      if (highestQualification !== undefined || customQualification !== undefined || otherQualification !== undefined || qualifications !== undefined) {
        teacherProfile.professionalInfo.qualifications = normalizedQuals;
        teacherProfile.professionalInfo.highestQualification = (typeof finalQual === 'string' && finalQual.trim()) ? finalQual.trim() : (normalizedQuals[0] || '');
      }
      if (specialization !== undefined) {
        teacherProfile.professionalInfo.specialization = typeof specialization === 'string' ? specialization.trim() : '';
      }
      if (yearsOfExperience !== undefined) {
        const numExp = Number(yearsOfExperience);
        teacherProfile.professionalInfo.yearsOfExperience = !isNaN(numExp) && numExp >= 0 ? numExp : 0;
      }

      await teacherProfile.save();
    } else {
      // Create TeacherProfile if missing
      teacherProfile = new TeacherProfile({
        institution: institutionId,
        user: user._id,
        teacherId: user.userId,
        department: cleanDeptName || 'General Faculty',
        departmentRef: targetDeptDoc ? targetDeptDoc._id : undefined,
        designation: typeof designation === 'string' && designation.trim() ? designation.trim() : (user.designation || 'Faculty'),
        personalInfo: {
          name: name.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          address: typeof address === 'string' ? address.trim() : ''
        },
        professionalInfo: {
          qualifications: normalizedQuals,
          highestQualification: (typeof finalQual === 'string' && finalQual.trim()) ? finalQual.trim() : (normalizedQuals[0] || ''),
          specialization: typeof specialization === 'string' ? specialization.trim() : '',
          yearsOfExperience: typeof yearsOfExperience !== 'undefined' ? Number(yearsOfExperience) || 0 : 0
        }
      });
      await teacherProfile.save();
    }

    // Sync session user
    if (req.session && req.session.user) {
      req.session.user.name = user.name;
    }

    // Log audit entry
    try {
      const AuditLog = require('../models/AuditLog');
      if (user.institution) {
        await AuditLog.create({
          institution: user.institution,
          action: 'TEACHER_PROFILE_UPDATE',
          actor: user._id,
          targetType: 'TeacherProfile',
          targetId: teacherProfile._id,
          details: { name: user.name, email: user.email, designation: user.designation, department: user.department }
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Teacher profile updated successfully',
      profile: {
        _id: teacherProfile._id,
        userId: user.userId,
        teacherId: teacherProfile.teacherId || user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: teacherProfile.personalInfo?.address || '',
        designation: teacherProfile.designation || user.designation || 'Faculty',
        highestQualification: teacherProfile.professionalInfo?.highestQualification || user.highestQualification || '',
        qualifications: teacherProfile.professionalInfo?.qualifications || user.qualifications || [],
        department: teacherProfile.department || user.department || '',
        specialization: teacherProfile.professionalInfo?.specialization || user.specialization || '',
        yearsOfExperience: teacherProfile.professionalInfo?.yearsOfExperience ?? 0,
        profilePhoto: user.profilePhoto || '',
        role: user.role,
        isActive: user.isActive,
        createdAt: teacherProfile.createdAt || user.createdAt,
        updatedAt: teacherProfile.updatedAt || user.updatedAt
      }
    });
  } catch (error) {
    console.error('updateTeacherProfile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update teacher profile' });
  }
};

/**
 * @route   GET /api/teacher/students
 * @desc    Get enrolled students directory for the authenticated teacher's assigned sections
 *          Includes calculated attendance percentage and explainable risk score
 * @access  Private (Teacher only)
 */
exports.getTeacherStudents = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;

    const teacherProfile = await TeacherProfile.findOne({
      user: userId,
      institution: institutionId
    });

    if (!teacherProfile) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Teacher profile not found.' });
    }

    // 1. Fetch all active TeachingAssignments for this teacher in this institution
    const assignments = await TeachingAssignment.find({
      teacher: teacherProfile._id,
      institution: institutionId,
      isActive: true
    }).populate('classRef', 'name course department academicYear semester section yearOfStudy isActive');

    const assignedClassIds = [];
    const assignedClassMap = new Map();

    assignments.forEach(a => {
      if (a.classRef && a.classRef.isActive !== false) {
        const cid = a.classRef._id.toString();
        if (!assignedClassMap.has(cid)) {
          assignedClassIds.push(a.classRef._id);
          const normalizedYear = normalizeYearOfStudy(a.classRef.yearOfStudy, a.classRef.semester);
          assignedClassMap.set(cid, {
            ...a.classRef.toObject(),
            yearOfStudy: a.classRef.yearOfStudy || normalizedYear
          });
        }
      }
    });

    if (assignedClassIds.length === 0) {
      return res.status(200).json({
        success: true,
        students: [],
        total: 0
      });
    }

    // 2. Filter target classes based on query params: yearOfStudy, department, classId
    const { yearOfStudy, department, classId } = req.query;
    let targetClassIds = assignedClassIds;

    // Security check: if classId is specified, verify teacher is authorized for that class
    if (classId && classId !== 'all') {
      const matchCid = assignedClassIds.find(id => id.toString() === classId);
      if (!matchCid) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: You are not assigned to this section.'
        });
      }
      targetClassIds = [matchCid];
    } else {
      // Filter by yearOfStudy and/or department if supplied
      if (yearOfStudy && yearOfStudy !== 'all') {
        targetClassIds = targetClassIds.filter(cid => {
          const c = assignedClassMap.get(cid.toString());
          return c && (c.yearOfStudy === yearOfStudy || normalizeYearOfStudy(c.yearOfStudy, c.semester) === yearOfStudy);
        });
      }

      if (department && department !== 'all') {
        targetClassIds = targetClassIds.filter(cid => {
          const c = assignedClassMap.get(cid.toString());
          return c && c.department && (c.department.toLowerCase() === department.toLowerCase() || (c.departmentRef && c.departmentRef.code && c.departmentRef.code.toLowerCase() === department.toLowerCase()));
        });
      }
    }

    if (targetClassIds.length === 0) {
      return res.status(200).json({
        success: true,
        students: [],
        total: 0
      });
    }

    // 3. Query enrolled students in the filtered target classes
    const studentDocs = await StudentProfile.find({
      classRef: { $in: targetClassIds },
      institution: institutionId
    })
      .populate('user', 'userId name email isActive')
      .populate('departmentRef', 'name code')
      .populate('classRef', 'name course department academicYear semester section yearOfStudy')
      .sort({ studentId: 1, 'personalInfo.name': 1 });

    const studentIds = studentDocs.map(s => s._id);

    // 4. Batch fetch AcademicRecords and RiskPredictions for these students
    const [academicRecords, riskPredictions] = await Promise.all([
      AcademicRecord.find({
        student: { $in: studentIds },
        institution: institutionId
      }),
      RiskPrediction.find({
        student: { $in: studentIds },
        institution: institutionId
      })
    ]);

    // Map records by studentId
    const recordsByStudent = new Map();
    academicRecords.forEach(r => {
      const sid = r.student.toString();
      if (!recordsByStudent.has(sid)) recordsByStudent.set(sid, []);
      recordsByStudent.get(sid).push(r);
    });

    // Map predictions by studentId
    const predictionsByStudent = new Map();
    riskPredictions.forEach(p => {
      const sid = p.student.toString();
      predictionsByStudent.set(sid, p);
    });

    // 5. Enrich students with calculated Attendance Percentage and Explainable Risk Score
    const enrichedStudents = studentDocs.map(s => {
      const sid = s._id.toString();
      const sRecords = recordsByStudent.get(sid) || [];
      const sPrediction = predictionsByStudent.get(sid);

      // End-to-end Attendance Percentage calculation
      const { attendancePercentage, classesAttended, totalClassesHeld } =
        calculateAttendanceFromRecords(sRecords);

      // Assessment average
      const { assessmentScore } = calculateAssessmentFromRecords(sRecords);

      // Explainable Risk Score calculation or retrieved stored prediction
      let riskScore = null;
      let riskLevel = null;
      let riskFactors = [];

      if (sPrediction && typeof sPrediction.score === 'number') {
        riskScore = sPrediction.score;
        riskLevel = sPrediction.riskLevel || 'low';
        riskFactors = sPrediction.factors || [];
      } else {
        const computedRisk = calculateExplainableRiskScore(attendancePercentage, assessmentScore);
        if (computedRisk.hasData) {
          riskScore = computedRisk.score;
          riskLevel = computedRisk.riskLevel;
          riskFactors = computedRisk.factors;
        }
      }

      const sClass = s.classRef || assignedClassMap.get(s.classRef?._id?.toString() || s.classRef?.toString());
      const studentYear = s.yearOfStudy || sClass?.yearOfStudy || normalizeYearOfStudy(s.yearOfStudy, s.semester || sClass?.semester);

      return {
        _id: s._id,
        studentId: s.studentId || s.user?.userId || '—',
        name: s.user?.name || s.personalInfo?.name || '—',
        email: s.personalInfo?.email || s.user?.email || '—',
        phone: s.personalInfo?.phone || '',
        department: s.department || sClass?.department || '—',
        yearOfStudy: studentYear || '—',
        section: s.section || sClass?.section || '—',
        course: s.course || sClass?.course || 'B.Tech',
        semester: s.semester || sClass?.semester || '—',
        academicYear: s.academicYear || sClass?.academicYear || '—',
        classRef: s.classRef ? (s.classRef._id || s.classRef) : null,
        attendancePercentage, // number e.g. 85.5 or null
        classesAttended,
        totalClassesHeld,
        riskScore, // number e.g. 25 or null
        riskLevel, // 'low' | 'medium' | 'high' | null
        riskFactors,
        isActive: s.user?.isActive ?? true
      };
    });

    return res.status(200).json({
      success: true,
      students: enrichedStudents,
      total: enrichedStudents.length
    });
  } catch (error) {
    console.error('getTeacherStudents error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch students directory.'
    });
  }
};

/**
 * @route   GET /api/teacher/students/:studentId
 * @desc    Get detailed student profile and records for teacher inspection
 * @access  Private (Teacher only)
 */
exports.getTeacherStudentDetails = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { studentId } = req.params;

    const teacherProfile = await TeacherProfile.findOne({
      user: userId,
      institution: institutionId
    });

    if (!teacherProfile) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Teacher profile not found.' });
    }

    const student = await StudentProfile.findOne({
      _id: studentId,
      institution: institutionId
    })
      .populate('user', 'userId name email isActive createdAt')
      .populate('classRef', 'name course department academicYear semester section yearOfStudy')
      .populate('departmentRef', 'name code');

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    // Security: Check teacher is assigned to student's section
    const studentClassId = student.classRef?._id || student.classRef;
    if (!studentClassId) {
      return res.status(403).json({ success: false, error: 'Student is not enrolled in an active section.' });
    }

    const isAssigned = await TeachingAssignment.exists({
      teacher: teacherProfile._id,
      classRef: studentClassId,
      institution: institutionId,
      isActive: true
    });

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You do not have permission to view this student.'
      });
    }

    // Fetch subjects taught by this teacher in this section
    const teacherAssignments = await TeachingAssignment.find({
      teacher: teacherProfile._id,
      classRef: studentClassId,
      institution: institutionId,
      isActive: true
    }).populate('subject', 'name code credits department subjectType semester isActive');

    const teacherSubjects = [];
    teacherAssignments.forEach(a => {
      if (a.subject && a.subject.isActive !== false) {
        teacherSubjects.push({
          _id: a.subject._id,
          name: a.subject.name,
          code: a.subject.code,
          credits: a.subject.credits,
          subjectType: a.subject.subjectType
        });
      }
    });

    // Fetch academic records for this student
    const records = await AcademicRecord.find({
      student: student._id,
      institution: institutionId
    })
      .populate('subject', 'name code')
      .populate('academicYear', 'year')
      .sort({ updatedAt: -1 });

    const { attendancePercentage, classesAttended, totalClassesHeld } =
      calculateAttendanceFromRecords(records);
    const { assessmentScore } = calculateAssessmentFromRecords(records);
    const riskResult = calculateExplainableRiskScore(attendancePercentage, assessmentScore);

    const sClass = student.classRef;
    const studentYear = student.yearOfStudy || sClass?.yearOfStudy || normalizeYearOfStudy(student.yearOfStudy, student.semester || sClass?.semester);

    return res.status(200).json({
      success: true,
      student: {
        _id: student._id,
        studentId: student.studentId || student.user?.userId || '—',
        name: student.user?.name || student.personalInfo?.name || '—',
        email: student.personalInfo?.email || student.user?.email || '—',
        phone: student.personalInfo?.phone || '',
        dateOfBirth: student.personalInfo?.dateOfBirth,
        address: student.personalInfo?.address || '',
        department: student.department || sClass?.department || '—',
        yearOfStudy: studentYear,
        section: student.section || sClass?.section || '—',
        course: student.course || sClass?.course || 'B.Tech',
        semester: student.semester || sClass?.semester || '—',
        academicYear: student.academicYear || sClass?.academicYear || '—',
        classRef: student.classRef,
        attendancePercentage,
        classesAttended,
        totalClassesHeld,
        assessmentScore,
        riskScore: riskResult.score,
        riskLevel: riskResult.riskLevel,
        riskFactors: riskResult.factors,
        records,
        teacherSubjects
      }
    });
  } catch (error) {
    console.error('getTeacherStudentDetails error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch student details.' });
  }
};

/**
 * @route   POST /api/teacher/students/:studentId/record
 * @desc    Record or update attendance and assessment marks for a student
 *          Recalculates attendance percentage & risk score, updates RiskPrediction
 * @access  Private (Teacher only)
 */
exports.recordStudentAttendanceAndMarks = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { studentId } = req.params;
    const {
      subjectId,
      classesAttended,
      totalClassesHeld,
      marksObtained,
      totalMarks,
      termId
    } = req.body;

    if (!subjectId) {
      return res.status(400).json({ success: false, error: 'Subject ID is required.' });
    }

    const teacherProfile = await TeacherProfile.findOne({
      user: userId,
      institution: institutionId
    });

    if (!teacherProfile) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Teacher profile not found.' });
    }

    const student = await StudentProfile.findOne({
      _id: studentId,
      institution: institutionId
    }).populate('classRef');

    if (!student || !student.classRef) {
      return res.status(404).json({ success: false, error: 'Student or enrolled section not found.' });
    }

    // Security check: teacher must be assigned to student's class and subject
    const isAssigned = await TeachingAssignment.exists({
      teacher: teacherProfile._id,
      classRef: student.classRef._id,
      subject: subjectId,
      institution: institutionId,
      isActive: true
    });

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You are not assigned to teach this subject in this student’s section.'
      });
    }

    // Validate attendance numbers
    let computedAttendancePct = null;
    let attendedNum = null;
    let heldNum = null;
    if (totalClassesHeld !== undefined && totalClassesHeld !== null && totalClassesHeld !== '') {
      heldNum = Number(totalClassesHeld);
      attendedNum = Number(classesAttended || 0);

      if (isNaN(heldNum) || isNaN(attendedNum) || heldNum <= 0 || attendedNum < 0) {
        return res.status(400).json({
          success: false,
          error: 'Total classes held must be greater than 0, and classes attended cannot be negative.'
        });
      }

      if (attendedNum > heldNum) {
        return res.status(400).json({
          success: false,
          error: 'Classes attended cannot exceed total classes held.'
        });
      }

      // Formula: (Classes Attended ÷ Total Classes Held) × 100
      computedAttendancePct = Math.min(100, Math.max(0, Math.round((attendedNum / heldNum) * 100 * 10) / 10));
    }

    // Validate marks numbers
    let marksObtainedNum = null;
    let totalMarksNum = null;
    if (totalMarks !== undefined && totalMarks !== null && totalMarks !== '') {
      totalMarksNum = Number(totalMarks);
      marksObtainedNum = Number(marksObtained || 0);

      if (isNaN(totalMarksNum) || isNaN(marksObtainedNum) || totalMarksNum <= 0 || marksObtainedNum < 0) {
        return res.status(400).json({
          success: false,
          error: 'Total marks must be greater than 0, and marks obtained cannot be negative.'
        });
      }

      if (marksObtainedNum > totalMarksNum) {
        return res.status(400).json({
          success: false,
          error: 'Marks obtained cannot exceed total marks.'
        });
      }
    }

    // Resolve AcademicYear document
    let academicYearDoc = await AcademicYear.findOne({
      institution: institutionId,
      isCurrent: true
    });
    if (!academicYearDoc) {
      academicYearDoc = await AcademicYear.findOne({ institution: institutionId });
    }

    // Create or update AcademicRecord
    const query = {
      institution: institutionId,
      student: student._id,
      subject: subjectId
    };
    if (academicYearDoc) query.academicYear = academicYearDoc._id;
    if (termId) query.termId = termId;

    const updateDoc = {
      institution: institutionId,
      student: student._id,
      subject: subjectId,
      academicYear: academicYearDoc ? academicYearDoc._id : undefined,
      termId: termId || undefined,
      recordedBy: userId
    };

    if (computedAttendancePct !== null) {
      updateDoc.attendancePercentage = computedAttendancePct;
      updateDoc.classesAttended = attendedNum;
      updateDoc.totalClassesHeld = heldNum;
    }

    if (marksObtainedNum !== null) {
      updateDoc.marksObtained = marksObtainedNum;
      updateDoc.totalMarks = totalMarksNum;
    } else {
      updateDoc.$setOnInsert = { marksObtained: 0, totalMarks: 100 };
    }

    const savedRecord = await AcademicRecord.findOneAndUpdate(
      query,
      updateDoc,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // End-to-End calculation: Sync attendance and RiskScore in DB
    const updatedMetrics = await syncStudentMetricsAndRisk(student._id, institutionId);

    return res.status(200).json({
      success: true,
      message: 'Attendance and assessment records updated successfully.',
      record: savedRecord,
      metrics: updatedMetrics
    });
  } catch (error) {
    console.error('recordStudentAttendanceAndMarks error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record student attendance and marks.'
    });
  }
};



