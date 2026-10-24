import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Award, Target, CheckCircle2, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { studentApi } from '../api';
import { useTheme } from '../context/ThemeContext';

export default function StudentLearningProgress() {
  const { isDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProgress = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentApi.getDashboard();
      if (res && res.success) {
        setData(res);
      } else {
        setError('Failed to load learning progress.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to connect to learning progress service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, []);

  const academicRecords = data?.academicRecords || [];

  const { chartData, overallProgress } = useMemo(() => {
    if (!academicRecords || academicRecords.length === 0) {
      return { chartData: [], overallProgress: null };
    }

    let totalMarks = 0;
    let marksObtained = 0;
    const points = [];

    academicRecords.forEach((r, idx) => {
      if (typeof r.marksObtained === 'number' && typeof r.totalMarks === 'number' && r.totalMarks > 0) {
        marksObtained += r.marksObtained;
        totalMarks += r.totalMarks;
        points.push({
          subject: r.subject?.code || r.subject?.name || `Module ${idx + 1}`,
          percentage: Math.round((r.marksObtained / r.totalMarks) * 100)
        });
      }
    });

    return {
      chartData: points,
      overallProgress: totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : null
    };
  }, [academicRecords]);

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
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 dark:text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600 dark:text-cyan-400" />
        <p className="text-sm font-medium">Loading your learning progress...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-rose-200 dark:border-rose-900/50 text-center max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Unable to Load Learning Progress</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">{error}</p>
        <button
          onClick={fetchProgress}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              My Learning Progress
            </h1>
            {overallProgress !== null && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80">
                {overallProgress}% Average Mastery
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Academic growth trajectories, concept mastery curves, and evaluation milestones.
          </p>
        </div>

        <button
          onClick={fetchProgress}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Progress Chart Card */}
      {chartData.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Assessment Trajectory Across Subjects
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified score percentages recorded across continuous evaluation modules
              </p>
            </div>
            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
              {overallProgress}%
            </span>
          </div>

          <div className="min-h-[300px]">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fill: axisTickColor, fontSize: 11 }} dy={10} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: axisTickColor, fontSize: 12 }} />
                <Tooltip cursor={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="percentage" name="Score (%)" stroke="#06b6d4" strokeWidth={3} dot={{ r: 5, strokeWidth: 2 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto shadow-xs">
          <TrendingUp className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No Learning Progress Recorded Yet</h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Progress curves and concept mastery metrics will be generated automatically once your academic assessment scores are published by faculty.
          </p>
        </div>
      )}
    </div>
  );
}
