---
name: classpulse-development-rules
description: Permanent development workflow, verification, and database safety rules for ClassPulse
always_on: true
---

# ClassPulse Permanent Development Rules & Instructions

This document defines the permanent development guidelines and workflow for the **ClassPulse** application. Every agent, assistant, and developer working in this workspace must strictly follow these instructions for all tasks.

---

## 1. Inspect Before Editing
- **Analyze Existing Codebase**: Thoroughly examine the existing project structure, frontend, backend, database models, API routes, authentication mechanisms, and all related components before writing or editing code.
- **Root Cause Identification**: Identify and understand the root cause of any bug, failure, or feature gap prior to making modifications.
- **Preserve System Architecture**: Preserve existing functional behaviors, design patterns, routing, and conventions. Never discard existing logic or replace components unnecessarily.

---

## 2. Run the Actual Application
- **Active Development Servers**: Start or reuse the running development servers (`npm run dev` in both `frontend` and `backend`).
- **Visible Browser Inspection**: Open and inspect the running application in a real, visible browser whenever browser automation is available.
- **Issue Reproduction**: Verify the actual user interface and reproduce reported issues before attempting fixes.
- **Integrity**: Never claim to have opened or tested in a browser if you have not done so.

---

## 3. Implement the Feature
- **Minimal, High-Reliability Changes**: Make the smallest, cleanest, and most reliable changes required to complete the requested feature.
- **Full-Stack Connectivity**: Connect frontend components to real backend API endpoints and the actual MongoDB database where required.
- **Role-Based Access Control**: Strictly honor the role-based boundaries and permissions for `admin`, `teacher`, and `student`.
- **Zero Fabrication**: Never fabricate student records, grades, marks, attendance, scores, analytics, or risk predictions.
- **Preserve Integrity**: Do not break existing authentication, routing, APIs, or unrelated functionality.

---

## 4. Browser Automation and Playwright
- **End-to-End Testing**: Use Playwright for end-to-end testing whenever available in the environment.
- **Headed/Visible Mode**: Prefer headed/visible browser execution so that actual application behavior, layout rendering, and interactive workflows can be observed.
- **Comprehensive User Flow Verification**: Test the relevant user journeys, form submissions, dropdowns, navigation transitions, API calls, validations, and error states.
- **Console & Network Diagnostics**: Monitor and verify browser console errors and network request responses.
- **Investigate & Retest**: If a test fails, investigate the root cause, apply the required fix, and re-execute the tests.
- **Truthful Reporting**: Never report a test as passed unless it was genuinely executed and passed.

---

## 5. Verify Every Change
- **Post-Change Verification**: Reopen or refresh the running application after implementation.
- **Direct UI Confirmation**: Confirm that the requested feature functions properly in the live user interface.
- **Regression Testing**: Verify relevant existing features to ensure no regressions were introduced.
- **Build & Quality Checks**: Run available build checks (`npm run build`), lint checks (`npm run lint`), and automated tests when appropriate.
- **Fix & Retest**: Immediately resolve any errors, warnings, or regressions introduced by the changes, and verify again.

---

## 6. Protect the Database and Security
- **Explicit Permission for Destructive Operations**: Never delete existing database records, reset the database, drop collections, or run destructive scripts without explicit user permission.
- **Database Schema & Configurations**: Never run database migrations or alter database connection configurations (`MONGODB_URI`, environment credentials) without explicit user permission.
- **Authentication & Authorization Standards**: Never bypass authentication checks or weaken authorization guards to make tests pass.
- **Credential Protection**: Do not expose or log passwords, session tokens, JWT secrets, or database credentials.

---

## 7. Final Report
Upon task completion, always provide a clear, concise report containing:
- **Implemented / Fixed**: Exact summary of what was implemented or resolved.
- **Modified & Created Files**: Specific list of all files created or modified with file links.
- **Browser & Playwright Tests**: Detailed record of all browser interactions, test scripts, and flows actually executed.
- **Pass / Fail Results**: Concrete pass/fail results for automated test suites, build checks, and linters.
- **Limitations & Outstanding Items**: Any unavailable tools, environmental limitations, or remaining considerations.

> **Note on Environment Limitations**: If visible browser automation or Playwright is unavailable, state that limitation clearly and use available alternatives (logs, screenshots, API tests, terminal checks). Never fabricate browser activity or test results.
