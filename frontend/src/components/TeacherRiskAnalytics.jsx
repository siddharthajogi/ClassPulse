import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { teacherApi } from '../api';
import TeacherDropdown from './TeacherDropdown';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Users,
  Search,
  X,
  RefreshCw,
  Calendar,
  Building2,
  Layers,
  BookOpen,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  CalendarCheck,
  GraduationCap,
  TrendingUp,
  UserCheck,
  Clock,
  Sparkles,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

// Academic years in curriculum sequence
const ACADEMIC_YEARS = [
  { value: 'all', label: 'All Years' },
  { value: 'First Year', label: 'First Year' },
  { value: 'Second Year', label: 'Second Year' },
  { value: 'Third Year', label: 'Third Year' },
  { value: 'Fourth Year', label: 'Fourth Year' },
];

const RISK_LEVEL_OPTIONS = [
  { value: 'all', label: 'All Risk Categories' },
  { value: 'high', label: '🚨 High Risk Only' },
  { value: 'medium', label: '⚠️ Medium Risk (Attention)' },
  { value: 'low', label: '✅ Low Risk (On Track)' },
  { value: 'insufficient', label: 'ℹ️ Insufficient Data' },
];

/**
 * RiskBadge component adapted from EduRiskMonitor with ClassPulse Tailwind design system
 */
export function RiskBadge({ level, score, showScore = true }) {
  if (!level) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        <span>Insufficient Data</span>
      </span>
    );
  }

  const normalized = String(level).toLowerCase().trim();
  if (normalized === 'high') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
        <span>High Risk</span>
        {showScore && typeof score === 'number' && (
          <span className="ml-0.5 px-1.5 py-0.5 bg-rose-200/60 dark:bg-rose-900/60 rounded text-[11px] font-mono font-extrabold">
            {score}
          </span>
        )}
      </span>
    );
  }

  if (normalized === 'medium') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        <span>Medium Risk</span>
        {showScore && typeof score === 'number' && (
          <span className="ml-0.5 px-1.5 py-0.5 bg-amber-200/60 dark:bg-amber-900/60 rounded text-[11px] font-mono font-extrabold">
            {score}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span>Low Risk</span>
      {showScore && typeof score === 'number' && (
        <span className="ml-0.5 px-1.5 py-0.5 bg-emerald-200/60 dark:bg-emerald-900/60 rounded text-[11px] font-mono font-extrabold">
          {score}
        </span>
      )}
    </span>
  );
}

// Format short readable section name (e.g. "Section A")
const formatShortSectionName = (sec) => {
  if (!sec) return 'Section';
  const trimmed = String(sec).trim();
  if (/^section\s+/i.test(trimmed)) return trimmed;
  if (/^sec\.?\s+/i.test(trimmed)) {
    return `Section ${trimmed.replace(/^sec\.?\s+/i, '')}`;
  }
  return `Section ${trimmed}`;
};

