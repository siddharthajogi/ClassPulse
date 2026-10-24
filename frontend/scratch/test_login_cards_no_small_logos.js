import { chromium } from 'playwright-core';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/J SIDHARTHA/.gemini/antigravity-ide/brain/e443c587-caf5-499e-a790-a29c994bd1e4/scratch';

async function verify() {
  console.log('=== VERIFYING REMOVAL OF SMALL LOGOS FROM LOGIN CARDS ===\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // 1. Light Mode Verification
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('classpulse_theme', 'light');
    document.documentElement.classList.remove('dark');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // Check main ClassPulse logo
  const heroLogos = await page.$$('main > div:first-child img[alt="ClassPulse"]');
  console.log(`[CHECK] Main ClassPulse hero logo count: ${heroLogos.length} (Expected: 1)`);
  if (heroLogos.length !== 1) throw new Error(`Expected 1 main hero logo, got ${heroLogos.length}`);

  // Check total logos inside login card headers
  const cardLogos = await page.$$('.grid form img, .grid div[title="ClassPulse"] img');
  console.log(`[CHECK] Logos inside login cards: ${cardLogos.length} (Expected: 0)`);
  if (cardLogos.length !== 0) throw new Error(`Expected 0 logos inside cards, got ${cardLogos.length}`);

  // Check all three cards exist with role headings and submit buttons
  const studentCard = await page.$('h2:has-text("Student")');
  const teacherCard = await page.$('h2:has-text("Teacher")');
  const adminCard = await page.$('h2:has-text("Admin")');
  if (!studentCard || !teacherCard || !adminCard) {
    throw new Error('One or more login cards missing!');
  }
  console.log('[PASS] All three cards (Student, Teacher, Admin) present and intact.');

  const lightPath = path.join(SCREENSHOT_DIR, '09_login_cards_clean_light.png');
  await page.screenshot({ path: lightPath, fullPage: true });
  console.log('[SAVED]', lightPath);

  // 2. Dark Mode Verification
  await page.click('button:has-text("Dark Mode")');
  await page.waitForTimeout(400);
  const darkPath = path.join(SCREENSHOT_DIR, '10_login_cards_clean_dark.png');
  await page.screenshot({ path: darkPath, fullPage: true });
  console.log('[SAVED]', darkPath);

  // 3. Mobile Viewport Verification
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const mobilePath = path.join(SCREENSHOT_DIR, '11_login_cards_clean_mobile.png');
  await page.screenshot({ path: mobilePath, fullPage: true });
  console.log('[SAVED]', mobilePath);

  await browser.close();
  console.log('\n===============================================================');
  console.log(' ALL LOGIN CARD LOGO REMOVAL CHECKS PASSED SUCCESSFULLY!');
  console.log('===============================================================');
}

verify().catch((err) => {
  console.error('[FAILED]:', err);
  process.exit(1);
});
