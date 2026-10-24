import React, { useState, useEffect, useMemo } from 'react';
import { CalendarCheck, AlertTriangle, CheckCircle2, RefreshCw, Loader2, AlertCircle, Clock } from 'lucide-react';
import { studentApi } from '../api';

export default function StudentAttendance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentApi.getDashboard();
      if (res && res.success) {
        setData(res);
      } else {
        setError('Failed to load attendance records.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to connect to attendance service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const academicRecords = data?.academicRecords || [];

  const { attendanceList, overallAttendance } = useMemo(() => {
    const list = [];
    let sum = 0;
    let count = 0;

    academicRecords.forEach((r) => {
      if (typeof r.attendancePercentage === 'number') {
        const val = Math.round(r.attendancePercentage);
        sum += val;
        count += 1;
        list.push({
          id: r._id,
          subjectName: r.subject?.name || 'Untitled Subject',
          subjectCode: r.subject?.code || '',
          academicYear: r.academicYear?.year || 'Current',
          percentage: val
        });
      }
    });

    return {
      attendanceList: list,
      overallAttendance: count > 0 ? Math.round(sum / count) : null
    };
  }, [academicRecords]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 dark:text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-pink-600 dark:text-pink-400" />
        <p className="text-sm font-medium">Loading your attendance records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-rose-200 dark:border-rose-900/50 text-center max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Unable to Load Attendance</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">{error}</p>
        <button
          onClick={fetchAttendance}
          className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
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
              My Attendance
            </h1>
            {overallAttendance !== null && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                overallAttendance >= 75
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}>
                {overallAttendance >= 75 ? '75%+ Requirement Met' : 'Attendance Warning (<75%)'}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Subject-wise attendance registers, session logs, and cumulative attendance standing.
          </p>
        </div>

        <button
          onClick={fetchAttendance}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      {overallAttendance !== null && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cumulative Attendance</p>
            <p className={`text-3xl font-bold mt-2 ${overallAttendance >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {overallAttendance}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Calculated across registered courses</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mandatory Threshold</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">75%</p>
            <p className="text-xs text-slate-500 mt-1">Minimum for semester exam eligibility</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Course Breakdown</p>
            <p className="text-3xl font-bold text-pink-600 dark:text-pink-400 mt-2">{attendanceList.length}</p>
            <p className="text-xs text-slate-500 mt-1">Subjects with recorded attendance</p>
          </div>
        </div>
      )}

      {/* Subject-Wise Attendance Breakdown */}
      {attendanceList.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
            Subject-Wise Attendance Details
          </h2>

          <div className="space-y-4">
            {attendanceList.map((item) => {
              const isPassing = item.percentage >= 75;
              return (
                <div 
                  key={item.id} 
                  className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.subjectCode}</p>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        {item.subjectName}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-extrabold ${isPassing ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {item.percentage}%
                      </span>
                      {isPassing ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isPassing ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto shadow-xs">
          <CalendarCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No Attendance Records Yet</h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Your daily session roll call and continuous evaluation attendance percentages have not yet been submitted by faculty.
          </p>
        </div>
      )}
    </div>
  );
}
