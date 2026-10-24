import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { teacherApi } from '../api';
import TeacherDropdown from './TeacherDropdown';
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

// Academic years of study in canonical order matching ClassPulse curriculum
const ACADEMIC_YEARS = [
  { value: 'all', label: 'All Years' },
  { value: 'First Year', label: 'First Year' },
  { value: 'Second Year', label: 'Second Year' },
  { value: 'Third Year', label: 'Third Year' },
  { value: 'Fourth Year', label: 'Fourth Year' },
];

export default function TeacherStudents({ currentUser }) {
  // Master data
  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState('');

  // Three Dependent Filters:
  // 1. Year: 'all' | 'First Year' | 'Second Year' | 'Third Year' | 'Fourth Year'
  // 2. Department: 'all' | department name
  // 3. Section: 'all' | class._id
  const [yearFilter, setYearFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');

  // Students list from backend
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState('');

  // Search & Sorting & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
      if (sectionFilter !== 'all') params.classId = sectionFilter;

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

  // Dependent Options: Department dropdown options based on Year filter
  const departmentDropdownOptions = useMemo(() => {
    const list = [{ value: 'all', label: 'All Departments' }];

    // Filter assigned classes by yearFilter
    const classesForYear = yearFilter === 'all'
      ? classes
      : classes.filter(c => c.yearOfStudy === yearFilter);

    const seenDeptNames = new Set();
    classesForYear.forEach(c => {
      const deptName = c.department;
      if (deptName && !seenDeptNames.has(deptName)) {
        seenDeptNames.add(deptName);
        const matched = departments.find(d => d.name === deptName || d.code === deptName);
        list.push({
          value: deptName,
          label: matched?.code ? `${matched.code} — ${deptName}` : deptName
        });
      }
    });

    return list;
  }, [classes, yearFilter, departments]);

  // Format short, readable section name (e.g. "Section A", "Section B", "Section C")
  const formatShortSectionName = (sec) => {
    if (!sec) return 'Section';
    const trimmed = String(sec).trim();
    if (/^section\s+/i.test(trimmed)) return trimmed;
    if (/^sec\.?\s+/i.test(trimmed)) {
      return `Section ${trimmed.replace(/^sec\.?\s+/i, '')}`;
    }
    return `Section ${trimmed}`;
  };

  // Dependent Options: Section dropdown options with short, readable names ("Section A", "Section B", "Section C")
  const sectionDropdownOptions = useMemo(() => {
    const list = [{ value: 'all', label: 'All Sections' }];

    let filtered = classes;
    if (yearFilter !== 'all') {
      filtered = filtered.filter(c => c.yearOfStudy === yearFilter);
    }
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(c => c.department?.toLowerCase() === departmentFilter.toLowerCase());
    }

    // Sort sections alphabetically by section letter/name
    const sorted = [...filtered].sort((a, b) => {
      const secA = (a.section || '').replace(/^sec(tion)?\s*/i, '');
      const secB = (b.section || '').replace(/^sec(tion)?\s*/i, '');
      return secA.localeCompare(secB, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Check for collisions across multiple departments if All Departments is active
    const labelCounts = {};
    sorted.forEach(c => {
      const short = formatShortSectionName(c.section);
      labelCounts[short] = (labelCounts[short] || 0) + 1;
    });

    sorted.forEach(c => {
      const baseShort = formatShortSectionName(c.section);
      // When a specific department is chosen, always display cleanly "Section A", "Section B"
      // If "All Departments" has duplicate section names across departments, append dept code for clarity
      const label = (labelCounts[baseShort] > 1 && departmentFilter === 'all')
        ? `${baseShort} (${c.department})`
        : baseShort;

      list.push({
        value: c._id,
        label
      });
    });

    return list;
  }, [classes, yearFilter, departmentFilter]);

  // Dependent Filter Cascading: Update year filter and reset downstream filters if invalid
  const handleYearChange = (newYear) => {
    setYearFilter(newYear);

    // Compute remaining classes for new year
    const classesForNewYear = newYear === 'all'
      ? classes
      : classes.filter(c => c.yearOfStudy === newYear);

    const validDepts = new Set(classesForNewYear.map(c => c.department?.toLowerCase()));
    let nextDept = departmentFilter;
    if (departmentFilter !== 'all' && !validDepts.has(departmentFilter.toLowerCase())) {
      nextDept = 'all';
      setDepartmentFilter('all');
    }

    // Reset section filter if current section is not in new classes
    if (sectionFilter !== 'all') {
      const isSecValid = classesForNewYear.some(c =>
        c._id.toString() === sectionFilter &&
        (nextDept === 'all' || c.department?.toLowerCase() === nextDept.toLowerCase())
      );
      if (!isSecValid) {
        setSectionFilter('all');
      }
    }
  };

  // Dependent Filter Cascading: Update department filter and reset section filter if invalid
  const handleDepartmentChange = (newDept) => {
    setDepartmentFilter(newDept);

    if (sectionFilter !== 'all') {
      const isSecValid = classes.some(c =>
        c._id.toString() === sectionFilter &&
        (yearFilter === 'all' || c.yearOfStudy === yearFilter) &&
        (newDept === 'all' || c.department?.toLowerCase() === newDept.toLowerCase())
      );
      if (!isSecValid) {
        setSectionFilter('all');
      }
    }
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

  // Paginated students slice
  const totalPages = Math.ceil(processedStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedStudents.slice(startIndex, startIndex + pageSize);
  }, [processedStudents, currentPage, pageSize]);

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
    <div className="space-y-4 max-w-7xl mx-auto pb-16 transition-colors duration-200" data-testid="teacher-students-page">
      {/* 2. Sub-Header: Duplicate 'Students' heading removed, content shifted upward */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
            <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Assigned Students Directory</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Directory of enrolled students across your assigned sections with attendance records and academic risk scores.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchStudents();
            loadTeacherClasses(true);
          }}
          disabled={refreshing || loadingStudents}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl text-xs sm:text-sm font-medium transition-all shadow-xs self-start sm:self-auto cursor-pointer disabled:opacity-60 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing || loadingStudents ? 'animate-spin text-emerald-600' : ''}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* 3. Three Dependent Filters & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-4.5 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 space-y-3">
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

          {/* Three Dependent Dropdowns: All Years -> All Departments -> All Sections */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter 1: All Years */}
            <TeacherDropdown
              id="teacher-students-year-filter"
              data-testid="teacher-students-year-filter"
              value={yearFilter}
              onChange={(e) => handleYearChange(e.target.value)}
              options={ACADEMIC_YEARS}
              placeholder="All Years"
              title="Filter by Year"
              icon={Calendar}
              className="w-full sm:w-auto min-w-[150px]"
              menuClassName="w-full sm:w-[190px]"
            />

            {/* Filter 2: All Departments */}
            <TeacherDropdown
              id="teacher-students-dept-filter"
              data-testid="teacher-students-dept-filter"
              value={departmentFilter}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              options={departmentDropdownOptions}
              placeholder="All Departments"
              title="Filter by Department"
              icon={Building2}
              className="w-full sm:w-auto min-w-[185px]"
              menuClassName="w-full sm:w-[270px]"
            />

            {/* Filter 3: All Sections (Short names: Section A, Section B, Section C) */}
            <TeacherDropdown
              id="teacher-students-section-filter"
              data-testid="teacher-students-section-filter"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              options={sectionDropdownOptions}
              placeholder="All Sections"
              title="Filter by Section"
              icon={Layers}
              className="w-full sm:w-auto min-w-[165px]"
              menuClassName="w-full sm:w-[220px]"
            />
          </div>
        </div>

        {/* Active Filter Chips & Clear */}
        {(yearFilter !== 'all' || departmentFilter !== 'all' || sectionFilter !== 'all' || searchTerm) && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs flex-wrap">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Active filters:</span>
            {yearFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                <span>Year: {yearFilter}</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => handleYearChange('all')} />
              </span>
            )}
            {departmentFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                <span>Dept: {departmentFilter}</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => handleDepartmentChange('all')} />
              </span>
            )}
            {sectionFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                <span>Section filter active</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSectionFilter('all')} />
              </span>
            )}
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold">
                <span>Search: "{searchTerm}"</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchTerm('')} />
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setYearFilter('all');
                setDepartmentFilter('all');
                setSectionFilter('all');
                setSearchTerm('');
              }}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold ml-auto cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}
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
        <div className="space-y-3.5">
          {/* Table Header Summary & Rows-per-page */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{paginatedStudents.length}</span> of{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{processedStudents.length}</span> assigned students
            </span>

            <div className="flex items-center gap-2">
              <span>Rows:</span>
              <TeacherDropdown
                id="students-table-pagesize"
                data-testid="students-table-pagesize"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                options={[
                  { value: 10, label: '10 per page' },
                  { value: 25, label: '25 per page' },
                  { value: 50, label: '50 per page' },
                ]}
                placeholder="10 per page"
                title="Rows per page"
                className="w-auto min-w-[120px]"
                menuClassName="w-[130px]"
                align="right"
                autoWidth
              />
            </div>
          </div>

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
                            <span className="font-semibold">{student.name}</span>
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
