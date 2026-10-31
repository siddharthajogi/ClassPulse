import { test, expect } from '@playwright/test';
import { loginAsTeacher, selectTeacherDropdown } from './helpers/test-setup';

test.describe('Section 4: Stage 2 — Assessment-to-Concept Mapping', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/knowledge-gaps');
    await page.waitForLoadState('networkidle');

    // Select Academic Year Fourth Year and Subject DSA
    await selectTeacherDropdown(page, 'filter-kg-year', /Fourth Year/i);
    await selectTeacherDropdown(page, 'filter-kg-subject', /DSA/i);

    // Switch to Stage 2 tab
    const stage2Tab = page.locator('button:has-text("2. Question Mapping")');
    await stage2Tab.click();
    await expect(page.getByRole('heading', { name: 'Knowledge-Gap Analysis' }).first()).toBeVisible();
  });

  test('4.1 Create an assessment, map questions to concepts, and verify persistence on reload', async ({ page }) => {
    const assessmentTitle = `E2E Midterm ${Date.now()}`;

    // Click New Assessment button
    await page.getByRole('button', { name: 'New Assessment' }).click();

    const createModal = page.locator('form:has-text("Assessment Title")');
    await expect(createModal).toBeVisible();

    // Fill assessment form
    await createModal.locator('input[placeholder*="Midterm"]').fill(assessmentTitle);
    
    // Q1 prompt (index 0)
    await createModal.locator('input[placeholder*="Solve linear recurrence"]').nth(0).fill('What is the time complexity of QuickSort?');
    // Q2 prompt (index 1)
    await createModal.locator('input[placeholder*="Solve linear recurrence"]').nth(1).fill('Explain binary search tree balancing.');

    // Submit Create Assessment
    await createModal.locator('button[type="submit"]:has-text("Create Assessment")').click();

    // Verify success toast
    await expect(page.locator('text=created successfully')).toBeVisible({ timeout: 6000 });

    // Verify Questions Table renders Q1 with Unmapped status
    const q1Row = page.locator('tr').filter({ has: page.locator('td:first-child', { hasText: 'Q1' }) });
    await expect(q1Row).toBeVisible();
    await expect(q1Row.locator('text=Unmapped')).toBeVisible();

    // Map Q1 to a concept
    await q1Row.locator('button[title*="Map concepts to"]').click();

    const mappingModal = page.locator('.fixed.inset-0', { hasText: 'Map Concepts to' });
    await expect(mappingModal).toBeVisible();

    // Check first available concept
    const firstConceptCheckbox = mappingModal.locator('input[type="checkbox"]').first();
    await firstConceptCheckbox.check();

    // Save Mapping
    await mappingModal.locator('button:has-text("Save Mapping")').click();
    await expect(page.locator('text=updated successfully').first()).toBeVisible({ timeout: 6000 });

    // Verify Q1 row status badge updates to Mapped
    await expect(q1Row.locator('span:has-text("Mapped")').first()).toBeVisible();

    // Refresh page and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    await selectTeacherDropdown(page, 'filter-kg-year', /Fourth Year/i);
    await selectTeacherDropdown(page, 'filter-kg-subject', /DSA/i);
    await page.locator('button:has-text("2. Question Mapping")').click();

    // Select the created assessment if not already selected
    const assessmentSelect = page.locator('select').first();
    await expect(assessmentSelect).toBeVisible();
    const optVal = await assessmentSelect.locator('option').filter({ hasText: assessmentTitle }).getAttribute('value');
    if (optVal) {
      await assessmentSelect.selectOption(optVal);
    }

    // Verify Q1 still mapped
    const q1RowReload = page.locator('tr').filter({ has: page.locator('td:first-child', { hasText: 'Q1' }) });
    await expect(q1RowReload.locator('span:has-text("Mapped")').first()).toBeVisible({ timeout: 7000 });

    // Clean up created assessment
    await page.getByRole('button', { name: 'Delete Assessment' }).click();
    await page.getByRole('button', { name: 'Permanently Delete' }).click();
    await expect(page.locator('text=deleted').first()).toBeVisible({ timeout: 6000 });
  });

  test('4.2 Multi-concept question mapping and unmapping tags', async ({ page }) => {
    const assessmentTitle = `E2E MultiMap ${Date.now()}`;

    // Create assessment
    await page.getByRole('button', { name: 'New Assessment' }).click();
    const createModal = page.locator('form:has-text("Assessment Title")');
    await createModal.locator('input[placeholder*="Midterm"]').fill(assessmentTitle);
    await createModal.locator('input[placeholder*="Solve linear recurrence"]').nth(0).fill('Question with multiple concept facets');
    await createModal.locator('button[type="submit"]:has-text("Create Assessment")').click();
    await expect(page.locator('text=created successfully')).toBeVisible({ timeout: 6000 });

    const q1Row = page.locator('tr').filter({ has: page.locator('td:first-child', { hasText: 'Q1' }) });
    await q1Row.locator('button[title*="Map concepts to"]').click();

    const mappingModal = page.locator('.fixed.inset-0', { hasText: 'Map Concepts to' });
    await expect(mappingModal).toBeVisible();

    // Check multiple concepts (at least 2 if available)
    const checkboxes = mappingModal.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    if (count >= 2) {
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await mappingModal.locator('button:has-text("Save Mapping")').click();
      await expect(page.locator('text=updated successfully').first()).toBeVisible({ timeout: 6000 });

      // Verify row displays concept tags with unmap X buttons
      const tags = q1Row.locator('button[title="Unmap this concept"]');
      await expect(tags).toHaveCount(2);

      // Unmap one concept directly from tag
      await tags.first().click();
      await expect(page.locator('text=Concept removed').first()).toBeVisible({ timeout: 6000 });
    } else {
      await checkboxes.first().check();
      await mappingModal.locator('button:has-text("Save Mapping")').click();
    }

    // Clean up
    await page.getByRole('button', { name: 'Delete Assessment' }).click();
    await page.getByRole('button', { name: 'Permanently Delete' }).click();
  });

  test('4.3 Student question marks validation (rejecting negative or marks > maxMarks)', async ({ page }) => {
    const assessmentTitle = `E2E ScoreVal ${Date.now()}`;

    // Create assessment with 1 question of maxMarks 10
    await page.getByRole('button', { name: 'New Assessment' }).click();
    const createModal = page.locator('form:has-text("Assessment Title")');
    await createModal.locator('input[placeholder*="Midterm"]').fill(assessmentTitle);
    await createModal.locator('input[placeholder*="Solve linear recurrence"]').nth(0).fill('Question for score validation testing');
    await createModal.locator('button[type="submit"]:has-text("Create Assessment")').click();
    await expect(page.locator('text=created successfully')).toBeVisible({ timeout: 6000 });

    // Open Student Evidence modal
    await page.locator('button:has-text("Record Question Marks"), button:has-text("Review Scores")').click();

    const evidenceModal = page.locator('.fixed.inset-0', { hasText: 'Student Question Evidence' });
    await expect(evidenceModal).toBeVisible();

    // Check if score inputs are present (for enrolled students)
    const scoreInputs = evidenceModal.locator('input[type="number"]');
    if (await scoreInputs.count() > 0) {
      // Enter invalid score greater than maxMarks (e.g. 25 when max is 10)
      await scoreInputs.first().fill('25');
      await evidenceModal.locator('button:has-text("Save Student Scores")').click();

      // Verify validation error
      await expect(evidenceModal.locator('div[class*="bg-rose-50"]')).toContainText(/cannot exceed maximum marks/i);

      // Enter invalid negative score
      await scoreInputs.first().fill('-5');
      await evidenceModal.locator('button:has-text("Save Student Scores")').click();
      await expect(evidenceModal.locator('div[class*="bg-rose-50"]')).toContainText(/cannot be negative/i);

      // Enter valid score (8/10)
      await scoreInputs.first().fill('8');
      await evidenceModal.locator('button:has-text("Save Student Scores")').click();
      await expect(page.locator('text=Saved')).toBeVisible({ timeout: 6000 });
    }

    await evidenceModal.getByRole('button', { name: 'Close' }).click().catch(() => {});

    // Clean up
    await page.getByRole('button', { name: 'Delete Assessment' }).click();
    await page.getByRole('button', { name: 'Permanently Delete' }).click();
  });
});
