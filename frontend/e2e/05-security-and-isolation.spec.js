import { test, expect } from '@playwright/test';
import { STUDENT_CREDENTIALS, TEACHER_CREDENTIALS } from './helpers/test-setup';

const BACKEND_BASE_URL = 'http://localhost:5000';

test.describe('Section 6: Security, Role-Based Access Control & Data Isolation', () => {

  test('6.1 Reject Unauthenticated Direct API Requests with 401', async ({ playwright }) => {
    const unauthContext = await playwright.request.newContext({ baseURL: BACKEND_BASE_URL });

    // 1. Concepts list
    const resConcepts = await unauthContext.get('/api/teacher/knowledge-gaps/concepts');
    expect(resConcepts.status()).toBe(401);
    const bodyConcepts = await resConcepts.json();
    expect(bodyConcepts.error).toMatch(/Authentication required/i);

    // 2. Create concept
    const resCreateConcept = await unauthContext.post('/api/teacher/knowledge-gaps/concepts', {
      data: { name: 'Hacked Concept', subject: '6aca38bedc693572a532fab4' }
    });
    expect(resCreateConcept.status()).toBe(401);

    // 3. Assessments list
    const resAssessments = await unauthContext.get('/api/teacher/knowledge-gaps/assessments');
    expect(resAssessments.status()).toBe(401);

    // 4. Create assessment
    const resCreateAssessment = await unauthContext.post('/api/teacher/knowledge-gaps/assessments', {
      data: { title: 'Hacked Assessment' }
    });
    expect(resCreateAssessment.status()).toBe(401);

    // 5. Diagnosis endpoint
    const resDiagnosis = await unauthContext.get('/api/teacher/knowledge-gaps/diagnosis');
    expect(resDiagnosis.status()).toBe(401);

    // 6. Follow-up endpoint
    const resFollowUp = await unauthContext.post('/api/teacher/knowledge-gaps/diagnosis/follow-up', {
      data: { notes: 'Hacked Note' }
    });
    expect(resFollowUp.status()).toBe(401);
  });

  test('6.2 Reject Student Authenticated Requests on Teacher Knowledge-Gap Endpoints with 403', async ({ playwright }) => {
    const studentContext = await playwright.request.newContext({ baseURL: BACKEND_BASE_URL });

    // Login as student
    const loginRes = await studentContext.post('/api/auth/login', {
      data: {
        userId: STUDENT_CREDENTIALS.userId,
        password: STUDENT_CREDENTIALS.password,
        role: STUDENT_CREDENTIALS.role
      }
    });
    expect(loginRes.status()).toBe(200);

    // 1. Attempt to fetch teacher concepts
    const resConcepts = await studentContext.get('/api/teacher/knowledge-gaps/concepts');
    expect(resConcepts.status()).toBe(403);
    const bodyConcepts = await resConcepts.json();
    expect(bodyConcepts.error).toMatch(/Access denied|Insufficient permissions/i);

    // 2. Attempt to create concept
    const resCreateConcept = await studentContext.post('/api/teacher/knowledge-gaps/concepts', {
      data: { name: 'Student Concept', subject: '6aca38bedc693572a532fab4' }
    });
    expect(resCreateConcept.status()).toBe(403);

    // 3. Attempt to fetch teacher assessments
    const resAssessments = await studentContext.get('/api/teacher/knowledge-gaps/assessments');
    expect(resAssessments.status()).toBe(403);

    // 4. Attempt to fetch diagnosis
    const resDiagnosis = await studentContext.get('/api/teacher/knowledge-gaps/diagnosis');
    expect(resDiagnosis.status()).toBe(403);

    // 5. Attempt to save follow-up note
    const resFollowUp = await studentContext.post('/api/teacher/knowledge-gaps/diagnosis/follow-up', {
      data: { notes: 'Student attempt to alter teacher notes' }
    });
    expect(resFollowUp.status()).toBe(403);
  });

  test('6.3 Data Isolation: Reject Teacher Access to Unassigned Subjects with 403', async ({ playwright }) => {
    const teacherContext = await playwright.request.newContext({ baseURL: BACKEND_BASE_URL });

    // Login as teacher
    const loginRes = await teacherContext.post('/api/auth/login', {
      data: {
        userId: TEACHER_CREDENTIALS.userId,
        password: TEACHER_CREDENTIALS.password,
        role: TEACHER_CREDENTIALS.role
      }
    });
    expect(loginRes.status()).toBe(200);

    // Attempt to access diagnosis for a fake / unassigned subject ObjectId
    const unassignedSubjectId = '650000000000000000000099';

    const resDiagnosis = await teacherContext.get(`/api/teacher/knowledge-gaps/diagnosis?subjectId=${unassignedSubjectId}`);
    expect(resDiagnosis.status()).toBe(403);
    const bodyDiag = await resDiagnosis.json();
    expect(bodyDiag.error).toMatch(/not authorized|Access denied/i);

    // Attempt to access concepts for an unassigned subject
    const resConcepts = await teacherContext.get(`/api/teacher/knowledge-gaps/concepts?subjectId=${unassignedSubjectId}`);
    expect(resConcepts.status()).toBe(403);
  });

  test('6.4 UI Portal Guard: Student cannot access teacher knowledge-gap page in browser', async ({ page }) => {
    // 1. Log in as student
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.fill('#student-userId', STUDENT_CREDENTIALS.userId);
    await page.fill('#student-password', STUDENT_CREDENTIALS.password);
    await page.click('button[type="submit"]:has-text("Login") >> nth=0');

    // Wait for student navigation
    await page.waitForURL('**/student/**', { timeout: 10000 });

    // 2. Attempt to navigate directly to Teacher Knowledge-Gap route
    await page.goto('/teacher/knowledge-gaps');
    await page.waitForLoadState('networkidle');

    // 3. Verify user is blocked/redirected away (not showing teacher knowledge-gap page)
    await expect(page.locator('h1:has-text("Knowledge-Gap Analysis")')).not.toBeVisible();
    expect(page.url()).not.toContain('/teacher/knowledge-gaps');
  });
});
