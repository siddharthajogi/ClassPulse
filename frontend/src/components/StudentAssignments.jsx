import React, { useState, useEffect } from 'react';
import { BookOpenCheck, Calendar, Clock, AlertCircle, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { studentApi } from '../api';

export default function StudentAssignments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentApi.getDashboard();
      if (res && res.success) {
        setData(res);
      } else {
        setError('Failed to load assignments.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to connect to assignments service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const assignments = data?.assignments || [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 dark:text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm font-medium">Loading your assignments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-rose-200 dark:border-rose-900/50 text-center max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Unable to Load Assignments</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">{error}</p>
        <button
          onClick={fetchAssignments}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
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
              My Assignments
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/80">
              {assignments.length} Active Courses
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Coursework deliverables, homework projects, and laboratory task submissions.
          </p>
        </div>

        <button
          onClick={fetchAssignments}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Assignments Status List */}
      {assignments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {assignments.map((item) => {
            const subject = item.subject || {};
            const teacher = item.teacher || {};
            const teacherUser = teacher.user || {};

            return (
              <div
                key={item._id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                        {subject.code || 'COURSE'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {subject.name || 'Assigned Subject'}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {subject.subjectType || 'Theory'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    {subject.description || 'Assigned class coursework module.'}
                  </p>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs mb-4">
                    <span className="text-slate-500">Instructor:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {teacherUser.name || teacher.designation || 'Assigned Faculty'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>No pending submissions</span>
                  </span>
                  <span>Semester {subject.semester || 'Current'}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto shadow-xs">
          <BookOpenCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No Course Assignments</h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            You do not currently have any pending coursework deliverables or homework tasks assigned by your instructors.
          </p>
        </div>
      )}
    </div>
  );
}
