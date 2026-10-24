import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Layers, 
  Users, 
  Activity, 
  CalendarCheck, 
  FileText, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  GraduationCap,
  Building2 
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { teacherApi } from '../api';
import { useTheme } from '../context/ThemeContext';

export default function TeacherDashboardOverview({ currentUser }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logoLoadError, setLogoLoadError] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await teacherApi.getDashboardAnalytics();
      if (response && response.success) {
        setData(response);
      } else {
        setError(response?.error || 'Failed to load teacher dashboard analytics.');
      }
    } catch (err) {
      console.error('Teacher Dashboard Data Error:', err);
      setError(err?.response?.data?.error || err.message || 'Unable to connect to teacher analytics service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    setLogoLoadError(false);
  }, [data?.context?.logoUrl]);

  // College branding data resolution
  const institutionName = data?.context?.institutionName || currentUser?.institution?.name || '';
  const rawLogoUrl = typeof data?.context?.logoUrl === 'string'
    ? data.context.logoUrl.trim()
    : (typeof currentUser?.institution?.logoUrl === 'string' ? currentUser.institution.logoUrl.trim() : '');
  const isLogoConfigured = Boolean(
    rawLogoUrl && 
    (rawLogoUrl.startsWith('http://') || rawLogoUrl.startsWith('https://') || rawLogoUrl.startsWith('/uploads/') || rawLogoUrl.startsWith('data:image/'))
  );
  const showLogoImage = isLogoConfigured && !logoLoadError;

  const collegeInitials = useMemo(() => {
    if (!institutionName) return '';
    const words = institutionName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }, [institutionName]);

  const handleCardKeyDown = (e, path) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(path);
    }
  };

  // Chart styling helpers
  const gridStroke = isDark ? '#334155' : '#e2e8f0';
  const axisTickColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipStyle = {
    borderRadius: '8px',
    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-full min-h-[400px] text-slate-500 dark:text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium">Loading teacher analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-6 rounded-2xl shadow-sm text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
          Unable to Load Analytics
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {error}
        </p>
        <button
          onClick={fetchDashboardData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const statCards = [
    {
      label: 'My Subjects',
      value: data?.stats?.mySubjects ?? 0,
      icon: BookOpen,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/60',
      link: '/teacher/subjects'
    },
    {
      label: 'My Classes',
      value: data?.stats?.myClasses ?? 0,
      icon: Layers,
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-950/60',
      link: '/teacher/classes'
    },
    {
      label: 'Total Students',
      value: data?.stats?.totalStudents ?? 0,
      icon: Users,
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-50 dark:bg-cyan-950/60',
      link: '/teacher/students'
    },
    {
      label: 'Students at Risk',
      value: data?.stats?.studentsAtRisk ?? 0,
      icon: Activity,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/60',
      link: '/teacher/risk-analytics'
    }
  ];

  const scoreToDisplay = data?.scoreAnalytics?.overallAverageScore ?? null;
  const attendanceToDisplay = data?.attendanceAnalytics?.overallAverageAttendance ?? null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* 1. Teacher Welcome Banner & College Branding */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-200 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
              Welcome, {data?.context?.teacherName || currentUser?.name || 'Faculty'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">
              {data?.context?.designation ? `${data.context.designation} • ` : ''}
              {data?.context?.departmentName ? `Department of ${data.context.departmentName}` : 'Academic Overview & Analytics'}
            </p>
          </div>
        </div>

        {/* Polished College Branding Area */}
        {institutionName && (
          <div className="flex items-center gap-3 self-stretch sm:self-auto bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 px-3.5 py-2.5 rounded-xl shrink-0 max-w-full sm:max-w-xs transition-colors">
            {showLogoImage ? (
              <img
                src={rawLogoUrl}
                alt={`${institutionName} Logo`}
                className="w-10 h-10 object-contain rounded-lg shrink-0 bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700/60 shadow-2xs"
                referrerPolicy="no-referrer"
                onError={() => setLogoLoadError(true)}
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center shrink-0 text-emerald-700 dark:text-emerald-400 font-bold text-xs shadow-2xs select-none">
                {collegeInitials ? (
                  <span>{collegeInitials}</span>
                ) : (
                  <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                Institution
              </p>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-snug" title={institutionName}>
                {institutionName}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Four Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => {
          const CardContent = (
            <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-center gap-3 transition-all hover:shadow-md ${card.link ? 'cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700/60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{card.label}</p>
              </div>
            </div>
          );
          return card.link ? (
            <Link 
              to={card.link} 
              key={idx} 
              className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
            >
              {CardContent}
            </Link>
          ) : (
            <div key={idx}>{CardContent}</div>
          );
        })}
      </div>

      {/* 3. Three Analytics Cards (All Clickable Navigation Surfaces) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Graph 1: Student Risk Analysis (Navigates to Student Risk Analytics) */}
        <div 
          role="link"
          tabIndex={0}
          onClick={() => navigate('/teacher/risk-analytics')}
          onKeyDown={(e) => handleCardKeyDown(e, '/teacher/risk-analytics')}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col transition-all duration-200 cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 group"
          aria-label="View Student Risk Analytics"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              <Activity className="w-5 h-5 text-emerald-500" />
              <span>Student Risk Analysis</span>
            </h2>
          </div>

          <div className="flex-1 min-h-[250px] relative flex flex-col justify-center">
            {data?.riskAnalytics?.isAvailable && data.riskAnalytics.total > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data.riskAnalytics.data}
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.riskAnalytics.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                    {data.riskAnalytics.total}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Total Evaluated
                  </span>
                </div>
              </>
            ) : (
              <div className="h-full min-h-[250px] flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
                <Activity className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Risk analysis not yet available.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                  Predictions will appear here once the risk assessment model generates results for your assigned students.
                </p>
              </div>
            )}
          </div>

          {data?.riskAnalytics?.isAvailable && data.riskAnalytics.total > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-4 flex-wrap">
              {data.riskAnalytics.data.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <span>{r.value} {r.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Graph 2: Average Attendance (Navigates to Attendance) */}
        <div 
          role="link"
          tabIndex={0}
          onClick={() => navigate('/teacher/attendance')}
          onKeyDown={(e) => handleCardKeyDown(e, '/teacher/attendance')}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col transition-all duration-200 cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 group"
          aria-label="View Attendance"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              <CalendarCheck className="w-5 h-5 text-emerald-500" />
              <span>Average Attendance</span>
            </h2>
            {data?.attendanceAnalytics?.attendance?.length === 1 && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                1 Academic Year
              </span>
            )}
            {data?.attendanceAnalytics?.attendance?.length > 1 && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                {data.attendanceAnalytics.attendance.length} Academic Years
              </span>
            )}
          </div>

          <div className="flex-1 min-h-[250px] flex flex-col justify-center">
            {data?.attendanceAnalytics?.hasData && data.attendanceAnalytics.attendance.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart 
                  data={data.attendanceAnalytics.attendance} 
                  margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis 
                    dataKey="year" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: axisTickColor, fontSize: 12 }} 
                    dy={10} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: axisTickColor, fontSize: 12 }} 
                    domain={[0, 100]} 
                  />
                  <Tooltip 
                    cursor={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} 
                    contentStyle={tooltipStyle} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="averageAttendance" 
                    name="Attendance (%)" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ r: 5, strokeWidth: 2 }} 
                    activeDot={{ r: 7 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full min-h-[250px] flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
                <CalendarCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No attendance data available yet.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                  Student attendance records will appear here once recorded for your classes.
                </p>
              </div>
            )}
          </div>

          {data?.attendanceAnalytics?.hasData && data.attendanceAnalytics.attendance.length > 0 && attendanceToDisplay !== null && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {`${attendanceToDisplay}%`}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Overall Average Attendance
              </p>
            </div>
          )}
        </div>

        {/* Graph 3: Overall Average Score (Navigates to Academic Records) */}
        <div 
          role="link"
          tabIndex={0}
          onClick={() => navigate('/teacher/academic-records')}
          onKeyDown={(e) => handleCardKeyDown(e, '/teacher/academic-records')}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col transition-all duration-200 cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 group"
          aria-label="View Academic Records"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
              <FileText className="w-5 h-5 text-teal-500" />
              <span>Overall Average Score</span>
            </h2>
            {data?.scoreAnalytics?.performance?.length === 1 && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                1 Academic Year
              </span>
            )}
            {data?.scoreAnalytics?.performance?.length > 1 && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                {data.scoreAnalytics.performance.length} Academic Years
              </span>
            )}
          </div>

          <div className="flex-1 min-h-[250px] flex flex-col justify-center">
            {data?.scoreAnalytics?.hasData && data.scoreAnalytics.performance.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart 
                  data={data.scoreAnalytics.performance} 
                  margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis 
                    dataKey="year" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: axisTickColor, fontSize: 12 }} 
                    dy={10} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: axisTickColor, fontSize: 12 }} 
                    domain={[0, 100]} 
                  />
                  <Tooltip 
                    cursor={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} 
                    contentStyle={tooltipStyle} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="averageScore" 
                    name="Avg Score (%)" 
                    stroke="#0d9488" 
                    strokeWidth={3} 
                    dot={{ r: 5, strokeWidth: 2 }} 
                    activeDot={{ r: 7 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full min-h-[250px] flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No academic score data available yet.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                  Academic assessment marks and scores will appear here once recorded for your students.
                </p>
              </div>
            )}
          </div>

          {data?.scoreAnalytics?.hasData && data.scoreAnalytics.performance.length > 0 && scoreToDisplay !== null && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {`${scoreToDisplay}%`}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Overall Average Score
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
