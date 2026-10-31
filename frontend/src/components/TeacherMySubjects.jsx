import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  BookOpen, 
  Layers, 
  Building2, 
  Award, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Tag, 
  Clock 
} from 'lucide-react';
import { teacherApi } from '../api';
import TeacherDropdown from './TeacherDropdown';
import { usePageRefresh } from '../context/RefreshContext';

// Helper to format string fields safely with fallback to '—'
const formatField = (val) => {
  if (val === null || val === undefined) return '—';
  const str = String(val).trim();
  return str.length > 0 && str !== '—' ? str : '—';
};

// Helper to format subject credits (e.g., 3 -> "3 Credits", 1 -> "1 Credit", or "—")
const formatCredits = (val) => {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '—') return '—';
    if (trimmed.toLowerCase().includes('credit')) return trimmed;
    const num = Number(trimmed);
    if (!isNaN(num)) {
      return `${num} ${num === 1 ? 'Credit' : 'Credits'}`;
    }
    return trimmed;
  }
  if (typeof val === 'number' && !isNaN(val)) {
    return `${val} ${val === 1 ? 'Credit' : 'Credits'}`;
  }
  return '—';
};

// Canonical teaching year order and normalization helper
const CANONICAL_YEAR_ORDER = [
  'First Year',
  'Second Year',
  'Third Year',
  'Fourth Year'
];

const getCanonicalYearLevel = (val) => {
  if (!val || typeof val !== 'string') return null;
  const lower = val.trim().toLowerCase();
  if (lower.includes('1st') || lower.includes('first') || lower === '1' || lower === 'year 1') return 'First Year';
  if (lower.includes('2nd') || lower.includes('second') || lower === '2' || lower === 'year 2') return 'Second Year';
  if (lower.includes('3rd') || lower.includes('third') || lower === '3' || lower === 'year 3') return 'Third Year';
  if (lower.includes('4th') || lower.includes('fourth') || lower === '4' || lower === 'year 4') return 'Fourth Year';
  return null;
};

// Helper to check if a subject matches the selected teaching year level
const subjectMatchesTeachingYear = (item, targetYear) => {
  if (!targetYear || targetYear === 'ALL') return true;

  // Direct year of study on subject
  if (getCanonicalYearLevel(item.yearOfStudy) === targetYear) {
    return true;
  }
  if (item.yearOfStudy && item.yearOfStudy.trim().toLowerCase() === targetYear.toLowerCase()) {
    return true;
  }

  // Section details year level
  if (Array.isArray(item.sectionDetails)) {
    return item.sectionDetails.some((sd) => {
      return getCanonicalYearLevel(sd.yearOfStudy) === targetYear ||
             (sd.yearOfStudy && sd.yearOfStudy.trim().toLowerCase() === targetYear.toLowerCase());
    });
  }

  return false;
};

