import { test, expect } from '@playwright/test';
import { loginAsTeacher, selectTeacherDropdown } from './helpers/test-setup';

test.describe('Section Dropdown Labels — Teacher Portal Verification', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
  });

  test('6.1 Student Risk Analytics section dropdown displays clean labels and scopes correctly', async ({ page }) => {
    await page.goto('/teacher/risk-analytics');
    await page.waitForLoadState('networkidle');

    // Wait for the risk section filter to be visible
    const secFilter = page.locator('#risk-filter-section');
    await expect(secFilter).toBeVisible({ timeout: 8000 });
    await expect(secFilter).toContainText(/All Sections/i);

    // Open section dropdown and verify options
    await secFilter.click();
    const listbox = page.locator('#risk-filter-section-listbox');
    await expect(listbox).toBeVisible({ timeout: 5000 });

    const secOptions = await listbox.locator('[role="option"]').allInnerTexts();
    // Verify clean simple labels
    expect(secOptions).toContain('Section A');
    expect(secOptions).toContain('Section B');

    // Ensure no department names or parenthetical expressions in section labels
    for (const opt of secOptions) {
      expect(opt).not.toMatch(/Computer Science and Engineering/i);
      expect(opt).not.toMatch(/\(/);
      expect(opt).not.toMatch(/\)/);
    }
    await page.keyboard.press('Escape');

    // 1. Filter by Fourth Year -> Should only show Section A
    await selectTeacherDropdown(page, 'risk-filter-year', /Fourth Year/i);
    await secFilter.click();
    const fourthYearSecs = await listbox.locator('[role="option"]').allInnerTexts();
    expect(fourthYearSecs).toContain('Section A');
    expect(fourthYearSecs).not.toContain('Section B');
    await page.keyboard.press('Escape');

    // 2. Filter by Second Year -> Should only show Section B
    await selectTeacherDropdown(page, 'risk-filter-year', /Second Year/i);
    await secFilter.click();
    const secondYearSecs = await listbox.locator('[role="option"]').allInnerTexts();
    expect(secondYearSecs).toContain('Section B');
    expect(secondYearSecs).not.toContain('Section A');
    await page.keyboard.press('Escape');

    // Reset Year to All Years
    await selectTeacherDropdown(page, 'risk-filter-year', /All Years/i);

    // 3. Filter by Subject: DSA -> Should only show Section A
    await selectTeacherDropdown(page, 'risk-filter-subject', /DSA/i);
    await secFilter.click();
    const dsaSecs = await listbox.locator('[role="option"]').allInnerTexts();
    expect(dsaSecs).toContain('Section A');
    expect(dsaSecs).not.toContain('Section B');

    // Select Section A and verify it filters students
    await listbox.locator('[role="option"]', { hasText: /Section A/i }).first().click();
    await expect(secFilter).toContainText(/Section A/i);

    // 4. Changing Subject to Distributed Systems should clear Section A since it's invalid
    await selectTeacherDropdown(page, 'risk-filter-subject', /Distributed Systems/i);
    await expect(secFilter).toContainText(/All Sections/i);

    // Now section options under Distributed Systems should only be Section B
    await secFilter.click();
    const dsSecs = await listbox.locator('[role="option"]').allInnerTexts();
    expect(dsSecs).toContain('Section B');
    expect(dsSecs).not.toContain('Section A');
    await page.keyboard.press('Escape');
  });

  test('6.2 Knowledge-Gap Analysis section dropdown displays clean labels and scopes correctly', async ({ page }) => {
    await page.goto('/teacher/knowledge-gaps');
    await page.waitForLoadState('networkidle');

    const secFilter = page.locator('#filter-kg-sec');
    await expect(secFilter).toBeVisible({ timeout: 8000 });
    await expect(secFilter).toContainText(/All Sections/i);

    // Open section dropdown and verify options
    await secFilter.click();
    const listbox = page.locator('#filter-kg-sec-listbox');
    await expect(listbox).toBeVisible({ timeout: 5000 });

    const secOptions = await listbox.locator('[role="option"]').allInnerTexts();
    expect(secOptions).toContain('Section A');
    expect(secOptions).toContain('Section B');

    // Ensure no department names or parenthetical expressions in section labels
    for (const opt of secOptions) {
      expect(opt).not.toMatch(/Computer Science and Engineering/i);
      expect(opt).not.toMatch(/\(/);
      expect(opt).not.toMatch(/\)/);
    }
    await page.keyboard.press('Escape');

    // Filter by Fourth Year -> only Section A
    await selectTeacherDropdown(page, 'filter-kg-year', /Fourth Year/i);
    await secFilter.click();
    const fourthYearSecs = await listbox.locator('[role="option"]').allInnerTexts();
    expect(fourthYearSecs).toContain('Section A');
    expect(fourthYearSecs).not.toContain('Section B');

    // Select Section A
    await listbox.locator('[role="option"]', { hasText: /Section A/i }).first().click();
    await expect(secFilter).toContainText(/Section A/i);

    // Changing Year to Second Year should clear Section A to All Sections
    await selectTeacherDropdown(page, 'filter-kg-year', /Second Year/i);
    await expect(secFilter).toContainText(/All Sections/i);

    // In Second Year, sections should only show Section B
    await secFilter.click();
    const secondYearSecs = await listbox.locator('[role="option"]').allInnerTexts();
    expect(secondYearSecs).toContain('Section B');
    expect(secondYearSecs).not.toContain('Section A');
    await page.keyboard.press('Escape');
  });

});
