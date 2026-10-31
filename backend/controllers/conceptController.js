const mongoose = require('mongoose');
const SubjectConcept = require('../models/SubjectConcept');
const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');
const TeacherProfile = require('../models/TeacherProfile');
const Class = require('../models/Class');

/**
 * Helper to resolve teacher profile and verify authorization for a subject
 */
async function resolveTeacherAndVerifySubject(userId, institutionId, subjectId) {
  const teacherProfile = await TeacherProfile.findOne({
    user: userId,
    institution: institutionId
  });

  if (!teacherProfile) {
    return { authorized: false, error: 'Teacher profile not found for this account.' };
  }

  // Check if teacher has an active teaching assignment for this subject
  const assignment = await TeachingAssignment.findOne({
    institution: institutionId,
    teacher: teacherProfile._id,
    subject: subjectId,
    isActive: true
  });

  if (!assignment) {
    return {
      authorized: false,
      error: 'Access denied: You are not assigned to teach this subject in this institution.'
    };
  }

  return { authorized: true, teacherProfile, assignment };
}

/**
 * Cycle detection algorithm using Depth-First Search
 * Returns { hasCycle: boolean, cyclePath?: string }
 */
async function detectCycle(institutionId, subjectId, currentConceptId, proposedPrereqIds, currentConceptName = '') {
  const allConcepts = await SubjectConcept.find({
    institution: institutionId,
    subject: subjectId,
    isActive: true
  }).select('_id name prerequisites');

  const adj = new Map();
  const nameMap = new Map();

  allConcepts.forEach(c => {
    const id = c._id.toString();
    nameMap.set(id, c.name);
    if (currentConceptId && id === currentConceptId.toString()) {
      adj.set(id, proposedPrereqIds.map(String));
    } else {
      adj.set(id, (c.prerequisites || []).map(p => p.toString()));
    }
  });

  const targetId = currentConceptId ? currentConceptId.toString() : 'NEW_CONCEPT';
  if (!adj.has(targetId)) {
    adj.set(targetId, proposedPrereqIds.map(String));
  }
  if (currentConceptName) {
    nameMap.set(targetId, currentConceptName);
  }

  const visited = new Set();
  const recStack = new Set();
  let cycle = null;

  function dfs(node, path) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path])) return true;
      } else if (recStack.has(neighbor)) {
        const cycleStartIndex = path.indexOf(neighbor);
        cycle = [...path.slice(cycleStartIndex), neighbor];
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      if (dfs(node, [])) {
        const cycleNames = cycle.map(id => nameMap.get(id) || (id === targetId ? (currentConceptName || 'This Concept') : id));
        return {
          hasCycle: true,
          cyclePath: cycleNames.join(' → ')
        };
      }
    }
  }

  return { hasCycle: false };
}

function cleanSectionIdentifier(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/\([^)]*\)/g, '').trim();
  if (str.includes(' - ')) {
    const parts = str.split(' - ');
    str = parts[parts.length - 1].trim();
  }
  if (str.includes(':')) {
    const parts = str.split(':');
    str = parts[parts.length - 1].trim();
  }
  str = str.replace(/^(CSE|ECE|EEE|MECH|CIVIL|IT|CS|B\.?Tech|M\.?Tech|MBA|MCA)\s*[-:]?\s*/i, '').trim();
  str = str.replace(/^(section|sec)\.?\s*[-:]?\s*/i, '').trim();
  return str;
}

const STUDY_YEARS_ORDER = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];

function normalizeYearOfStudy(yearOfStudy, semester) {
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
  return null;
}

/**
 * @route   GET /api/teacher/knowledge-gaps/filters
 * @desc    Get scope filter options for the authenticated teacher (Department, Year, Semester, Section, Subject)
 * @access  Private (Teacher)
 */
