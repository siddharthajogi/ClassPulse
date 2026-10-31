import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { teacherApi } from '../api';
import TeacherDropdown, { cleanSectionName, formatSectionLabel } from './TeacherDropdown';
import { usePageRefresh } from '../context/RefreshContext';
import {
  Users,
  Search,
  X,
  RefreshCw,
  AlertCircle,
  Calendar,
  Building2,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserCheck,
  BookOpen,
  Activity,
  GraduationCap,
  CalendarCheck,
  FileText
} from 'lucide-react';

// Canonical order of academic years of study matching ClassPulse curriculum
const CANONICAL_YEAR_ORDER = [
  'First Year',
  'Second Year',
  'Third Year',
  'Fourth Year',
];

export default function TeacherStudents({ currentUser }) {
  // Master data
  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState('');

  // Three Dependent Dynamic Academic Filters:
  // 1. Academic Year: available year | 'all'
  // 2. Department: available department | 'all'
  // 3. Section: class._id | 'all'
  const [yearFilter, setYearFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');

  // Students list from backend
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState('');

  // Search & Sorting & Fixed Sensible Pagination (15 per page)
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  // View Profile Modal State (Read-Only)
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Load teacher's assigned classes on mount
  const loadTeacherClasses = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoadingInitial(true);
    setPageError('');

    try {
      const res = await teacherApi.getMyClasses();
      if (res && res.success) {
        setClasses(res.classes || []);
        setDepartments(res.departments || []);
      } else {
        setPageError(res?.error || 'Failed to load assigned curriculum data.');
      }
    } catch (err) {
      console.error('Failed to load teacher classes:', err);
      setPageError(
        err.response?.data?.error ||
        err.message ||
        'Unable to load classes. Please verify your connection.'
      );
    } finally {
      setLoadingInitial(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTeacherClasses();
  }, [loadTeacherClasses]);

  // 2. Fetch enrolled students from backend whenever filters change
  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    setStudentsError('');
    setCurrentPage(1);

    try {
      const params = {};
      if (yearFilter !== 'all') params.yearOfStudy = yearFilter;
      if (departmentFilter !== 'all') params.department = departmentFilter;
      if (sectionFilter !== 'all') {
        params.section = cleanSectionName(sectionFilter);
        const selectedSec = availableSections.find(s => s.value === sectionFilter || s.sectionCode === cleanSectionName(sectionFilter));
        if (selectedSec && selectedSec.classIds && selectedSec.classIds.length > 0) {
          params.classId = selectedSec.classIds.join(',');
        } else {
          params.classId = sectionFilter;
        }
      }

      const res = await teacherApi.getStudents(params);
      if (res && res.success) {
        setStudents(res.students || []);
      } else {
        setStudentsError(res?.error || 'Failed to load students directory.');
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);
      setStudentsError(
        err.response?.data?.error ||
        err.message ||
        'Unable to fetch students for the selected criteria.'
      );
    } finally {
      setLoadingStudents(false);
    }
  }, [yearFilter, departmentFilter, sectionFilter]);

  useEffect(() => {
    if (!loadingInitial) {
      fetchStudents();
    }
  }, [loadingInitial, fetchStudents]);

  // Register with global header refresh button
  usePageRefresh(async () => {
    await Promise.all([fetchStudents(), loadTeacherClasses(true)]);
  }, [fetchStudents, loadTeacherClasses]);

  // Filter assigned classes to only those containing enrolled students assigned to this teacher
  const classesWithStudents = useMemo(() => {
    const withCount = classes.filter(c => (c.studentCount || 0) > 0);
    return withCount.length > 0 ? withCount : classes;
  }, [classes]);

  // Clean section label helper (e.g. "Section A", "Section B", "Section C")
  // Uses shared formatSectionLabel to guarantee clean labels without redundant department or year names
  const formatCleanSectionLabel = (sec) => {
    return formatSectionLabel(sec);
  };

  // 1. Dynamic Academic Year Options: only years represented by assigned students
  const availableYears = useMemo(() => {
    const yearsSet = new Set(classesWithStudents.map(c => c.yearOfStudy).filter(Boolean));
    return CANONICAL_YEAR_ORDER.filter(y => yearsSet.has(y));
  }, [classesWithStudents]);

  const yearDropdownOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Years' },
      ...availableYears.map(y => ({ value: y, label: y }))
    ];
  }, [availableYears]);

  // 2. Dynamic Department Options: scoped to selected Academic Year
  const classesForYear = useMemo(() => {
    if (yearFilter === 'all') return classesWithStudents;
    return classesWithStudents.filter(c => c.yearOfStudy === yearFilter);
  }, [classesWithStudents, yearFilter]);

  const availableDepartments = useMemo(() => {
    const deptsSet = new Set(classesForYear.map(c => c.department).filter(Boolean));
    return Array.from(deptsSet).sort();
  }, [classesForYear]);

  const departmentDropdownOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Departments' },
      ...availableDepartments.map(d => ({ value: d, label: d }))
    ];
  }, [availableDepartments]);

  // 3. Dynamic Section Options: scoped to selected Year & Department with clean labels
  const classesForDept = useMemo(() => {
    if (departmentFilter === 'all') return classesForYear;
    return classesForYear.filter(c => c.department?.toLowerCase() === departmentFilter.toLowerCase());
  }, [classesForYear, departmentFilter]);

  const availableSections = useMemo(() => {
    const sectionMap = new Map();

    classesForDept.forEach(c => {
      const cleanCode = cleanSectionName(c.section);
      if (!cleanCode) return;
      if (!sectionMap.has(cleanCode)) {
        sectionMap.set(cleanCode, {
          value: cleanCode,
          sectionCode: cleanCode,
          label: formatCleanSectionLabel(c.section),
          classIds: [],
          classes: []
        });
      }
      const item = sectionMap.get(cleanCode);
      item.classIds.push(String(c._id));
      item.classes.push(c);
    });

    const list = Array.from(sectionMap.values());
    list.sort((a, b) => a.sectionCode.localeCompare(b.sectionCode, undefined, { numeric: true, sensitivity: 'base' }));
    return list;
  }, [classesForDept]);

  const sectionDropdownOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Sections' },
      ...availableSections.map(s => ({ value: s.value, label: s.label }))
    ];
  }, [availableSections]);

  // Cascading Filter Updates: Update Year and cascade to Department and Section
  const handleYearChange = (newYear) => {
    setYearFilter(newYear);

    // Compute valid departments for newYear
    const poolForYear = newYear === 'all' ? classesWithStudents : classesWithStudents.filter(c => c.yearOfStudy === newYear);
    const deptsSet = new Set(poolForYear.map(c => c.department).filter(Boolean));
    const validDepts = Array.from(deptsSet);

    // Clear dependent department selection only if it becomes invalid under newYear
    let nextDept = departmentFilter;
    if (departmentFilter !== 'all' && !validDepts.some(d => d.toLowerCase() === departmentFilter.toLowerCase())) {
      nextDept = 'all';
      setDepartmentFilter('all');
    }

    // Compute valid sections for newYear & nextDept
    const poolForDept = nextDept === 'all' ? poolForYear : poolForYear.filter(c => c.department?.toLowerCase() === nextDept.toLowerCase());
    const validSecCodes = Array.from(new Set(poolForDept.map(c => cleanSectionName(c.section)).filter(Boolean)));

    // Clear dependent section selection only if it becomes invalid under newYear & nextDept
    if (sectionFilter !== 'all' && !validSecCodes.includes(cleanSectionName(sectionFilter))) {
      setSectionFilter('all');
    }
  };

  // Cascading Filter Updates: Update Department and cascade to Section
  const handleDepartmentChange = (newDept) => {
    setDepartmentFilter(newDept);

    // Compute valid sections for current yearFilter & newDept
    const poolForYear = yearFilter === 'all' ? classesWithStudents : classesWithStudents.filter(c => c.yearOfStudy === yearFilter);
    const poolForDept = newDept === 'all' ? poolForYear : poolForYear.filter(c => c.department?.toLowerCase() === newDept.toLowerCase());
    const validSecCodes = Array.from(new Set(poolForDept.map(c => cleanSectionName(c.section)).filter(Boolean)));

    // Clear dependent section selection only if it becomes invalid under newDept
    if (sectionFilter !== 'all' && !validSecCodes.includes(cleanSectionName(sectionFilter))) {
      setSectionFilter('all');
    }
  };

  const handleSectionChange = (newSec) => {
    setSectionFilter(newSec);
  };

  // Client-side search and sorting on returned teacher-authorized students
  const processedStudents = useMemo(() => {
    let result = [...students];

    // Search by student name or student ID
    if (searchTerm.trim()) {
      const query = searchTerm.trim().toLowerCase();
      result = result.filter(s => {
        const name = (s.name || '').toLowerCase();
        const studentId = (s.studentId || '').toLowerCase();
        return name.includes(query) || studentId.includes(query);
      });
    }

    // Sort by selected column
    result.sort((a, b) => {
      let aVal = '';
      let bVal = '';

      if (sortField === 'name') {
        aVal = a.name || '';
        bVal = b.name || '';
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (sortField === 'studentId') {
        aVal = a.studentId || '';
        bVal = b.studentId || '';
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (sortField === 'attendance') {
        const aNum = typeof a.attendancePercentage === 'number' ? a.attendancePercentage : -1;
        const bNum = typeof b.attendancePercentage === 'number' ? b.attendancePercentage : -1;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      if (sortField === 'riskScore') {
        const aNum = typeof a.riskScore === 'number' ? a.riskScore : -1;
        const bNum = typeof b.riskScore === 'number' ? b.riskScore : -1;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      return 0;
    });

    return result;
  }, [students, searchTerm, sortField, sortDirection]);

  // Fixed sensible pagination (15 per page)
  const totalPages = Math.ceil(processedStudents.length / PAGE_SIZE) || 1;
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return processedStudents.slice(startIndex, startIndex + PAGE_SIZE);
  }, [processedStudents, currentPage]);

  // Clean student name helper removing artificial verification names
  const getCleanStudentName = (student) => {
    const name = student?.name || student?.personalInfo?.name || '—';
    if (/verification student/i.test(name)) {
      return name.replace(/verification student/i, 'Student').trim() || 'Student';
    }
    return name;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Open View Profile Modal (Read-Only)
  const handleOpenProfileModal = async (studentId) => {
    setSelectedStudentId(studentId);
    setIsModalOpen(true);
    setLoadingDetails(true);
    setDetailsError('');

    try {
      const res = await teacherApi.getStudentDetails(studentId);
      if (res && res.success && res.student) {
        setStudentDetails(res.student);
      } else {
        setDetailsError(res?.error || 'Failed to fetch student details.');
      }
    } catch (err) {
      console.error('Failed to load student details:', err);
      setDetailsError(err.response?.data?.error || err.message || 'Unable to load student profile.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStudentId(null);
    setStudentDetails(null);
    setDetailsError('');
  };

  // Initial Loading Skeleton
  if (loadingInitial) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto pb-12 pt-1" data-testid="teacher-students-loading">
        <div className="flex flex-col sm:flex-row gap-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex-1 bg-white dark:bg-slate-900 rounded-2xl h-12 border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl h-72 border border-slate-200 dark:border-slate-800 animate-pulse" />
      </div>
    );
  }

  // Error state for classes
  if (pageError && classes.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-8 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-8 rounded-2xl shadow-sm text-center">
        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Unable to Load Students
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
          {pageError}
        </p>
        <button
          onClick={() => loadTeacherClasses(false)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto pb-12 transition-colors duration-200" data-testid="teacher-students-page">
      {/* 1. Dynamic Academic Filters & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search students by name or Student ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-9 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
              data-testid="student-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Three Dependent Dropdowns in exact order: 1. Academic Year -> 2. Department -> 3. Section */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter 1: Academic Year */}
            <TeacherDropdown
              id="teacher-students-year-filter"
              data-testid="teacher-students-year-filter"
              value={yearFilter}
              onChange={(e) => handleYearChange(e.target.value)}
              options={yearDropdownOptions}
              placeholder="All Years"
              title="Filter by Academic Year"
              icon={Calendar}
              alwaysShowDefaultOption={true}
              className="w-full sm:w-auto min-w-[150px]"
              menuClassName="w-full sm:w-[190px]"
            />

            {/* Filter 2: Department */}
            <TeacherDropdown
              id="teacher-students-dept-filter"
              data-testid="teacher-students-dept-filter"
              value={departmentFilter}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              options={departmentDropdownOptions}
              placeholder="All Departments"
              title="Filter by Department"
              icon={Building2}
              alwaysShowDefaultOption={true}
              className="w-full sm:w-auto min-w-[185px]"
              menuClassName="w-full sm:w-[270px]"
            />

            {/* Filter 3: Section (Clean labels: Section A, Section B, Section C) */}
            <TeacherDropdown
              id="teacher-students-section-filter"
              data-testid="teacher-students-section-filter"
              value={sectionFilter}
              onChange={(e) => handleSectionChange(e.target.value)}
              options={sectionDropdownOptions}
              placeholder="All Sections"
              title="Filter by Section"
              icon={Layers}
              alwaysShowDefaultOption={true}
              className="w-full sm:w-auto min-w-[165px]"
              menuClassName="w-full sm:w-[200px]"
            />
          </div>
        </div>
      </div>

      {/* 4. Student Directory Table */}
      {loadingStudents ? (
        <div className="py-20 text-center text-slate-500 dark:text-slate-400 space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs sm:text-sm font-medium">Loading assigned students...</p>
        </div>
      ) : studentsError ? (
        <div className="p-8 text-center bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/60 my-4">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">
            Failed to Load Students
          </h4>
          <p className="text-xs text-rose-600 dark:text-rose-400 max-w-md mx-auto mt-1 mb-4">
            {studentsError}
          </p>
          <button
            type="button"
            onClick={fetchStudents}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : students.length === 0 ? (
        <div className="p-10 sm:p-14 text-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900" data-testid="students-empty-state">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Users className="w-7 h-7" />
          </div>
          <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
            No Students Found
          </h4>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1.5 leading-relaxed">
            There are currently no students enrolled in sections matching your active filter criteria. When students are enrolled in your assigned sections, they will automatically appear here.
          </p>
        </div>
      ) : processedStudents.length === 0 ? (
        <div className="p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
            No Matching Students
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            No students match your query "{searchTerm}".
          </p>
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Clear Search Query
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Directory Table — Exactly the 4 Required Columns + Profile Action */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap" data-testid="teacher-students-table">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {/* Column 1: Student Name */}
                  <th
                    className="px-5 py-3.5 font-semibold cursor-pointer select-none hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Student Name</span>
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Column 2: Student ID */}
                  <th
                    className="px-5 py-3.5 font-semibold cursor-pointer select-none hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    onClick={() => handleSort('studentId')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Student ID</span>
                      {sortField === 'studentId' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Column 3: Attendance Percentage */}
                  <th
                    className="px-5 py-3.5 font-semibold cursor-pointer select-none hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    onClick={() => handleSort('attendance')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Attendance Percentage</span>
                      {sortField === 'attendance' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Column 4: Risk Score */}
                  <th
                    className="px-5 py-3.5 font-semibold cursor-pointer select-none hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    onClick={() => handleSort('riskScore')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Risk Score</span>
                      {sortField === 'riskScore' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Action Column: View Profile */}
                  <th className="px-5 py-3.5 font-semibold text-right">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedStudents.map((student) => {
                  const hasAttendance = typeof student.attendancePercentage === 'number' && !isNaN(student.attendancePercentage);
                  const hasRisk = typeof student.riskScore === 'number' && !isNaN(student.riskScore);

                  return (
                    <tr
                      key={student._id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      data-testid={`student-row-${student.studentId}`}
                    >
                      {/* 1. Student Name */}
                      <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0">
                            {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <span className="font-semibold">{getCleanStudentName(student)}</span>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                              {student.department} · {student.yearOfStudy} · Sec {student.section}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Student ID */}
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {student.studentId || '—'}
                      </td>

                      {/* 3. Attendance Percentage: Formula = (Attended / Held) * 100 */}
                      <td className="px-5 py-3.5">
                        {hasAttendance ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                student.attendancePercentage >= 75
                                  ? 'bg-emerald-500'
                                  : student.attendancePercentage >= 65
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                            />
                            <span
                              className={`font-bold ${
                                student.attendancePercentage >= 75
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : student.attendancePercentage >= 65
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-rose-700 dark:text-rose-400'
                              }`}
                            >
                              {student.attendancePercentage}%
                            </span>
                            {typeof student.classesAttended === 'number' && typeof student.totalClassesHeld === 'number' && student.totalClassesHeld > 0 && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                ({student.classesAttended}/{student.totalClassesHeld})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-medium select-none">—</span>
                        )}
                      </td>

                      {/* 4. Risk Score (0 - 100 with Level) */}
                      <td className="px-5 py-3.5">
                        {hasRisk ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                student.riskLevel === 'high'
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                                  : student.riskLevel === 'medium'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                              }`}
                            >
                              {student.riskLevel ? student.riskLevel.charAt(0).toUpperCase() + student.riskLevel.slice(1) : ''} ({student.riskScore})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-xs font-medium">
                            —
                          </span>
                        )}
                      </td>

                      {/* View Profile Action */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenProfileModal(student._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/50 text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 transition-colors cursor-pointer"
                          data-testid={`view-profile-btn-${student.studentId}`}
                        >
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>View Profile</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page <span className="font-semibold text-slate-800 dark:text-slate-200">{currentPage}</span> of{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPages}</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. View Profile Modal: Read-only student profile, records, and risk analysis with green close styling */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header with Green Close Control */}
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Student Profile
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {studentDetails ? `${studentDetails.name} (${studentDetails.studentId})` : 'Loading profile...'}
                  </p>
                </div>
              </div>

              {/* Close Icon Styled with Teacher Portal Green Theme */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
                title="Close modal"
                data-testid="modal-header-close-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Read-Only Overview & Summaries */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {loadingDetails ? (
                <div className="py-16 text-center space-y-2">
                  <RefreshCw className="w-7 h-7 animate-spin mx-auto text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Loading student details...</p>
                </div>
              ) : detailsError ? (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400">
                  {detailsError}
                </div>
              ) : studentDetails ? (
                <div className="space-y-5">
                  {/* Student Demographic Information Card */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium">Department</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{studentDetails.department || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Year & Section</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{studentDetails.yearOfStudy} · Sec {studentDetails.section}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Course</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{studentDetails.course || 'B.Tech'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Semester</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{studentDetails.semester || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Academic Year</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{studentDetails.academicYear || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Email</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">{studentDetails.email || '—'}</p>
                    </div>
                  </div>

                  {/* Attendance & Performance Summary Metrics Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Attendance Metric Card */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Attendance Summary
                        </span>
                        <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                          <CalendarCheck className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                          {typeof studentDetails.attendancePercentage === 'number' ? `${studentDetails.attendancePercentage}%` : '—'}
                        </span>
                        {typeof studentDetails.classesAttended === 'number' && typeof studentDetails.totalClassesHeld === 'number' && studentDetails.totalClassesHeld > 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            ({studentDetails.classesAttended} / {studentDetails.totalClassesHeld} classes)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        {typeof studentDetails.attendancePercentage === 'number'
                          ? studentDetails.attendancePercentage >= 75
                            ? 'Good Standing (above 75% minimum requirement)'
                            : 'Attendance Warning (below 75% institutional requirement)'
                          : 'No attendance records recorded yet'}
                      </p>
                    </div>

                    {/* Academic Risk Metric Card */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Academic Risk
                        </span>
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          <Activity className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        {typeof studentDetails.riskScore === 'number' ? (
                          <>
                            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                              {studentDetails.riskScore}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-md font-semibold border ${
                                studentDetails.riskLevel === 'high'
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                                  : studentDetails.riskLevel === 'medium'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                              }`}
                            >
                              {studentDetails.riskLevel ? studentDetails.riskLevel.toUpperCase() + ' RISK' : 'LOW RISK'}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                            Insufficient data
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        {typeof studentDetails.assessmentScore === 'number'
                          ? `Assessment Average: ${studentDetails.assessmentScore}%`
                          : 'Calculated from saved attendance and assessment trends'}
                      </p>
                    </div>
                  </div>

                  {/* Explainable Risk Factors */}
                  <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                      <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Explainable Risk Analysis Factors</span>
                    </div>
                    {studentDetails.riskFactors && studentDetails.riskFactors.length > 0 ? (
                      <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc list-inside">
                        {studentDetails.riskFactors.map((factor, idx) => (
                          <li key={idx} className="leading-relaxed">{factor}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        Insufficient data to calculate risk factors. Academic records will populate this analysis.
                      </p>
                    )}
                  </div>

                  {/* Saved Academic & Attendance Records Table (Read-Only) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Saved Academic & Attendance Records</span>
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {studentDetails.records?.length || 0} record{studentDetails.records?.length === 1 ? '' : 's'} found
                      </span>
                    </div>

                    {studentDetails.records && studentDetails.records.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-semibold">
                            <tr>
                              <th className="px-3.5 py-2.5">Subject</th>
                              <th className="px-3.5 py-2.5">Attendance</th>
                              <th className="px-3.5 py-2.5">Assessment Marks</th>
                              <th className="px-3.5 py-2.5">Academic Year</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {studentDetails.records.map((rec) => (
                              <tr key={rec._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                  {rec.subject?.code ? `${rec.subject.code} — ` : ''}{rec.subject?.name || 'Subject'}
                                </td>
                                <td className="px-3.5 py-2.5">
                                  {typeof rec.attendancePercentage === 'number' ? (
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                      {rec.attendancePercentage}%
                                      {typeof rec.classesAttended === 'number' && typeof rec.totalClassesHeld === 'number' && rec.totalClassesHeld > 0 && (
                                        <span className="font-normal text-slate-400 ml-1">
                                          ({rec.classesAttended}/{rec.totalClassesHeld})
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-3.5 py-2.5">
                                  {typeof rec.marksObtained === 'number' && typeof rec.totalMarks === 'number' ? (
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {rec.marksObtained} / {rec.totalMarks}
                                      <span className="font-normal text-slate-400 ml-1">
                                        ({Math.round((rec.marksObtained / rec.totalMarks) * 100)}%)
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-3.5 py-2.5 text-slate-500 dark:text-slate-400">
                                  {rec.academicYear?.year || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 text-center rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        No saved attendance or assessment records found for this student. Records are entered on the Attendance and Academic Records pages.
                      </div>
                    )}
                  </div>

                  {/* Informational Guidance Notice */}
                  <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-xs text-slate-600 dark:text-slate-400">
                    <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      Attendance records are entered and managed on the <span className="font-semibold text-slate-800 dark:text-slate-200">Attendance</span> page. Assessment marks are entered and managed on the <span className="font-semibold text-slate-800 dark:text-slate-200">Academic Records</span> page.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer with Green Theme Close Button */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-xs hover:shadow transition-all duration-150 cursor-pointer"
                data-testid="modal-footer-close-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
