import React, { useState, useEffect } from 'react';
import { BookOpen, User, Mail, Award, Clock, Loader2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { studentApi } from '../api';

export default function StudentMySubjects() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSubjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentApi.getDashboard();
      if (res && res.success) {
        setData(res);
      } else {
        setError('Failed to load assigned subjects.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to connect to subjects service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 dark:text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-pink-600 dark:text-pink-400" />
        <p className="text-sm font-medium">Loading your enrolled subjects...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-rose-200 dark:border-rose-900/50 text-center max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Unable to Load Subjects</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">{error}</p>
        <button
          onClick={fetchSubjects}
          className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const assignments = data?.assignments || [];
  const group = data?.student?.group;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              My Subjects
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/80">
              {assignments.length} Enrolled
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {group 
              ? `Curriculum inherited from ${group.name || `${group.department} Section ${group.section}`}`
              : 'Assigned academic courses, syllabi, and faculty contacts.'}
          </p>
        </div>

        <button
          onClick={fetchSubjects}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Subjects Grid */}
      {assignments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {assignments.map((item) => {
            const subject = item.subject || {};
            const teacher = item.teacher || {};
            const teacherUser = teacher.user || {};

            return (
              <div
                key={item._id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider block">
                        {subject.code || 'NO-CODE'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                        {subject.name || 'Untitled Subject'}
                      </h3>
                    </div>
                    <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                    {subject.description || 'No subject syllabus description specified for this course.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-5">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Credits</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {subject.credits != null ? `${subject.credits} Credits` : 'N/A'}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Type</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize mt-0.5">
                        {subject.subjectType || 'Theory'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Faculty Card Footer */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {teacherUser.name ? teacherUser.name.charAt(0).toUpperCase() : 'T'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {teacherUser.name || teacher.personalInfo?.name || 'Assigned Faculty'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {teacher.designation || 'Instructor'}
                      </p>
                    </div>
                  </div>
                  {teacherUser.email && (
                    <a
                      href={`mailto:${teacherUser.email}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                      title={`Email ${teacherUser.email}`}
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto shadow-xs">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No Subjects Assigned Yet</h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Your section has not yet been assigned course curriculum. Once the college administration or faculty links teaching assignments, your subjects will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
