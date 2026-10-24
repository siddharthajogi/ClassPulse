# ClassPulse Permanent Development Rules & Instructions — Fast Development Mode

This document defines the permanent development guidelines and workflow for the **ClassPulse** application. Every agent, assistant, and developer working in this workspace must strictly follow these instructions for all tasks.

---

## 1. Priority: Fast Development & Minimal Waiting
- **Fast Implementation**: The primary objective is fast implementation, minimal waiting, and clean code changes.
- **Manual UI Testing by User**: Visual inspection and interactive testing are performed by the user after code changes are complete.
- **No Automatic Browser Testing**: Do NOT perform automatic browser-based testing unless the user explicitly requests it for a specific task.

---

## 2. Disable Automatic Browser Testing
For all future development tasks:
- **No Automatic Browser Control**: Do not automatically open, launch, or control a browser.
- **No Browser Agent Interactions**: Do not use a browser agent to manually navigate pages, click buttons, fill forms, or inspect the UI.
- **No Default Headed or Playwright Tests**: Do not run headed-browser testing or automatic Playwright end-to-end tests by default.
- **No Visual Media Overhead**: Do not spend time capturing screenshots, creating browser recordings, or generating visual demonstrations.
- **Leave Manual UI Testing to the User**: Visual inspection, layout checks, and manual user flow testing belong exclusively to the user.

---

## 3. Fast Development Workflow
For every task:
1. **Targeted Inspection**: Inspect only the relevant source files, components, routes, APIs, and database models. Avoid exploring or loading unrelated files.
2. **Root Cause Analysis**: Identify and understand the likely root cause before making any edits.
3. **Minimal, Reliable Changes**: Implement the smallest, cleanest, and most reliable change that fully satisfies the request.
4. **Code Review**: Review modified code for obvious syntax issues, logic errors, security vulnerabilities, and regressions.
5. **Lightweight Checks**: Run fast, targeted checks when relevant (such as targeted unit tests, lint checks, type checks, or `npm run build`). Avoid unnecessary lengthy test suites.
6. **Preserve Running Servers**: Do not start, stop, or restart development servers unless the task specifically requires it.
7. **Zero Fabrication**: Never introduce fake student records, grades, marks, attendance, scores, analytics, or risk predictions.
8. **Preserve System Architecture**: Maintain existing functional behaviors, design patterns, routing, authentication, and conventions. Never discard existing logic or replace components unnecessarily.

---

## 4. Protect Database, Security, and Quality
- **Explicit Permission for Destructive Operations**: Never delete existing database records, reset the database, drop collections, or run destructive scripts without explicit user permission.
- **Database Schema & Configurations**: Never run database migrations or alter database connection configurations (`MONGODB_URI`, environment credentials) without explicit user permission.
- **Authentication & Role-Based Access Control**: Strictly honor the role-based boundaries and permissions for `admin`, `teacher`, and `student`. Never bypass authentication checks or weaken authorization guards.
- **Credential Protection**: Do not expose or log passwords, session tokens, JWT secrets, or database credentials.
- **Lightweight Check Failures**: If a lightweight check fails, immediately investigate and resolve issues introduced by the change.
- **Truthful Reporting**: Never claim that manual browser testing, Playwright tests, or any other checks passed when they were not run. If a check is too slow or unavailable, state that clearly.

---

## 5. Final Report
Upon task completion, always provide a concise, brief report containing:
- **What Changed**: Concise summary of what was implemented or resolved.
- **Modified & Created Files**: Specific list of all files created or modified with clickable file links (`file://`).
- **Lightweight Checks Run & Results**: Concrete results of any fast checks run (build, lint, targeted test).
- **Manual Verification Notes**: Anything important that the user should manually verify in the browser.
