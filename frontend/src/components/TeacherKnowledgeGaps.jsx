import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Target, 
  BookOpen, 
  Layers, 
  Building2, 
  Calendar, 
  Award, 
  Sparkles, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Network, 
  ListFilter, 
  GitBranch, 
  ArrowRight, 
  ChevronRight, 
  Info, 
  HelpCircle, 
  X, 
  Loader2, 
  ShieldCheck, 
  Eye, 
  Share2,
  Check,
  Maximize2,
  Activity
} from 'lucide-react';
import { teacherApi } from '../api';
import TeacherDropdown, { cleanSectionName, formatSectionLabel } from './TeacherDropdown';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { usePageRefresh } from '../context/RefreshContext';
import TeacherAssessmentMapping from './TeacherAssessmentMapping';
import TeacherKnowledgeGapDiagnosis from './TeacherKnowledgeGapDiagnosis';

const DIFFICULTY_LEVELS = [
  { value: 'Fundamental', label: 'Fundamental (Core)', color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { value: 'Beginner', label: 'Beginner', color: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  { value: 'Intermediate', label: 'Intermediate', color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { value: 'Advanced', label: 'Advanced', color: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' }
];

/**
 * Utility to extract clean, normalized section identifier from raw database strings.
 * Strips department names, prefixes, degree names, and academic years.
 * e.g. "B.Tech Computer Science and Engineering - Sec A (Fourth Year)" -> "A"
 *      "CSE - Section B" -> "B"
 *      "Sec A" -> "A"
 *      "A" -> "A"
 */
export { cleanSectionName, formatSectionLabel };

export const STUDY_YEARS_ORDER = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];

/**
 * Normalizes any study year or semester value to canonical study year representation:
 * 'First Year', 'Second Year', 'Third Year', 'Fourth Year'
 */
export function normalizeYearOfStudy(yearOfStudy, semester) {
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

export default function TeacherKnowledgeGaps({ currentUser }) {
  // Active Stage Tab: 'stage1' (Concepts & Prerequisites) | 'stage2' (Assessment Question Mapping) | 'stage3' (Knowledge-Gap Diagnosis)
  const [activeStage, setActiveStage] = useState('stage3');

  // Scope Filter Options from backend
  const [filterData, setFilterData] = useState({
    departments: [],
    academicYears: [],
    studyYears: [],
    studyYearToAcademicYear: {},
    semesters: [],
    sections: [],
    subjects: []
  });
  const [filtersLoading, setFiltersLoading] = useState(true);

  // Active Scope Filter States
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedSemester, setSelectedSemester] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  // Data states
  const [concepts, setConcepts] = useState([]);
  const [subjectDetails, setSubjectDetails] = useState(null);
  const [stats, setStats] = useState({
    totalConcepts: 0,
    rootConceptsCount: 0,
    totalPrerequisiteLinks: 0
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // View state: 'list' (Table/Cards), 'map' (Prerequisite Dependency Graph), 'split' (Combined)
  const [activeView, setActiveView] = useState('split');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConceptForHighlight, setSelectedConceptForHighlight] = useState(null);

  // Modal states: Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConcept, setEditingConcept] = useState(null);
  const [modalForm, setModalForm] = useState({
    name: '',
    description: '',
    difficultyLevel: 'Intermediate',
    academicYear: '',
    semester: '',
    orderIndex: 0,
    prerequisites: []
  });
  const [modalError, setModalError] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [conceptToDelete, setConceptToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Load scope filter options on mount
  const loadFilters = useCallback(async () => {
    setFiltersLoading(true);
    try {
      const res = await teacherApi.getKnowledgeGapFilters();
      if (res && res.success && res.filters) {
        setFilterData(res.filters);
        // Pre-select first available subject if none is selected
        if (!selectedSubjectId && res.filters.subjects && res.filters.subjects.length > 0) {
          setSelectedSubjectId(res.filters.subjects[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load knowledge-gap filters:', err);
      setError('Failed to load academic scope filters. Please verify your connection.');
    } finally {
      setFiltersLoading(false);
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  // Load concepts for selected subject
  const loadConcepts = useCallback(async (isManualRefresh = false) => {
    if (!selectedSubjectId) return;

    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await teacherApi.getKnowledgeGapConcepts({
        subjectId: selectedSubjectId,
        search: searchQuery.trim() || undefined
      });

      if (res && res.success) {
        setConcepts(res.concepts || []);
        setSubjectDetails(res.subject || null);
        setStats(res.stats || {
          totalConcepts: (res.concepts || []).length,
          rootConceptsCount: (res.concepts || []).filter(c => !c.prerequisites || c.prerequisites.length === 0).length,
          totalPrerequisiteLinks: 0
        });
      } else {
        setError(res?.error || 'Failed to load subject concepts.');
      }
    } catch (err) {
      console.error('Failed to fetch concepts:', err);
      setError(err?.response?.data?.error || 'Unable to load subject concepts from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSubjectId, searchQuery]);

  useEffect(() => {
    if (selectedSubjectId) {
      loadConcepts();
    } else {
      setConcepts([]);
      setSubjectDetails(null);
    }
  }, [selectedSubjectId, loadConcepts]);

  // Register with global header refresh button
  usePageRefresh(async () => {
    if (selectedSubjectId) {
      await Promise.all([loadFilters(), loadConcepts(true)]);
    } else {
      await loadFilters();
    }
  }, [selectedSubjectId, loadFilters, loadConcepts]);

  // Available departments dependent on active Year filter and teacher assignments
  const availableDepartments = useMemo(() => {
    const depts = new Set();
    (filterData.sections || []).forEach(sec => {
      const secYear = normalizeYearOfStudy(sec.yearOfStudy, sec.semester);
      if (selectedYear === 'ALL' || secYear === selectedYear) {
        if (sec.department) depts.add(sec.department);
      }
    });
    (filterData.subjects || []).forEach(sub => {
      const subYears = sub.yearsOfStudy || [];
      const matchYear = selectedYear === 'ALL' || 
        subYears.includes(selectedYear) || 
        normalizeYearOfStudy(null, sub.semester) === selectedYear;
      if (matchYear && sub.department) {
        depts.add(sub.department);
      }
    });
    if (depts.size === 0 && selectedYear === 'ALL') {
      (filterData.departments || []).forEach(d => depts.add(d));
    }
    return Array.from(depts).sort();
  }, [filterData.sections, filterData.subjects, filterData.departments, selectedYear]);

  // Available sections dependent on active Year and Department filters
  const availableSections = useMemo(() => {
    let list = filterData.sections || [];
    if (selectedYear !== 'ALL') {
      list = list.filter(sec => {
        const secYear = normalizeYearOfStudy(sec.yearOfStudy, sec.semester);
        return secYear === selectedYear;
      });
    }
    if (selectedDept !== 'ALL') {
      list = list.filter(sec => (sec.department || '').toLowerCase() === selectedDept.toLowerCase());
    }
    return list;
  }, [filterData.sections, selectedYear, selectedDept]);

  // Filtered assigned subjects based on active Year, Department, and Section filters
  const filteredSubjects = useMemo(() => {
    let list = filterData.subjects || [];

    if (selectedYear !== 'ALL') {
      list = list.filter(s => {
        const subYears = s.yearsOfStudy || [];
        const matchByClass = (s.sectionIds || []).some(id => {
          const cls = availableSections.find(sec => sec.id === id);
          return Boolean(cls);
        });
        return subYears.includes(selectedYear) || matchByClass || normalizeYearOfStudy(null, s.semester) === selectedYear;
      });
    }
    if (selectedDept !== 'ALL') {
      list = list.filter(s => (s.department || '').toLowerCase() === selectedDept.toLowerCase());
    }
    if (selectedSection !== 'ALL') {
      const targetSec = availableSections.find(sec => sec.id === selectedSection);
      const targetClean = targetSec ? cleanSectionName(targetSec.section) : cleanSectionName(selectedSection);
      const matchingClassIds = availableSections
        .filter(sec => sec.id === selectedSection || (targetClean && cleanSectionName(sec.section) === targetClean))
        .map(sec => sec.id);

      list = list.filter(s =>
        Array.isArray(s.sectionIds) && s.sectionIds.some(id => matchingClassIds.includes(id))
      );
    }

    return list;
  }, [filterData.subjects, selectedYear, selectedDept, selectedSection, availableSections]);

  // Underlying calendar academic year (e.g. "2026-2027") mapped to the selected study year
  const underlyingAcademicYear = useMemo(() => {
    if (!selectedYear || selectedYear === 'ALL') return 'ALL';
    if (filterData.studyYearToAcademicYear && filterData.studyYearToAcademicYear[selectedYear]) {
      return filterData.studyYearToAcademicYear[selectedYear];
    }
    const matchedSec = (filterData.sections || []).find(sec => {
      const sy = normalizeYearOfStudy(sec.yearOfStudy, sec.semester);
      return sy === selectedYear && sec.academicYear;
    });
    if (matchedSec?.academicYear) return matchedSec.academicYear;
    return filterData.academicYears?.[0] || '2026-2027';
  }, [selectedYear, filterData.studyYearToAcademicYear, filterData.sections, filterData.academicYears]);

  // Sync selected subject if active selection no longer exists in filtered list
  useEffect(() => {
    if (filteredSubjects.length > 0) {
      const exists = filteredSubjects.some(s => s.id === selectedSubjectId);
      if (!exists) {
        setSelectedSubjectId(filteredSubjects[0].id);
      }
    } else {
      setSelectedSubjectId('');
    }
  }, [filteredSubjects, selectedSubjectId]);

  // Cascading filter selection handlers
  const handleYearChange = useCallback((newYear) => {
    setSelectedYear(newYear);

    // Compute valid departments for newYear
    const validDepts = new Set();
    (filterData.sections || []).forEach(sec => {
      const secYear = normalizeYearOfStudy(sec.yearOfStudy, sec.semester);
      if (newYear === 'ALL' || secYear === newYear) {
        if (sec.department) validDepts.add(sec.department.toLowerCase());
      }
    });
    (filterData.subjects || []).forEach(sub => {
      const subYears = sub.yearsOfStudy || [];
      const matchYear = newYear === 'ALL' || subYears.includes(newYear) || normalizeYearOfStudy(null, sub.semester) === newYear;
      if (matchYear && sub.department) {
        validDepts.add(sub.department.toLowerCase());
      }
    });

    let nextDept = selectedDept;
    if (selectedDept !== 'ALL' && !validDepts.has(selectedDept.toLowerCase())) {
      nextDept = 'ALL';
      setSelectedDept('ALL');
    }

    // Compute valid sections for newYear & nextDept
    const validSecs = (filterData.sections || []).filter(sec => {
      const secYear = normalizeYearOfStudy(sec.yearOfStudy, sec.semester);
      const yrMatch = newYear === 'ALL' || secYear === newYear;
      const deptMatch = nextDept === 'ALL' || (sec.department || '').toLowerCase() === nextDept.toLowerCase();
      return yrMatch && deptMatch;
    });

    if (selectedSection !== 'ALL') {
      const stillValid = validSecs.some(sec => sec.id === selectedSection || cleanSectionName(sec.section) === cleanSectionName(selectedSection));
      if (!stillValid) {
        setSelectedSection('ALL');
      }
    }
  }, [filterData.sections, filterData.subjects, selectedDept, selectedSection]);

  const handleDeptChange = useCallback((newDept) => {
    setSelectedDept(newDept);

    // Compute valid sections for selectedYear & newDept
    const validSecs = (filterData.sections || []).filter(sec => {
      const secYear = normalizeYearOfStudy(sec.yearOfStudy, sec.semester);
      const yrMatch = selectedYear === 'ALL' || secYear === selectedYear;
      const deptMatch = newDept === 'ALL' || (sec.department || '').toLowerCase() === newDept.toLowerCase();
      return yrMatch && deptMatch;
    });

    if (selectedSection !== 'ALL') {
      const stillValid = validSecs.some(sec => sec.id === selectedSection || cleanSectionName(sec.section) === cleanSectionName(selectedSection));
      if (!stillValid) {
        setSelectedSection('ALL');
      }
    }
  }, [filterData.sections, selectedYear, selectedSection]);

  const handleSectionChange = useCallback((newSection) => {
    setSelectedSection(newSection);
  }, []);

  const handleSubjectChange = useCallback((newSubjectId) => {
    setSelectedSubjectId(newSubjectId);
    if (selectedSection !== 'ALL') {
      const sub = (filterData.subjects || []).find(s => s.id === newSubjectId);
      if (sub && Array.isArray(sub.sectionIds)) {
        const targetSec = (filterData.sections || []).find(sec => sec.id === selectedSection);
        const clean = targetSec ? cleanSectionName(targetSec.section) : '';
        const isValid = sub.sectionIds.includes(selectedSection) ||
          (clean && (sub.sectionIds || []).some(secId => {
            const secObj = (filterData.sections || []).find(s => s.id === secId);
            return secObj && cleanSectionName(secObj.section) === clean;
          }));
        if (!isValid) {
          setSelectedSection('ALL');
        }
      }
    }
  }, [selectedSection, filterData.subjects, filterData.sections]);

  // 1. All Years Options (Populated dynamically with academic study years: First Year, Second Year, Third Year, Fourth Year)
  const yearOptions = useMemo(() => {
    const list = [{ value: 'ALL', label: 'All Years' }];

    // Discover valid study years from backend filterData.studyYears or assigned classes/sections
    const availableStudyYearsSet = new Set(filterData.studyYears || []);
    
    // Also inspect sections and subjects in filterData to catch any configured study years
    (filterData.sections || []).forEach(sec => {
      const sy = normalizeYearOfStudy(sec.yearOfStudy, sec.semester);
      if (sy) availableStudyYearsSet.add(sy);
    });
    (filterData.subjects || []).forEach(sub => {
      (sub.yearsOfStudy || []).forEach(sy => availableStudyYearsSet.add(sy));
      const sy = normalizeYearOfStudy(null, sub.semester);
      if (sy) availableStudyYearsSet.add(sy);
    });

    // Populate according to canonical academic structure: First Year, Second Year, Third Year, Fourth Year
    STUDY_YEARS_ORDER.forEach(studyYear => {
      if (availableStudyYearsSet.has(studyYear)) {
        list.push({ value: studyYear, label: studyYear });
      }
    });

    return list;
  }, [filterData.studyYears, filterData.sections, filterData.subjects]);

  // 2. All Departments Options (Scoped by Year)
  const departmentOptions = useMemo(() => {
    const list = [{ value: 'ALL', label: 'All Departments' }];
    availableDepartments.forEach(d => {
      list.push({ value: d, label: d });
    });
    return list;
  }, [availableDepartments]);

  // 3. All Sections Options (Scoped by Year & Department, with clean simple labels)
  const sectionOptions = useMemo(() => {
    const list = [{ value: 'ALL', label: 'All Sections' }];
    const seenNames = new Set();

    const sorted = [...availableSections].sort((a, b) => {
      const cleanA = cleanSectionName(a.section || '');
      const cleanB = cleanSectionName(b.section || '');
      return cleanA.localeCompare(cleanB);
    });

    sorted.forEach(sec => {
      const clean = cleanSectionName(sec.section);
      if (!clean) return;
      if (!seenNames.has(clean)) {
        seenNames.add(clean);
        list.push({
          value: clean,
          label: formatSectionLabel(sec.section)
        });
      }
    });

    return list;
  }, [availableSections]);

  // 4. Assigned Subject Options
  const subjectOptions = useMemo(() => {
    return filteredSubjects.map(sub => ({
      value: sub.id,
      label: `${sub.code ? `[${sub.code}] ` : ''}${sub.name}`
    }));
  }, [filteredSubjects]);

  // Filtered concepts by search query
  const displayedConcepts = useMemo(() => {
    if (!searchQuery.trim()) return concepts;
    const q = searchQuery.toLowerCase().trim();
    return concepts.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.description && c.description.toLowerCase().includes(q)) ||
      (c.difficultyLevel && c.difficultyLevel.toLowerCase().includes(q))
    );
  }, [concepts, searchQuery]);

  // Topological sorting and levels calculation for the Prerequisite Map
  const { graphNodes, graphEdges, maxLevel } = useMemo(() => {
    if (!concepts || concepts.length === 0) {
      return { graphNodes: [], graphEdges: [], maxLevel: 0 };
    }

    // Map by ID
    const conceptMap = new Map();
    concepts.forEach(c => conceptMap.set(c._id.toString(), c));

    // Calculate level (distance from foundational root)
    const levelMap = new Map();
    const memo = new Map();

    const computeLevel = (id, visited = new Set()) => {
      if (memo.has(id)) return memo.get(id);
      if (visited.has(id)) return 0; // prevent recursion in case of legacy bad data
      visited.add(id);

      const concept = conceptMap.get(id);
      if (!concept || !concept.prerequisites || concept.prerequisites.length === 0) {
        memo.set(id, 0);
        return 0;
      }

      let maxP = 0;
      for (const p of concept.prerequisites) {
        const pId = (p._id || p).toString();
        const pLevel = computeLevel(pId, new Set(visited));
        if (pLevel + 1 > maxP) maxP = pLevel + 1;
      }

      memo.set(id, maxP);
      return maxP;
    };

    let calculatedMaxLevel = 0;
    concepts.forEach(c => {
      const lvl = computeLevel(c._id.toString());
      levelMap.set(c._id.toString(), lvl);
      if (lvl > calculatedMaxLevel) calculatedMaxLevel = lvl;
    });

    // Group nodes by level for column-based positioning
    const levelBuckets = [];
    for (let i = 0; i <= calculatedMaxLevel; i++) {
      levelBuckets[i] = [];
    }

    concepts.forEach(c => {
      const lvl = levelMap.get(c._id.toString()) || 0;
      levelBuckets[lvl].push(c);
    });

    // Assign (x, y) coordinates
    // Width per column: ~260px, Height per node: ~120px + vertical spacing: ~40px
    const colWidth = 280;
    const rowHeight = 150;
    const startX = 40;
    const startY = 40;

    const positionedNodes = [];
    levelBuckets.forEach((bucket, colIdx) => {
      bucket.forEach((c, rowIdx) => {
        positionedNodes.push({
          ...c,
          level: colIdx,
          x: startX + colIdx * colWidth,
          y: startY + rowIdx * rowHeight,
          width: 230,
          height: 110
        });
      });
    });

    // Build edges (Prerequisite -> Dependent)
    const nodeCoordMap = new Map();
    positionedNodes.forEach(n => nodeCoordMap.set(n._id.toString(), n));

    const edges = [];
    positionedNodes.forEach(target => {
      (target.prerequisites || []).forEach(p => {
        const pId = (p._id || p).toString();
        const source = nodeCoordMap.get(pId);
        if (source) {
          edges.push({
            id: `${source._id}->${target._id}`,
            sourceId: source._id.toString(),
            targetId: target._id.toString(),
            sourceName: source.name,
            targetName: target.name,
            sourceX: source.x + source.width,
            sourceY: source.y + source.height / 2,
            targetX: target.x,
            targetY: target.y + target.height / 2
          });
        }
      });
    });

    return {
      graphNodes: positionedNodes,
      graphEdges: edges,
      maxLevel: calculatedMaxLevel
    };
  }, [concepts]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingConcept(null);
    setModalForm({
      name: '',
      description: '',
      difficultyLevel: 'Intermediate',
      academicYear: (underlyingAcademicYear !== 'ALL' ? underlyingAcademicYear : subjectDetails?.academicYear) || '',
      semester: subjectDetails?.semester || '',
      orderIndex: concepts.length + 1,
      prerequisites: []
    });
    setModalError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (concept) => {
    setEditingConcept(concept);
    setModalForm({
      name: concept.name || '',
      description: concept.description || '',
      difficultyLevel: concept.difficultyLevel || 'Intermediate',
      academicYear: concept.academicYear || '',
      semester: concept.semester || '',
      orderIndex: typeof concept.orderIndex === 'number' ? concept.orderIndex : 0,
      prerequisites: (concept.prerequisites || []).map(p => (p._id || p).toString())
    });
    setModalError('');
    setIsModalOpen(true);
  };

  // Handle Save Concept (Create or Update)
  const handleSaveConcept = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!modalForm.name.trim()) {
      setModalError('Please enter a concept name.');
      return;
    }

    setModalSubmitting(true);
    try {
      if (editingConcept) {
        // Update
        const res = await teacherApi.updateKnowledgeGapConcept(editingConcept._id, {
          name: modalForm.name.trim(),
          description: modalForm.description.trim(),
          difficultyLevel: modalForm.difficultyLevel,
          academicYear: modalForm.academicYear,
          semester: modalForm.semester,
          orderIndex: Number(modalForm.orderIndex) || 0,
          prerequisites: modalForm.prerequisites
        });

        if (res && res.success) {
          setIsModalOpen(false);
          setSuccessMsg(`Concept "${modalForm.name}" updated successfully.`);
          loadConcepts();
          setTimeout(() => setSuccessMsg(''), 4000);
        } else {
          setModalError(res?.error || 'Failed to update concept.');
        }
      } else {
        // Create
        const res = await teacherApi.createKnowledgeGapConcept({
          subjectId: selectedSubjectId,
          name: modalForm.name.trim(),
          description: modalForm.description.trim(),
          difficultyLevel: modalForm.difficultyLevel,
          academicYear: modalForm.academicYear,
          semester: modalForm.semester,
          orderIndex: Number(modalForm.orderIndex) || 0,
          prerequisites: modalForm.prerequisites
        });

        if (res && res.success) {
          setIsModalOpen(false);
          setSuccessMsg(`Concept "${modalForm.name}" created successfully.`);
          loadConcepts();
          setTimeout(() => setSuccessMsg(''), 4000);
        } else {
          setModalError(res?.error || 'Failed to create concept.');
        }
      }
    } catch (err) {
      console.error('Save concept error:', err);
      setModalError(err?.response?.data?.error || err.message || 'Operation failed. Please check inputs.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (concept) => {
    setConceptToDelete(concept);
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!conceptToDelete) return;
    setDeleteLoading(true);
    setDeleteError('');

    try {
      const res = await teacherApi.deleteKnowledgeGapConcept(conceptToDelete._id);
      if (res && res.success) {
        setIsDeleteModalOpen(false);
        setSuccessMsg(`Concept "${conceptToDelete.name}" deleted successfully.`);
        setConceptToDelete(null);
        loadConcepts();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setDeleteError(res?.error || 'Failed to delete concept.');
      }
    } catch (err) {
      console.error('Delete concept error:', err);
      setDeleteError(err?.response?.data?.error || err.message || 'Unable to delete concept.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Toggle prerequisite selection in modal form
  const handleTogglePrerequisite = (conceptId) => {
    setModalForm(prev => {
      const exists = prev.prerequisites.includes(conceptId);
      if (exists) {
        return { ...prev, prerequisites: prev.prerequisites.filter(id => id !== conceptId) };
      } else {
        return { ...prev, prerequisites: [...prev.prerequisites, conceptId] };
      }
    });
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto pb-12 transition-colors duration-200">
      
      {/* 1. Page Header Description & Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
          {activeStage === 'stage1'
            ? 'Define and organize course concepts and their prerequisite learning sequences to build the foundation for future student knowledge-gap diagnosis.'
            : activeStage === 'stage2'
            ? 'Map assessment questions and student responses to subject concepts, establishing the empirical foundation for knowledge-gap diagnosis.'
            : 'Synthesize assessment question scores and prerequisite sequences to diagnose student-level knowledge gaps with traceable evidence.'}
        </p>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          {activeStage === 'stage1' ? (
            <button
              onClick={handleOpenCreateModal}
              disabled={!selectedSubjectId}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>Add Concept</span>
            </button>
          ) : activeStage === 'stage2' ? (
            <button
              onClick={() => setActiveStage('stage1')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>Manage Concepts</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveStage('stage2')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              <span>Assessment Evidence</span>
            </button>
          )}
        </div>
      </div>

      {/* Stage Navigation Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <button
          onClick={() => setActiveStage('stage1')}
          className={`py-3 px-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeStage === 'stage1'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span className="truncate">1. Concepts & Prereqs</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeStage === 'stage1' ? 'bg-emerald-700/60 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            {concepts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveStage('stage2')}
          className={`py-3 px-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeStage === 'stage2'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <Target className="w-4 h-4 shrink-0" />
          <span className="truncate">2. Question Mapping</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeStage === 'stage2' ? 'bg-emerald-700/60 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            Evidence
          </span>
        </button>

        <button
          onClick={() => setActiveStage('stage3')}
          className={`py-3 px-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeStage === 'stage3'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4 shrink-0" />
          <span className="truncate">3. Gap Diagnosis</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeStage === 'stage3' ? 'bg-emerald-700/60 text-white' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
          }`}>
            Diagnosis
          </span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Scope Filters Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Academic Scope & Course Filters
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {filteredSubjects.length} {filteredSubjects.length === 1 ? 'Subject Available' : 'Subjects Available'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. All Years */}
          <div>
            <TeacherDropdown
              id="filter-kg-year"
              label="Academic Year"
              icon={Calendar}
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              options={yearOptions}
              placeholder="All Years"
              disabled={filtersLoading}
            />
          </div>

          {/* 2. All Departments */}
          <div>
            <TeacherDropdown
              id="filter-kg-dept"
              label="Department"
              icon={Building2}
              value={selectedDept}
              onChange={(e) => handleDeptChange(e.target.value)}
              options={departmentOptions}
              placeholder="All Departments"
              disabled={filtersLoading}
            />
          </div>

          {/* 3. All Sections */}
          <div>
            <TeacherDropdown
              id="filter-kg-sec"
              label="Section"
              icon={Award}
              value={selectedSection}
              onChange={(e) => handleSectionChange(e.target.value)}
              options={sectionOptions}
              placeholder="All Sections"
              disabled={filtersLoading}
            />
          </div>

          {/* 4. Assigned Subject */}
          <div>
            <TeacherDropdown
              id="filter-kg-subject"
              label="Target Subject *"
              icon={BookOpen}
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              options={subjectOptions}
              placeholder={subjectOptions.length === 0 ? "No assigned subjects" : "Select Subject..."}
              disabled={filtersLoading || subjectOptions.length === 0}
            />
          </div>
        </div>

        {/* Active Subject Context Bar */}
        {subjectDetails && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {subjectDetails.name}
              </span>
              <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {subjectDetails.code}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500 dark:text-slate-400">
                {subjectDetails.department}
              </span>
              {subjectDetails.semester && (
                <>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Semester {subjectDetails.semester}
                  </span>
                </>
              )}
            </div>

            {/* Quick Metrics Strip */}
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-slate-500 dark:text-slate-400">
                Total Concepts: <strong className="text-emerald-600 dark:text-emerald-400">{stats.totalConcepts}</strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Foundational: <strong className="text-slate-700 dark:text-slate-200">{stats.rootConceptsCount}</strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Dependencies: <strong className="text-slate-700 dark:text-slate-200">{stats.totalPrerequisiteLinks}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Main Workspace: Stage 1 or Stage 2 */}
      {activeStage === 'stage1' ? (
        <div className="space-y-4">
          {/* Controls Bar: Search & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts or topics..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Toggle Tabs */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold self-start sm:self-auto shadow-2xs">
            <button
              onClick={() => setActiveView('split')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeView === 'split'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Split View</span>
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeView === 'list'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Concept List ({displayedConcepts.length})</span>
            </button>
            <button
              onClick={() => setActiveView('map')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeView === 'map'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Prerequisite Map</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-slate-200 dark:border-slate-800 text-center shadow-xs">
            <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Loading concepts and prerequisite relationships...
            </p>
          </div>
        )}

        {/* Empty State: No Subject Selected */}
        {!loading && !selectedSubjectId && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto shadow-xs space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Select an Assigned Subject
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Please choose a subject from the scope filters above to view and manage its curriculum concepts and prerequisite structures.
            </p>
          </div>
        )}

        {/* Empty State: Subject has 0 Concepts */}
        {!loading && selectedSubjectId && concepts.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 sm:p-14 border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto shadow-xs space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                No Concepts Added Yet for {subjectDetails?.name || 'This Course'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                Start by adding foundational topics or core syllabus units for this subject. You can then map prerequisite dependencies between them to visualize the learning progression.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Subject Concept</span>
              </button>
            </div>
          </div>
        )}

        {/* Content View: When concepts exist */}
        {!loading && concepts.length > 0 && (
          <div className="space-y-6">
            
            {/* PREREQUISITE MAP SECTION (rendered when activeView is 'map' or 'split') */}
            {(activeView === 'map' || activeView === 'split') && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <Network className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        Prerequisite Dependency Map
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Directed dependency graph showing foundational prerequisite concepts flowing into advanced topics.
                      </p>
                    </div>
                  </div>

                  {/* Interactive Diagram Legend */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span>Foundational</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span>Requires Prereq</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span>Unlocks / Enables</span>
                    </span>
                  </div>
                </div>

                {/* SVG Visual Graph Canvas */}
                <div className="p-4 sm:p-6 overflow-x-auto min-h-[380px] bg-slate-50/50 dark:bg-slate-950/40">
                  <div 
                    className="relative"
                    style={{
                      width: Math.max(860, (maxLevel + 1) * 280 + 80),
                      minHeight: Math.max(340, graphNodes.length * 75)
                    }}
                  >
                    {/* SVG Connecting Arrows */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ zIndex: 1 }}
                    >
                      <defs>
                        <marker
                          id="arrowhead-default"
                          markerWidth="8"
                          markerHeight="6"
                          refX="7"
                          refY="3"
                          orient="auto"
                        >
                          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                        </marker>
                        <marker
                          id="arrowhead-highlight"
                          markerWidth="8"
                          markerHeight="6"
                          refX="7"
                          refY="3"
                          orient="auto"
                        >
                          <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                        </marker>
                      </defs>

                      {graphEdges.map((edge) => {
                        const isHighlighted = selectedConceptForHighlight === edge.sourceId || selectedConceptForHighlight === edge.targetId;
                        
                        // Cubic bezier curve path
                        const dx = Math.max(40, (edge.targetX - edge.sourceX) / 2);
                        const pathD = `M ${edge.sourceX} ${edge.sourceY} C ${edge.sourceX + dx} ${edge.sourceY}, ${edge.targetX - dx} ${edge.targetY}, ${edge.targetX} ${edge.targetY}`;

                        return (
                          <g key={edge.id}>
                            <path
                              d={pathD}
                              fill="none"
                              stroke={isHighlighted ? '#10b981' : '#cbd5e1'}
                              strokeWidth={isHighlighted ? 2.5 : 1.5}
                              strokeDasharray={isHighlighted ? 'none' : '4 2'}
                              markerEnd={isHighlighted ? 'url(#arrowhead-highlight)' : 'url(#arrowhead-default)'}
                              className="transition-all duration-200"
                            />
                          </g>
                        );
                      })}
                    </svg>

                    {/* Nodes (Concepts) */}
                    <div className="relative" style={{ zIndex: 2 }}>
                      {graphNodes.map((node) => {
                        const isSelected = selectedConceptForHighlight === node._id.toString();
                        const isPrereqOfSelected = selectedConceptForHighlight && (node.dependents || []).some(d => d._id.toString() === selectedConceptForHighlight);
                        const isDependentOfSelected = selectedConceptForHighlight && (node.prerequisites || []).some(p => (p._id || p).toString() === selectedConceptForHighlight);

                        let cardBorderClass = 'border-slate-200 dark:border-slate-800';
                        if (isSelected) {
                          cardBorderClass = 'ring-2 ring-emerald-500 border-emerald-500 shadow-md';
                        } else if (isPrereqOfSelected) {
                          cardBorderClass = 'ring-2 ring-amber-400 border-amber-400';
                        } else if (isDependentOfSelected) {
                          cardBorderClass = 'ring-2 ring-emerald-400 border-emerald-400';
                        }

                        const diffMeta = DIFFICULTY_LEVELS.find(d => d.value === node.difficultyLevel) || DIFFICULTY_LEVELS[2];

                        return (
                          <div
                            key={node._id}
                            onClick={() => setSelectedConceptForHighlight(prev => prev === node._id.toString() ? null : node._id.toString())}
                            style={{
                              position: 'absolute',
                              left: `${node.x}px`,
                              top: `${node.y}px`,
                              width: `${node.width}px`,
                              height: `${node.height}px`
                            }}
                            className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border ${cardBorderClass} shadow-2xs hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between select-none group`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${diffMeta.color}`}>
                                  {node.difficultyLevel}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  L{node.level}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                {node.name}
                              </h4>
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-800 text-slate-400">
                              <span title={`${(node.prerequisites || []).length} Prerequisites required`}>
                                Prereq: <strong className="text-slate-700 dark:text-slate-300">{(node.prerequisites || []).length}</strong>
                              </span>
                              <span title={`Unlocks ${(node.dependents || []).length} following concepts`}>
                                Unlocks: <strong className="text-emerald-600 dark:text-emerald-400">{(node.dependents || []).length}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Diagram Helper Footer */}
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <span>Click any concept in the diagram to inspect its upstream prerequisites and unlocked downstream topics.</span>
                  </div>
                  {selectedConceptForHighlight && (
                    <button
                      onClick={() => setSelectedConceptForHighlight(null)}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Clear Selection Highlight
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* CONCEPTS LIST / DIRECTORY (rendered when activeView is 'list' or 'split') */}
            {(activeView === 'list' || activeView === 'split') && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      Curriculum Subject Concepts ({displayedConcepts.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Organized syllabus units and topics with designated prerequisite competencies.
                    </p>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Subject: {subjectDetails?.code || '—'}
                  </span>
                </div>

                {/* Table View */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-3.5">#</th>
                        <th className="px-5 py-3.5">Concept Name</th>
                        <th className="px-5 py-3.5">Difficulty</th>
                        <th className="px-5 py-3.5">Prerequisites (Must Know Before)</th>
                        <th className="px-5 py-3.5">Unlocks (Next Topics)</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                      {displayedConcepts.map((item, index) => {
                        const diffMeta = DIFFICULTY_LEVELS.find(d => d.value === item.difficultyLevel) || DIFFICULTY_LEVELS[2];
                        const prereqs = item.prerequisites || [];
                        const dependents = item.dependents || [];

                        return (
                          <tr key={item._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-5 py-4 text-xs font-mono text-slate-400">
                              {index + 1}
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                {item.name}
                              </div>
                              {item.description ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 max-w-sm">
                                  {item.description}
                                </p>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">No description provided</span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${diffMeta.color}`}>
                                {item.difficultyLevel || 'Intermediate'}
                              </span>
                            </td>

                            <td className="px-5 py-4 max-w-xs">
                              {prereqs.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {prereqs.map(p => (
                                    <span
                                      key={p._id || p}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60"
                                    >
                                      <span>{p.name || 'Prerequisite'}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Foundational (None)</span>
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 max-w-xs">
                              {dependents.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {dependents.map(d => (
                                    <span
                                      key={d._id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60"
                                    >
                                      <span>{d.name}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Terminal / Advanced
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEditModal(item)}
                                  className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Concept"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenDeleteModal(item)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Concept"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      ) : activeStage === 'stage2' ? (
        <TeacherAssessmentMapping
          selectedSubjectId={selectedSubjectId}
          subjectDetails={subjectDetails}
          selectedSection={selectedSection}
          selectedYear={underlyingAcademicYear}
          selectedSemester={selectedSemester}
          filterData={filterData}
          concepts={concepts}
          onSwitchToStage1={() => setActiveStage('stage1')}
        />
      ) : (
        <TeacherKnowledgeGapDiagnosis
          selectedSubjectId={selectedSubjectId}
          subjectDetails={subjectDetails}
          selectedSection={selectedSection}
          selectedYear={underlyingAcademicYear}
          selectedSemester={selectedSemester}
          filterData={filterData}
          onSwitchToStage1={() => setActiveStage('stage1')}
          onSwitchToStage2={() => setActiveStage('stage2')}
        />
      )}

      {/* 4. Concept Create & Edit Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !modalSubmitting) {
              setIsModalOpen(false);
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingConcept ? 'Edit Subject Concept' : 'Add New Subject Concept'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Subject: <strong className="text-slate-700 dark:text-slate-300">{subjectDetails?.name}</strong> ({subjectDetails?.code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !modalSubmitting && setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Error Alert (e.g., circular dependency or duplicate name) */}
            {modalError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div>
                  <p className="font-semibold">Unable to Save Concept</p>
                  <p className="mt-0.5 leading-relaxed">{modalError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveConcept} className="space-y-4">
              {/* Concept Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Concept / Topic Name *
                </label>
                <input
                  type="text"
                  required
                  value={modalForm.name}
                  onChange={(e) => setModalForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Variables & Primitive Data Types"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Description / Syllabus Focus (Optional)
                </label>
                <textarea
                  rows={2}
                  value={modalForm.description}
                  onChange={(e) => setModalForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Summary of core topics covered in this concept unit..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Difficulty & Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Difficulty Level
                  </label>
                  <select
                    value={modalForm.difficultyLevel}
                    onChange={(e) => setModalForm(prev => ({ ...prev, difficultyLevel: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {DIFFICULTY_LEVELS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Curriculum Sequence Index
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={modalForm.orderIndex}
                    onChange={(e) => setModalForm(prev => ({ ...prev, orderIndex: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* PREREQUISITE SELECTOR */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Prerequisite Concepts (Must Be Understood First)
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {modalForm.prerequisites.length} Selected
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                  Select other concepts within this course that students should understand before learning this concept. Circular dependencies are strictly prevented on the backend.
                </p>

                {/* Available Prerequisites Checklist */}
                {concepts.filter(c => !editingConcept || c._id !== editingConcept._id).length > 0 ? (
                  <div className="max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                    {concepts
                      .filter(c => !editingConcept || c._id !== editingConcept._id)
                      .map(c => {
                        const isChecked = modalForm.prerequisites.includes(c._id);
                        return (
                          <label
                            key={c._id}
                            className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePrerequisite(c._id)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="truncate">{c.name}</span>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                              {c.difficultyLevel}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800">
                    No other concepts exist for this subject yet. This will be created as a foundational concept.
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="inline-flex items-center gap-2 px-4.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingConcept ? 'Save Concept Changes' : 'Create Concept'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Safe Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deleteLoading) {
            setIsDeleteModalOpen(false);
            setConceptToDelete(null);
            setDeleteError('');
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Subject Concept?"
        recordName={conceptToDelete?.name || ''}
        loading={deleteLoading}
        error={deleteError}
        message="Are you sure you want to delete this concept from the subject curriculum? If other concepts depend on it as a prerequisite, deletion will be safely blocked."
        confirmDisabled={Boolean(conceptToDelete?.dependents && conceptToDelete.dependents.length > 0)}
      >
        {conceptToDelete?.dependents && conceptToDelete.dependents.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs space-y-1.5 mt-3">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Cannot Delete: Active Prerequisite Dependency</span>
            </div>
            <p className="leading-relaxed">
              This concept is marked as a prerequisite by {conceptToDelete.dependents.length} concept(s):
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {conceptToDelete.dependents.map(d => (
                <span key={d._id} className="px-2 py-0.5 rounded-md font-medium bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                  {d.name}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-1">
              Please edit the dependent concepts and remove this prerequisite link before deleting.
            </p>
          </div>
        )}
      </DeleteConfirmationModal>

    </div>
  );
}
