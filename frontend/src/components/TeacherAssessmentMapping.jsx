import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Target,
  Plus,
  Edit3,
  Trash2,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  X,
  Loader2,
  Check,
  ChevronDown,
  Calendar,
  Layers,
  Award,
  BookOpen,
  SlidersHorizontal,
  ArrowRight,
  Database,
  UserCheck,
  BarChart3,
  ExternalLink,
  Tag
} from 'lucide-react';
import { teacherApi } from '../api';
import TeacherDropdown from './TeacherDropdown';
import { usePageRefresh } from '../context/RefreshContext';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const ASSESSMENT_TYPES = [
  'Continuous Assessment',
  'Quiz',
  'Assignment',
  'Midterm',
  'Final',
  'Lab Practical',
  'Other'
];

const DIFFICULTY_BADGES = {
  Fundamental: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Beginner: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  Intermediate: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  Advanced: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
};

export default function TeacherAssessmentMapping({
  selectedSubjectId,
  subjectDetails,
  selectedSection,
  selectedYear,
  selectedSemester,
  filterData,
  concepts = [],
  onSwitchToStage1
}) {
  // Assessment list state
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Selected assessment detailed data state
  const [assessmentDetails, setAssessmentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Global notifications
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Filtering & search within questions
  const [questionSearch, setQuestionSearch] = useState('');
  const [mappingStatusFilter, setMappingStatusFilter] = useState('ALL'); // 'ALL' | 'MAPPED' | 'UNMAPPED'

  // Modal 1: Map Concepts for a Single Question
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [questionToMap, setQuestionToMap] = useState(null);
  const [selectedConceptIds, setSelectedConceptIds] = useState([]);
  const [conceptFilterSearch, setConceptFilterSearch] = useState('');
  const [savingMapping, setSavingMapping] = useState(false);
  const [mappingError, setMappingError] = useState('');

  // Modal 2: Create Assessment Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    assessmentType: 'Continuous Assessment',
    academicYear: '',
    semester: '',
    classId: '',
    assessmentDate: '',
    questions: [
      { questionNumber: 'Q1', text: '', maxMarks: 10, concepts: [] },
      { questionNumber: 'Q2', text: '', maxMarks: 10, concepts: [] }
    ]
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // Modal 3: Add / Edit Question inline within current assessment
  const [isQuestionEditModalOpen, setIsQuestionEditModalOpen] = useState(false);
  const [editingQuestionData, setEditingQuestionData] = useState(null);
  const [questionEditForm, setQuestionEditForm] = useState({
    questionNumber: '',
    text: '',
    maxMarks: 10
  });
  const [questionEditSubmitting, setQuestionEditSubmitting] = useState(false);
  const [questionEditError, setQuestionEditError] = useState('');

  // Modal 4: Delete Assessment Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Modal 5: Student Evidence Drawer / Modal
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [evidenceData, setEvidenceData] = useState(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [scoreInputs, setScoreInputs] = useState({}); // { `${studentId}_${questionId}`: marks }
  const [scoreSaveSubmitting, setScoreSaveSubmitting] = useState(false);
  const [evidenceMessage, setEvidenceMessage] = useState('');
  const [evidenceError, setEvidenceError] = useState('');

  // Available section options for dropdowns
  const sectionOptions = useMemo(() => {
    const list = filterData?.sections || [];
    return list.map(sec => ({
      value: sec.id,
      label: sec.name || `${sec.department} - ${sec.section}`
    }));
  }, [filterData]);

  // Load assessments for current subject
  const loadAssessments = useCallback(async (isManual = false) => {
    if (!selectedSubjectId) {
      setAssessments([]);
      setSelectedAssessmentId('');
      setAssessmentDetails(null);
      return;
    }

    if (isManual) setRefreshing(true);
    else setLoadingAssessments(true);
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

      const res = await teacherApi.getKnowledgeGapAssessments(params);
      if (res && res.success) {
        const list = res.assessments || [];
        setAssessments(list);

        // Keep existing selection if valid, or select the first assessment
        if (list.length > 0) {
          setSelectedAssessmentId(prev => {
            const exists = list.some(a => a._id === prev);
            return exists ? prev : list[0]._id;
          });
        } else {
          setSelectedAssessmentId('');
          setAssessmentDetails(null);
        }
      } else {
        setError(res?.error || 'Failed to fetch assessments.');
      }
    } catch (err) {
      console.error('loadAssessments error:', err);
      setError(err?.response?.data?.error || 'Unable to load assessments.');
    } finally {
      setLoadingAssessments(false);
      setRefreshing(false);
    }
  }, [selectedSubjectId, selectedSection, selectedYear, selectedSemester]);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  // Register with global header refresh button
  usePageRefresh(async () => {
    await loadAssessments(true);
    if (selectedAssessmentId) {
      await loadAssessmentDetails(selectedAssessmentId);
    }
  }, [loadAssessments, selectedAssessmentId, loadAssessmentDetails]);

  // Load detailed assessment data when selectedAssessmentId changes
  const loadAssessmentDetails = useCallback(async (id) => {
    if (!id) {
      setAssessmentDetails(null);
      return;
    }

    setLoadingDetails(true);
    try {
      const res = await teacherApi.getKnowledgeGapAssessmentDetails(id);
      if (res && res.success) {
        setAssessmentDetails(res.assessment);
      } else {
        setError(res?.error || 'Failed to load assessment details.');
      }
    } catch (err) {
      console.error('loadAssessmentDetails error:', err);
      setError(err?.response?.data?.error || 'Unable to load assessment details.');
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAssessmentId) {
      loadAssessmentDetails(selectedAssessmentId);
    } else {
      setAssessmentDetails(null);
    }
  }, [selectedAssessmentId, loadAssessmentDetails]);

  // Filter questions for display
  const displayedQuestions = useMemo(() => {
    if (!assessmentDetails?.questions) return [];
    let list = assessmentDetails.questions;

    if (mappingStatusFilter === 'MAPPED') {
      list = list.filter(q => q.isMapped);
    } else if (mappingStatusFilter === 'UNMAPPED') {
      list = list.filter(q => !q.isMapped);
    }

    if (questionSearch.trim()) {
      const qLower = questionSearch.toLowerCase();
      list = list.filter(q =>
        q.questionNumber.toLowerCase().includes(qLower) ||
        (q.text && q.text.toLowerCase().includes(qLower)) ||
        (q.concepts && q.concepts.some(c => c.name.toLowerCase().includes(qLower)))
      );
    }

    return list;
  }, [assessmentDetails?.questions, mappingStatusFilter, questionSearch]);

  // Concept lookup map for fast retrieval
  const conceptMap = useMemo(() => {
    const map = new Map();
    concepts.forEach(c => map.set(c._id, c));
    return map;
  }, [concepts]);

  // Handle Opening Mapping Modal for a question
  const handleOpenMappingModal = (question) => {
    setQuestionToMap(question);
    const initialIds = (question.concepts || []).map(c => (typeof c === 'object' && c._id ? c._id : c));
    setSelectedConceptIds(initialIds);
    setConceptFilterSearch('');
    setMappingError('');
    setIsMappingModalOpen(true);
  };

  // Toggle concept in mapping modal
  const handleToggleConceptSelection = (conceptId) => {
    setSelectedConceptIds(prev => {
      const exists = prev.includes(conceptId);
      if (exists) {
        return prev.filter(id => id !== conceptId);
      } else {
        return [...prev, conceptId];
      }
    });
  };

  // Save Mapping to Database
  const handleSaveMapping = async () => {
    if (!assessmentDetails?._id || !questionToMap?._id) return;

    setSavingMapping(true);
    setMappingError('');

    try {
      const res = await teacherApi.updateQuestionMapping(
        assessmentDetails._id,
        questionToMap._id,
        { concepts: selectedConceptIds }
      );

      if (res && res.success) {
        setIsMappingModalOpen(false);
        setSuccessMsg(`Mapping for question ${questionToMap.questionNumber} updated successfully.`);
        // Refresh detailed view and assessment list stats
        loadAssessmentDetails(assessmentDetails._id);
        loadAssessments();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setMappingError(res?.error || 'Failed to update mapping.');
      }
    } catch (err) {
      console.error('handleSaveMapping error:', err);
      setMappingError(err?.response?.data?.error || 'Failed to save question concept mapping.');
    } finally {
      setSavingMapping(false);
    }
  };

  // Quick unmap single concept from question pill
  const handleRemoveSingleConcept = async (question, conceptIdToRemove) => {
    if (!assessmentDetails?._id || !question?._id) return;

    const updatedConceptIds = (question.concepts || [])
      .map(c => (typeof c === 'object' && c._id ? c._id : c))
      .filter(id => id !== conceptIdToRemove);

    try {
      const res = await teacherApi.updateQuestionMapping(
        assessmentDetails._id,
        question._id,
        { concepts: updatedConceptIds }
      );

      if (res && res.success) {
        setSuccessMsg(`Concept removed from ${question.questionNumber}.`);
        loadAssessmentDetails(assessmentDetails._id);
        loadAssessments();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('handleRemoveSingleConcept error:', err);
      setError(err?.response?.data?.error || 'Failed to remove concept link.');
    }
  };

  // Open Create Assessment Modal
  const handleOpenCreateModal = () => {
    setCreateForm({
      title: '',
      description: '',
      assessmentType: 'Continuous Assessment',
      academicYear: selectedYear && selectedYear !== 'ALL' ? selectedYear : (subjectDetails?.academicYear || ''),
      semester: selectedSemester && selectedSemester !== 'ALL' ? selectedSemester : (subjectDetails?.semester || ''),
      classId: selectedSection && selectedSection !== 'ALL' ? selectedSection : '',
      assessmentDate: new Date().toISOString().split('T')[0],
      questions: [
        { questionNumber: 'Q1', text: '', maxMarks: 10, concepts: [] },
        { questionNumber: 'Q2', text: '', maxMarks: 10, concepts: [] },
        { questionNumber: 'Q3', text: '', maxMarks: 10, concepts: [] }
      ]
    });
    setCreateError('');
    setIsCreateModalOpen(true);
  };

  // Add question row in create form
  const handleAddQuestionRowInCreate = () => {
    setCreateForm(prev => {
      const nextNum = prev.questions.length + 1;
      return {
        ...prev,
        questions: [
          ...prev.questions,
          { questionNumber: `Q${nextNum}`, text: '', maxMarks: 10, concepts: [] }
        ]
      };
    });
  };

  // Remove question row in create form
  const handleRemoveQuestionRowInCreate = (idx) => {
    setCreateForm(prev => {
      const updated = prev.questions.filter((_, i) => i !== idx);
      return { ...prev, questions: updated };
    });
  };

  // Update question field in create form
  const handleUpdateQuestionFieldInCreate = (idx, field, value) => {
    setCreateForm(prev => {
      const updated = [...prev.questions];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, questions: updated };
    });
  };

  // Submit Create Assessment
  const handleCreateAssessmentSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      setCreateError('Assessment title is required.');
      return;
    }

    if (createForm.questions.length === 0) {
      setCreateError('At least one question is required.');
      return;
    }

    for (const q of createForm.questions) {
      const m = Number(q.maxMarks);
      if (isNaN(m) || m <= 0) {
        setCreateError(`Question ${q.questionNumber} must have maximum marks greater than 0.`);
        return;
      }
    }

    setCreateSubmitting(true);
    setCreateError('');

    try {
      const payload = {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        subjectId: selectedSubjectId,
        classId: createForm.classId || undefined,
        assessmentType: createForm.assessmentType,
        academicYear: createForm.academicYear,
        semester: createForm.semester,
        assessmentDate: createForm.assessmentDate || undefined,
        questions: createForm.questions.map(q => ({
          questionNumber: q.questionNumber.trim(),
          text: q.text.trim(),
          maxMarks: Number(q.maxMarks),
          concepts: q.concepts
        }))
      };

      const res = await teacherApi.createKnowledgeGapAssessment(payload);
      if (res && res.success) {
        setIsCreateModalOpen(false);
        setSuccessMsg(`Assessment "${createForm.title}" created successfully.`);
        await loadAssessments();
        if (res.assessment?._id) {
          setSelectedAssessmentId(res.assessment._id);
        }
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setCreateError(res?.error || 'Failed to create assessment.');
      }
    } catch (err) {
      console.error('handleCreateAssessmentSubmit error:', err);
      setCreateError(err?.response?.data?.error || 'Failed to create assessment.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Question Edit Modal (Add new question or Edit existing)
  const handleOpenQuestionEditModal = (q = null) => {
    if (q) {
      // Editing existing question
      setEditingQuestionData(q);
      setQuestionEditForm({
        questionNumber: q.questionNumber,
        text: q.text || '',
        maxMarks: q.maxMarks || 10
      });
    } else {
      // Adding new question to existing assessment
      const currentCount = assessmentDetails?.questions?.length || 0;
      setEditingQuestionData(null);
      setQuestionEditForm({
        questionNumber: `Q${currentCount + 1}`,
        text: '',
        maxMarks: 10
      });
    }
    setQuestionEditError('');
    setIsQuestionEditModalOpen(true);
  };

  // Submit Question Edit / Add
  const handleQuestionEditSubmit = async (e) => {
    e.preventDefault();
    if (!questionEditForm.questionNumber.trim()) {
      setQuestionEditError('Question number is required.');
      return;
    }

    const marksNum = Number(questionEditForm.maxMarks);
    if (isNaN(marksNum) || marksNum <= 0) {
      setQuestionEditError('Maximum marks must be a valid number greater than 0.');
      return;
    }

    if (!assessmentDetails) return;

    setQuestionEditSubmitting(true);
    setQuestionEditError('');

    try {
      const existingQuestions = [...(assessmentDetails.questions || [])];

      if (editingQuestionData) {
        // Update existing question
        const idx = existingQuestions.findIndex(q => q._id === editingQuestionData._id);
        if (idx >= 0) {
          existingQuestions[idx] = {
            ...existingQuestions[idx],
            questionNumber: questionEditForm.questionNumber.trim(),
            text: questionEditForm.text.trim(),
            maxMarks: marksNum,
            concepts: (existingQuestions[idx].concepts || []).map(c => (typeof c === 'object' && c._id ? c._id : c))
          };
        }
      } else {
        // Add new question
        existingQuestions.push({
          questionNumber: questionEditForm.questionNumber.trim(),
          text: questionEditForm.text.trim(),
          maxMarks: marksNum,
          concepts: []
        });
      }

      const res = await teacherApi.saveAssessmentQuestions(assessmentDetails._id, {
        questions: existingQuestions.map(q => ({
          _id: q._id,
          questionNumber: q.questionNumber,
          text: q.text,
          maxMarks: q.maxMarks,
          concepts: q.concepts
        }))
      });

      if (res && res.success) {
        setIsQuestionEditModalOpen(false);
        setSuccessMsg(editingQuestionData ? 'Question updated.' : 'New question added.');
        loadAssessmentDetails(assessmentDetails._id);
        loadAssessments();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setQuestionEditError(res?.error || 'Failed to save question.');
      }
    } catch (err) {
      console.error('handleQuestionEditSubmit error:', err);
      setQuestionEditError(err?.response?.data?.error || 'Failed to save question.');
    } finally {
      setQuestionEditSubmitting(false);
    }
  };

  // Delete single question from assessment
  const handleDeleteQuestion = async (qId) => {
    if (!assessmentDetails) return;
    if (!window.confirm('Are you sure you want to remove this question from the assessment?')) return;

    try {
      const filtered = (assessmentDetails.questions || [])
        .filter(q => q._id !== qId)
        .map(q => ({
          _id: q._id,
          questionNumber: q.questionNumber,
          text: q.text,
          maxMarks: q.maxMarks,
          concepts: (q.concepts || []).map(c => (typeof c === 'object' && c._id ? c._id : c))
        }));

      const res = await teacherApi.saveAssessmentQuestions(assessmentDetails._id, { questions: filtered });
      if (res && res.success) {
        setSuccessMsg('Question removed.');
        loadAssessmentDetails(assessmentDetails._id);
        loadAssessments();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('handleDeleteQuestion error:', err);
      setError(err?.response?.data?.error || 'Failed to remove question.');
    }
  };

  // Open Delete Assessment Modal
  const handleOpenDeleteAssessmentModal = (a) => {
    setAssessmentToDelete(a);
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  // Confirm Delete Assessment
  const handleConfirmDeleteAssessment = async () => {
    if (!assessmentToDelete?._id) return;
    setDeleteSubmitting(true);
    setDeleteError('');

    try {
      const res = await teacherApi.deleteKnowledgeGapAssessment(assessmentToDelete._id);
      if (res && res.success) {
        setIsDeleteModalOpen(false);
        setSuccessMsg(`Assessment "${assessmentToDelete.title}" deleted.`);
        setAssessmentToDelete(null);
        await loadAssessments();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setDeleteError(res?.error || 'Failed to delete assessment.');
      }
    } catch (err) {
      console.error('handleConfirmDeleteAssessment error:', err);
      setDeleteError(err?.response?.data?.error || 'Failed to delete assessment.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Open Student Evidence Modal / Drawer
  const handleOpenEvidenceModal = async () => {
    if (!assessmentDetails?._id) return;
    setIsEvidenceModalOpen(true);
    setEvidenceLoading(true);
    setEvidenceError('');
    setEvidenceMessage('');

    try {
      const res = await teacherApi.getKnowledgeGapAssessmentScores(assessmentDetails._id);
      if (res && res.success) {
        setEvidenceData(res);
        setEvidenceMessage(res.evidenceMessage || '');

        // Populate initial score inputs from saved scores
        const initialInputs = {};
        (res.scores || []).forEach(s => {
          const key = `${s.student}_${s.questionId}`;
          initialInputs[key] = s.marksObtained;
        });
        setScoreInputs(initialInputs);
      } else {
        setEvidenceError(res?.error || 'Failed to load student evidence.');
      }
    } catch (err) {
      console.error('handleOpenEvidenceModal error:', err);
      setEvidenceError(err?.response?.data?.error || 'Unable to retrieve student question marks.');
    } finally {
      setEvidenceLoading(false);
    }
  };

  // Handle Score Input Change
  const handleScoreInputChange = (studentId, questionId, val) => {
    const key = `${studentId}_${questionId}`;
    setScoreInputs(prev => ({
      ...prev,
      [key]: val
    }));
  };

  // Save Student Scores
  const handleSaveStudentScores = async () => {
    if (!assessmentDetails?._id || !evidenceData) return;

    // Validate inputs
    const scoresToSubmit = [];
    const questionsMap = new Map();
    (assessmentDetails.questions || []).forEach(q => questionsMap.set(q._id.toString(), q));

    for (const [key, val] of Object.entries(scoreInputs)) {
      if (val === '' || val === null || val === undefined) continue;

      const [studentId, questionId] = key.split('_');
      const numVal = Number(val);

      const qDoc = questionsMap.get(questionId);
      const qNum = qDoc ? qDoc.questionNumber : 'Question';
      const maxM = qDoc ? qDoc.maxMarks : 100;

      if (isNaN(numVal)) {
        setEvidenceError(`Marks for ${qNum} must be a valid number.`);
        return;
      }
      if (numVal < 0) {
        setEvidenceError(`Marks for ${qNum} cannot be negative.`);
        return;
      }
      if (numVal > maxM) {
        setEvidenceError(`Marks for ${qNum} (${numVal}) cannot exceed maximum marks (${maxM}).`);
        return;
      }

      scoresToSubmit.push({
        studentId,
        questionId,
        marksObtained: numVal
      });
    }

    if (scoresToSubmit.length === 0) {
      setEvidenceError('Please enter at least one question mark before saving.');
      return;
    }

    setScoreSaveSubmitting(true);
    setEvidenceError('');

    try {
      const res = await teacherApi.recordKnowledgeGapAssessmentScores(assessmentDetails._id, {
        scores: scoresToSubmit
      });

      if (res && res.success) {
        setSuccessMsg(`Saved ${scoresToSubmit.length} student question scores.`);
        setIsEvidenceModalOpen(false);
        loadAssessmentDetails(assessmentDetails._id);
        loadAssessments();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setEvidenceError(res?.error || 'Failed to save scores.');
      }
    } catch (err) {
      console.error('handleSaveStudentScores error:', err);
      setEvidenceError(err?.response?.data?.error || 'Failed to save student question scores.');
    } finally {
      setScoreSaveSubmitting(false);
    }
  };

  // Filtered concepts in the mapping modal
  const modalFilteredConcepts = useMemo(() => {
    if (!conceptFilterSearch.trim()) return concepts;
    const lower = conceptFilterSearch.toLowerCase();
    return concepts.filter(c =>
      c.name.toLowerCase().includes(lower) ||
      (c.description && c.description.toLowerCase().includes(lower)) ||
      (c.difficultyLevel && c.difficultyLevel.toLowerCase().includes(lower))
    );
  }, [concepts, conceptFilterSearch]);

  return (
    <div className="space-y-6">

      {/* Local Feedback Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg">
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
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Assessment Selector Strip & Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Assessment Question-to-Concept Mapping
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select an assessment to link its questions to Stage 1 concepts and review mapping progress.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={handleOpenCreateModal}
              disabled={!selectedSubjectId}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Assessment</span>
            </button>
          </div>
        </div>

        {/* Assessment Dropdown / Selector Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              Active Assessment *
            </label>
            {loadingAssessments ? (
              <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center px-3 text-xs text-slate-400">
                Loading available assessments...
              </div>
            ) : assessments.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedAssessmentId}
                  onChange={(e) => setSelectedAssessmentId(e.target.value)}
                  className="w-full appearance-none pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {assessments.map(a => (
                    <option key={a._id} value={a._id}>
                      {a.title} ({a.assessmentType}) — {a.stats.totalQuestions} Questions • {a.stats.completionPercentage}% Mapped • Max Marks: {a.totalMarks}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>No assessments recorded yet for this subject.</span>
                <button
                  onClick={handleOpenCreateModal}
                  className="font-bold text-emerald-600 hover:text-emerald-700 underline ml-2"
                >
                  Create one now
                </button>
              </div>
            )}
          </div>

          {/* Delete assessment button */}
          <div className="flex items-end justify-start md:justify-end gap-2">
            {assessmentDetails && (
              <button
                onClick={() => handleOpenDeleteAssessmentModal(assessmentDetails)}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-semibold transition-colors cursor-pointer"
                title="Delete this assessment"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Assessment</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Assessment KPI Cards & Mapping Status */}
      {assessmentDetails ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Total Questions */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Questions</p>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {assessmentDetails.stats.totalQuestions}
              </p>
              <p className="text-[10px] text-slate-400">Total Marks: {assessmentDetails.totalMarks}</p>
            </div>
          </div>

          {/* Card 2: Mapped Questions */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Mapped Questions</p>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                {assessmentDetails.stats.mappedQuestions}
              </p>
              <p className="text-[10px] text-emerald-600/80">Linked to ≥ 1 concept</p>
            </div>
          </div>

          {/* Card 3: Unmapped Questions */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Unmapped</p>
              <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5">
                {assessmentDetails.stats.unmappedQuestions}
              </p>
              <p className="text-[10px] text-amber-600/80">Pending mapping</p>
            </div>
          </div>

          {/* Card 4: Progress Bar Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mapping Progress</p>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {assessmentDetails.stats.completionPercentage}%
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${assessmentDetails.stats.completionPercentage}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {assessmentDetails.stats.mappedQuestions} of {assessmentDetails.stats.totalQuestions} mapped
            </p>
          </div>

          {/* Card 5: Student Evidence Status */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Student Evidence</p>
              {assessmentDetails.stats.hasStudentEvidence ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Recorded
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  Unavailable
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate">
              {assessmentDetails.stats.hasStudentEvidence
                ? `${assessmentDetails.stats.studentScoresCount} student scores stored`
                : 'Question scores not recorded'}
            </p>
            <button
              onClick={handleOpenEvidenceModal}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 mt-1 cursor-pointer"
            >
              <UserCheck className="w-3 h-3" />
              <span>{assessmentDetails.stats.hasStudentEvidence ? 'Review Scores' : 'Record Question Marks'}</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* 3. Questions Table & Management Workspace */}
      {assessmentDetails ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          {/* Questions Toolbar: Search, Filters, Add Question */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Question search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  placeholder="Search questions or mapped concepts..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                />
                {questionSearch && (
                  <button
                    onClick={() => setQuestionSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                <button
                  onClick={() => setMappingStatusFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    mappingStatusFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All ({assessmentDetails.questions?.length || 0})
                </button>
                <button
                  onClick={() => setMappingStatusFilter('MAPPED')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    mappingStatusFilter === 'MAPPED'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Mapped ({assessmentDetails.stats.mappedQuestions})
                </button>
                <button
                  onClick={() => setMappingStatusFilter('UNMAPPED')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    mappingStatusFilter === 'UNMAPPED'
                      ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Unmapped ({assessmentDetails.stats.unmappedQuestions})
                </button>
              </div>
            </div>

            {/* Add question action */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenQuestionEditModal(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>
          </div>

          {/* Stage 1 concepts notice if empty */}
          {concepts.length === 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  No concepts exist for this subject in Stage 1 yet. To map assessment questions, define concepts in Stage 1 first.
                </span>
              </div>
              <button
                onClick={onSwitchToStage1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer"
              >
                <span>Go to Stage 1 Concepts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Questions Table */}
          {displayedQuestions.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 w-20">#</th>
                    <th className="py-3 px-4 min-w-[220px]">Question Description / Prompt</th>
                    <th className="py-3 px-4 w-28 text-center">Max Marks</th>
                    <th className="py-3 px-4 min-w-[280px]">Mapped Concepts (Stage 1)</th>
                    <th className="py-3 px-4 w-28 text-center">Status</th>
                    <th className="py-3 px-4 w-36 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {displayedQuestions.map((q) => (
                    <tr
                      key={q._id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. Question Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {q.questionNumber}
                      </td>

                      {/* 2. Text / Prompt */}
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {q.text ? (
                          <p className="line-clamp-2">{q.text}</p>
                        ) : (
                          <span className="text-slate-400 italic">No description provided</span>
                        )}
                      </td>

                      {/* 3. Max Marks */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {q.maxMarks}
                      </td>

                      {/* 4. Mapped Concepts */}
                      <td className="py-3.5 px-4">
                        {q.concepts && q.concepts.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {q.concepts.map(concept => {
                              const cId = concept._id || concept;
                              const cName = concept.name || conceptMap.get(cId)?.name || 'Concept';
                              const cDiff = concept.difficultyLevel || conceptMap.get(cId)?.difficultyLevel || 'Intermediate';
                              const badgeClass = DIFFICULTY_BADGES[cDiff] || DIFFICULTY_BADGES.Intermediate;

                              return (
                                <span
                                  key={cId}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeClass}`}
                                >
                                  <span>{cName}</span>
                                  <button
                                    onClick={() => handleRemoveSingleConcept(q, cId)}
                                    className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer"
                                    title="Unmap this concept"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            <AlertCircle className="w-3 h-3" />
                            <span>Unmapped</span>
                          </span>
                        )}
                      </td>

                      {/* 5. Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {q.isMapped ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3" />
                            <span>Mapped</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      {/* 6. Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenMappingModal(q)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800"
                            title="Map concepts to this question"
                          >
                            <Target className="w-3.5 h-3.5" />
                            <span>Map</span>
                          </button>

                          <button
                            onClick={() => handleOpenQuestionEditModal(q)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Edit question text/marks"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteQuestion(q._id)}
                            className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Delete question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {questionSearch
                  ? 'No questions match your search query.'
                  : mappingStatusFilter !== 'ALL'
                  ? `No ${mappingStatusFilter.toLowerCase()} questions found in this assessment.`
                  : 'This assessment does not contain any questions yet.'}
              </p>
              <button
                onClick={() => handleOpenQuestionEditModal(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Question</span>
              </button>
            </div>
          )}
        </div>
      ) : !loadingAssessments && (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              No Assessment Selected
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              Select an existing assessment from the dropdown above or create a new assessment to begin mapping assessment questions to course concepts.
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            disabled={!selectedSubjectId}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Assessment</span>
          </button>
        </div>
      )}

      {/* 4. MODAL: Map Concepts to a Question */}
      {isMappingModalOpen && questionToMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Map Concepts to {questionToMap.questionNumber}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select one or more Stage 1 concepts that this question assesses.
                </p>
              </div>
              <button
                onClick={() => setIsMappingModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Question Summary Bar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="font-bold text-slate-700 dark:text-slate-300">Prompt: </span>
                <span className="text-slate-600 dark:text-slate-400 italic">
                  {questionToMap.text || 'No question prompt description'}
                </span>
              </div>
              <span className="shrink-0 font-bold px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                Max Marks: {questionToMap.maxMarks}
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {mappingError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{mappingError}</span>
                </div>
              )}

              {/* Concepts Search & Selection Count */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={conceptFilterSearch}
                    onChange={(e) => setConceptFilterSearch(e.target.value)}
                    placeholder="Search compatible subject concepts..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                  {selectedConceptIds.length} Selected
                </span>
              </div>

              {/* Concept Checklist */}
              {modalFilteredConcepts.length > 0 ? (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {modalFilteredConcepts.map(concept => {
                    const isChecked = selectedConceptIds.includes(concept._id);
                    const badgeClass = DIFFICULTY_BADGES[concept.difficultyLevel] || DIFFICULTY_BADGES.Intermediate;

                    return (
                      <label
                        key={concept._id}
                        className={`flex items-start justify-between gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleConceptSelection(concept._id)}
                            className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold">{concept.name}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeClass}`}>
                                {concept.difficultyLevel}
                              </span>
                              {(!concept.prerequisites || concept.prerequisites.length === 0) && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  Foundational
                                </span>
                              )}
                            </div>
                            {concept.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                                {concept.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {isChecked && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-500 text-xs">
                  {conceptFilterSearch
                    ? 'No concepts match your search.'
                    : 'No concepts available for this subject in Stage 1 yet.'}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedConceptIds([])}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
              >
                Clear Selections
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMappingModalOpen(false)}
                  disabled={savingMapping}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMapping}
                  disabled={savingMapping}
                  className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingMapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Mapping</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: Create New Assessment */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Create Assessment for {subjectDetails?.name || 'Subject'}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Define assessment metadata and question-level records for concept mapping.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAssessmentSubmit} className="p-5 overflow-y-auto space-y-4">
              {createError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Row 1: Title & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assessment Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="e.g. Continuous Assessment 1, Midterm Exam"
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assessment Type
                  </label>
                  <select
                    value={createForm.assessmentType}
                    onChange={(e) => setCreateForm({ ...createForm, assessmentType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {ASSESSMENT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Section, Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Section (Optional)
                  </label>
                  <select
                    value={createForm.classId}
                    onChange={(e) => setCreateForm({ ...createForm, classId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">All Assigned Sections</option>
                    {sectionOptions.map(sec => (
                      <option key={sec.value} value={sec.value}>{sec.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assessment Date
                  </label>
                  <input
                    type="date"
                    value={createForm.assessmentDate}
                    onChange={(e) => setCreateForm({ ...createForm, assessmentDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Question list definition in Create Modal */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Questions ({createForm.questions.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Specify question identifier and maximum marks. You can map concepts now or after saving.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddQuestionRowInCreate}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question Row</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {createForm.questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 grid grid-cols-12 gap-2.5 items-center"
                    >
                      <div className="col-span-3 sm:col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">ID</label>
                        <input
                          type="text"
                          required
                          value={q.questionNumber}
                          onChange={(e) => handleUpdateQuestionFieldInCreate(idx, 'questionNumber', e.target.value)}
                          placeholder="Q1"
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-7">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Prompt / Topic (Optional)</label>
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) => handleUpdateQuestionFieldInCreate(idx, 'text', e.target.value)}
                          placeholder="e.g. Solve linear recurrence relations"
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Max Marks</label>
                        <input
                          type="number"
                          required
                          min="0.5"
                          step="0.5"
                          value={q.maxMarks}
                          onChange={(e) => handleUpdateQuestionFieldInCreate(idx, 'maxMarks', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center font-bold"
                        />
                      </div>

                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestionRowInCreate(idx)}
                          disabled={createForm.questions.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Marks Preview */}
              <div className="pt-2 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                <span>Calculated Total Assessment Marks:</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-sm">
                  {createForm.questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0)} Marks
                </span>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {createSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Create Assessment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Add / Edit Single Question */}
      {isQuestionEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {editingQuestionData ? `Edit Question ${editingQuestionData.questionNumber}` : 'Add New Question'}
              </h3>
              <button
                onClick={() => setIsQuestionEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuestionEditSubmit} className="p-5 space-y-4">
              {questionEditError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{questionEditError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Question Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    value={questionEditForm.questionNumber}
                    onChange={(e) => setQuestionEditForm({ ...questionEditForm, questionNumber: e.target.value })}
                    placeholder="e.g. Q1, Q2(a)"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Maximum Marks *
                  </label>
                  <input
                    type="number"
                    required
                    min="0.25"
                    step="0.5"
                    value={questionEditForm.maxMarks}
                    onChange={(e) => setQuestionEditForm({ ...questionEditForm, maxMarks: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Question Prompt / Text (Optional)
                </label>
                <textarea
                  rows={3}
                  value={questionEditForm.text}
                  onChange={(e) => setQuestionEditForm({ ...questionEditForm, text: e.target.value })}
                  placeholder="Describe the assessment question or learning objective tested..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuestionEditModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={questionEditSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {questionEditSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Question</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: Delete Assessment Confirmation */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deleteSubmitting) {
            setIsDeleteModalOpen(false);
            setAssessmentToDelete(null);
            setDeleteError('');
          }
        }}
        onConfirm={handleConfirmDeleteAssessment}
        title="Delete Assessment?"
        recordName={assessmentToDelete?.title || ''}
        loading={deleteSubmitting}
        error={deleteError}
        message="Are you sure you want to remove this assessment and its question mappings? This will not affect subject concepts or students' aggregate marks."
      />

      {/* 8. MODAL / DRAWER: Student Question Evidence */}
      {isEvidenceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Student Question Evidence — {assessmentDetails?.title}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  View or record real question-level marks to prepare evidence for Stage 3 Knowledge-Gap Diagnosis.
                </p>
              </div>
              <button
                onClick={() => setIsEvidenceModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Evidence Notice Alert */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                  <HelpCircle className="w-4 h-4 text-emerald-600" />
                  <span>Evidence Integrity & Stage 3 Diagnosis Notice</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Total assessment marks in Academic Records do not automatically distribute across questions. Only real question-level responses recorded here will be used in Stage 3. No mock scores or artificial values are fabricated.
                </p>
              </div>

              {evidenceError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{evidenceError}</span>
                </div>
              )}

              {evidenceLoading ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  <span>Loading student records...</span>
                </div>
              ) : evidenceData?.students && evidenceData.students.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase">
                        <th className="py-3 px-3 w-16">Roll #</th>
                        <th className="py-3 px-4 min-w-[140px]">Student Name</th>
                        {(evidenceData.questions || []).map(q => (
                          <th key={q._id} className="py-3 px-3 text-center min-w-[90px]">
                            {q.questionNumber}
                            <span className="block text-[10px] font-normal text-slate-400">
                              / {q.maxMarks}M
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {evidenceData.students.map(s => (
                        <tr key={s._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {s.rollNumber || '—'}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                            {s.name}
                          </td>
                          {(evidenceData.questions || []).map(q => {
                            const key = `${s._id}_${q._id}`;
                            const val = scoreInputs[key] ?? '';

                            return (
                              <td key={q._id} className="py-2.5 px-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={q.maxMarks}
                                  step="0.5"
                                  value={val}
                                  onChange={(e) => handleScoreInputChange(s._id, q._id, e.target.value)}
                                  placeholder="—"
                                  className="w-16 px-2 py-1 rounded-lg text-center text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 space-y-2">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    No active students found in this assessment's assigned section.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Assign a target class/section to the assessment to enter student-level question marks.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Validates: 0 ≤ marks ≤ question max marks
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEvidenceModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  Close
                </button>
                {evidenceData?.students?.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveStudentScores}
                    disabled={scoreSaveSubmitting}
                    className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    {scoreSaveSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Student Scores</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