exports.getKnowledgeGapFilters = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;

    const teacherProfile = await TeacherProfile.findOne({
      user: userId,
      institution: institutionId
    });

    if (!teacherProfile) {
      return res.status(200).json({
        success: true,
        filters: {
          departments: [],
          academicYears: [],
          studyYears: [],
          studyYearToAcademicYear: {},
          semesters: [],
          sections: [],
          subjects: []
        }
      });
    }

    // Fetch active assignments for this teacher
    const assignments = await TeachingAssignment.find({
      teacher: teacherProfile._id,
      institution: institutionId,
      isActive: true
    })
      .populate('subject', 'name code department semester academicYear credits subjectType isActive')
      .populate('classRef', 'name course department academicYear semester section yearOfStudy isActive')
      .sort({ createdAt: -1 });

    const departmentSet = new Set();
    const academicYearSet = new Set();
    const studyYearSet = new Set();
    const studyYearToAcademicYearMap = {};
    const semesterSet = new Set();
    const sectionMap = new Map();
    const subjectMap = new Map();

    assignments.forEach(a => {
      const sub = a.subject;
      const cls = a.classRef;

      if (!sub || sub.isActive === false) return;

      const dept = cls?.department || sub.department;
      if (dept) departmentSet.add(dept);

      const yr = a.academicYear || cls?.academicYear || sub.academicYear;
      if (yr) academicYearSet.add(yr);

      const sem = cls?.semester || sub.semester;
      if (sem) semesterSet.add(sem);

      const resolvedYearOfStudy = normalizeYearOfStudy(cls?.yearOfStudy, cls?.semester || sub.semester);
      if (resolvedYearOfStudy) {
        studyYearSet.add(resolvedYearOfStudy);
        if (yr && !studyYearToAcademicYearMap[resolvedYearOfStudy]) {
          studyYearToAcademicYearMap[resolvedYearOfStudy] = yr;
        }
      }

      if (cls && cls.isActive !== false) {
        const clsId = cls._id.toString();
        const subIdStr = sub ? sub._id.toString() : null;
        if (!sectionMap.has(clsId)) {
          const rawSec = cls.section || '';
          const cleanedSec = cleanSectionIdentifier(rawSec) || rawSec;
          sectionMap.set(clsId, {
            id: clsId,
            name: cls.name,
            course: cls.course,
            department: cls.department,
            academicYear: cls.academicYear,
            semester: cls.semester,
            section: cleanedSec,
            yearOfStudy: resolvedYearOfStudy || cls.yearOfStudy || '',
            subjectIds: subIdStr ? [subIdStr] : []
          });
        } else if (subIdStr) {
          const secEntry = sectionMap.get(clsId);
          if (Array.isArray(secEntry.subjectIds) && !secEntry.subjectIds.includes(subIdStr)) {
            secEntry.subjectIds.push(subIdStr);
          }
        }
      }

      const subId = sub._id.toString();
      if (!subjectMap.has(subId)) {
        subjectMap.set(subId, {
          id: subId,
          name: sub.name,
          code: sub.code,
          department: dept || sub.department,
          semester: sem || sub.semester || '',
          academicYear: yr || sub.academicYear || '',
          credits: sub.credits,
          subjectType: sub.subjectType || 'Theory',
          sectionIds: cls ? [cls._id.toString()] : [],
          yearsOfStudy: resolvedYearOfStudy ? [resolvedYearOfStudy] : []
        });
      } else {
        const entry = subjectMap.get(subId);
        if (cls && !entry.sectionIds.includes(cls._id.toString())) {
          entry.sectionIds.push(cls._id.toString());
        }
        if (resolvedYearOfStudy && !entry.yearsOfStudy.includes(resolvedYearOfStudy)) {
          entry.yearsOfStudy.push(resolvedYearOfStudy);
        }
      }
    });

    const subjectsList = Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const sectionsList = Array.from(sectionMap.values()).sort((a, b) => (a.section || '').localeCompare(b.section || ''));
    const departmentsList = Array.from(departmentSet).sort();
    const academicYearsList = Array.from(academicYearSet).sort();
    const studyYearsList = STUDY_YEARS_ORDER.filter(sy => studyYearSet.has(sy));
    const semestersList = Array.from(semesterSet).sort();

    return res.status(200).json({
      success: true,
      filters: {
        departments: departmentsList,
        academicYears: academicYearsList,
        studyYears: studyYearsList,
        studyYearToAcademicYear: studyYearToAcademicYearMap,
        semesters: semestersList,
        sections: sectionsList,
        subjects: subjectsList
      }
    });
  } catch (error) {
    console.error('getKnowledgeGapFilters error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve academic scope filters.'
    });
  }
};

