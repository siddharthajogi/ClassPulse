import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Search,
  Filter,
  RefreshCw,
  Users,
  Layers,
  BookOpen,
  ArrowRight,
  GitBranch,
  X,
  Loader2,
  Check,
  ChevronDown,
  Info,
  Calendar,
  Award,
  ExternalLink,
  MessageSquare,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { teacherApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';

const CLASSIFICATION_STYLES = {
  NEEDS_ATTENTION: {
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    border: 'border-rose-200 dark:border-rose-900',
    text: 'text-rose-700 dark:text-rose-300',
    badge: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800',
    cell: 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800'
  },
  DEVELOPING: {
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    border: 'border-amber-200 dark:border-amber-900',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
    cell: 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 dark:hover:bg-amber-900/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
  },
  ON_TRACK: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    border: 'border-emerald-200 dark:border-emerald-900',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800',
    cell: 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
  },
  INSUFFICIENT_DATA: {
    bg: 'bg-slate-50 dark:bg-slate-800/40',
    border: 'border-slate-200 dark:border-slate-700',
    text: 'text-slate-500 dark:text-slate-400',
    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    cell: 'bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 border-dashed border-slate-200 dark:border-slate-700'
  }
};

const REVIEW_STATUS_COLORS = {
  'Needs Review': 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  'Under Review': 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  'Action Taken': 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  'Resolved': 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  'Monitoring': 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
};

