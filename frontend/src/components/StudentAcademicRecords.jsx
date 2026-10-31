import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Award, Calendar, RefreshCw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { studentApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';

export default function StudentAcademicRecords() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentApi.getDashboard();
      if (res && res.success) {
        setData(res);
      } else {
        setError('Failed to load academic records.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to connect to academic records service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Register with global header refresh button
  usePageRefresh(fetchRecords, []);

  const academicRecords = data?.academicRecords || [];

  const { overallPercentage, totalMarksObtained, totalMarksPossible } = useMemo(() => {
    if (!academicRecords || academicRecords.length === 0) {
      return { overallPercentage: null, totalMarksObtained: 0, totalMarksPossible: 0 };
    }
    let obtained = 0;
    let possible = 0;
    academicRecords.forEach((r) => {
      if (typeof r.marksObtained === 'number' && typeof r.totalMarks === 'number' && r.totalMarks > 0) {
        obtained += r.marksObtained;
        possible += r.totalMarks;
      }
    });
    return {
      overallPercentage: possible > 0 ? Math.round((obtained / possible) * 100) : null,
      totalMarksObtained: obtained,
      totalMarksPossible: possible
    };
  }, [academicRecords]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 dark:text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1E3A8A] dark:text-blue-400" />
        <p className="text-sm font-medium">Loading your academic records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-rose-200 dark:border-rose-900/50 text-center max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Unable to Load Records</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">{error}</p>
        <button
          onClick={fetchRecords}
          className="px-4 py-2 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
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
              My Academic Records
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-[#1E3A8A] dark:text-blue-300 border border-blue-200 dark:border-blue-900/80">
              {academicRecords.length} {academicRecords.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Official grading transcripts, continuous assessments, and evaluation history.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {academicRecords.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Assessments</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{academicRecords.length}</p>
            <p className="text-xs text-slate-500 mt-1">Evaluated coursework modules</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cumulative Average</p>
            <p className="text-3xl font-bold text-[#1E3A8A] dark:text-blue-400 mt-2">
              {overallPercentage !== null ? `${overallPercentage}%` : '--'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Overall score across subjects</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Marks Aggregation</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
              {totalMarksObtained} <span className="text-lg font-normal text-slate-400">/ {totalMarksPossible}</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Total score points recorded</p>
          </div>
        </div>
      )}

      {/* Records Table / Card View */}
      {academicRecords.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Academic Year</th>
                  <th className="px-6 py-4">Marks Obtained</th>
                  <th className="px-6 py-4">Total Marks</th>
                  <th className="px-6 py-4">Percentage</th>
                  <th className="px-6 py-4">Attendance</th>
                  <th className="px-6 py-4">Recorded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                {academicRecords.map((r) => {
                  const pct = (r.marksObtained != null && r.totalMarks) 
                    ? Math.round((r.marksObtained / r.totalMarks) * 100) 
                    : null;
                  return (
                    <tr key={r._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {r.subject?.name || 'Untitled Subject'}
                        </div>
                        <div className="text-xs text-slate-400">{r.subject?.code || ''}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {r.academicYear?.year || 'Current'}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">
                        {r.marksObtained}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {r.totalMarks}
                      </td>
                      <td className="px-6 py-4 font-semibold text-[#1E3A8A] dark:text-blue-400">
                        {pct !== null ? `${pct}%` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {r.attendancePercentage != null ? `${Math.round(r.attendancePercentage)}%` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto shadow-xs">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No Academic Records Yet</h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Your instructor or examination department has not yet published continuous evaluation scores or marks for your enrolled courses.
          </p>
        </div>
      )}
    </div>
  );
}
