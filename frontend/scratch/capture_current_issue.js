import { chromium } from 'playwright-core';
import path from 'path';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  console.log('Logging in as Teacher (t001)...');
  await page.fill('#teacher-userId', 't001');
  await page.fill('#teacher-password', 'Teacher@123');
  await page.click('#teacher-userId >> xpath=ancestor::form//button[@type="submit"]');

  // Wait for navigation to /teacher/dashboard
  await page.waitForURL('**/teacher/**', { timeout: 10000 });
  console.log('Logged in successfully, current URL:', page.url());

  // Switch to Dark Mode if not already dark
  const themeButton = page.locator('button[aria-label="Select Theme"]');
  if (await themeButton.count() > 0) {
    await themeButton.click();
    await page.waitForTimeout(400);
    const darkModeBtn = page.locator('button:has-text("Dark Mode")');
    if (await darkModeBtn.count() > 0) {
      await darkModeBtn.click();
      await page.waitForTimeout(400);
      console.log('Switched to Dark Mode');
    }
  }

  // Navigate to /teacher/classes
  console.log('Navigating to /teacher/classes...');
  await page.goto('http://localhost:5173/teacher/classes');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const artifactDir = 'C:\\Users\\J SIDHARTHA\\.gemini\\antigravity-ide\\brain\\43b0b205-cdca-49d0-a883-90d874339291';
  await page.screenshot({ path: path.join(artifactDir, 'before_classes_page.png'), fullPage: false });
  console.log('Saved before_classes_page.png');

  // Inspect the department select
  const deptSelect = page.locator('select').first();
  if (await deptSelect.count() > 0) {
    console.log('Department select found!');
    await deptSelect.focus();
    await page.screenshot({ path: path.join(artifactDir, 'before_dept_focused.png') });
    console.log('Saved before_dept_focused.png');
  }

  await browser.close();
  console.log('Done capturing initial state.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