/**
 * @route   GET /api/teacher/knowledge-gaps/concepts
 * @desc    Get all concepts and prerequisite relationships for a specific subject
 * @access  Private (Teacher)
 */
exports.getConcepts = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { subjectId, search } = req.query;

    if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({
        success: false,
        error: 'A valid Subject ID is required.'
      });
    }

    // Verify teacher authorization for this subject
    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, subjectId);
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: authCheck.error });
    }

    // Fetch subject details
    const subject = await Subject.findOne({ _id: subjectId, institution: institutionId });
    if (!subject) {
      return res.status(404).json({ success: false, error: 'Subject not found.' });
    }

    const query = {
      institution: institutionId,
      subject: subjectId,
      isActive: true
    };

    if (search && typeof search === 'string' && search.trim()) {
      const reg = new RegExp(search.trim(), 'i');
      query.$or = [{ name: reg }, { description: reg }];
    }

    // Fetch all active concepts for this subject
    const concepts = await SubjectConcept.find(query)
      .populate('prerequisites', '_id name difficultyLevel orderIndex academicYear semester')
      .populate('createdBy', 'name userId email')
      .populate('lastUpdatedBy', 'name userId email')
      .sort({ orderIndex: 1, createdAt: 1 });

    // Calculate reverse dependencies (which concepts depend on this concept)
    const dependentMap = new Map();
    concepts.forEach(c => {
      dependentMap.set(c._id.toString(), []);
    });

    concepts.forEach(c => {
      (c.prerequisites || []).forEach(p => {
        const pId = (p._id || p).toString();
        if (dependentMap.has(pId)) {
          dependentMap.get(pId).push({
            _id: c._id,
            name: c.name,
            difficultyLevel: c.difficultyLevel
          });
        }
      });
    });

    // Attach dependents array to each concept
    const enrichedConcepts = concepts.map(c => {
      const cObj = c.toObject();
      cObj.dependents = dependentMap.get(c._id.toString()) || [];
      return cObj;
    });

    // Summary statistics
    const totalConcepts = enrichedConcepts.length;
    const rootConceptsCount = enrichedConcepts.filter(c => !c.prerequisites || c.prerequisites.length === 0).length;
    let totalPrerequisiteLinks = 0;
    enrichedConcepts.forEach(c => {
      totalPrerequisiteLinks += (c.prerequisites || []).length;
    });

    return res.status(200).json({
      success: true,
      subject: {
        _id: subject._id,
        name: subject.name,
        code: subject.code,
        department: subject.department,
        semester: subject.semester,
        academicYear: subject.academicYear,
        credits: subject.credits,
        subjectType: subject.subjectType
      },
      concepts: enrichedConcepts,
      stats: {
        totalConcepts,
        rootConceptsCount,
        totalPrerequisiteLinks
      }
    });
  } catch (error) {
    console.error('getConcepts error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve subject concepts.'
    });
  }
};

/**
 * @route   POST /api/teacher/knowledge-gaps/concepts
 * @desc    Create a new concept with validated prerequisites
 * @access  Private (Teacher)
 */
