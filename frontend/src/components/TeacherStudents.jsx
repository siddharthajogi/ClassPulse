import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { teacherApi } from '../api';
import TeacherDropdown from './TeacherDropdown';
import {
  Users,
  GraduationCap,
  Building2,
  Layers,
  Search,
  X,
  ChevronRight,
  ArrowLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertCircle,
  Calendar,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';

// Academic years of study in canonical order matching ClassPulse curriculum
const ACADEMIC_YEARS = [
  { id: 'First Year', label: 'First Year' },
  { id: 'Second Year', label: 'Second Year' },
  { id: 'Third Year', label: 'Third Year' },
  { id: 'Fourth Year', label: 'Fourth Year' },
];

export default function TeacherStudents() {
  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Navigation hierarchy state:
  // Step 1: selectedYear (default: 'First Year')
  // Step 2: selectedDept (null | dept object)
  // Step 3: selectedSection (null | section object)
  const [selectedYear, setSelectedYear] = useState('First Year');
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);

  // Student roster state for selectedSection
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState('');

  // Table filtering, sorting, pagination state
  const [studentSearch, setStudentSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 1. Load teacher's assigned classes and sections from backend
  const loadClassesData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const res = await teacherApi.getMyClasses();
      if (res && res.success) {
        const assignedClasses = res.classes || [];
        setClasses(assignedClasses);
        setDepartments(res.departments || []);
        setAcademicYears(res.academicYears || []);

        // If current selectedYear has no classes, check if another year has classes to auto-focus
        const currentYearHasClasses = assignedClasses.some(c => c.yearOfStudy === selectedYear);
        if (!currentYearHasClasses && assignedClasses.length > 0) {
          const firstWithClasses = ACADEMIC_YEARS.find(y =>
            assignedClasses.some(c => c.yearOfStudy === y.id)
          );
          if (firstWithClasses) {
            setSelectedYear(firstWithClasses.id);
          }
        }
      } else {
        setError(res?.error || 'Failed to load assigned departments and sections.');
      }
    } catch (err) {
      console.error('Failed to load classes for students directory:', err);
      setError(
        err.response?.data?.error ||
        err.message ||
        'Unable to connect to students service. Please check your connection.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadClassesData();
  }, [loadClassesData]);

  // 2. Load enrolled students roster when a section is selected
  const loadSectionStudents = useCallback(async (sectionId) => {
    if (!sectionId) return;
    setLoadingStudents(true);
    setStudentsError('');
    setStudentSearch('');
    setCurrentPage(1);

    try {
      const res = await teacherApi.getClassById(sectionId);
      if (res && res.success && res.class) {
        setStudents(res.class.students || []);
      } else {
        setStudentsError(res?.error || 'Failed to load enrolled students roster.');
      }
    } catch (err) {
      console.error('Failed to load section students roster:', err);
      setStudentsError(
        err.response?.data?.error ||
        err.message ||
        'Unable to fetch students for this section.'
      );
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const handleSelectSection = (section) => {
    setSelectedSection(section);
    loadSectionStudents(section._id);
  };

  const handleSelectYear = (yearId) => {
    setSelectedYear(yearId);
    setSelectedDept(null);
    setSelectedSection(null);
    setStudents([]);
    setStudentSearch('');
  };

  const handleBackToDepartments = () => {
    setSelectedDept(null);
    setSelectedSection(null);
    setStudents([]);
    setStudentSearch('');
  };

  const handleBackToSections = () => {
    setSelectedSection(null);
    setStudents([]);
    setStudentSearch('');
  };

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

  // Compute counts per academic year to show on tabs
  const yearCountsMap = useMemo(() => {
    const map = {};
    ACADEMIC_YEARS.forEach(y => {
      const yearSections = classes.filter(c => c.yearOfStudy === y.id);
      const studentSum = yearSections.reduce((acc, s) => acc + (s.studentCount || 0), 0);
      map[y.id] = {
        sectionCount: yearSections.length,
        studentCount: studentSum
      };
    });
    return map;
  }, [classes]);

  // Group classes for selectedYear into unique departments assigned to this teacher
  const departmentsForSelectedYear = useMemo(() => {
    const yearSections = classes.filter(c => c.yearOfStudy === selectedYear);
    const deptMap = {};

    yearSections.forEach(section => {
      const deptKey = `${section.course || 'B.Tech'}:::${section.department}`;
      if (!deptMap[deptKey]) {
        const info = getDeptInfo(section.department);
        deptMap[deptKey] = {
          deptKey,
          departmentName: section.department,
          departmentCode: info.code,
          displayName: info.displayName,
          course: section.course || 'B.Tech',
          sections: [],
          totalStudents: 0
        };
      }
      deptMap[deptKey].sections.push(section);
      deptMap[deptKey].totalStudents += (section.studentCount || 0);
    });

    const list = Object.values(deptMap);
    // Sort sections within each department alphabetically
    list.forEach(dept => {
      dept.sections.sort((a, b) =>
        (a.section || '').localeCompare(b.section || '', undefined, { numeric: true, sensitivity: 'base' })
      );
      dept.sectionCount = dept.sections.length;
    });

    // Sort departments alphabetically
    list.sort((a, b) => a.departmentName.localeCompare(b.departmentName));
    return list;
  }, [classes, selectedYear, getDeptInfo]);

  // Filtered and sorted students for the selected section
  const processedStudents = useMemo(() => {
    let result = [...students];

    // Filter by search term (Student Name or Student ID)
    if (studentSearch.trim()) {
      const query = studentSearch.trim().toLowerCase();
      result = result.filter(s => {
        const name = (s.user?.name || s.personalInfo?.name || s.name || '').toLowerCase();
        const studentId = (s.studentId || s.user?.userId || '').toLowerCase();
        const email = (s.personalInfo?.email || s.user?.email || '').toLowerCase();
        return name.includes(query) || studentId.includes(query) || email.includes(query);
      });
    }

    // Sort by name or student ID
    result.sort((a, b) => {
      let aVal = '';
      let bVal = '';

      if (sortField === 'name') {
        aVal = a.user?.name || a.personalInfo?.name || a.name || '';
        bVal = b.user?.name || b.personalInfo?.name || b.name || '';
      } else if (sortField === 'studentId') {
        aVal = a.studentId || a.user?.userId || '';
        bVal = b.studentId || b.user?.userId || '';
      }

      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [students, studentSearch, sortField, sortDirection]);

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

  // Loading skeleton state
  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12" data-testid="teacher-students-loading">
        <div className="flex gap-3">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="flex-1 bg-white dark:bg-slate-900 rounded-2xl h-14 border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(n => (
            <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl h-36 border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error && classes.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-8 rounded-2xl shadow-xs text-center">
        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Unable to Load Students Directory
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
          {error}
        </p>
        <button
          onClick={() => loadClassesData(false)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 transition-colors duration-200" data-testid="teacher-students-page">
      {/* 1. Academic Year Navigation: 4 Compact Buttons/Tabs */}
      <div className="bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ACADEMIC_YEARS.map(year => {
            const isSelected = selectedYear === year.id;
            const counts = yearCountsMap[year.id] || { sectionCount: 0, studentCount: 0 };

            return (
              <button
                key={year.id}
                type="button"
                data-testid={`year-tab-${year.id}`}
                onClick={() => handleSelectYear(year.id)}
                className={`flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-1.5 sm:gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer select-none border ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/25'
                    : 'bg-slate-50/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <GraduationCap className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  <span>{year.label}</span>
                </div>

                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    isSelected
                      ? 'bg-emerald-700/80 text-emerald-100'
                      : counts.sectionCount > 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {counts.sectionCount} {counts.sectionCount === 1 ? 'Sec' : 'Secs'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Breadcrumb / Hierarchy Navigation Bar */}
      {(selectedDept || selectedSection) && (
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap text-slate-600 dark:text-slate-400 font-medium">
            <button
              type="button"
              onClick={handleBackToDepartments}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
            >
              {selectedYear}
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            {selectedSection ? (
              <>
                <button
                  type="button"
                  onClick={handleBackToSections}
                  className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                >
                  {selectedDept?.departmentName}
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-900 dark:text-slate-100 font-bold">
                  Section {selectedSection.section}
                </span>
              </>
            ) : (
              <span className="text-slate-900 dark:text-slate-100 font-bold">
                {selectedDept?.departmentName}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={selectedSection ? handleBackToSections : handleBackToDepartments}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{selectedSection ? 'Back to Sections' : 'Back to Departments'}</span>
          </button>
        </div>
      )}

      {/* 3. VIEW 1: DEPARTMENT SELECTION (When no department is selected) */}
      {!selectedDept && !selectedSection && (
        <div className="space-y-4" data-testid="students-department-selection">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Assigned Departments for {selectedYear}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select a department to view assigned sections and enrolled student rosters.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {departmentsForSelectedYear.length} {departmentsForSelectedYear.length === 1 ? 'Department' : 'Departments'}
            </span>
          </div>

          {departmentsForSelectedYear.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 sm:p-12 text-center shadow-2xs">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Building2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                No Assigned Departments in {selectedYear}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                You do not have any teaching assignments in {selectedYear}. When an administrator assigns your faculty profile to curriculum subjects in {selectedYear}, the department will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departmentsForSelectedYear.map(dept => (
                <div
                  key={dept.deptKey}
                  data-testid={`dept-card-${dept.departmentCode || dept.departmentName}`}
                  onClick={() => setSelectedDept(dept)}
                  className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/80 dark:hover:border-emerald-500/80 hover:ring-2 hover:ring-emerald-500/15 p-5 shadow-2xs transition-all duration-150 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Department Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50">
                        {dept.course}
                      </span>
                    </div>

                    {/* Department Title */}
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {dept.displayName}
                    </h3>
                  </div>

                  {/* Metrics Badges */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dept.sectionCount} {dept.sectionCount === 1 ? 'Section' : 'Sections'}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                      <Users className="w-3.5 h-3.5" />
                      <span>{dept.totalStudents} {dept.totalStudents === 1 ? 'Student' : 'Students'}</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. VIEW 2: SECTION SELECTION (When department is selected, but no section is selected) */}
      {selectedDept && !selectedSection && (
        <div className="space-y-4" data-testid="students-section-selection">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedDept.displayName}
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50">
                  {selectedDept.course}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Assigned sections in {selectedYear}. Click a section to view its enrolled student directory.
              </p>
            </div>

            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 self-start sm:self-auto">
              {selectedDept.sections.length} {selectedDept.sections.length === 1 ? 'Section' : 'Sections'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedDept.sections.map(section => (
              <div
                key={section._id}
                data-testid={`section-card-${section.section}`}
                onClick={() => handleSelectSection(section)}
                className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/80 dark:hover:border-emerald-500/80 hover:ring-2 hover:ring-emerald-500/15 p-5 shadow-2xs transition-all duration-150 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* First row: Section Name and Total Enrolled Students */}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Section {section.section}
                    </h3>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-900/50 shrink-0">
                      <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>{section.studentCount || 0} {section.studentCount === 1 ? 'Student' : 'Students'}</span>
                    </span>
                  </div>

                  {/* Second row: Academic Details Card */}
                  <div className="mt-3.5 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">Academic Year:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {section.academicYear || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">Semester:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {section.semester ? `Semester ${section.semester}` : '—'}
                      </span>
                    </div>
                    {section.teacherSubjects && section.teacherSubjects.length > 0 && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">My Subject:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[160px]">
                          {section.teacherSubjects.map(s => s.name).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: View Students Action Button */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>View Student Roster</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. VIEW 3: ENROLLED STUDENT TABLE (When a section is selected) */}
      {selectedSection && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 sm:p-6 space-y-6" data-testid="students-roster-view">
          {/* Header & Overview */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  Section {selectedSection.section} — Enrolled Students
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50">
                  {selectedDept?.course || 'B.Tech'}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {selectedYear}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {selectedDept?.departmentName} • Academic Year {selectedSection.academicYear || '—'} {selectedSection.semester ? `• Semester ${selectedSection.semester}` : ''}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-900/50 rounded-xl text-xs font-bold self-start md:self-auto shrink-0">
              <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>{students.length} {students.length === 1 ? 'Student Enrolled' : 'Students Enrolled'}</span>
            </div>
          </div>

          {/* Search Bar & Page Size Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search students by name or student ID..."
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-9 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                data-testid="student-search-input"
              />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearch('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400">Rows:</span>
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
                title="Rows per page"
                placeholder="10 per page"
                className="w-auto min-w-[130px]"
                menuClassName="w-[140px]"
                align="right"
                autoWidth
              />
            </div>
          </div>

          {/* Student Roster Loading State */}
          {loadingStudents ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs sm:text-sm font-medium">Loading enrolled students roster...</p>
            </div>
          ) : studentsError ? (
            <div className="p-8 text-center bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/60 my-4">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">
                Failed to Load Student Roster
              </h4>
              <p className="text-xs text-rose-600 dark:text-rose-400 max-w-md mx-auto mt-1 mb-4">
                {studentsError}
              </p>
              <button
                type="button"
                onClick={() => loadSectionStudents(selectedSection._id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : students.length === 0 ? (
            <div className="p-10 sm:p-14 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/40 dark:bg-slate-900/40 my-4" data-testid="students-empty-state">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No students enrolled in Section {selectedSection.section} yet
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                There are currently no students registered to this section in the database. When students are enrolled by an administrator, they will appear here.
              </p>
            </div>
          ) : processedStudents.length === 0 ? (
            <div className="p-8 text-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/30 dark:bg-slate-900/30 my-4">
              <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No matching students found
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                No enrolled students match your search query "{studentSearch}".
              </p>
              <button
                type="button"
                onClick={() => setStudentSearch('')}
                className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Responsive Student Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap" data-testid="students-roster-table">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      {/* Column 1: Student Name (Sortable) */}
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

                      {/* Column 2: Student ID (Sortable) */}
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

                      {/* Column 3: Department */}
                      <th className="px-5 py-3.5 font-semibold">Department</th>

                      {/* Column 4: Section */}
                      <th className="px-5 py-3.5 font-semibold">Section</th>

                      {/* Column 5: Academic Year */}
                      <th className="px-5 py-3.5 font-semibold">Academic Year</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedStudents.map((student, idx) => {
                      const studentName = student.user?.name || student.personalInfo?.name || student.name || '—';
                      const studentEmail = student.personalInfo?.email || student.user?.email || '';
                      const studentId = student.studentId || student.user?.userId || '—';
                      const studentDept = student.department || student.departmentRef?.name || selectedDept.departmentName || '—';
                      const studentSec = student.section ? `Section ${student.section}` : `Section ${selectedSection.section}`;
                      const studentAcadYear = student.academicYear || selectedSection.academicYear || '—';

                      return (
                        <tr
                          key={student._id || idx}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                          data-testid={`student-row-${studentId}`}
                        >
                          {/* 1. Student Name */}
                          <td className="px-5 py-3.5">
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                                {studentName}
                              </span>
                              {studentEmail && (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                                  {studentEmail}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Student ID */}
                          <td className="px-5 py-3.5">
                            <span className="font-mono font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200/60 dark:border-teal-800/50">
                              {studentId}
                            </span>
                          </td>

                          {/* 3. Department */}
                          <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                            {studentDept}
                          </td>

                          {/* 4. Section */}
                          <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                            {studentSec}
                          </td>

                          {/* 5. Academic Year */}
                          <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                            {studentAcadYear}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
                <div>
                  Showing{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {Math.min((currentPage - 1) * pageSize + 1, processedStudents.length)}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {Math.min(currentPage * pageSize, processedStudents.length)}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {processedStudents.length}
                  </span>{' '}
                  students
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>

                    <span className="px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
