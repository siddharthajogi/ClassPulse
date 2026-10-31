import { expect } from '@playwright/test';

export const TEACHER_CREDENTIALS = {
  userId: 't001',
  password: 'StudyPoint@Teacher2026',
  role: 'teacher'
};

export const STUDENT_CREDENTIALS = {
  userId: 's001',
  password: 'StudentPassword@2026',
  role: 'student'
};

export const ADMIN_CREDENTIALS = {
  userId: '0001',
  password: 'StudyPoint@Admin2026',
  role: 'admin'
};

/**
 * Log in via UI form
 */
export async function loginAsTeacher(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Fill teacher credentials
  await page.fill('#teacher-userId', TEACHER_CREDENTIALS.userId);
  await page.fill('#teacher-password', TEACHER_CREDENTIALS.password);
  
  // Submit teacher form
  const teacherSubmitBtn = page.locator('#teacher-userId >> xpath=ancestor::form//button[@type="submit"]');
  await teacherSubmitBtn.click();

  // Wait for redirect to /teacher/dashboard
  await page.waitForURL('**/teacher/**', { timeout: 10000 });
}

/**
 * Helper to select an option in TeacherDropdown
 */
export async function selectTeacherDropdown(page, buttonId, optionTextOrRegex) {
  const trigger = page.locator(`#${buttonId}`);
  await trigger.waitFor({ state: 'visible', timeout: 8000 });
  await trigger.click();

  const listbox = page.locator(`#${buttonId}-listbox`);
  await listbox.waitFor({ state: 'visible', timeout: 5000 });

  const option = listbox.locator('[role="option"]', { hasText: optionTextOrRegex });
  await option.first().waitFor({ state: 'visible', timeout: 5000 });
  await option.first().click();

  // Wait for listbox to close
  await listbox.waitFor({ state: 'hidden', timeout: 5000 });
}
