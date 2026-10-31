import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  CalendarCheck, 
  BookOpenCheck, 
  TrendingUp, 
  FileText, 
  Sparkles, 
  GraduationCap, 
  Building2, 
  AlertCircle, 
  RefreshCw, 
  Loader2, 
  Layers, 
  Award,
  HeartHandshake
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { studentApi } from '../api';
import { useTheme } from '../context/ThemeContext';
import { usePageRefresh } from '../context/RefreshContext';

export default function StudentDashboardOverview({ currentUser }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logoLoadError, setLogoLoadError] = useState(false);

  const fetchStudentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await studentApi.getDashboard();
      if (response && response.success) {
        setData(response);
      } else {
        setError(response?.error || 'Failed to load student dashboard.');
      }
    } catch (err) {
      console.error('Student Dashboard Overview Error:', err);
      setError(err?.response?.data?.error || err.message || 'Unable to connect to student service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  // Register with global header refresh button
  usePageRefresh(fetchStudentData, [fetchStudentData]);

  useEffect(() => {
    setLogoLoadError(false);
  }, [data?.institution?.logoUrl]);

  // Student and Institution details
  const student = data?.student;
  const assignments = data?.assignments || [];
  const academicRecords = data?.academicRecords || [];
  const institution = data?.institution;

  const institutionName = institution?.name || currentUser?.institution?.name || '';
  const rawLogoUrl = typeof institution?.logoUrl === 'string'
    ? institution.logoUrl.trim()
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

  // Derived metrics from verified student records (ZERO FABRICATION)
  const { averageScore, averageAttendance, scoreChartData, attendanceChartData } = useMemo(() => {
    if (!academicRecords || academicRecords.length === 0) {
      return {
        averageScore: null,
        averageAttendance: null,
        scoreChartData: [],
        attendanceChartData: []
      };
    }

    let totalMarks = 0;
    let marksObtained = 0;
    let attendanceSum = 0;
    let attendanceCount = 0;

    const sChart = [];
    const aChart = [];

    academicRecords.forEach((rec, idx) => {
      const subName = rec.subject?.code || rec.subject?.name || `Subject ${idx + 1}`;
      
      if (typeof rec.marksObtained === 'number' && typeof rec.totalMarks === 'number' && rec.totalMarks > 0) {
        marksObtained += rec.marksObtained;
        totalMarks += rec.totalMarks;
        const pct = Math.round((rec.marksObtained / rec.totalMarks) * 100);
        sChart.push({
          subject: subName,
          score: pct
        });
      }

      if (typeof rec.attendancePercentage === 'number') {
        attendanceSum += rec.attendancePercentage;
        attendanceCount += 1;
        aChart.push({
          subject: subName,
          attendance: Math.round(rec.attendancePercentage)
        });
      }
    });

    const avgScore = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : null;
    const avgAtt = attendanceCount > 0 ? Math.round(attendanceSum / attendanceCount) : null;

    return {
      averageScore: avgScore,
      averageAttendance: avgAtt,
      scoreChartData: sChart,
      attendanceChartData: aChart
    };
  }, [academicRecords]);

  // Keyboard navigation for clickable analytics cards
  const handleCardKeyDown = (e, path) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(path);
    }
  };

  // Recharts styling tokens matching Teacher & Admin dashboards
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
        <Loader2 className="w-8 h-8 animate-spin text-[#1E3A8A] dark:text-blue-400 mb-3" />
        <p className="text-sm font-medium">Loading your student dashboard...</p>
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
          Unable to Load Dashboard
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {error}
        </p>
        <button
          onClick={fetchStudentData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl text-sm font-medium transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // 4 Summary cards matching Teacher Dashboard's visual layout
  const statCards = [
    {
      label: 'My Subjects',
      value: assignments.length,
      subtext: assignments.length > 0 ? `${assignments.length} enrolled subjects` : 'No subjects assigned yet',
      icon: BookOpen,
      color: 'text-[#1E3A8A] dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/60',
      link: '/student/subjects'
    },
    {
      label: 'My Attendance',
      value: averageAttendance !== null ? `${averageAttendance}%` : '--',
      subtext: averageAttendance !== null ? 'Cumulative average' : 'No attendance recorded',
      icon: CalendarCheck,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/60',
      link: '/student/attendance'
    },
    {
      label: 'My Assignments',
      value: assignments.length,
      subtext: data?.assignmentsPending ? 'Curriculum pending' : `${assignments.length} assigned courses`,
      icon: BookOpenCheck,
      color: 'text-[#1E3A8A] dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/60',
      link: '/student/assignments'
    },
    {
      label: 'My Learning Progress',
      value: averageScore !== null ? `${averageScore}%` : '--',
      subtext: averageScore !== null ? 'Overall score average' : 'No records evaluated',
      icon: TrendingUp,
      color: 'text-[#1E3A8A] dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/60',
      link: '/student/learning-progress'
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* 1. Student Welcome Banner & College Branding */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-200 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/80 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6 text-[#1E3A8A] dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
              Welcome, {student?.name || currentUser?.name || 'Student'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">
              {[
                student?.course,
                student?.department ? `Department of ${student.department}` : null,
                student?.academicYear ? `Year ${student.academicYear}` : null,
                student?.section ? `Section ${student.section}` : null
              ].filter(Boolean).join(' • ') || 'Academic Coursework & Progress'}
            </p>
          </div>
        </div>

        {/* College Branding Area */}
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
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/80 flex items-center justify-center shrink-0 text-[#1E3A8A] dark:text-blue-400 font-bold text-xs shadow-2xs select-none">
                {collegeInitials ? (
                  <span>{collegeInitials}</span>
                ) : (
                  <Building2 className="w-5 h-5 text-[#1E3A8A] dark:text-blue-400" />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
        {statCards.map((card, idx) => {
          const CardContent = (
            <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-7 min-h-[148px] flex flex-col justify-center gap-3.5 transition-all hover:shadow-md ${card.link ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-800' : ''}`}>
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
                <div className="flex items-center justify-between mt-1.5 flex-wrap gap-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{card.label}</p>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">{card.subtext}</span>
                </div>
              </div>
            </div>
          );
          return (
            <Link 
              to={card.link} 
              key={idx} 
              className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] rounded-2xl"
            >
              {CardContent}
            </Link>
          );
        })}
      </div>

      {/* 3. Three Large Information Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-7">
        
        {/* Card 1: Academic Performance */}
        <div 
          role="link"
          tabIndex={0}
          onClick={() => navigate('/student/academic-records')}
          onKeyDown={(e) => handleCardKeyDown(e, '/student/academic-records')}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col transition-all duration-200 cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] group"
          aria-label="View Academic Records"
        >
          <div className="flex justify-between items-center mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 group-hover:text-[#1E3A8A] dark:group-hover:text-blue-400 transition-colors">
              <FileText className="w-5 h-5 text-[#1E3A8A] dark:text-blue-400" />
              <span>Academic Performance</span>
            </h2>
            {academicRecords.length > 0 && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                {academicRecords.length} {academicRecords.length === 1 ? 'Record' : 'Records'}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-[270px] flex flex-col justify-center">
            {scoreChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={270}>
                <LineChart data={scoreChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis 
                    dataKey="subject" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: axisTickColor, fontSize: 11 }} 
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
                    dataKey="score" 
                    name="Score (%)" 
                    stroke="#1E3A8A" 
                    strokeWidth={3} 
                    dot={{ r: 5, strokeWidth: 2 }} 
                    activeDot={{ r: 7 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full min-h-[270px] flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No assessment results recorded yet.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                  Your internal test scores, lab marks, and semester performance will appear here once recorded by faculty.
                </p>
              </div>
            )}
          </div>

          {averageScore !== null && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {`${averageScore}%`}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Overall Average Score
              </p>
            </div>
          )}
        </div>

        {/* Card 2: Attendance Overview */}
        <div 
          role="link"
          tabIndex={0}
          onClick={() => navigate('/student/attendance')}
          onKeyDown={(e) => handleCardKeyDown(e, '/student/attendance')}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col transition-all duration-200 cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] group"
          aria-label="View Attendance"
        >
          <div className="flex justify-between items-center mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              <CalendarCheck className="w-5 h-5 text-emerald-500" />
              <span>Attendance Overview</span>
            </h2>
            {averageAttendance !== null && (
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                {averageAttendance >= 75 ? 'Regular' : 'Low Attendance'}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-[270px] flex flex-col justify-center">
            {attendanceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={270}>
                <LineChart data={attendanceChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis 
                    dataKey="subject" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: axisTickColor, fontSize: 11 }} 
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
                    dataKey="attendance" 
                    name="Attendance (%)" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ r: 5, strokeWidth: 2 }} 
                    activeDot={{ r: 7 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full min-h-[270px] flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
                <CalendarCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No attendance records recorded yet.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                  Session attendance roll call and percentage records will appear here once recorded by your instructors.
                </p>
              </div>
            )}
          </div>

          {averageAttendance !== null && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {`${averageAttendance}%`}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Cumulative Attendance Average
              </p>
            </div>
          )}
        </div>

        {/* Card 3: Learning Support */}
        <div 
          role="link"
          tabIndex={0}
          onClick={() => navigate('/student/interventions')}
          onKeyDown={(e) => handleCardKeyDown(e, '/student/interventions')}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col transition-all duration-200 cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] group"
          aria-label="View Learning Support & Interventions"
        >
          <div className="flex justify-between items-center mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 group-hover:text-[#1E3A8A] dark:group-hover:text-blue-400 transition-colors">
              <Sparkles className="w-5 h-5 text-[#1E3A8A] dark:text-blue-400" />
              <span>Learning Support</span>
            </h2>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
              Guidance
            </span>
          </div>

          <div className="flex-1 min-h-[270px] flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
            <HeartHandshake className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No active learning interventions.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
              Personalized learning plans, remedial practice sets, and recovery support from your teachers will appear here.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <span className="text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 hover:underline">
              Explore Academic Support &rarr;
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
