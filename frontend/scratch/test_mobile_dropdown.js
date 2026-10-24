import { chromium } from 'playwright-core';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\J SIDHARTHA\\.gemini\\antigravity-ide\\brain\\43b0b205-cdca-49d0-a883-90d874339291';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });

  // Login as Teacher
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.fill('#teacher-userId', 't001');
  await page.fill('#teacher-password', 'Teacher@123');
  await page.click('#teacher-userId >> xpath=ancestor::form//button[@type="submit"]');
  await page.waitForURL('**/teacher/**', { timeout: 10000 });

  // Dark Mode Mobile
  await page.evaluate(() => {
    window.localStorage.setItem('study_point_theme', 'dark');
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  });

  await page.goto('http://localhost:5173/teacher/classes');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const deptBtn = page.locator('#teacher-classes-dept-filter');
  await deptBtn.click();
  await page.waitForTimeout(300);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile_dark_classes_dept_open.png')
  });
  console.log('✓ Saved mobile_dark_classes_dept_open.png');

  // Light Mode Mobile
  await page.evaluate(() => {
    window.localStorage.setItem('study_point_theme', 'light');
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const lightDeptBtn = page.locator('#teacher-classes-dept-filter');
  await lightDeptBtn.click();
  await page.waitForTimeout(300);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile_light_classes_dept_open.png')
  });
  console.log('✓ Saved mobile_light_classes_dept_open.png');

  await browser.close();
  console.log('Mobile verification completed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