exports.createConcept = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const {
      subjectId,
      name,
      description,
      academicYear,
      semester,
      difficultyLevel,
      orderIndex,
      prerequisites
    } = req.body;

    if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ success: false, error: 'A valid subjectId is required.' });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Concept name is required.' });
    }

    const trimmedName = name.trim();

    // Verify teacher authorization
    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, subjectId);
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: authCheck.error });
    }

    // Check duplicate concept name within subject
    const existing = await SubjectConcept.findOne({
      institution: institutionId,
      subject: subjectId,
      name: { $regex: new RegExp(`^${trimmedName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
      isActive: true
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `A concept named "${trimmedName}" already exists for this subject.`
      });
    }

    // Validate prerequisites array
    const validPrereqIds = [];
    if (Array.isArray(prerequisites) && prerequisites.length > 0) {
      for (const p of prerequisites) {
        const pId = typeof p === 'object' && p !== null ? (p._id || p.id) : p;
        if (!pId || !mongoose.Types.ObjectId.isValid(pId)) {
          return res.status(400).json({ success: false, error: `Invalid prerequisite ID: ${pId}` });
        }
        validPrereqIds.push(new mongoose.Types.ObjectId(pId));
      }

      // Verify that all prerequisites exist within the same subject and institution
      const matchingPrereqs = await SubjectConcept.find({
        _id: { $in: validPrereqIds },
        institution: institutionId,
        subject: subjectId,
        isActive: true
      });

      if (matchingPrereqs.length !== validPrereqIds.length) {
        return res.status(400).json({
          success: false,
          error: 'All selected prerequisites must be existing concepts belonging to the same subject.'
        });
      }

      // Cycle detection
      const cycleCheck = await detectCycle(institutionId, subjectId, null, validPrereqIds, trimmedName);
      if (cycleCheck.hasCycle) {
        return res.status(400).json({
          success: false,
          error: `Circular dependency detected: ${cycleCheck.cyclePath}. A concept cannot have circular prerequisites.`
        });
      }
    }

    const newConcept = await SubjectConcept.create({
      institution: institutionId,
      subject: subjectId,
      name: trimmedName,
      description: typeof description === 'string' ? description.trim() : '',
      academicYear: academicYear ? String(academicYear).trim() : (authCheck.assignment.academicYear || ''),
      semester: semester ? String(semester).trim() : '',
      difficultyLevel: ['Fundamental', 'Beginner', 'Intermediate', 'Advanced'].includes(difficultyLevel) ? difficultyLevel : 'Intermediate',
      orderIndex: typeof orderIndex === 'number' ? orderIndex : 0,
      prerequisites: validPrereqIds,
      createdBy: userId,
      lastUpdatedBy: userId,
      isActive: true
    });

    const populatedConcept = await SubjectConcept.findById(newConcept._id)
      .populate('prerequisites', '_id name difficultyLevel orderIndex academicYear semester')
      .populate('createdBy', 'name userId email')
      .populate('lastUpdatedBy', 'name userId email');

    return res.status(201).json({
      success: true,
      message: 'Concept created successfully.',
      concept: populatedConcept
    });
  } catch (error) {
    console.error('createConcept error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create concept.'
    });
  }
};

/**
 * @route   PUT /api/teacher/knowledge-gaps/concepts/:id
 * @desc    Update an existing concept and its prerequisites with cycle prevention
 * @access  Private (Teacher)
 */
exports.updateConcept = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { id } = req.params;
    const {
      name,
      description,
      academicYear,
      semester,
      difficultyLevel,
      orderIndex,
      prerequisites
    } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'A valid concept ID is required.' });
    }

    const concept = await SubjectConcept.findOne({
      _id: id,
      institution: institutionId,
      isActive: true
    });

    if (!concept) {
      return res.status(404).json({ success: false, error: 'Concept not found.' });
    }

    // Verify teacher authorization for this concept's subject
    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, concept.subject);
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: authCheck.error });
    }

    // Name update validation
    if (name) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ success: false, error: 'Concept name cannot be empty.' });
      }

      // Check duplicate name excluding current concept
      const duplicate = await SubjectConcept.findOne({
        _id: { $ne: concept._id },
        institution: institutionId,
        subject: concept.subject,
        name: { $regex: new RegExp(`^${trimmedName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
        isActive: true
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: `Another concept named "${trimmedName}" already exists for this subject.`
        });
      }

      concept.name = trimmedName;
    }

    // Optional fields
    if (description !== undefined) concept.description = String(description).trim();
    if (academicYear !== undefined) concept.academicYear = String(academicYear).trim();
    if (semester !== undefined) concept.semester = String(semester).trim();
    if (difficultyLevel && ['Fundamental', 'Beginner', 'Intermediate', 'Advanced'].includes(difficultyLevel)) {
      concept.difficultyLevel = difficultyLevel;
    }
    if (typeof orderIndex === 'number') concept.orderIndex = orderIndex;

    // Prerequisites validation & update
    if (Array.isArray(prerequisites)) {
      const validPrereqIds = [];
      for (const p of prerequisites) {
        const pId = typeof p === 'object' && p !== null ? (p._id || p.id) : p;
        if (!pId || !mongoose.Types.ObjectId.isValid(pId)) {
          return res.status(400).json({ success: false, error: `Invalid prerequisite ID: ${pId}` });
        }

        // Self-prerequisite prevention
        if (pId.toString() === concept._id.toString()) {
          return res.status(400).json({
            success: false,
            error: 'A concept cannot be its own prerequisite.'
          });
        }

        validPrereqIds.push(new mongoose.Types.ObjectId(pId));
      }

      // Verify compatible scope (same subject and institution)
      if (validPrereqIds.length > 0) {
        const matchingPrereqs = await SubjectConcept.find({
          _id: { $in: validPrereqIds },
          institution: institutionId,
          subject: concept.subject,
          isActive: true
        });

        if (matchingPrereqs.length !== validPrereqIds.length) {
          return res.status(400).json({
            success: false,
            error: 'All selected prerequisites must be existing concepts belonging to the same subject.'
          });
        }

        // Circular dependency check
        const cycleCheck = await detectCycle(institutionId, concept.subject, concept._id, validPrereqIds, concept.name);
        if (cycleCheck.hasCycle) {
          return res.status(400).json({
            success: false,
            error: `Circular dependency detected: ${cycleCheck.cyclePath}. A concept cannot have circular prerequisites.`
          });
        }
      }

      concept.prerequisites = validPrereqIds;
    }

    concept.lastUpdatedBy = userId;
    await concept.save();

    const updatedConcept = await SubjectConcept.findById(concept._id)
      .populate('prerequisites', '_id name difficultyLevel orderIndex academicYear semester')
      .populate('createdBy', 'name userId email')
      .populate('lastUpdatedBy', 'name userId email');

    return res.status(200).json({
      success: true,
      message: 'Concept updated successfully.',
      concept: updatedConcept
    });
  } catch (error) {
    console.error('updateConcept error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update concept.'
    });
  }
};

