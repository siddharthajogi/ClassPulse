import { chromium } from 'playwright-core';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\J SIDHARTHA\\.gemini\\antigravity-ide\\brain\\43b0b205-cdca-49d0-a883-90d874339291';
const CLASS_ID = '6acef698a6b4a43061ecd84f';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Login as Teacher
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.fill('#teacher-userId', 't001');
  await page.fill('#teacher-password', 'Teacher@123');
  await page.click('#teacher-userId >> xpath=ancestor::form//button[@type="submit"]');
  await page.waitForURL('**/teacher/**', { timeout: 10000 });

  // 1. Dark Mode Section Details
  await page.evaluate(() => {
    window.localStorage.setItem('study_point_theme', 'dark');
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  });
  await page.goto(`http://localhost:5173/teacher/classes/${CLASS_ID}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  const darkPageSizeBtn = page.locator('#teacher-section-pagesize');
  if (await darkPageSizeBtn.count() > 0) {
    await darkPageSizeBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'dark_section_pagesize_open.png')
    });
    console.log('✓ Saved dark_section_pagesize_open.png');
  }

  // 2. Light Mode Section Details
  await page.evaluate(() => {
    window.localStorage.setItem('study_point_theme', 'light');
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  const lightPageSizeBtn = page.locator('#teacher-section-pagesize');
  if (await lightPageSizeBtn.count() > 0) {
    await lightPageSizeBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'light_section_pagesize_open.png')
    });
    console.log('✓ Saved light_section_pagesize_open.png');
  }

  await browser.close();
  console.log('Section details verification complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
