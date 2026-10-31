import { test, expect } from '@playwright/test';
import { TEACHER_CREDENTIALS, loginAsTeacher, selectTeacherDropdown } from './helpers/test-setup';

test.describe('Section 2: Navigation and Page Loading', () => {
  test('2.1 Invalid teacher login is rejected appropriately', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.fill('#teacher-userId', 't001');
    await page.fill('#teacher-password', 'IncorrectPassword123!');
    const submitBtn = page.locator('#teacher-userId >> xpath=ancestor::form//button[@type="submit"]');
    await submitBtn.click();

    // Verify error notification inside card
    const errorAlert = page.locator('#teacher-userId >> xpath=ancestor::div[contains(@class, "rounded-2xl")]//div[contains(@class, "bg-rose-50")]');
    await expect(errorAlert).toBeVisible({ timeout: 6000 });
    await expect(errorAlert).toContainText(/Invalid credentials/i);
    expect(page.url()).not.toContain('/teacher');
  });

  test('2.2 Valid teacher login opens Teacher Portal', async ({ page }) => {
    await loginAsTeacher(page);
    await expect(page).toHaveURL(/.*\/teacher\/.*/);
    await expect(page.locator('aside').first()).toBeVisible();
    await expect(page.locator('aside h2')).toContainText(/ClassPulse/i);
  });

  test('2.3 Knowledge-Gap Analysis navigation link opens the correct route without console errors', async ({ page }) => {
    await loginAsTeacher(page);

    const kgConsoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('401')) {
          kgConsoleErrors.push(text);
        }
      }
    });

    // Click sidebar link for Knowledge-Gap Analysis
    const kgNavLink = page.locator('aside a[href="/teacher/knowledge-gaps"]');
    await expect(kgNavLink.first()).toBeVisible({ timeout: 6000 });
    await kgNavLink.first().click();

    await page.waitForURL('**/teacher/knowledge-gaps', { timeout: 8000 });
    const pageHeading = page.getByRole('heading', { name: 'Knowledge-Gap Analysis' }).first();
    await expect(pageHeading).toBeVisible();

    // Verify no catastrophic uncaught errors
    expect(kgConsoleErrors).toHaveLength(0);
  });

  test('2.4 Academic scope filters load real options, clean section names, and respect cascading dependencies', async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/knowledge-gaps');
    await page.waitForLoadState('networkidle');

    // Verify 4 filters exist in exact order and semester is removed
    const yearFilter = page.locator('#filter-kg-year');
    const deptFilter = page.locator('#filter-kg-dept');
    const secFilter = page.locator('#filter-kg-sec');
    const subjFilter = page.locator('#filter-kg-subject');
    const semFilter = page.locator('#filter-kg-sem');

    await expect(yearFilter).toBeVisible();
    await expect(deptFilter).toBeVisible();
    await expect(secFilter).toBeVisible();
    await expect(subjFilter).toBeVisible();
    await expect(semFilter).not.toBeAttached();

    // Verify "All Years" is the default year placeholder / option
    await expect(yearFilter).toContainText(/All Years/i);

    // Verify Clean Section names: open section dropdown and verify options
    await secFilter.click();
    const sectionOptions = page.locator('#filter-kg-sec-listbox [role="option"]');
    const sectionTexts = await sectionOptions.allInnerTexts();
    // Options should be "All Sections" and clean labels like "Section A", "Section B"
    for (const text of sectionTexts) {
      if (!/All Sections/i.test(text)) {
        expect(text).toMatch(/^Section\s+[A-Za-z0-9_-]+$/);
        expect(text).not.toContain('Dept:');
        expect(text).not.toContain('DEPT:');
        expect(text).not.toContain('Computer Science');
        expect(text).not.toContain('B.Tech');
      }
    }
    // Dismiss section dropdown
    await page.keyboard.press('Escape');

    // Verify Academic Year dropdown displays "All Years" on trigger, and listbox options are study years (Second Year, Fourth Year)
    await expect(yearFilter).toContainText(/All Years/i);
    await yearFilter.click();
    const yearOptions = page.locator('#filter-kg-year-listbox [role="option"]');
    const yearTexts = await yearOptions.allInnerTexts();
    expect(yearTexts).toContain('Fourth Year');
    expect(yearTexts).toContain('Second Year');
    // Ensure no raw calendar years like "Year: 2026-2027" are displayed
    for (const text of yearTexts) {
      expect(text).not.toContain('Year: 2026-2027');
      expect(text).not.toContain('2026-2027');
    }
    // Dismiss year dropdown
    await page.keyboard.press('Escape');

    // Select Fourth Year
    await selectTeacherDropdown(page, 'filter-kg-year', /Fourth Year/i);
    await expect(yearFilter).toContainText(/Fourth Year/i);

    // In Fourth Year, verify subject is DSA (CSE101) and Section A is available
    await expect(subjFilter).toContainText(/DSA/i);
    await expect(page.locator('text=CSE101').first()).toBeVisible({ timeout: 6000 });

    // Verify sections under Fourth Year only contain Section A
    await secFilter.click();
    const fourthYearSecOptions = await page.locator('#filter-kg-sec-listbox [role="option"]').allInnerTexts();
    expect(fourthYearSecOptions).toContain('Section A');
    expect(fourthYearSecOptions).not.toContain('Section B');
    await page.keyboard.press('Escape');

    // Select Second Year
    await selectTeacherDropdown(page, 'filter-kg-year', /Second Year/i);
    await expect(yearFilter).toContainText(/Second Year/i);

    // In Second Year, verify subject updates to Distributed Systems and Section B is available
    await expect(subjFilter).toContainText(/Distributed Systems/i);
    await secFilter.click();
    const secondYearSecOptions = await page.locator('#filter-kg-sec-listbox [role="option"]').allInnerTexts();
    expect(secondYearSecOptions).toContain('Section B');
    expect(secondYearSecOptions).not.toContain('Section A');
    await page.keyboard.press('Escape');

    // Cascading test: Changing Academic Year back to All Years
    await selectTeacherDropdown(page, 'filter-kg-year', /All Years/i);
    await expect(page.locator('#filter-kg-subject')).toBeVisible();
  });

  test('2.5 Unauthorized users cannot access teacher Knowledge-Gap Analysis page', async ({ page, context }) => {
    await context.clearCookies();

    await page.goto('/teacher/knowledge-gaps');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain('/teacher/knowledge-gaps');
  });
});
