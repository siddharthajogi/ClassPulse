import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  Building2, 
  Calendar, 
  Layers, 
  BookOpen, 
  CheckSquare, 
  GraduationCap, 
  Filter 
} from 'lucide-react';
import TeacherDropdown from './TeacherDropdown';

export default function TeacherPlaceholder({ title, icon: Icon, description }) {
  const [department, setDepartment] = useState('all');
  const [academicYear, setAcademicYear] = useState('all');
  const [semester, setSemester] = useState('all');
  const [section, setSection] = useState('all');
  const [subjectAssignment, setSubjectAssignment] = useState('all');

  const departmentOptions = [
    { value: 'all', label: 'All Departments' },
    { value: 'CSE', label: 'CSE — Computer Science and Engineering', subtext: 'Department of Computing' },
    { value: 'ECE', label: 'ECE — Electronics and Communication Engineering', subtext: 'Department of Electronics' },
    { value: 'ME', label: 'ME — Mechanical Engineering', subtext: 'Department of Mechanics' },
    { value: 'CE', label: 'CE — Civil Engineering', subtext: 'Department of Infrastructure' },
    { value: 'AIML', label: 'AIML — Artificial Intelligence and Machine Learning', subtext: 'Department of Emerging Tech' },
  ];

  const yearOptions = [
    { value: 'all', label: 'All Calendar Years' },
    { value: '2026-2027', label: '2026-2027 (Current)' },
    { value: '2025-2026', label: '2025-2026 (Previous)' },
    { value: '2024-2025', label: '2024-2025 (Archive)' },
  ];

  const semesterOptions = [
    { value: 'all', label: 'All Semesters' },
    { value: '1st', label: 'Semester 1 (1st Sem)' },
    { value: '2nd', label: 'Semester 2 (2nd Sem)' },
    { value: '3rd', label: 'Semester 3 (3rd Sem)' },
    { value: '4th', label: 'Semester 4 (4th Sem)' },
    { value: '5th', label: 'Semester 5 (5th Sem)' },
    { value: '6th', label: 'Semester 6 (6th Sem)' },
    { value: '7th', label: 'Semester 7 (7th Sem)' },
    { value: '8th', label: 'Semester 8 (8th Sem)' },
  ];

  const sectionOptions = [
    { value: 'all', label: 'All Sections' },
    { value: 'A', label: 'Section A' },
    { value: 'B', label: 'Section B' },
    { value: 'C', label: 'Section C' },
    { value: 'D', label: 'Section D' },
  ];

  const isAssignmentPage = title?.toLowerCase().includes('assignment');
  const subjectOrAssignmentOptions = isAssignmentPage
    ? [
        { value: 'all', label: 'All Course Assignments' },
        { value: 'asg-1', label: 'Assignment 1 — Data Structures & Algorithms Implementation' },
        { value: 'asg-2', label: 'Assignment 2 — Operating System Process Scheduling' },
        { value: 'asg-3', label: 'Assignment 3 — Database Normalization & SQL Queries' },
        { value: 'mid-project', label: 'Mid-Term Capstone Milestone Submission' },
      ]
    : [
        { value: 'all', label: 'All Assigned Subjects' },
        { value: 'CS301', label: 'CS301 — Data Structures & Algorithms' },
        { value: 'CS302', label: 'CS302 — Database Management Systems' },
        { value: 'CS401', label: 'CS401 — Artificial Intelligence & Machine Learning' },
        { value: 'CS402', label: 'CS402 — Computer Networks & Security' },
      ];

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Interactive Module Scope & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 transition-colors duration-200">
        <div className="flex items-center gap-2 mb-3 px-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{title} Filter Scope</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Filter */}
          <TeacherDropdown
            id="placeholder-dept-select"
            data-testid="placeholder-dept-select"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            options={departmentOptions}
            placeholder="All Departments"
            title="Filter by Department"
            icon={Building2}
            className="w-full sm:w-auto min-w-[200px] max-w-[280px]"
            menuClassName="w-full sm:w-[320px]"
          />

          {/* Academic Year Filter */}
          <TeacherDropdown
            id="placeholder-year-select"
            data-testid="placeholder-year-select"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            options={yearOptions}
            placeholder="All Calendar Years"
            title="Filter by Academic Year"
            icon={Calendar}
            className="w-full sm:w-auto min-w-[160px]"
            menuClassName="w-full sm:w-[220px]"
          />

          {/* Semester Selector */}
          <TeacherDropdown
            id="placeholder-semester-select"
            data-testid="placeholder-semester-select"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            options={semesterOptions}
            placeholder="All Semesters"
            title="Filter by Semester"
            icon={GraduationCap}
            className="w-full sm:w-auto min-w-[150px]"
            menuClassName="w-full sm:w-[220px]"
          />

          {/* Section Selector */}
          <TeacherDropdown
            id="placeholder-section-select"
            data-testid="placeholder-section-select"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            options={sectionOptions}
            placeholder="All Sections"
            title="Filter by Section"
            icon={Layers}
            className="w-full sm:w-auto min-w-[140px]"
            menuClassName="w-full sm:w-[180px]"
          />

          {/* Subject or Assignment Selector */}
          <TeacherDropdown
            id="placeholder-subject-assignment-select"
            data-testid="placeholder-subject-assignment-select"
            value={subjectAssignment}
            onChange={(e) => setSubjectAssignment(e.target.value)}
            options={subjectOrAssignmentOptions}
            placeholder={isAssignmentPage ? 'All Course Assignments' : 'All Assigned Subjects'}
            title={isAssignmentPage ? 'Select Assignment' : 'Select Subject'}
            icon={isAssignmentPage ? CheckSquare : BookOpen}
            className="w-full sm:w-auto min-w-[200px] max-w-[300px]"
            menuClassName="w-full sm:w-[340px]"
          />
        </div>
      </div>

      {/* Main Module Information Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-8 sm:p-12 text-center transition-colors duration-200">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs mb-6">
          {Icon ? <Icon className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 mb-4">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Scheduled for Development</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-3">
          {title}
        </h1>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed mb-6">
          {description ||
            'This module is part of the ClassPulse teacher workflow. It is scheduled for implementation in an upcoming release with full academic data connections.'}
        </p>

        {/* Selected Scope Indicator */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Selected Scope:</span>
          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 shadow-2xs font-medium text-emerald-700 dark:text-emerald-300">
            {departmentOptions.find(d => d.value === department)?.label.split('—')[0].trim() || 'All'}
          </span>
          <span>•</span>
          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 shadow-2xs font-medium">
            {academicYear === 'all' ? 'All Calendar Years' : academicYear}
          </span>
          <span>•</span>
          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 shadow-2xs font-medium">
            {semester === 'all' ? 'All Semesters' : `Sem ${semester}`}
          </span>
          <span>•</span>
          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 shadow-2xs font-medium">
            {section === 'all' ? 'All Sections' : `Sec ${section}`}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/teacher/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-all shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