/**
 * @route   DELETE /api/teacher/knowledge-gaps/concepts/:id
 * @desc    Delete a concept safely (blocks deletion if other concepts depend on it)
 * @access  Private (Teacher)
 */
exports.deleteConcept = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'A valid concept ID is required.' });
    }

    const concept = await SubjectConcept.findOne({
      _id: id,
      institution: institutionId,
      isActive: true
    });

    if (!concept) {
      return res.status(404).json({ success: false, error: 'Concept not found.' });
    }

    // Verify teacher authorization for this subject
    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, concept.subject);
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: authCheck.error });
    }

    // Safe deletion check: prevent deletion if other concepts depend on this concept as prerequisite
    const dependentConcepts = await SubjectConcept.find({
      institution: institutionId,
      subject: concept.subject,
      prerequisites: concept._id,
      isActive: true
    }).select('name');

    if (dependentConcepts.length > 0) {
      const depNames = dependentConcepts.map(c => `"${c.name}"`).join(', ');
      return res.status(400).json({
        success: false,
        error: `Cannot delete concept "${concept.name}" because it is required as a prerequisite by: ${depNames}. Please remove this prerequisite relationship from those concepts first.`
      });
    }

    // Delete the concept
    await SubjectConcept.deleteOne({ _id: concept._id });

    return res.status(200).json({
      success: true,
      message: `Concept "${concept.name}" deleted successfully.`
    });
  } catch (error) {
    console.error('deleteConcept error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete concept.'
    });
  }
};