export default function TeacherMySubjects({ currentUser }) {
  const [subjects, setSubjects] = useState([]);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeachingYear, setSelectedTeachingYear] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');

  const fetchSubjects = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await teacherApi.getMySubjects();
      if (response && response.success) {
        setSubjects(response.subjects || []);
        setContext(response.context || null);
      } else {
        setError(response?.error || 'Failed to load assigned subjects.');
      }
    } catch (err) {
      console.error('Fetch My Subjects Error:', err);
      setError(
        err?.response?.data?.error || 
        err.message || 
        'Unable to connect to subjects service. Please check your connection.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // Register with global header refresh button
  usePageRefresh(() => fetchSubjects(true), [fetchSubjects]);

  // Extract dynamically available Teaching Year levels from actual assignments
  const availableTeachingYears = useMemo(() => {
    const yearsSet = new Set();
    subjects.forEach((s) => {
      const yr = getCanonicalYearLevel(s.yearOfStudy);
      if (yr) {
        yearsSet.add(yr);
      } else if (s.yearOfStudy && s.yearOfStudy !== '—' && !s.yearOfStudy.includes('-')) {
        // Exclude academic calendar year ranges like 2026-2027
        yearsSet.add(s.yearOfStudy.trim());
      }

      if (Array.isArray(s.sectionDetails)) {
        s.sectionDetails.forEach((sd) => {
          const secYr = getCanonicalYearLevel(sd.yearOfStudy);
          if (secYr) {
            yearsSet.add(secYr);
          }
        });
      }
    });

    return Array.from(yearsSet).sort((a, b) => {
      const idxA = CANONICAL_YEAR_ORDER.indexOf(a);
      const idxB = CANONICAL_YEAR_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [subjects]);

  // Teaching Year dropdown options
  const teachingYearOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Teaching Years', isDefault: true },
      ...availableTeachingYears.map((yr) => ({
        value: yr,
        label: yr
      }))
    ];
  }, [availableTeachingYears]);

  // Extract available Departments based on current Teaching Year selection and teacher's assignments
  const availableDepartments = useMemo(() => {
    const relevantSubjects = selectedTeachingYear === 'ALL'
      ? subjects
      : subjects.filter((s) => subjectMatchesTeachingYear(s, selectedTeachingYear));

    const depts = new Set();
    relevantSubjects.forEach((s) => {
      if (s.department && s.department !== '—') {
        depts.add(s.department.trim());
      }
    });

    return Array.from(depts).sort();
  }, [subjects, selectedTeachingYear]);

  // Department dropdown options
  const departmentOptions = useMemo(() => {
    if (availableDepartments.length === 0 && selectedTeachingYear !== 'ALL') {
      return [
        { value: 'ALL', label: 'No Departments Available', isDefault: true, disabled: true }
      ];
    }

    return [
      { value: 'ALL', label: 'All Departments', isDefault: true },
      ...availableDepartments.map((d) => ({
        value: d,
        label: d
      }))
    ];
  }, [availableDepartments, selectedTeachingYear]);

  // Handle Teaching Year change: update year and auto-reset department if invalid in the new year
  const handleTeachingYearChange = useCallback((newYear) => {
    setSelectedTeachingYear(newYear);

    if (selectedDept !== 'ALL') {
      const relevantSubjects = newYear === 'ALL'
        ? subjects
        : subjects.filter((s) => subjectMatchesTeachingYear(s, newYear));

      const relevantDepts = new Set();
      relevantSubjects.forEach((s) => {
        if (s.department && s.department !== '—') {
          relevantDepts.add(s.department.trim());
        }
      });

      if (!relevantDepts.has(selectedDept)) {
        setSelectedDept('ALL');
      }
    }
  }, [subjects, selectedDept]);

  // Safety net: Auto-reset department if selected department is not available in the active department list
  useEffect(() => {
    if (selectedDept !== 'ALL' && !availableDepartments.includes(selectedDept)) {
      setSelectedDept('ALL');
    }
  }, [availableDepartments, selectedDept]);

  // Filtered subjects based on search query, teaching year, and department
  const filteredSubjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return subjects.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query) ||
        (item.department && item.department.toLowerCase().includes(query)) ||
        (item.yearOfStudy && item.yearOfStudy.toLowerCase().includes(query)) ||
        (item.semester && item.semester.toLowerCase().includes(query)) ||
        (item.sections && item.sections.some((sec) => sec.toLowerCase().includes(query)));

      const matchesYear = subjectMatchesTeachingYear(item, selectedTeachingYear);
      const matchesDept = selectedDept === 'ALL' || item.department === selectedDept;

      return matchesSearch && matchesYear && matchesDept;
    });
  }, [subjects, searchQuery, selectedTeachingYear, selectedDept]);

  // Loading skeleton state
  if (loading) {
    return (
      <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto pb-10" data-testid="teacher-subjects-loading">
        {/* Search & Actions Skeleton */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl flex-1 w-full" />
          <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>

        {/* Filters Row Skeleton */}
        <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
          <div className="h-14 w-full sm:w-[220px] bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          <div className="h-14 w-full sm:w-[260px] bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
        </div>

        {/* Cards Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-7">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 min-h-[220px] border border-slate-200 dark:border-slate-800 animate-pulse space-y-4"
            >
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80">
                <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4" />
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/5" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-8 rounded-2xl shadow-sm text-center">
        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Unable to Load Subjects
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
          {error}
        </p>
        <button
          onClick={() => fetchSubjects(false)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto pb-10" data-testid="teacher-subjects-page">
      
      {/* 1. Search & Actions Card (Search bar, count badge, and Refresh button) */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              id="teacher-subjects-search-input"
              data-testid="teacher-subjects-search-input"
              type="text"
              placeholder="Search by subject name, code, department, or section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Right: Subject count badge */}
          <div className="flex items-center gap-2.5 shrink-0 justify-between sm:justify-end">
            {/* Subject Count Badge */}
            <span
              data-testid="teacher-subjects-count-badge"
              className="inline-flex items-center justify-center h-10 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 shadow-2xs whitespace-nowrap"
            >
              {filteredSubjects.length} {filteredSubjects.length === 1 ? 'Subject' : 'Subjects'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Standalone Compact Filter Controls Directly on Page Background */}
      {subjects.length > 0 && (
        <div 
          className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4"
          data-testid="teacher-subjects-filters-row"
        >
          {/* 1. Teaching Year Filter */}
          <div className="flex flex-col gap-1.5 w-full sm:w-[220px]">
            <label 
              htmlFor="teacher-subjects-teaching-year-filter" 
              className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              Teaching Year
            </label>
            <TeacherDropdown
              id="teacher-subjects-teaching-year-filter"
              data-testid="teacher-subjects-teaching-year-filter"
              value={selectedTeachingYear}
              onChange={(e) => handleTeachingYearChange(e.target.value)}
              options={teachingYearOptions}
              placeholder="All Teaching Years"
              title="Filter by Teaching Year"
              icon={Clock}
              className="w-full h-10"
              menuClassName="w-full sm:w-[240px]"
            />
          </div>

          {/* 2. Department Filter */}
          <div className="flex flex-col gap-1.5 w-full sm:w-[260px]">
            <label 
              htmlFor="teacher-subjects-dept-filter" 
              className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              Department
            </label>
            <TeacherDropdown
              id="teacher-subjects-dept-filter"
              data-testid="teacher-subjects-dept-filter"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              options={departmentOptions}
              placeholder="All Departments"
              title="Filter by Department"
              icon={Building2}
              className="w-full h-10"
              menuClassName="w-full sm:w-[280px]"
              disabled={availableDepartments.length === 0}
            />
          </div>
        </div>
      )}


      {/* 3. Empty State: No subjects assigned yet */}
      {subjects.length === 0 ? (
        <div
          data-testid="no-subjects-assigned"
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-14 text-center shadow-xs"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-4 shadow-xs">
            <BookOpen className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 mb-3">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Curriculum Allocation Status</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
            No subjects assigned yet.
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed mb-6">
            You do not have any teaching subjects assigned for the current curriculum. When an administrator assigns a subject and your faculty profile to a section in <span className="font-semibold text-slate-800 dark:text-slate-200">Departments & Sections → Curriculum Mapping</span>, it will automatically appear here.
          </p>

          <button
            onClick={() => fetchSubjects(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Check for New Assignments</span>
          </button>
        </div>
      ) : filteredSubjects.length === 0 ? (
        /* No Search / Filter Matches */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-xs">
          <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
            No matching subjects found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            No assigned subjects match your search or filter criteria.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedTeachingYear('ALL');
              setSelectedDept('ALL');
            }}
            className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        /* 4. Subject Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-7" data-testid="subject-cards-grid">
          {filteredSubjects.map((subject) => {
            const displayName = formatField(subject.name);
            const displayCode = formatField(subject.code);
            const displayDepartment = formatField(subject.department);
            const displayCourseType = formatField(subject.courseType || subject.subjectType || subject.type);
            const displayCredits = formatCredits(subject.credits);

            return (
              <div
                key={subject.id || subject.subjectId}
                data-testid={`subject-card-${subject.code || subject.name}`}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 min-h-[220px] border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-200 hover:border-emerald-300 dark:hover:border-emerald-700/60 flex flex-col justify-between"
              >
                <div>
                  {/* 1. Subject Name - Prominently at the top */}
                  <div className="pb-4 mb-4 border-b border-slate-100 dark:border-slate-800/80">
                    <h2 
                      className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight line-clamp-2"
                      title={displayName}
                      data-testid="subject-name"
                    >
                      {displayName}
                    </h2>
                  </div>

                  {/* 2 to 5: Subject Details in strict required order */}
                  <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    {/* 2. Subject Code */}
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Subject Code:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200" data-testid="subject-code">
                        {displayCode}
                      </span>
                    </div>

                    {/* 3. Department */}
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Department:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={displayDepartment} data-testid="subject-department">
                        {displayDepartment}
                      </span>
                    </div>

                    {/* 4. Course Type */}
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Course Type:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200" data-testid="subject-course-type">
                        {displayCourseType}
                      </span>
                    </div>

                    {/* 5. Credits */}
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Credits:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200" data-testid="subject-credits">
                        {displayCredits}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
