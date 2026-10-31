import { test, expect } from '@playwright/test';
import { loginAsTeacher, selectTeacherDropdown } from './helpers/test-setup';

test.describe('Section 3: Stage 1 — Concept and Prerequisite Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/knowledge-gaps');
    await page.waitForLoadState('networkidle');

    // Select Academic Year Fourth Year and Subject DSA
    await selectTeacherDropdown(page, 'filter-kg-year', /Fourth Year/i);
    await selectTeacherDropdown(page, 'filter-kg-subject', /DSA/i);

    // Switch to Stage 1 tab (1. Concepts & Prereqs)
    const stage1Tab = page.locator('button:has-text("1. Concepts & Prereqs")');
    await stage1Tab.click();
    await expect(page.getByRole('heading', { name: 'Knowledge-Gap Analysis' }).first()).toBeVisible();
  });

  test('3.1 Create a subject concept, verify list appearance, and check persistence on reload', async ({ page }) => {
    const conceptName = `E2E Concept ${Date.now()}`;

    // Click Add Concept button
    await page.getByRole('button', { name: 'Add Concept' }).click();

    // Verify modal opens
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Fill concept form
    await modal.locator('input[placeholder*="Variables"]').fill(conceptName);
    await modal.locator('textarea').fill('Detailed syllabus focus for automated test');
    await modal.locator('select').selectOption('Fundamental');

    // Submit form using submit button
    await modal.locator('button[type="submit"]').click();

    // Verify success toast/alert
    await expect(page.locator('text=created successfully')).toBeVisible({ timeout: 6000 });

    // Verify concept is listed in the concepts table (column 2 has concept name)
    const conceptRow = page.locator('tr').filter({ has: page.locator('td:nth-child(2)', { hasText: conceptName }) });
    await expect(conceptRow).toBeVisible({ timeout: 6000 });

    // Refresh page and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Re-select Subject if needed after reload
    await selectTeacherDropdown(page, 'filter-kg-year', /Fourth Year/i);
    await selectTeacherDropdown(page, 'filter-kg-subject', /DSA/i);
    await page.locator('button:has-text("1. Concepts & Prereqs")').click();

    const conceptRowAfterReload = page.locator('tr').filter({ has: page.locator('td:nth-child(2)', { hasText: conceptName }) });
    await expect(conceptRowAfterReload).toBeVisible({ timeout: 7000 });

    // Clean up created concept
    await conceptRowAfterReload.getByRole('button', { name: 'Delete Concept' }).click();
    await page.getByRole('button', { name: 'Permanently Delete' }).click();
    await expect(page.locator('tr').filter({ has: page.locator('td:nth-child(2)', { hasText: conceptName }) })).toHaveCount(0, { timeout: 6000 });
  });

  test('3.2 Edit concept, update fields, and verify persistence', async ({ page }) => {
    const originalName = `E2E Edit Test ${Date.now()}`;
    const updatedName = `${originalName} - MODIFIED`;

    // 1. Create
    await page.getByRole('button', { name: 'Add Concept' }).click();
    const modal = page.locator('div[role="dialog"]');
    await modal.locator('input[placeholder*="Variables"]').fill(originalName);
    await modal.locator('select').selectOption('Beginner');
    await modal.locator('button[type="submit"]').click();
    
    const row = page.locator('tr').filter({ has: page.locator('td:nth-child(2)', { hasText: originalName }) });
    await expect(row).toBeVisible({ timeout: 6000 });

    // 2. Edit
    await row.getByRole('button', { name: 'Edit Concept' }).click();
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    await page.locator('div[role="dialog"] input[type="text"]').fill(updatedName);
    await page.locator('div[role="dialog"] select').selectOption('Advanced');
    await page.locator('div[role="dialog"] button[type="submit"]').click();

    // Verify update
    await expect(page.locator('text=updated successfully')).toBeVisible({ timeout: 6000 });
    const updatedRow = page.locator('tr').filter({ has: page.locator('td:nth-child(2)', { hasText: updatedName }) });
    await expect(updatedRow).toBeVisible();

    // 3. Clean up
    await updatedRow.getByRole('button', { name: 'Delete Concept' }).click();
    await page.getByRole('button', { name: 'Permanently Delete' }).click();
    await expect(page.locator('tr').filter({ has: page.locator('td:nth-child(2)', { hasText: updatedName }) })).toHaveCount(0, { timeout: 6000 });
  });

  test('3.3 Prerequisite relationships and circular dependency rejection', async ({ page }) => {
    const parentName = `E2E Parent ${Date.now()}`;
    const childName = `E2E Child ${Date.now()}`;

    // 1. Create Parent Concept
    await page.getByRole('button', { name: 'Add Concept' }).click();
    await page.locator('div[role="dialog"] input[placeholder*="Variables"]').fill(parentName);
    await page.locator('div[role="dialog"] select').selectOption('Fundamental');
    await page.locator('div[role="dialog"] button[type="submit"]').click();
    const parentRow = page.locator('tr').filter({ has: page.locator('td:nth-child(2)', { hasText: parentName }) });
    await expect(parentRow).toBeVisible({ timeout: 6000 });

    // 2. Create Child Concept with Parent as prerequisite
    await page.getByRole('button', { name: 'Add Concept' }).click();
    await page.locator('div[role="dialog"] input[placeholder*="Variables"]').fill(childName);
    await page.locator('div[role="dialog"] select').selectOption('Intermediate');

    // Check parent checkbox in prerequisites list
    const parentCheckbox = page.locator(`div[role="dialog"] label:has-text("${parentName}") input[type="checkbox"]`);
    await parentCheckbox.check();
    await page.locator('div[role="dialog"] button[type="submit"]').click();

    const childRow = page.locator('tr').filter({ has: page.locator('td:nth-child(2)', { hasText: childName }) });
    await expect(childRow).toBeVisible({ timeout: 6000 });

    // 3. Circular Dependency Test: Try editing Parent and adding Child as prerequisite
    await parentRow.getByRole('button', { name: 'Edit Concept' }).click();

    const childCheckboxInParentModal = page.locator(`div[role="dialog"] label:has-text("${childName}") input[type="checkbox"]`);
    await childCheckboxInParentModal.check();
    await page.locator('div[role="dialog"] button[type="submit"]').click();

    // Verify circular dependency rejection error alert inside modal
    const modalErrorAlert = page.locator('div[role="dialog"] div[class*="bg-rose-50"]');
    await expect(modalErrorAlert).toBeVisible({ timeout: 6000 });
    await expect(modalErrorAlert).toContainText(/circular/i);

    // Cancel modal
    await page.locator('div[role="dialog"] button:has-text("Cancel")').click();

    // 4. Deletion safety: Try deleting Parent concept while Child depends on it
    await parentRow.getByRole('button', { name: 'Delete Concept' }).click();
    const permanentlyDeleteBtn = page.getByRole('button', { name: 'Permanently Delete' });
    await expect(permanentlyDeleteBtn).toBeDisabled();
    await expect(page.locator('text=Cannot Delete: Active Prerequisite Dependency')).toBeVisible();
    await page.locator('div[role="dialog"] button:has-text("Cancel")').click();

    // 5. Clean up: Delete Child first (leaf), then Parent
    await childRow.getByRole('button', { name: 'Delete Concept' }).click();
    await page.getByRole('button', { name: 'Permanently Delete' }).click();
    await expect(page.locator('tr').filter({ has: page.locator('td:nth-child(2)', { hasText: childName }) })).toHaveCount(0, { timeout: 6000 });

    await parentRow.getByRole('button', { name: 'Delete Concept' }).click();
    await page.getByRole('button', { name: 'Permanently Delete' }).click();
    await expect(page.locator('tr').filter({ has: page.locator('td:nth-child(2)', { hasText: parentName }) })).toHaveCount(0, { timeout: 6000 });
  });

  test('3.4 Validation error on empty concept name', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Concept' }).click();
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Leave name empty and attempt submission
    await modal.locator('input[placeholder*="Variables"]').fill('');
    await modal.locator('button[type="submit"]').click();

    // Modal should stay open
    await expect(modal).toBeVisible();
    await modal.locator('button:has-text("Cancel")').click();
  });
});
