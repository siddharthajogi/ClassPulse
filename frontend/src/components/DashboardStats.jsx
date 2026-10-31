import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';
import { Loader2, Users, BookOpen, UserCheck, Building, Activity, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext';

export default function DashboardStats() {
  const { isDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [perfError, setPerfError] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setPerfError(false);
      const [statsRes, riskRes] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getRiskOverview()
      ]);

      let perfData = {
        performance: [],
        attendance: [],
        latestScore: null,
        latestAttendance: null,
        overallAverageScore: null,
        overallAverageAttendance: null
      };
      try {
        const perfRes = await adminApi.getPerformanceAnalytics();
        if (perfRes && perfRes.success) {
          perfData = {
            performance: perfRes.data?.performance || [],
            attendance: perfRes.data?.attendance || [],
            latestScore: perfRes.data?.latestScore ?? null,
            latestAttendance: perfRes.data?.latestAttendance ?? null,
            overallAverageScore: perfRes.data?.overallAverageScore ?? null,
            overallAverageAttendance: perfRes.data?.overallAverageAttendance ?? null
          };
        } else {
          setPerfError(true);
        }
      } catch (err) {
        console.error('Failed to load performance analytics:', err);
        setPerfError(true);
      }
      
      setData({
        stats: statsRes.stats,
        context: statsRes.context,
        performance: perfData.performance,
        attendance: perfData.attendance,
        latestScore: perfData.latestScore,
        latestAttendance: perfData.latestAttendance,
        overallAverageScore: perfData.overallAverageScore,
        overallAverageAttendance: perfData.overallAverageAttendance,
        risk: riskRes.data,
        totalRisk: riskRes.total
      });
    } catch (err) {
      console.error('Dashboard Stats Error:', err);
      setError('Failed to load dashboard statistics: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(fetchDashboardData);

  useEffect(() => {
    setLogoLoadError(false);
  }, [data?.context?.logoUrl]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) return <div className="flex justify-center items-center h-full min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (error) return <div className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 p-4 rounded-lg m-6">{error}</div>;

  const statCards = [
    { label: 'Total Students', value: data?.stats?.totalStudents ?? 0, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/60', link: '/admin/students' },
    { label: 'Total Teachers', value: data?.stats?.totalTeachers ?? 0, icon: BookOpen, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/60', link: '/admin/teachers' },
    { label: 'Active Accounts (Including Admin)', value: data?.stats?.activeAccounts ?? 0, icon: UserCheck, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/60', link: '/admin/accounts' }
  ];

  const hasConfig = data.context.institutionName && data.context.institutionName !== 'Setup Pending';
  const rawLogoUrl = typeof data?.context?.logoUrl === 'string' ? data.context.logoUrl.trim() : '';
  const isLogoConfigured = Boolean(
    rawLogoUrl && 
    (rawLogoUrl.startsWith('http://') || rawLogoUrl.startsWith('https://') || rawLogoUrl.startsWith('/uploads/') || rawLogoUrl.startsWith('data:image/'))
  );
  const showLogoImage = isLogoConfigured && !logoLoadError;

  const gridStroke = isDark ? '#334155' : '#e2e8f0';
  const axisTickColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipStyle = {
    borderRadius: '8px',
    border: isDark ? '1px solid #334155' : 'none',
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
  };

  const scoreToDisplay = data.latestScore ?? data.overallAverageScore ?? (data.performance && data.performance.length > 0 ? data.performance[data.performance.length - 1].averageScore : null);
  const attendanceToDisplay = data.latestAttendance ?? data.overallAverageAttendance ?? (data.attendance && data.attendance.length > 0 ? data.attendance[data.attendance.length - 1].averageAttendance : null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* 1. College Information Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-200">
         <div className="flex items-center gap-4">
            {showLogoImage ? (
               <img 
                 src={rawLogoUrl} 
                 alt={hasConfig ? `${data.context.institutionName} Logo` : 'College Logo'} 
                 className="w-12 h-12 object-contain rounded-xl shrink-0" 
                 referrerPolicy="no-referrer"
                 onError={() => setLogoLoadError(true)}
               />
            ) : (
               <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center shrink-0">
                 <Building className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/>
               </div>
            )}
            <div>
               <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                 {hasConfig ? data.context.institutionName : 'College Not Configured'}
               </h1>
               <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                 {hasConfig 
                    ? (data.context.description || "No description configured.")
                    : "Complete your college profile in College Settings."}
               </p>
            </div>
         </div>
         <div className="shrink-0 flex items-center">
            <Link to="/admin/college-settings" className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium text-sm transition-colors shadow-sm">
               College Settings
            </Link>
         </div>
      </div>

      {/* 2. Three Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {statCards.map((card, idx) => {
          const CardContent = (
            <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-7 min-h-[148px] flex flex-col justify-center gap-3.5 transition-all hover:shadow-md ${card.link ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700/60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1.5">{card.label}</p>
              </div>
            </div>
          );
          return card.link ? <Link to={card.link} key={idx} className="block group focus:outline-none">{CardContent}</Link> : <div key={idx}>{CardContent}</div>;
        })}
      </div>

      {/* 3. Three Large Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-7 items-stretch">
        
        {/* Card 1: Overall Average Score */}
        <Link
          to="/admin/academic-records"
          className="block group rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-all duration-200 cursor-pointer h-full"
          aria-label="Overall Average Score - View Academic Records"
          onKeyDown={(e) => {
            if (e.key === ' ') {
              e.preventDefault();
              e.currentTarget.click();
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col h-full transition-all duration-200 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700/60 group-hover:border-indigo-300 dark:group-hover:border-indigo-700/60 cursor-pointer">
            <div className="flex justify-between items-center mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                <FileText className="w-5 h-5 text-indigo-500"/> Overall Average Score
              </h2>
              {data.performance && data.performance.length === 1 && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                  1 Academic Year
                </span>
              )}
              {data.performance && data.performance.length > 1 && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                  {data.performance.length} Academic Years
                </span>
              )}
            </div>
            <div className="flex-1 min-h-[270px]">
              {perfError ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 dark:text-slate-400">
                  <Activity className="w-8 h-8 text-rose-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Assessment data service unavailable</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Unable to connect to academic records service.</p>
                </div>
              ) : data.performance && data.performance.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.performance} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: axisTickColor, fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: axisTickColor, fontSize: 12}} domain={[0, 100]} />
                    <Tooltip cursor={{stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3'}} contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="averageScore" name="Avg Score (%)" stroke="#3b82f6" strokeWidth={3} dot={{r: 5, strokeWidth: 2}} activeDot={{r: 7}} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
                  <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No academic score data available yet.</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">Academic performance records and scores will appear here once student assessments are recorded.</p>
                </div>
              )}
            </div>
            {!perfError && data.performance && data.performance.length > 0 && scoreToDisplay !== null && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                 <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                   {`${scoreToDisplay}%`}
                 </span>
                 <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Overall Average Score</p>
              </div>
            )}
          </div>
        </Link>

        {/* Card 2: Year-by-Year Average Attendance */}
        <Link
          to="/admin/academic-records"
          className="block group rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-all duration-200 cursor-pointer h-full"
          aria-label="Average Attendance - View Academic Records"
          onKeyDown={(e) => {
            if (e.key === ' ') {
              e.preventDefault();
              e.currentTarget.click();
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col h-full transition-all duration-200 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700/60 group-hover:border-indigo-300 dark:group-hover:border-indigo-700/60 cursor-pointer">
            <div className="flex justify-between items-center mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                <Activity className="w-5 h-5 text-emerald-500"/> Average Attendance
              </h2>
              {data.attendance && data.attendance.length === 1 && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                  1 Academic Year
                </span>
              )}
              {data.attendance && data.attendance.length > 1 && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                  {data.attendance.length} Academic Years
                </span>
              )}
            </div>
            <div className="flex-1 min-h-[270px]">
              {perfError ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 dark:text-slate-400">
                  <Activity className="w-8 h-8 text-rose-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Attendance service unavailable</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Unable to connect to attendance records service.</p>
                </div>
              ) : data.attendance && data.attendance.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.attendance} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: axisTickColor, fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: axisTickColor, fontSize: 12}} domain={[0, 100]} />
                    <Tooltip cursor={{stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3'}} contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="averageAttendance" name="Attendance (%)" stroke="#10b981" strokeWidth={3} dot={{r: 5, strokeWidth: 2}} activeDot={{r: 7}} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
                  <Activity className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No attendance data available yet.</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">Student attendance percentages will be visualized here once recorded.</p>
                </div>
              )}
            </div>
            {!perfError && data.attendance && data.attendance.length > 0 && attendanceToDisplay !== null && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                 <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                   {`${attendanceToDisplay}%`}
                 </span>
                 <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Average Attendance</p>
              </div>
            )}
          </div>
        </Link>

        {/* Card 3: Students at Risk */}
        <Link
          to="/admin/risk-analytics"
          className="block group rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-all duration-200 cursor-pointer h-full"
          aria-label="Students at Risk - View Risk Analytics"
          onKeyDown={(e) => {
            if (e.key === ' ') {
              e.preventDefault();
              e.currentTarget.click();
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col h-full transition-all duration-200 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700/60 group-hover:border-indigo-300 dark:group-hover:border-indigo-700/60 cursor-pointer">
            <div className="flex justify-between items-center mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
               <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                 Students at Risk
               </h2>
            </div>
            <div className="flex-1 min-h-[270px] relative">
              {data.totalRisk > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.risk} innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                        {data.risk.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{data.totalRisk}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Total At Risk</span>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm text-center">
                  <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2"/>
                  <p>Risk analysis not yet available.</p>
                  <p className="text-xs mt-1">Insufficient data or model not integrated.</p>
                </div>
              )}
            </div>
            {data.totalRisk > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-4">
                {data.risk.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <span className="w-3 h-3 rounded-full" style={{backgroundColor: r.color}}></span>
                    {r.value} {r.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Link>

      </div>
    </div>
  );
}
