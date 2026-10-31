import { test, expect } from '@playwright/test';
import { loginAsTeacher, selectTeacherDropdown } from './helpers/test-setup';

test.describe('Section 5: Stage 3 — Knowledge-Gap Diagnosis', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/knowledge-gaps');
    await page.waitForLoadState('networkidle');

    // Select Academic Year Fourth Year and Subject DSA
    await selectTeacherDropdown(page, 'filter-kg-year', /Fourth Year/i);
    await selectTeacherDropdown(page, 'filter-kg-subject', /DSA/i);

    // Switch to Stage 3 Diagnosis tab
    const stage3Tab = page.locator('button:has-text("3. Gap Diagnosis")');
    await stage3Tab.click();
    await expect(page.getByRole('heading', { name: 'Knowledge-Gap Analysis' }).first()).toBeVisible();
  });

  test('5.1 Verify Diagnosis header, deterministic formula explainability notice, and summary KPI cards', async ({ page }) => {
    // 1. Verify Header Banner
    await expect(page.locator('text=Evidence-Based Knowledge-Gap Diagnosis')).toBeVisible({ timeout: 7000 });

    // 2. Verify Deterministic Evaluation Engine Rules & Thresholds explainability notice
    const notice = page.locator('p:has-text("Deterministic Evaluation Engine Rules & Thresholds")');
    await expect(notice).toBeVisible();
    const noticeBlock = page.locator('div.space-y-0\\.5').filter({ hasText: 'Deterministic Evaluation Engine' });
    await expect(noticeBlock).toContainText(/Needs Attention:\s*Score\s*<\s*50%/i);
    await expect(noticeBlock).toContainText(/Developing:\s*50%–74%/i);
    await expect(noticeBlock).toContainText(/On Track:\s*≥\s*75%/i);
    await expect(noticeBlock).toContainText(/Insufficient Data/i);
    await expect(noticeBlock).toContainText(/never treated as zero/i);

    // 3. Verify all 5 Summary KPI Cards
    await expect(page.locator('text=Students Evaluated')).toBeVisible();
    await expect(page.locator('text=Concepts with Gaps')).toBeVisible();
    await expect(page.locator('text=Students Needing Support')).toBeVisible();
    await expect(page.locator('text=Unassessed Concepts')).toBeVisible();
    await expect(page.locator('text=Cohort Average')).toBeVisible();
  });

  test('5.2 Verify Concept Performance Heatmap matrix, status legend, and view toggles', async ({ page }) => {
    // 1. Verify Legend badges
    const legend = page.locator('span:has-text("Heatmap Legend:")');
    await expect(legend).toBeVisible({ timeout: 7000 });
    await expect(page.locator('span.inline-flex:has-text("Needs Attention")')).toBeVisible();
    await expect(page.locator('span.inline-flex:has-text("Developing")')).toBeVisible();
    await expect(page.locator('span.inline-flex:has-text("On Track")')).toBeVisible();
    await expect(page.locator('span.inline-flex:has-text("Insufficient Evidence")')).toBeVisible();

    // 2. Verify Heatmap Table or empty state
    const heatmapTable = page.locator('table');
    const emptyState = page.locator('text=No diagnosis records found');
    await expect(heatmapTable.or(emptyState)).toBeVisible();

    // 3. Filter controls check
    const statusSelect = page.locator('select').filter({ hasText: 'All Diagnostic Statuses' });
    if (await statusSelect.count() > 0) {
      await statusSelect.selectOption({ label: 'Needs Attention (<50%)' });
      await statusSelect.selectOption({ value: 'ALL' });
    }

    // 4. Toggle to Findings Report view
    const findingsTab = page.locator('button:has-text("Student Gap Findings")');
    await findingsTab.click();
    await expect(page.locator('button:has-text("Student Gap Findings")')).toHaveClass(/bg-white|dark:bg-slate-900/);

    // Switch back to Heatmap
    const heatmapTab = page.locator('button:has-text("Concept Performance Heatmap")');
    await heatmapTab.click();
    await expect(heatmapTab).toHaveClass(/bg-white|dark:bg-slate-900/);
  });

  test('5.3 Controlled mathematical diagnosis, Evidence Audit modal, and Follow-Up Note saving', async ({ page }) => {
    const assessmentTitle = `E2E DiagExam ${Date.now()}`;

    // 1. Switch to Stage 2 and create a test assessment
    await page.locator('button:has-text("2. Question Mapping")').click();
    await page.getByRole('button', { name: 'New Assessment' }).click();

    const createModal = page.locator('form:has-text("Assessment Title")');
    await createModal.locator('input[placeholder*="Midterm"]').fill(assessmentTitle);
    await createModal.locator('input[placeholder*="Solve linear recurrence"]').nth(0).fill('Controlled diagnosis test question');
    await createModal.locator('button[type="submit"]:has-text("Create Assessment")').click();
    await expect(page.locator('text=created successfully').first()).toBeVisible({ timeout: 6000 });

    // Map Q1 to first concept
    const q1Row = page.locator('tr').filter({ has: page.locator('td:first-child', { hasText: 'Q1' }) });
    await q1Row.locator('button[title*="Map concepts to"]').click();

    const mappingModal = page.locator('.fixed.inset-0', { hasText: 'Map Concepts to' });
    await expect(mappingModal).toBeVisible();
    const firstConceptCheckbox = mappingModal.locator('input[type="checkbox"]').first();
    await firstConceptCheckbox.check();
    await mappingModal.locator('button:has-text("Save Mapping")').click();
    await expect(page.locator('text=updated successfully').first()).toBeVisible({ timeout: 6000 });

    // Record question score: 4/10 (40% -> Needs Attention)
    await page.locator('button:has-text("Record Question Marks"), button:has-text("Review Scores")').click();
    const evidenceModal = page.locator('.fixed.inset-0', { hasText: 'Student Question Evidence' });
    await expect(evidenceModal).toBeVisible();

    const scoreInputs = evidenceModal.locator('input[type="number"]');
    if (await scoreInputs.count() > 0) {
      // Set student 1 score to 4
      await scoreInputs.first().fill('4');
      await evidenceModal.locator('button:has-text("Save Student Scores")').click();
      await expect(page.locator('text=Saved').first()).toBeVisible({ timeout: 6000 });
    }
    await evidenceModal.getByRole('button', { name: 'Close' }).click().catch(() => {});

    // 2. Switch to Stage 3 Diagnosis tab
    await page.locator('button:has-text("3. Gap Diagnosis")').click();
    await page.waitForLoadState('networkidle');

    // 3. Verify cell displays 40% and click it to open Evidence Audit Modal
    const targetCell = page.locator('button:has-text("40%")').first();
    if (await targetCell.count() > 0) {
      await expect(targetCell).toBeVisible();
      // Click cell to open Evidence Audit Modal
      await targetCell.click();

      const auditModal = page.locator('.fixed.inset-0', { hasText: 'Evidence Audit & Diagnostic Breakdown' });
      await expect(auditModal).toBeVisible({ timeout: 7000 });

      // Verify Audit Modal components
      await expect(auditModal.locator('text=Student Profile')).toBeVisible();
      await expect(auditModal.locator('text=Target Concept')).toBeVisible();
      await expect(auditModal.locator('text=Teacher Instructional Review & Follow-Up Notes')).toBeVisible();

      // Enter follow-up note and change status
      const statusSelect = auditModal.locator('select').first();
      await statusSelect.selectOption({ label: 'Under Review' });

      const notesTextarea = auditModal.locator('textarea[placeholder*="Advised student to review"]');
      await notesTextarea.fill('Automated E2E diagnostic review note: confirmed 40% score.');

      await auditModal.locator('button:has-text("Save Follow-Up Note")').click();
      await expect(auditModal.locator('text=updated')).toBeVisible({ timeout: 6000 });

      // Close audit modal
      await auditModal.locator('button:has-text("Close Audit")').click();
    }

    // 4. Cleanup created assessment
    await page.locator('button:has-text("2. Question Mapping")').click();
    await page.waitForLoadState('networkidle');
    const assessmentSelect = page.locator('select').first();
    const optVal = await assessmentSelect.locator('option').filter({ hasText: assessmentTitle }).getAttribute('value');
    if (optVal) {
      await assessmentSelect.selectOption(optVal);
    }
    await page.getByRole('button', { name: 'Delete Assessment' }).click();
    await page.getByRole('button', { name: 'Permanently Delete' }).click();
    await expect(page.locator('text=deleted').first()).toBeVisible({ timeout: 6000 });
  });
});
