import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { teacherApi } from '../api';
import TeacherDropdown from './TeacherDropdown';
import {
  ArrowLeft,
  Building2,
  Calendar,
  GraduationCap,
  Users,
  BookOpen,
  Layers,
  Search,
  AlertCircle,
  RefreshCw,
  Tag,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  X
} from 'lucide-react';

export default function TeacherSectionDetails({ currentUser }) {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [sectionData, setSectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Student table search & pagination
  const [studentSearch, setStudentSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch Section Details from Backend API
  const fetchSectionDetails = useCallback(async (isManualRefresh = false) => {
    if (!classId) return;

    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const res = await teacherApi.getClassById(classId);
      if (res && res.success && res.class) {
        setSectionData(res.class);
      } else {
        setError(res?.error || 'Failed to load section details.');
      }
    } catch (err) {
      console.error('Failed to load section details:', err);
      setError(
        err.response?.data?.error ||
        err.message ||
        'Unable to load section details. Please verify your connection.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchSectionDetails();
  }, [fetchSectionDetails]);

  // Reset pagination when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [studentSearch]);

  // Deduplicated / Formatted Assignments List
  const assignments = useMemo(() => {
    if (!sectionData || !sectionData.assignments) return [];
    return sectionData.assignments;
  }, [sectionData]);

  // Distinct count of subjects assigned to this section
  const distinctSubjectsCount = useMemo(() => {
    if (!assignments || assignments.length === 0) return 0;
    const subjectIds = new Set();
    assignments.forEach(asgn => {
      const sId = asgn.subject?._id ? asgn.subject._id.toString() : (asgn.subject ? asgn.subject.toString() : null);
      if (sId) subjectIds.add(sId);
    });
    return subjectIds.size;
  }, [assignments]);

  // Filtered students according to search query
  const filteredStudents = useMemo(() => {
    if (!sectionData || !sectionData.students) return [];
    const term = studentSearch.toLowerCase().trim();
    if (!term) return sectionData.students;

    return sectionData.students.filter(student => {
      const name = (student.user?.name || student.personalInfo?.name || '').toLowerCase();
      const id = (student.studentId || student.user?.userId || '').toLowerCase();
      const email = (student.personalInfo?.email || student.user?.email || '').toLowerCase();
      const dept = (student.department || sectionData.department || '').toLowerCase();
      const sec = (student.section || sectionData.section || '').toLowerCase();

      return (
        name.includes(term) ||
        id.includes(term) ||
        email.includes(term) ||
        dept.includes(term) ||
        sec.includes(term)
      );
    });
  }, [sectionData, studentSearch]);

  // Pagination calculation
  const totalStudents = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // Loading skeleton state
  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-pulse" data-testid="section-details-loading">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-44 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map(n => (
            <div key={n} className="h-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
        <div className="h-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800" />
        <div className="h-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  // Error state
  if (error || !sectionData) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-8 rounded-3xl shadow-sm text-center">
        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Unable to Load Section Details
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
          {error || 'The requested section could not be found or you do not have permission to view it.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/teacher/classes')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to My Classes</span>
          </button>
          <button
            onClick={() => fetchSectionDetails(false)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const deptDisplayName = sectionData.departmentRef?.name || sectionData.department || 'Department';
  const deptCode = sectionData.departmentRef?.code || (sectionData.department && sectionData.department.length <= 5 ? sectionData.department.toUpperCase() : '');
  const sectionName = sectionData.section ? `Section ${sectionData.section}` : (sectionData.name || 'Section');
  const course = sectionData.course || 'B.Tech';
  const academicYear = sectionData.academicYear || '—';
  const yearOfStudy = sectionData.yearOfStudy || sectionData.normalizedYearOfStudy || '—';
  const semester = sectionData.semester ? `Semester ${sectionData.semester}` : '—';
  const enrolledStudentCount = sectionData.studentCount !== undefined ? sectionData.studentCount : (sectionData.students ? sectionData.students.length : 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 transition-colors duration-200" data-testid="teacher-section-details-page">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/teacher/classes')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer"
            data-testid="back-to-classes-btn"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Back to My Classes</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">{sectionName}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchSectionDetails(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-colors self-start sm:self-auto cursor-pointer disabled:opacity-60"
          title="Refresh section details"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* 2.A: SECTION INFORMATION (Hero Banner & 7 Required Metrics)    */}
      {/* ============================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0 mt-1 border border-emerald-100 dark:border-emerald-900/50">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {course}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {semester}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-900/50">
                  {yearOfStudy}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mt-1.5">
                {sectionName}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>Department of <strong className="text-slate-800 dark:text-slate-200 font-bold">{deptDisplayName}</strong></span>
                {deptCode && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                    {deptCode}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Assigned Faculty View
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {currentUser?.name || 'Faculty Member'}
              </span>
            </div>
          </div>
        </div>

        {/* 7 Required Section Information Cards */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
          {/* 1. Department Name */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Department</span>
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block truncate" title={deptDisplayName}>
                {deptDisplayName}
              </span>
              {deptCode && (
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {deptCode}
                </span>
              )}
            </div>
          </div>

          {/* 2. Section Name */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Section</span>
              <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 block truncate">
                {sectionName}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Cohort Group
              </span>
            </div>
          </div>

          {/* 3. Academic Year */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Academic Year</span>
              <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block truncate">
                {academicYear}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Calendar Session
              </span>
            </div>
          </div>

          {/* 4. Year of Study */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Year of Study</span>
              <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block truncate">
                {yearOfStudy}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Program Progression
              </span>
            </div>
          </div>

          {/* 5. Semester */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Semester</span>
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block truncate">
                {semester}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Current Term
              </span>
            </div>
          </div>

          {/* 6. Total Enrolled Students */}
          <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-900/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-teal-600 dark:text-teal-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Enrolled Students</span>
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-extrabold text-teal-700 dark:text-teal-300 block">
                {enrolledStudentCount}
              </span>
              <span className="text-[10px] text-teal-700/80 dark:text-teal-400 font-medium">
                {enrolledStudentCount === 1 ? 'Registered Student' : 'Registered Students'}
              </span>
            </div>
          </div>

          {/* 7. Distinct Subjects Assigned to Section */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Distinct Subjects</span>
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 block">
                {distinctSubjectsCount}
              </span>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 font-medium">
                {distinctSubjectsCount === 1 ? 'Subject Assigned' : 'Subjects Assigned'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2.B: SUBJECT ASSIGNMENTS TABLE                                 */}
      {/* ============================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs" data-testid="subject-assignments-section">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Subject Assignments
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {assignments.length} {assignments.length === 1 ? 'Subject' : 'Subjects'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Every subject assigned to {sectionName} as defined in Curriculum Management.
            </p>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/40 dark:bg-slate-900/40 my-6">
            <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No Subjects Assigned to this Section Yet
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              When an administrator allocates subjects to this section in the Admin Portal, they will be listed here.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <table className="w-full text-left text-xs whitespace-nowrap" data-testid="subject-assignments-table">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Subject Name</th>
                  <th className="px-5 py-3.5 font-semibold">Subject Code</th>
                  <th className="px-5 py-3.5 font-semibold">Course Type</th>
                  <th className="px-5 py-3.5 font-semibold">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {assignments.map(asgn => {
                  const sub = asgn.subject || {};
                  const courseType = sub.subjectType || sub.courseType || 'Theory';

                  return (
                    <tr
                      key={asgn._id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Subject Name */}
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {sub.name || '—'}
                        </span>
                      </td>

                      {/* Subject Code */}
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/50">
                          {sub.code || '—'}
                        </span>
                      </td>

                      {/* Course Type */}
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
                          courseType.toLowerCase().includes('lab') || courseType.toLowerCase().includes('practical')
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/40'
                            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40'
                        }`}>
                          {courseType}
                        </span>
                      </td>

                      {/* Credits */}
                      <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">
                        {sub.credits !== null && sub.credits !== undefined ? `${sub.credits} Credits` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2.C: STUDENT DETAILS TABLE (Searchable & Paginated)           */}
      {/* ============================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs" data-testid="enrolled-students-section">
        {/* Table Header and Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Enrolled Students
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                {enrolledStudentCount} Total Enrolled
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Official roster of students registered exclusively in {sectionName}.
            </p>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name or ID..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                data-testid="student-search-input"
              />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => setStudentSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Page Size Selector */}
            <TeacherDropdown
              id="teacher-section-pagesize"
              data-testid="teacher-section-pagesize"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              options={[
                { value: 10, label: '10 per page' },
                { value: 20, label: '20 per page' },
                { value: 50, label: '50 per page' },
              ]}
              title="Students per page"
              placeholder="10 per page"
              className="w-auto min-w-[130px]"
              menuClassName="w-[140px]"
              align="right"
              autoWidth
            />
          </div>
        </div>

        {/* Empty State / Student Table */}
        {filteredStudents.length === 0 ? (
          <div className="p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/40 dark:bg-slate-900/40 my-6">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {studentSearch ? 'No matching students found' : `No students enrolled in ${sectionName}`}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              {studentSearch
                ? `No students matching "${studentSearch}" were found in this section's enrollment list.`
                : 'There are currently no students registered to this section in the database.'}
            </p>
            {studentSearch && (
              <button
                type="button"
                onClick={() => setStudentSearch('')}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <table className="w-full text-left text-xs whitespace-nowrap" data-testid="enrolled-students-table">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Student Name</th>
                    <th className="px-5 py-3.5 font-semibold">Student ID</th>
                    <th className="px-5 py-3.5 font-semibold">Department</th>
                    <th className="px-5 py-3.5 font-semibold">Section</th>
                    <th className="px-5 py-3.5 font-semibold">Academic Year & Year of Study</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedStudents.map(student => {
                    const studentName = student.user?.name || student.personalInfo?.name || '—';
                    const studentEmail = student.personalInfo?.email || student.user?.email || '';
                    const studentId = student.studentId || student.user?.userId || '—';
                    const studentDept = student.departmentRef?.name || student.department || deptDisplayName;
                    const studentSec = student.section ? `Section ${student.section}` : sectionName;
                    const studentAcadYear = student.academicYear || academicYear;
                    const studentYear = student.yearOfStudy || yearOfStudy;
                    const isActive = student.user?.isActive !== false && student.isActive !== false;

                    return (
                      <tr key={student._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Student Name */}
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

                        {/* Student ID */}
                        <td className="px-5 py-3.5">
                          <span className="font-mono font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200/60 dark:border-teal-800/50">
                            {studentId}
                          </span>
                        </td>

                        {/* Department */}
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          {studentDept}
                        </td>

                        {/* Section */}
                        <td className="px-5 py-3.5 font-bold text-teal-700 dark:text-teal-300">
                          {studentSec}
                        </td>

                        {/* Academic Year & Year of Study */}
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <span>{studentAcadYear}</span>
                            <span>•</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">{studentYear}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>{isActive ? 'Active' : 'Inactive'}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Showing{' '}
                <strong className="text-slate-800 dark:text-slate-200 font-bold">
                  {totalStudents === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-800 dark:text-slate-200 font-bold">
                  {Math.min(currentPage * pageSize, totalStudents)}
                </strong>{' '}
                of{' '}
                <strong className="text-slate-800 dark:text-slate-200 font-bold">
                  {totalStudents}
                </strong>{' '}
                students
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          currentPage === page
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