export default function TeacherRiskAnalytics({ currentUser }) {
  // Master analytics response state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Interactive Filter States
  const [yearFilter, setYearFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [riskCategoryFilter, setRiskCategoryFilter] = useState('all');

  // Search & Sorting & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('riskScore'); // default sort by risk score descending
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Student Profile Modal State
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load analytics from backend with active filters
  const loadRiskAnalytics = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const params = {};
      if (yearFilter !== 'all') params.yearOfStudy = yearFilter;
      if (departmentFilter !== 'all') params.department = departmentFilter;
      if (sectionFilter !== 'all') params.classId = sectionFilter;
      if (subjectFilter !== 'all') params.subjectId = subjectFilter;
      if (riskCategoryFilter !== 'all') params.riskLevel = riskCategoryFilter;

      const res = await teacherApi.getTeacherRiskAnalytics(params);
      if (res && res.success) {
        setAnalyticsData(res);
      } else {
        setError(res?.error || 'Failed to load student risk analytics.');
      }
    } catch (err) {
      console.error('getTeacherRiskAnalytics error:', err);
      setError(
        err.response?.data?.error ||
        err.message ||
        'Unable to load student risk analytics. Please check connection.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [yearFilter, departmentFilter, sectionFilter, subjectFilter, riskCategoryFilter]);

  useEffect(() => {
    loadRiskAnalytics();
  }, [loadRiskAnalytics]);

  // Derived filter options from backend response
  const filterOptions = analyticsData?.filterOptions || {};

  // Department dropdown options based on Year filter
  const departmentDropdownOptions = useMemo(() => {
    const list = [{ value: 'all', label: 'All Departments' }];
    const depts = filterOptions.departments || [];
    depts.forEach(d => {
      list.push({ value: d, label: d });
    });
    return list;
  }, [filterOptions.departments]);

  // Section dropdown options based on Year & Dept filters
  const sectionDropdownOptions = useMemo(() => {
    const list = [{ value: 'all', label: 'All Sections' }];
    const secs = filterOptions.sections || [];

    let filtered = secs;
    if (yearFilter !== 'all') {
      filtered = filtered.filter(s => s.yearOfStudy === yearFilter);
    }
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(s => s.department?.toLowerCase() === departmentFilter.toLowerCase());
    }

    // Sort alphabetically
    filtered.sort((a, b) => (a.section || '').localeCompare(b.section || ''));

    filtered.forEach(s => {
      const shortName = formatShortSectionName(s.section);
      const label = departmentFilter === 'all' && s.department
        ? `${shortName} (${s.department})`
        : shortName;
      list.push({
        value: s._id,
        label
      });
    });

    return list;
  }, [filterOptions.sections, yearFilter, departmentFilter]);

  // Subject dropdown options
  const subjectDropdownOptions = useMemo(() => {
    const list = [{ value: 'all', label: 'All Assigned Subjects' }];
    const subjs = filterOptions.subjects || [];
    subjs.forEach(s => {
      list.push({
        value: s._id,
        label: s.label || s.name
      });
    });
    return list;
  }, [filterOptions.subjects]);

  // Cascading Filter Handlers
  const handleYearChange = (newYear) => {
    setYearFilter(newYear);
    // Validate downstream section
    if (sectionFilter !== 'all') {
      const valid = (filterOptions.sections || []).some(
        s => s._id === sectionFilter && (newYear === 'all' || s.yearOfStudy === newYear)
      );
      if (!valid) setSectionFilter('all');
    }
    setCurrentPage(1);
  };

  const handleDepartmentChange = (newDept) => {
    setDepartmentFilter(newDept);
    if (sectionFilter !== 'all') {
      const valid = (filterOptions.sections || []).some(
        s => s._id === sectionFilter && (newDept === 'all' || s.department?.toLowerCase() === newDept.toLowerCase())
      );
      if (!valid) setSectionFilter('all');
    }
    setCurrentPage(1);
  };

  // Client-side search and sorting on returned authorized student risk records
  const allStudents = analyticsData?.students || [];

  const processedStudents = useMemo(() => {
    let result = [...allStudents];

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(s => {
        const name = (s.name || '').toLowerCase();
        const sid = (s.studentId || '').toLowerCase();
        return name.includes(q) || sid.includes(q);
      });
    }

    // Sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

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

      if (sortField === 'riskScore') {
        const aNum = typeof a.riskScore === 'number' ? a.riskScore : -1;
        const bNum = typeof b.riskScore === 'number' ? b.riskScore : -1;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      if (sortField === 'attendance') {
        const aNum = typeof a.attendancePercentage === 'number' ? a.attendancePercentage : -1;
        const bNum = typeof b.attendancePercentage === 'number' ? b.attendancePercentage : -1;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      if (sortField === 'assessment') {
        const aNum = typeof a.assessmentScore === 'number' ? a.assessmentScore : -1;
        const bNum = typeof b.assessmentScore === 'number' ? b.assessmentScore : -1;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      return 0;
    });

    return result;
  }, [allStudents, searchTerm, sortField, sortDirection]);

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

  // Open Student Details Modal (Read-Only)
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

  // Summary Metrics
  const summary = analyticsData?.summary || {
    totalStudents: 0,
    highRiskCount: 0,
    highRiskPercentage: 0,
    mediumRiskCount: 0,
    mediumRiskPercentage: 0,
    lowRiskCount: 0,
    lowRiskPercentage: 0,
    insufficientDataCount: 0,
    averageAttendance: null,
    averagePerformance: null,
    averageRiskScore: null
  };

  // Chart Datasets
  const charts = analyticsData?.charts || {
    riskDistribution: [],
    attendanceDistribution: [],
    performanceDistribution: []
  };

  // Loading skeleton
  if (loading && !analyticsData) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto pb-16 pt-1" data-testid="teacher-risk-analytics-loading">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl h-24 border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl h-72 border border-slate-200 dark:border-slate-800 animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error && !analyticsData) {
    return (
      <div className="max-w-xl mx-auto my-8 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-8 rounded-2xl shadow-sm text-center">
        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Unable to Load Student Risk Analytics
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
          {error}
        </p>
        <button
          onClick={() => loadRiskAnalytics(false)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16 transition-colors duration-200" data-testid="teacher-risk-analytics-page">
      {/* 1. Sub-Header: No duplicate heading, clean descriptive badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
            <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Student Risk Analytics</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time dropout risk detection, attendance patterns, and explainable intervention radar adapted from EduRiskMonitor.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadRiskAnalytics(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl text-xs sm:text-sm font-medium transition-all shadow-xs self-start sm:self-auto cursor-pointer disabled:opacity-60 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* 2. Interactive Filter Scope Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 space-y-3">
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
              data-testid="risk-search-input"
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

          {/* Filters: Year -> Dept -> Section -> Subject -> Risk Category */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Year Filter */}
            <TeacherDropdown
              id="risk-filter-year"
              data-testid="risk-filter-year"
              value={yearFilter}
              onChange={(e) => handleYearChange(e.target.value)}
              options={ACADEMIC_YEARS}
              placeholder="All Years"
              title="Filter by Year"
              icon={Calendar}
              className="w-full sm:w-auto min-w-[140px]"
              menuClassName="w-full sm:w-[180px]"
            />

            {/* Department Filter */}
            <TeacherDropdown
              id="risk-filter-dept"
              data-testid="risk-filter-dept"
              value={departmentFilter}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              options={departmentDropdownOptions}
              placeholder="All Departments"
              title="Filter by Department"
              icon={Building2}
              className="w-full sm:w-auto min-w-[170px]"
              menuClassName="w-full sm:w-[240px]"
            />

            {/* Section Filter */}
            <TeacherDropdown
              id="risk-filter-section"
              data-testid="risk-filter-section"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              options={sectionDropdownOptions}
              placeholder="All Sections"
              title="Filter by Section"
              icon={Layers}
              className="w-full sm:w-auto min-w-[155px]"
              menuClassName="w-full sm:w-[210px]"
            />

            {/* Subject Filter */}
            <TeacherDropdown
              id="risk-filter-subject"
              data-testid="risk-filter-subject"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              options={subjectDropdownOptions}
              placeholder="All Subjects"
              title="Filter by Subject"
              icon={BookOpen}
              className="w-full sm:w-auto min-w-[175px]"
              menuClassName="w-full sm:w-[270px]"
            />

            {/* Risk Category Filter (from EduRiskMonitor) */}
            <TeacherDropdown
              id="risk-filter-level"
              data-testid="risk-filter-level"
              value={riskCategoryFilter}
              onChange={(e) => setRiskCategoryFilter(e.target.value)}
              options={RISK_LEVEL_OPTIONS}
              placeholder="All Risk Categories"
              title="Filter by Risk Category"
              icon={ShieldAlert}
              className="w-full sm:w-auto min-w-[185px]"
              menuClassName="w-full sm:w-[230px]"
            />
          </div>
        </div>

        {/* Active Filter Chips */}
        {(yearFilter !== 'all' || departmentFilter !== 'all' || sectionFilter !== 'all' || subjectFilter !== 'all' || riskCategoryFilter !== 'all' || searchTerm) && (
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
                <span>Section active</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSectionFilter('all')} />
              </span>
            )}
            {subjectFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                <span>Subject active</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSubjectFilter('all')} />
              </span>
            )}
            {riskCategoryFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold">
                <span>Category: {riskCategoryFilter}</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setRiskCategoryFilter('all')} />
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
                setSubjectFilter('all');
                setRiskCategoryFilter('all');
                setSearchTerm('');
              }}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold ml-auto cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* 3. Analytics Summary Cards (Adapted from EduRiskMonitor Admin & Mentor Dashboards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Students in Scope */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Students
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {summary.totalStudents}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Enrolled across authorized sections
          </p>
        </div>

        {/* Card 2: High Risk (Immediate Action Alert) */}
        <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              High Risk (Alert)
            </span>
            <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
              {summary.highRiskCount}
            </span>
            <span className="text-xs text-rose-600/80 dark:text-rose-400/80 font-medium">
              ({summary.highRiskPercentage}%)
            </span>
          </div>
          <p className="text-[11px] text-rose-600/70 dark:text-rose-400/70 mt-1">
            Immediate intervention recommended
          </p>
        </div>

        {/* Card 3: Medium Risk (Requiring Attention) */}
        <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Requiring Attention
            </span>
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {summary.mediumRiskCount}
            </span>
            <span className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium">
              ({summary.mediumRiskPercentage}%)
            </span>
          </div>
          <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-1">
            Proactive monitoring advised
          </p>
        </div>

        {/* Card 4: Low Risk (On Track) */}
        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              On Track (Low Risk)
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {summary.lowRiskCount}
            </span>
            <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-medium">
              ({summary.lowRiskPercentage}%)
            </span>
          </div>
          <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">
            Meeting attendance & score goals
          </p>
        </div>
      </div>

      {/* Averages Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-800">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400">Average Attendance</span>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {summary.averageAttendance !== null ? `${summary.averageAttendance}%` : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-800">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400">Average Assessment Score</span>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {summary.averagePerformance !== null ? `${summary.averagePerformance}%` : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 border border-slate-200 dark:border-slate-800">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400">Insufficient Data Records</span>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {summary.insufficientDataCount} students
            </p>
          </div>
        </div>
      </div>

      {/* 4. Risk Analytics Charts (Adapted from EduRiskMonitor EngagementChart & AdminDashboard) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Risk Level Distribution (Donut / Pie) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Risk Level Distribution
              </h3>
              <p className="text-[11px] text-slate-400">
                Proportion of students across risk brackets
              </p>
            </div>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>

          {charts.riskDistribution && charts.riskDistribution.some(d => d.count > 0) ? (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.riskDistribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {charts.riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '0.75rem',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-slate-400 text-xs">
              <Activity className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
              <span>No recorded risk data in this scope</span>
            </div>
          )}
        </div>

        {/* Chart 2: Attendance Overview (BarChart from EduRiskMonitor) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Attendance Distribution
              </h3>
              <p className="text-[11px] text-slate-400">
                Institutional 75% threshold compliance
              </p>
            </div>
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
          </div>

          {charts.attendanceDistribution && charts.attendanceDistribution.some(d => d.count > 0) ? (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.attendanceDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '0.75rem',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {charts.attendanceDistribution.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-slate-400 text-xs">
              <CalendarCheck className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
              <span>No attendance records in this scope</span>
            </div>
          )}
        </div>

        {/* Chart 3: Assessment Performance Brackets (from EduRiskMonitor) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Assessment Performance Bands
              </h3>
              <p className="text-[11px] text-slate-400">
                Evaluation marks breakdown across selected students
              </p>
            </div>
            <GraduationCap className="w-4 h-4 text-emerald-600" />
          </div>

          {charts.performanceDistribution && charts.performanceDistribution.some(d => d.count > 0) ? (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.performanceDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '0.75rem',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {charts.performanceDistribution.map((entry, index) => (
                      <Cell key={`perf-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-slate-400 text-xs">
              <GraduationCap className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
              <span>No assessment marks recorded in this scope</span>
            </div>
          )}
        </div>
      </div>

      {/* 5. Student Risk Directory Table (Adapted from EduRiskMonitor MentorDashboard) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Student Risk & Intervention Directory</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                {processedStudents.length} {processedStudents.length === 1 ? 'student' : 'students'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Individual risk breakdown, explainable contributing factors, and educator recommendations.
            </p>
          </div>
        </div>

        {processedStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-semibold select-none">
                <tr>
                  {/* Student */}
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:text-emerald-600 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Student</span>
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Student ID */}
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:text-emerald-600 transition-colors"
                    onClick={() => handleSort('studentId')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Student ID</span>
                      {sortField === 'studentId' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Attendance */}
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:text-emerald-600 transition-colors"
                    onClick={() => handleSort('attendance')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Attendance</span>
                      {sortField === 'attendance' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Assessment */}
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:text-emerald-600 transition-colors"
                    onClick={() => handleSort('assessment')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Assessment</span>
                      {sortField === 'assessment' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Risk Level & Score */}
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:text-emerald-600 transition-colors"
                    onClick={() => handleSort('riskScore')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Risk Level & Score</span>
                      {sortField === 'riskScore' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Primary Contributing Factors */}
                  <th className="px-5 py-3.5">
                    <span>Contributing Factors (EduRiskMonitor)</span>
                  </th>

                  {/* Follow-up Action */}
                  <th className="px-5 py-3.5 text-right">
                    <span>Follow-up Action</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginatedStudents.map((student) => {
                  const hasAttendance = typeof student.attendancePercentage === 'number';
                  const hasAssessment = typeof student.assessmentScore === 'number';

                  return (
                    <tr
                      key={student._id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      data-testid={`risk-row-${student.studentId}`}
                    >
                      {/* 1. Student Name & Class */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                          {student.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {student.yearOfStudy} · Sec {student.section} · {student.department}
                        </div>
                      </td>

                      {/* 2. Student ID */}
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {student.studentId}
                      </td>

                      {/* 3. Attendance */}
                      <td className="px-5 py-3.5">
                        {hasAttendance ? (
                          <div className="inline-flex items-center gap-1.5 font-semibold">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                student.attendancePercentage >= 75
                                  ? 'bg-emerald-500'
                                  : student.attendancePercentage >= 65
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                            />
                            <span
                              className={
                                student.attendancePercentage >= 75
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : student.attendancePercentage >= 65
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-rose-700 dark:text-rose-400'
                              }
                            >
                              {student.attendancePercentage}%
                            </span>
                            {typeof student.classesAttended === 'number' && typeof student.totalClassesHeld === 'number' && student.totalClassesHeld > 0 && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({student.classesAttended}/{student.totalClassesHeld})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* 4. Assessment Performance */}
                      <td className="px-5 py-3.5">
                        {hasAssessment ? (
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {student.assessmentScore}%
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* 5. Risk Level & Score Badge */}
                      <td className="px-5 py-3.5">
                        <RiskBadge level={student.riskLevel} score={student.riskScore} />
                      </td>

                      {/* 6. Primary Contributing Factors */}
                      <td className="px-5 py-3.5 max-w-xs truncate">
                        {student.riskFactors && student.riskFactors.length > 0 ? (
                          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                            <span className="truncate" title={student.riskFactors.join('; ')}>
                              {student.riskFactors[0]}
                              {student.riskFactors.length > 1 && ` (+${student.riskFactors.length - 1} more)`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No risk detected</span>
                        )}
                      </td>

                      {/* 7. Action Button */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenProfileModal(student._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/50 text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 transition-colors cursor-pointer"
                          data-testid={`risk-view-profile-btn-${student.studentId}`}
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
        ) : (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
            <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-1" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No students match the selected filter criteria
            </p>
            <p className="text-xs text-slate-400">
              Try adjusting the year, department, section, subject, or risk level filters.
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Page <span className="font-semibold text-slate-800 dark:text-slate-200">{currentPage}</span> of{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPages}</span>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Explainable Risk Methodology & Educator Guidance Notice */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
          <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>EduRiskMonitor Explainable Methodology & Institutional Framework</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Student Risk Analytics uses a transparent, rule-based algorithm adapted from <span className="font-semibold text-slate-800 dark:text-slate-200">EduRiskMonitor</span> combining attendance fidelity (0 - 50 points, with a minimum 75% institutional requirement) and academic assessment performance (0 - 50 points, with a 40% passing benchmark).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-rose-600 dark:text-rose-400">High Risk (67 - 100 pts)</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Attendance &lt; 65% or assessment &lt; 40%. Requires prompt academic intervention and counseling.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-amber-600 dark:text-amber-400">Medium Risk (34 - 66 pts)</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Attendance between 65%-74% or assessment between 40%-59%. Proactive tracking and tutorial reviews.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Low Risk (0 - 33 pts)</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Attendance ≥ 75% and assessment ≥ 60%. Student is consistently meeting institutional standards.
            </p>
          </div>
        </div>
      </div>

      {/* 7. Student Profile Details Modal (Read-Only) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          data-testid="student-risk-profile-modal"
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Student Risk Profile & Follow-up
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
                data-testid="risk-modal-header-close-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
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
                <div className="space-y-4">
                  {/* Demographics */}
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
                      <span className="text-slate-400 font-medium">Email</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">{studentDetails.email || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Academic Year</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{studentDetails.academicYear || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Risk Status</span>
                      <div className="mt-0.5">
                        <RiskBadge level={studentDetails.riskLevel} score={studentDetails.riskScore} />
                      </div>
                    </div>
                  </div>

                  {/* Summary Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Attendance Summary */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Attendance Summary</span>
                        <CalendarCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                          {typeof studentDetails.attendancePercentage === 'number' ? `${studentDetails.attendancePercentage}%` : '—'}
                        </span>
                        {typeof studentDetails.classesAttended === 'number' && typeof studentDetails.totalClassesHeld === 'number' && studentDetails.totalClassesHeld > 0 && (
                          <span className="text-xs text-slate-400">
                            ({studentDetails.classesAttended} / {studentDetails.totalClassesHeld} classes)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {typeof studentDetails.attendancePercentage === 'number'
                          ? studentDetails.attendancePercentage >= 75
                            ? 'Good Standing (above 75% institutional threshold)'
                            : 'Attendance Warning (below 75% institutional requirement)'
                          : 'No attendance records recorded yet'}
                      </p>
                    </div>

                    {/* Academic Performance */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Assessment Score</span>
                        <GraduationCap className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                          {typeof studentDetails.assessmentScore === 'number' ? `${studentDetails.assessmentScore}%` : '—'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {typeof studentDetails.assessmentScore === 'number'
                          ? studentDetails.assessmentScore >= 60
                            ? 'Satisfactory academic performance'
                            : 'Assessment score requires academic follow-up'
                          : 'No assessment scores recorded yet'}
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

                  {/* Saved Academic & Attendance Records Table */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Saved Academic & Attendance Records</span>
                    </h4>

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
                        No saved attendance or assessment records found for this student.
                      </div>
                    )}
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
                data-testid="risk-modal-footer-close-btn"
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
