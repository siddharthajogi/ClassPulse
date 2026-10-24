import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { teacherApi } from '../api';
import TeacherDropdown from './TeacherDropdown';
import {
  BookOpen,
  Users,
  GraduationCap,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Calendar,
  Building2,
  X,
  Loader2,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Tag
} from 'lucide-react';

// Academic years of study in canonical order matching Admin Portal
const ACADEMIC_YEARS_ORDER = [
  { id: 'First Year', label: 'First Year', yearNumber: 1, defaultSemesters: ['1st', '2nd'] },
  { id: 'Second Year', label: 'Second Year', yearNumber: 2, defaultSemesters: ['3rd', '4th'] },
  { id: 'Third Year', label: 'Third Year', yearNumber: 3, defaultSemesters: ['5th', '6th'] },
  { id: 'Fourth Year', label: 'Fourth Year', yearNumber: 4, defaultSemesters: ['7th', '8th'] },
];

export default function TeacherClassesSections({ currentUser }) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [totalEnrolledStudents, setTotalEnrolledStudents] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Top Summary Card Filter & Search State
  // summaryFilter: 'all' | 'assigned' | 'not_assigned' | 'enrolled'
  const [summaryFilter, setSummaryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const res = await teacherApi.getMyClasses();
      if (res && res.success) {
        setClasses(res.classes || []);
        setTotalEnrolledStudents(res.totalEnrolledStudents || 0);
        setDepartments(res.departments || []);
        setAcademicYears(res.academicYears || []);
      } else {
        setError(res?.error || 'Failed to load assigned departments and sections.');
      }
    } catch (err) {
      console.error('Failed to load teacher classes and sections:', err);
      setError(
        err.response?.data?.error ||
        err.message ||
        'Unable to connect to classes service. Please check your connection.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Helper to resolve department display code and name
  const getDeptInfo = useCallback((deptString) => {
    if (!deptString) return { code: 'DEPT', name: 'Department', displayName: 'Department' };
    const trimmed = typeof deptString === 'string' ? deptString.trim() : (deptString?.name || String(deptString)).trim();
    const found = departments.find(d =>
      (d._id && String(d._id) === String(trimmed)) ||
      (d.code && d.code.toLowerCase() === trimmed.toLowerCase()) ||
      (d.name && d.name.toLowerCase() === trimmed.toLowerCase())
    );
    if (found) {
      return {
        code: found.code || (found.name?.length <= 5 ? found.name.toUpperCase() : found.name?.substring(0, 4).toUpperCase()),
        name: found.name,
        displayName: found.code ? `${found.code} — ${found.name}` : found.name
      };
    }
    return {
      code: trimmed.length <= 5 ? trimmed.toUpperCase() : trimmed.substring(0, 4).toUpperCase(),
      name: trimmed,
      displayName: trimmed
    };
  }, [departments]);

  // Overview Metrics from teacher's actual assigned classes (Assigned Sections & Enrolled Students)
  const totalGroupsCount = classes.length;
  const enrolledStudentsCount = totalEnrolledStudents;

  // Handle clicking summary cards
  const handleSummaryCardClick = (filterType) => {
    if (summaryFilter === filterType) {
      setSummaryFilter('all');
    } else {
      setSummaryFilter(filterType);
    }
  };

  // Filter Classes based on Search and Filter Criteria
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      // 1. Search filter
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term ||
        (c.name || '').toLowerCase().includes(term) ||
        (c.course || '').toLowerCase().includes(term) ||
        (c.department || '').toLowerCase().includes(term) ||
        (c.section || '').toLowerCase().includes(term) ||
        (c.semester || '').toLowerCase().includes(term) ||
        (c.academicYear || '').toLowerCase().includes(term) ||
        (c.yearOfStudy || '').toLowerCase().includes(term) ||
        (c.teacherSubjects && c.teacherSubjects.some(s => s.name?.toLowerCase().includes(term) || s.code?.toLowerCase().includes(term)));

      // 2. Summary card interactive filter
      let matchesSummary = true;
      if (summaryFilter === 'assigned') {
        matchesSummary = c.status === 'Assigned' || (!c.hasPendingAssignments && c.status !== 'Not Assigned');
      } else if (summaryFilter === 'not_assigned' || summaryFilter === 'pending') {
        matchesSummary = c.status === 'Not Assigned' || c.hasPendingAssignments;
      } else if (summaryFilter === 'enrolled') {
        matchesSummary = (c.studentCount || 0) > 0;
      }

      // 3. Department dropdown filter
      const matchesDept = departmentFilter === 'all' ||
        c.department === departmentFilter ||
        departments.some(d => d.code === departmentFilter && (c.department === d.name || c.department === d.code));

      // 4. Academic year of study filter
      const matchesYear = yearFilter === 'all' ||
        c.yearOfStudy === yearFilter ||
        (yearFilter === 'First Year' && (c.yearOfStudy === '1st Year' || c.semester === '1st' || c.semester === '2nd')) ||
        (yearFilter === 'Second Year' && (c.yearOfStudy === '2nd Year' || c.semester === '3rd' || c.semester === '4th')) ||
        (yearFilter === 'Third Year' && (c.yearOfStudy === '3rd Year' || c.semester === '5th' || c.semester === '6th')) ||
        (yearFilter === 'Fourth Year' && (c.yearOfStudy === '4th Year' || c.semester === '7th' || c.semester === '8th'));

      return matchesSearch && matchesSummary && matchesDept && matchesYear;
    });
  }, [classes, searchTerm, summaryFilter, departmentFilter, yearFilter, departments]);

  // Memoized options for TeacherDropdown
  const departmentDropdownOptions = useMemo(() => {
    const list = [{ value: 'all', label: 'All Departments' }];
    departments
      .filter(d => d && (d.name || d._id))
      .forEach(d => {
        list.push({
          value: d.name,
          label: d.code ? `${d.code} — ${d.name}` : d.name,
          subtext: d.code ? d.name : null,
        });
      });
    return list;
  }, [departments]);

  // Exactly 5 options for Academic Year of study filter
  const yearDropdownOptions = useMemo(() => [
    { value: 'all', label: 'All Years' },
    { value: 'First Year', label: 'First Year' },
    { value: 'Second Year', label: 'Second Year' },
    { value: 'Third Year', label: 'Third Year' },
    { value: 'Fourth Year', label: 'Fourth Year' },
  ], []);

  // Build Academic Hierarchy: Academic Years -> Departments -> Inner Sections Grid
  const academicYearHierarchy = useMemo(() => {
    const targetYears = yearFilter === 'all'
      ? ACADEMIC_YEARS_ORDER
      : ACADEMIC_YEARS_ORDER.filter(yearMeta => yearMeta.id === yearFilter);

    return targetYears.map(yearMeta => {
      // Find all sections belonging to this year of study
      const yearSections = filteredClasses.filter(c =>
        c.yearOfStudy === yearMeta.id ||
        (yearMeta.id === 'First Year' && (c.yearOfStudy === '1st Year' || c.semester === '1st' || c.semester === '2nd')) ||
        (yearMeta.id === 'Second Year' && (c.yearOfStudy === '2nd Year' || c.semester === '3rd' || c.semester === '4th')) ||
        (yearMeta.id === 'Third Year' && (c.yearOfStudy === '3rd Year' || c.semester === '5th' || c.semester === '6th')) ||
        (yearMeta.id === 'Fourth Year' && (c.yearOfStudy === '4th Year' || c.semester === '7th' || c.semester === '8th'))
      );

      // Group sections by department inside this year
      const deptMap = {};
      yearSections.forEach(section => {
        const deptKey = `${section.course || 'B.Tech'}:::${section.department}`;
        if (!deptMap[deptKey]) {
          const deptInfo = getDeptInfo(section.department);
          deptMap[deptKey] = {
            deptKey,
            departmentName: section.department,
            departmentCode: deptInfo.code,
            displayName: deptInfo.displayName,
            course: section.course || 'B.Tech',
            academicYear: section.academicYear,
            yearOfStudy: yearMeta.id,
            semesters: new Set(),
            sections: [],
            totalStudents: 0
          };
        }
        deptMap[deptKey].sections.push(section);
        deptMap[deptKey].totalStudents += (section.studentCount || 0);
        if (section.semester) deptMap[deptKey].semesters.add(section.semester);
      });

      // Sort sections within each department by section name (Section A, B, C...)
      const departmentCards = Object.values(deptMap).map(dept => {
        const sortedSections = [...dept.sections].sort((a, b) =>
          (a.section || '').localeCompare(b.section || '', undefined, { numeric: true, sensitivity: 'base' })
        );
        const sortedSemesters = Array.from(dept.semesters).sort();
        return {
          ...dept,
          semesters: sortedSemesters,
          sections: sortedSections,
          sectionCount: sortedSections.length
        };
      });

      // Sort department cards alphabetically by department name
      departmentCards.sort((a, b) => a.departmentName.localeCompare(b.departmentName));

      const totalYearSections = departmentCards.reduce((acc, d) => acc + d.sections.length, 0);
      const totalYearStudents = departmentCards.reduce((acc, d) => acc + d.totalStudents, 0);

      return {
        ...yearMeta,
        departments: departmentCards,
        departmentCount: departmentCards.length,
        totalSections: totalYearSections,
        totalStudents: totalYearStudents
      };
    });
  }, [filteredClasses, getDeptInfo, yearFilter]);

  // Loading skeleton state
  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-10" data-testid="teacher-classes-loading">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {[1, 2].map(n => (
            <div key={n} className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse h-28" />
          ))}
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error && classes.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-8 rounded-2xl shadow-sm text-center">
        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Unable to Load Classes
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
          {error}
        </p>
        <button
          onClick={() => loadData(false)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 transition-colors duration-200" data-testid="teacher-classes-sections-page">
      {/* Overview Cards: Retain Only Assigned Sections & Enrolled Students */}
      <div>
        {summaryFilter !== 'all' && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setSummaryFilter('all')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
            >
              Reset Card Filter
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Card 1: Assigned Sections */}
          <button
            type="button"
            onClick={() => handleSummaryCardClick('all')}
            className={`text-left p-5 sm:p-6 rounded-2xl border transition-all duration-200 cursor-pointer ${
              summaryFilter === 'all'
                ? 'bg-white dark:bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Assigned Sections
              </span>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {totalGroupsCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {totalGroupsCount === 1 ? 'section' : 'sections'}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <span>{summaryFilter === 'all' ? 'Active: Showing all' : 'Click to view all'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Card 2: Enrolled Students */}
          <button
            type="button"
            onClick={() => handleSummaryCardClick('enrolled')}
            className={`text-left p-5 sm:p-6 rounded-2xl border transition-all duration-200 cursor-pointer ${
              summaryFilter === 'enrolled'
                ? 'bg-white dark:bg-slate-900 border-teal-500 ring-2 ring-teal-500/20 shadow-md'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-800 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Enrolled Students
              </span>
              <div className="p-2.5 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-teal-600 dark:text-teal-400">
                {enrolledStudentsCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {enrolledStudentsCount === 1 ? 'student' : 'students'}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 font-medium">
              <span>{summaryFilter === 'enrolled' ? 'Filter applied' : 'Across your sections'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </div>

      {/* 3. Search and Dropdown Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search hierarchy by program, department, semester, section..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Department Filter */}
          <TeacherDropdown
            id="teacher-classes-dept-filter"
            data-testid="teacher-classes-dept-filter"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            options={departmentDropdownOptions}
            placeholder="All Departments"
            title="Filter by Department"
            icon={Building2}
            className="w-full sm:w-auto min-w-[200px] max-w-[280px]"
            menuClassName="w-full sm:w-[320px]"
          />

          {/* Academic Year Filter */}
          <TeacherDropdown
            id="teacher-classes-year-filter"
            data-testid="teacher-classes-year-filter"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            options={yearDropdownOptions}
            placeholder="All Years"
            title="Filter by Year"
            icon={Calendar}
            className="w-full sm:w-auto min-w-[170px]"
            menuClassName="w-full sm:w-[220px]"
          />
        </div>
      </div>

      {/* 4. Academic Year Hierarchy Containers */}
      {totalGroupsCount === 0 ? (
        <div
          data-testid="no-classes-assigned"
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-14 text-center shadow-xs"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-4 shadow-xs">
            <Layers className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Curriculum Assignment Status</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
            No classes or sections assigned yet.
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed mb-6">
            You do not have any teaching assignments in the academic structure yet. When an administrator assigns a subject and your faculty profile to a section in <span className="font-semibold text-slate-800 dark:text-slate-200">Departments & Sections</span>, the corresponding department and inner section card will automatically appear here.
          </p>

          <button
            onClick={() => loadData(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Check for New Assignments</span>
          </button>
        </div>
      ) : (
        <div className="space-y-10" data-testid="academic-years-hierarchy">
          {academicYearHierarchy.map((yearGroup, yearIndex) => {
            const hasDepts = yearGroup.departments.length > 0;

            return (
              <section
                key={yearGroup.id}
                data-testid={`year-container-${yearGroup.id}`}
                className="bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-5 sm:p-7 transition-colors duration-200"
              >
                {/* Academic Year Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      {yearGroup.yearNumber || (yearIndex + 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                          {yearGroup.label}
                        </h2>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {yearGroup.departmentCount} {yearGroup.departmentCount === 1 ? 'Department' : 'Departments'}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          {yearGroup.totalSections} {yearGroup.totalSections === 1 ? 'Section' : 'Sections'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {yearGroup.totalStudents} total enrolled students across your assigned sections in this academic year
                      </p>
                    </div>
                  </div>
                </div>

                {/* Department Cards with Inner Section Cards */}
                <div className="mt-6 space-y-6">
                  {!hasDepts ? (
                    <div className="p-8 sm:p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                      <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No Assigned Sections for {yearGroup.label}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                        {searchTerm || summaryFilter !== 'all' || departmentFilter !== 'all' || yearFilter !== 'all'
                          ? 'No assigned sections in this academic year match your active filter criteria.'
                          : `When an administrator assigns your faculty profile to curriculum subjects in ${yearGroup.label}, they will automatically appear here.`}
                      </p>
                    </div>
                  ) : (
                    yearGroup.departments.map(deptCard => (
                      <div
                        key={deptCard.deptKey}
                        data-testid={`department-card-${deptCard.departmentCode || deptCard.departmentName}`}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all p-6 sm:p-7"
                      >
                        {/* Department Card Header */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-start gap-3">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0 mt-0.5">
                              <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                  {deptCard.displayName}
                                </h3>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                                  {deptCard.course}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                                {deptCard.academicYear && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Calendar: {deptCard.academicYear}</span>
                                  </span>
                                )}
                                {deptCard.semesters.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                                    <span>
                                      Semesters: {deptCard.semesters.map(s => `Sem ${s}`).join(', ')}
                                    </span>
                                  </span>
                                )}
                                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                                  <Users className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{deptCard.totalStudents} enrolled students</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {deptCard.sectionCount} {deptCard.sectionCount === 1 ? 'Section' : 'Sections'}
                            </span>
                          </div>
                        </div>

                        {/* INNER SECTION CARDS GRID */}
                        <div className="mt-5">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3.5">
                            Assigned Sections ({deptCard.sections.length})
                          </span>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                            {deptCard.sections.map(section => {
                              const subjectsCount = section.subjectsCount || (section.teacherSubjects ? section.teacherSubjects.length : 0);
                              const studentCount = section.studentCount || 0;

                              return (
                                <div
                                  key={section._id}
                                  data-testid={`section-card-${section.section}`}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 min-h-[160px] shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700/70 hover:shadow-sm transition-all duration-200 flex flex-col justify-between"
                                >
                                  <div>
                                    {/* First row: Section name and Total enrolled students */}
                                    <div className="flex items-center justify-between gap-2">
                                      <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate">
                                        Section {section.section}
                                      </h4>
                                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-900/50 shrink-0">
                                        <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                        <span>{studentCount} {studentCount === 1 ? 'Student' : 'Students'}</span>
                                      </span>
                                    </div>

                                    {/* Second row: My Subjects and Academic Year in one compact row */}
                                    <div className="mt-3.5 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2 flex-wrap">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="text-slate-400 dark:text-slate-500 font-medium">My Subjects:</span>
                                        <span className="font-bold text-slate-900 dark:text-slate-100">
                                          {subjectsCount}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="text-slate-400 dark:text-slate-500 font-medium">Academic Year:</span>
                                        <span className="font-bold text-slate-900 dark:text-slate-100">
                                          {section.academicYear || deptCard.academicYear || '—'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Bottom row: One full-width button labelled View Details */}
                                  <div className="mt-4 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/teacher/classes/${section._id}`)}
                                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs hover:shadow transition-all duration-150 cursor-pointer"
                                      data-testid={`view-details-btn-${section.section}`}
                                    >
                                      <span>View Details</span>
                                      <ChevronRight className="w-4 h-4 text-emerald-100" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