export default function TeacherKnowledgeGapDiagnosis({
  selectedSubjectId,
  subjectDetails,
  selectedSection,
  selectedYear,
  selectedSemester,
  filterData,
  onSwitchToStage1,
  onSwitchToStage2
}) {
  // Main diagnosis data state
  const [diagnosisData, setDiagnosisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Local Filter Controls
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentFilter, setSelectedStudentFilter] = useState('ALL');
  const [selectedConceptFilter, setSelectedConceptFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL'); // 'ALL' | 'NEEDS_ATTENTION' | 'DEVELOPING' | 'ON_TRACK' | 'INSUFFICIENT_DATA'
  const [activeTab, setActiveTab] = useState('heatmap'); // 'heatmap' | 'report'

  // Detailed Modal / Drawer for single student-concept finding
  const [selectedFindingForDetail, setSelectedFindingForDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailData, setDetailData] = useState(null);

  // Follow-up Note state in modal
  const [followUpStatus, setFollowUpStatus] = useState('Needs Review');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaveSuccess, setNoteSaveSuccess] = useState('');

  // Load diagnosis data
  const loadDiagnosis = useCallback(async (isManual = false) => {
    if (!selectedSubjectId) {
      setDiagnosisData(null);
      return;
    }

    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = { subjectId: selectedSubjectId };
      if (selectedSection && selectedSection !== 'ALL') {
        params.classId = selectedSection;
      }
      if (selectedYear && selectedYear !== 'ALL') {
        params.academicYear = selectedYear;
      }
      if (selectedSemester && selectedSemester !== 'ALL') {
        params.semester = selectedSemester;
      }

      const res = await teacherApi.getKnowledgeGapDiagnosis(params);
      if (res && res.success) {
        setDiagnosisData(res);
      } else {
        setError(res?.error || 'Failed to generate diagnosis.');
      }
    } catch (err) {
      console.error('loadDiagnosis error:', err);
      setError(err?.response?.data?.error || 'Unable to load knowledge-gap diagnosis.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSubjectId, selectedSection, selectedYear, selectedSemester]);

  useEffect(() => {
    loadDiagnosis();
  }, [loadDiagnosis]);

  // Register with global header refresh button
  usePageRefresh(async () => {
    await loadDiagnosis(true);
  }, [loadDiagnosis]);

  // Open Detailed Evidence Modal for student & concept
  const handleOpenDetailModal = async (studentId, conceptId) => {
    setDetailLoading(true);
    setDetailError('');
    setDetailData(null);
    setNoteSaveSuccess('');
    setSelectedFindingForDetail({ studentId, conceptId });

    try {
      const res = await teacherApi.getKnowledgeGapStudentConceptDetail(
        studentId,
        conceptId,
        { subjectId: selectedSubjectId }
      );

      if (res && res.success) {
        setDetailData(res.detail);
        setFollowUpStatus(res.detail.followUp?.reviewStatus || 'Needs Review');
        setFollowUpNotes(res.detail.followUp?.notes || '');
      } else {
        setDetailError(res?.error || 'Failed to load concept detail.');
      }
    } catch (err) {
      console.error('handleOpenDetailModal error:', err);
      setDetailError(err?.response?.data?.error || 'Failed to retrieve evidence details.');
    } finally {
      setDetailLoading(false);
    }
  };

  // Save Teacher Follow-Up Note
  const handleSaveFollowUpNote = async () => {
    if (!detailData || !selectedSubjectId) return;

    setSavingNote(true);
    setDetailError('');
    setNoteSaveSuccess('');

    try {
      const res = await teacherApi.saveKnowledgeGapFollowUpNote({
        studentId: detailData.student._id,
        conceptId: detailData.concept._id,
        subjectId: selectedSubjectId,
        reviewStatus: followUpStatus,
        notes: followUpNotes.trim()
      });

      if (res && res.success) {
        setNoteSaveSuccess('Follow-up status and notes updated.');
        // Refresh diagnosis background data to keep review statuses in sync
        loadDiagnosis();
        setTimeout(() => setNoteSaveSuccess(''), 3000);
      } else {
        setDetailError(res?.error || 'Failed to save follow-up note.');
      }
    } catch (err) {
      console.error('handleSaveFollowUpNote error:', err);
      setDetailError(err?.response?.data?.error || 'Failed to save review note.');
    } finally {
      setSavingNote(false);
    }
  };

  // Filtered Findings list for the Report Table
  const filteredFindings = useMemo(() => {
    if (!diagnosisData?.findings) return [];
    let list = diagnosisData.findings;

    // Filter by Classification
    if (selectedStatusFilter !== 'ALL') {
      list = list.filter(f => f.classification === selectedStatusFilter);
    }

    // Filter by Concept
    if (selectedConceptFilter !== 'ALL') {
      list = list.filter(f => f.concept._id === selectedConceptFilter);
    }

    // Filter by Student Search / Dropdown
    if (selectedStudentFilter !== 'ALL') {
      list = list.filter(f => f.student._id === selectedStudentFilter);
    } else if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      list = list.filter(f =>
        f.student.name.toLowerCase().includes(q) ||
        f.student.rollNumber.toLowerCase().includes(q) ||
        f.concept.name.toLowerCase().includes(q)
      );
    }

    return list;
  }, [diagnosisData?.findings, selectedStatusFilter, selectedConceptFilter, selectedStudentFilter, studentSearch]);

  // Available unique students for dropdown filter
  const studentDropdownOptions = useMemo(() => {
    if (!diagnosisData?.heatmap?.students) return [];
    return diagnosisData.heatmap.students.map(s => ({
      value: s.student._id,
      label: `${s.student.name} (${s.student.rollNumber || 'No ID'})`
    }));
  }, [diagnosisData?.heatmap?.students]);

  // Available concepts for dropdown filter
  const conceptDropdownOptions = useMemo(() => {
    if (!diagnosisData?.heatmap?.concepts) return [];
    return diagnosisData.heatmap.concepts.map(c => ({
      value: c._id,
      label: c.name
    }));
  }, [diagnosisData?.heatmap?.concepts]);

  return (
    <div className="space-y-6">

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="p-1 hover:bg-emerald-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header Banner & Diagnostics Overview */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Evidence-Based Knowledge-Gap Diagnosis
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Synthesizing Stage 1 concept hierarchies and Stage 2 assessment question marks into actionable student gap profiles.
              </p>
            </div>
          </div>
        </div>

        {/* Explainability & Safeguards Notice */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Deterministic Evaluation Engine Rules & Thresholds:
            </p>
            <p className="text-[11px] leading-relaxed">
              <strong>Needs Attention:</strong> Score &lt; 50% across scored questions •{' '}
              <strong>Developing:</strong> 50%–74% •{' '}
              <strong>On Track:</strong> ≥ 75% •{' '}
              <strong>Insufficient Data:</strong> No question-level responses recorded. Unscored or missing questions are never treated as zero.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Summary KPI Cards */}
      {diagnosisData?.summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Students Analyzed */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Students Evaluated</p>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {diagnosisData.summary.totalStudentsAnalyzed}
              </p>
              <p className="text-[10px] text-slate-400">Enrolled in active cohort</p>
            </div>
          </div>

          {/* Card 2: Concepts Needing Attention */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Concepts with Gaps</p>
              <p className="text-xl font-black text-rose-700 dark:text-rose-300 mt-0.5">
                {diagnosisData.summary.conceptsNeedingAttentionCount}
              </p>
              <p className="text-[10px] text-rose-600/80">Triggering &lt;50% threshold</p>
            </div>
          </div>

          {/* Card 3: Students With Gaps */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Students Needing Support</p>
              <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5">
                {diagnosisData.summary.studentsWithGapsCount}
              </p>
              <p className="text-[10px] text-amber-600/80">≥ 1 concept needing attention</p>
            </div>
          </div>

          {/* Card 4: Insufficient Evidence Concepts */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unassessed Concepts</p>
              <p className="text-xl font-black text-slate-700 dark:text-slate-300 mt-0.5">
                {diagnosisData.summary.insufficientEvidenceConceptsCount}
              </p>
              <p className="text-[10px] text-slate-400">No question scores recorded</p>
            </div>
          </div>

          {/* Card 5: Class Average on Assessed Concepts */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cohort Average</p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {diagnosisData.summary.classAveragePerformance !== null
                  ? `${diagnosisData.summary.classAveragePerformance}%`
                  : '—'}
              </p>
              <p className="text-[10px] text-slate-400">Across evaluated questions</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* 3. Main Workspace: View Toggle & Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        {/* Navigation Bar between Heatmap and Findings Report */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('heatmap')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'heatmap'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Concept Performance Heatmap</span>
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'report'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Student Gap Findings ({filteredFindings.length})</span>
            </button>
          </div>

          {/* Quick links to Stage 1 and Stage 2 */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={onSwitchToStage1}
              className="text-slate-500 hover:text-emerald-600 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Stage 1 Concepts</span>
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={onSwitchToStage2}
              className="text-slate-500 hover:text-emerald-600 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Stage 2 Assessments</span>
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Student Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search student or concept..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {studentSearch && (
              <button
                onClick={() => setStudentSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Specific Student Dropdown */}
          <div>
            <select
              value={selectedStudentFilter}
              onChange={(e) => setSelectedStudentFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Enrolled Students ({studentDropdownOptions.length})</option>
              {studentDropdownOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 3. Concept Filter Dropdown */}
          <div>
            <select
              value={selectedConceptFilter}
              onChange={(e) => setSelectedConceptFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Subject Concepts ({conceptDropdownOptions.length})</option>
              {conceptDropdownOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 4. Classification Filter Dropdown */}
          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Diagnostic Statuses</option>
              <option value="NEEDS_ATTENTION">Needs Attention (&lt;50%)</option>
              <option value="DEVELOPING">Developing (50%–74%)</option>
              <option value="ON_TRACK">On Track (≥75%)</option>
              <option value="INSUFFICIENT_DATA">Insufficient Data (No Scores)</option>
            </select>
          </div>
        </div>

        {/* 4. CONTENT: TAB 1 - CONCEPT PERFORMANCE HEATMAP */}
        {activeTab === 'heatmap' && (
          <div className="space-y-4 pt-2">
            {/* Heatmap Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                Heatmap Legend:
              </span>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200 border-rose-300 text-[11px] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  <span>Needs Attention (&lt;50%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200 border-amber-300 text-[11px] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  <span>Developing (50%–74%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300 text-[11px] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>On Track (≥75%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px]">
                  <span>— Insufficient Evidence</span>
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                <span>Evaluating empirical assessment evidence...</span>
              </div>
            ) : diagnosisData?.heatmap?.students && diagnosisData.heatmap.students.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 px-4 min-w-[180px] font-bold text-slate-700 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-r">
                        Student
                      </th>
                      {(diagnosisData.heatmap.concepts || []).map(concept => (
                        <th
                          key={concept._id}
                          className="py-3 px-3 min-w-[130px] text-center font-bold text-slate-700 dark:text-slate-300 border-l border-slate-100 dark:border-slate-800"
                        >
                          <div className="line-clamp-1" title={concept.name}>
                            {concept.name}
                          </div>
                          <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                            {concept.difficultyLevel}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {diagnosisData.heatmap.students
                      .filter(s => {
                        if (selectedStudentFilter !== 'ALL' && s.student._id !== selectedStudentFilter) return false;
                        if (studentSearch.trim()) {
                          const q = studentSearch.toLowerCase();
                          return s.student.name.toLowerCase().includes(q) || s.student.rollNumber.toLowerCase().includes(q);
                        }
                        return true;
                      })
                      .map(row => (
                        <tr key={row.student._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          {/* Student identifier sticky column */}
                          <td className="py-2.5 px-4 sticky left-0 bg-white dark:bg-slate-900 z-10 font-medium text-slate-900 dark:text-slate-100 border-r border-slate-100 dark:border-slate-800">
                            <div className="font-bold truncate max-w-[170px]">{row.student.name}</div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {row.student.rollNumber || 'No ID'}
                            </span>
                          </td>

                          {/* Concept Cells */}
                          {row.cells.map(cell => {
                            const style = CLASSIFICATION_STYLES[cell.classification] || CLASSIFICATION_STYLES.INSUFFICIENT_DATA;
                            return (
                              <td
                                key={cell.conceptId}
                                className="p-1.5 text-center border-l border-slate-100 dark:border-slate-800"
                              >
                                <button
                                  onClick={() => handleOpenDetailModal(row.student._id, cell.conceptId)}
                                  className={`w-full py-2 px-1 rounded-lg text-xs font-bold border transition-transform hover:scale-[1.02] cursor-pointer ${style.cell}`}
                                  title={`${row.student.name} • ${cell.conceptName}: ${cell.performance !== null ? `${cell.performance}%` : 'Insufficient Evidence'}`}
                                >
                                  {cell.performance !== null ? (
                                    <span>{cell.performance}%</span>
                                  ) : (
                                    <span className="text-[11px] font-normal">—</span>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 space-y-2">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  No diagnosis records found for the selected academic scope.
                </p>
                <p className="text-[11px] text-slate-400">
                  Ensure subject concepts have been defined in Stage 1 and questions have been mapped in Stage 2.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 5. CONTENT: TAB 2 - STUDENT KNOWLEDGE-GAP REPORT TABLE */}
        {activeTab === 'report' && (
          <div className="space-y-4 pt-2">
            {filteredFindings.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Concept & Difficulty</th>
                      <th className="py-3 px-3 text-center">Diagnostic Status</th>
                      <th className="py-3 px-3 text-center">Measured Score</th>
                      <th className="py-3 px-3 text-center">Evidence</th>
                      <th className="py-3 px-3 text-center">Prerequisites</th>
                      <th className="py-3 px-3 text-center">Review Follow-Up</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredFindings.map((f, idx) => {
                      const style = CLASSIFICATION_STYLES[f.classification] || CLASSIFICATION_STYLES.INSUFFICIENT_DATA;
                      const statusColor = REVIEW_STATUS_COLORS[f.followUp?.reviewStatus] || 'bg-slate-100 text-slate-600';

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                          {/* 1. Student */}
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block">
                              {f.student.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {f.student.rollNumber || 'No ID'}
                            </span>
                          </td>

                          {/* 2. Concept */}
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              {f.concept.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {f.concept.difficultyLevel} • {f.concept.prerequisitesCount} prereq(s)
                            </span>
                          </td>

                          {/* 3. Classification Badge */}
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${style.badge}`}>
                              {f.classification === 'NEEDS_ATTENTION' && <AlertTriangle className="w-3 h-3" />}
                              {f.classification === 'DEVELOPING' && <AlertCircle className="w-3 h-3" />}
                              {f.classification === 'ON_TRACK' && <Check className="w-3 h-3" />}
                              <span>{f.classificationLabel}</span>
                            </span>
                          </td>

                          {/* 4. Score */}
                          <td className="py-3 px-3 text-center font-bold">
                            {f.performance !== null ? (
                              <div>
                                <span className="text-slate-900 dark:text-slate-100">{f.performance}%</span>
                                <span className="block text-[10px] text-slate-400 font-normal">
                                  {f.earnedMarks}/{f.possibleMarks}M
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No Scores</span>
                            )}
                          </td>

                          {/* 5. Evidence Count */}
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-md font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                              {f.evidenceCount} Qs
                            </span>
                          </td>

                          {/* 6. Prerequisite Warning */}
                          <td className="py-3 px-3 text-center">
                            {f.hasPrerequisiteGap ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800" title="A prerequisite concept also needs attention">
                                <GitBranch className="w-3 h-3" />
                                <span>Prereq Gap</span>
                              </span>
                            ) : f.prerequisiteFindings?.length > 0 ? (
                              <span className="text-[11px] text-slate-400">
                                {f.prerequisiteFindings.length} OK
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Foundational</span>
                            )}
                          </td>

                          {/* 7. Follow-Up Review Status */}
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusColor}`}>
                              {f.followUp?.reviewStatus || 'Needs Review'}
                            </span>
                          </td>

                          {/* 8. Action */}
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenDetailModal(f.student._id, f.concept._id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer transition-colors border border-emerald-200 dark:border-emerald-800"
                            >
                              <span>View Evidence</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500">
                No student gap findings match your active search or classification filters.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. MODAL: Student-Level Evidence & Prerequisite Detail View */}
      {selectedFindingForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Evidence Audit & Diagnostic Breakdown</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Traceable question-level student marks and prerequisite learning sequence analysis.
                </p>
              </div>
              <button
                onClick={() => setSelectedFindingForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {detailLoading ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  <span>Loading evidence audit...</span>
                </div>
              ) : detailData ? (
                <>
                  {/* Student & Concept Summary Card */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student Profile</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {detailData.student.name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        Roll: {detailData.student.rollNumber || '—'} • {detailData.student.section}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Concept</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {detailData.concept.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Level: {detailData.concept.difficultyLevel} • Curriculum #{detailData.concept.orderIndex}
                      </p>
                    </div>
                  </div>

                  {/* Diagnostic Scorecard & Explanation */}
                  <div className={`p-4 rounded-xl border ${CLASSIFICATION_STYLES[detailData.classification]?.bg || 'bg-slate-50'} ${CLASSIFICATION_STYLES[detailData.classification]?.border || 'border-slate-200'} space-y-1.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Measured Concept Proficiency
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${CLASSIFICATION_STYLES[detailData.classification]?.badge}`}>
                        {detailData.classificationLabel}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                        {detailData.performance !== null ? `${detailData.performance}%` : 'Insufficient Evidence'}
                      </span>
                      {detailData.performance !== null && (
                        <span className="text-xs text-slate-500 font-semibold">
                          ({detailData.earnedMarks} / {detailData.possibleMarks} earned marks)
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-1">
                      {detailData.reason}
                    </p>
                  </div>

                  {/* Question Evidence Audit Table */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Supporting Assessment Evidence ({detailData.evidenceQuestions.length} Questions)
                      </h4>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Stage 2 Assessment Mappings
                      </span>
                    </div>

                    {detailData.evidenceQuestions.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 uppercase">
                              <th className="py-2.5 px-3">Assessment Title</th>
                              <th className="py-2.5 px-2 text-center">Q #</th>
                              <th className="py-2.5 px-3">Question Prompt / Objective</th>
                              <th className="py-2.5 px-3 text-center">Marks Earned</th>
                              <th className="py-2.5 px-2 text-center">Max</th>
                              <th className="py-2.5 px-3 text-right">Score %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {detailData.evidenceQuestions.map((q, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                  {q.assessmentTitle}
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    {q.assessmentType}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-center font-mono font-bold">
                                  {q.questionNumber}
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-[11px] max-w-[200px] truncate">
                                  {q.prompt || 'No question description provided'}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-slate-900 dark:text-slate-100">
                                  {q.marksEarned}
                                </td>
                                <td className="py-2 px-2 text-center text-slate-500">
                                  {q.maxMarks}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-600">
                                  {q.percentage}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-400 text-center">
                        No question-level scores found for this concept and student.
                      </div>
                    )}
                  </div>

                  {/* Prerequisite Hierarchy Analysis (Stage 1 relationships) */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Prerequisite Learning Sequence Analysis
                      </h4>
                    </div>

                    {detailData.prerequisites && detailData.prerequisites.length > 0 ? (
                      <div className="space-y-2">
                        {detailData.prerequisites.map((p, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                              p.classification === 'NEEDS_ATTENTION'
                                ? 'bg-rose-50/70 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200'
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{p.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                                  {p.difficultyLevel}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {p.classification === 'NEEDS_ATTENTION'
                                  ? 'Potential foundational bottleneck: Student also scored below 50% in this prerequisite concept.'
                                  : p.performance !== null
                                  ? `Student attained ${p.performance}% mastery on this prerequisite.`
                                  : 'No assessment evidence recorded yet for this prerequisite.'}
                              </p>
                            </div>

                            <span className="shrink-0 font-bold px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              {p.performance !== null ? `${p.performance}%` : 'No Data'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500">
                        This is a foundational concept with no prior prerequisites defined in Stage 1.
                      </div>
                    )}
                  </div>

                  {/* Teacher Follow-Up Controls */}
                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Teacher Instructional Review & Follow-Up Notes
                        </h4>
                      </div>
                      {detailData.followUp?.updatedAt && (
                        <span className="text-[10px] text-slate-400">
                          Last updated by {detailData.followUp.updatedBy}
                        </span>
                      )}
                    </div>

                    {noteSaveSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>{noteSaveSuccess}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Review Status
                        </label>
                        <select
                          value={followUpStatus}
                          onChange={(e) => setFollowUpStatus(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="Needs Review">Needs Review</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Action Taken">Action Taken (Remediation)</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Monitoring">Monitoring</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Follow-Up Instructional Notes (Private to Teachers)
                        </label>
                        <textarea
                          rows={2}
                          value={followUpNotes}
                          onChange={(e) => setFollowUpNotes(e.target.value)}
                          placeholder="e.g. Advised student to review recurrence relation base cases; scheduled tutorial session."
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleSaveFollowUpNote}
                        disabled={savingNote}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Save Follow-Up Note</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  {detailError || 'No detail data available.'}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedFindingForDetail(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
