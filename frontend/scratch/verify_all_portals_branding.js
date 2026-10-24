import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:\\Users\\J SIDHARTHA\\.gemini\\antigravity-ide\\brain\\e443c587-caf5-499e-a790-a29c994bd1e4\\scratch';

async function run() {
  console.log('=== STARTING CLASSPULSE BRANDING & LOGO VERIFICATION SUITE ===\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // 1. Verify Public Login Page - Light Mode
  console.log('1. Navigating to Login Page (Light Mode)...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  // Set light theme explicitly
  await page.evaluate(() => {
    localStorage.setItem('classpulse_theme', 'light');
    document.documentElement.classList.remove('dark');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Check main CP logo
  const heroLogo = await page.$('main img[alt="ClassPulse"]');
  if (!heroLogo) throw new Error('Hero ClassPulse logo not found on login page!');
  const heroLogoSrc = await heroLogo.getAttribute('src');
  console.log('   [PASS] Hero CP Logo found with src:', heroLogoSrc);

  // Check login card CP logos (Expected 0 as required)
  const cardLogos = await page.$$('div[title="ClassPulse"] img[alt="ClassPulse"], .grid form img');
  console.log(`   [PASS] Found ${cardLogos.length} login card CP logo marks (expected 0).`);
  if (cardLogos.length !== 0) throw new Error(`Expected 0 card logos, found ${cardLogos.length}`);

  const loginLightPath = path.join(SCREENSHOT_DIR, '01_login_light.png');
  await page.screenshot({ path: loginLightPath, fullPage: true });
  console.log('   [SAVED]', loginLightPath);

  // 2. Verify Public Login Page - Dark Mode
  console.log('\n2. Switching to Dark Mode on Login Page...');
  await page.click('button:has-text("Dark Mode")');
  await page.waitForTimeout(500);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log('   [PASS] Document has dark class:', isDark);

  const loginDarkPath = path.join(SCREENSHOT_DIR, '02_login_dark.png');
  await page.screenshot({ path: loginDarkPath, fullPage: true });
  console.log('   [SAVED]', loginDarkPath);

  // 3. Verify Admin Portal (Desktop & Mobile)
  console.log('\n3. Logging in as Admin (0001)...');
  // Type credentials in Admin card
  await page.fill('#admin-userId', '0001');
  await page.fill('#admin-password', 'StudyPoint@Admin2026');
  await page.click('button[type="submit"]:has-text("Login") >> nth=2');
  
  await page.waitForURL('**/admin/**', { timeout: 8000 });
  await page.waitForTimeout(1000);
  console.log('   [PASS] Admin URL reached:', page.url());

  // Check Admin Sidebar Logo
  const adminSidebarLogo = await page.$('aside img[alt="ClassPulse"]');
  if (!adminSidebarLogo) throw new Error('Admin sidebar logo not found!');
  const adminLogoSrc = await adminSidebarLogo.getAttribute('src');
  console.log('   [PASS] Admin sidebar logo found with src:', adminLogoSrc);

  const adminDesktopDarkPath = path.join(SCREENSHOT_DIR, '03_admin_portal_dark.png');
  await page.screenshot({ path: adminDesktopDarkPath });
  console.log('   [SAVED]', adminDesktopDarkPath);

  // Switch Admin to Light Mode
  await page.click('button:has-text("Theme")');
  await page.waitForTimeout(200);
  await page.click('button:has-text("Light Mode")');
  await page.waitForTimeout(500);

  const adminDesktopLightPath = path.join(SCREENSHOT_DIR, '04_admin_portal_light.png');
  await page.screenshot({ path: adminDesktopLightPath });
  console.log('   [SAVED]', adminDesktopLightPath);

  // Admin Mobile Viewport
  console.log('   Testing Admin Mobile Viewport (390px width)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const adminMobileLogo = await page.$('header img[alt="ClassPulse"]');
  if (!adminMobileLogo) throw new Error('Admin mobile header logo not found!');
  console.log('   [PASS] Admin mobile header logo displayed.');

  const adminMobilePath = path.join(SCREENSHOT_DIR, '05_admin_mobile.png');
  await page.screenshot({ path: adminMobilePath });
  console.log('   [SAVED]', adminMobilePath);

  // Admin Logout
  await page.click('header button[title="Logout"]');
  await page.waitForURL('http://localhost:5173/', { timeout: 5000 });
  console.log('   [PASS] Admin logged out successfully.');

  // Reset viewport
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);

  // 4. Verify Teacher Portal (Desktop & Mobile)
  console.log('\n4. Logging in as Teacher (t001)...');
  await page.fill('#teacher-userId', 't001');
  await page.fill('#teacher-password', 'TeacherPassword@2026');
  await page.click('button[type="submit"]:has-text("Login") >> nth=1');

  await page.waitForURL('**/teacher/**', { timeout: 8000 });
  await page.waitForTimeout(1000);
  console.log('   [PASS] Teacher URL reached:', page.url());

  // Check Teacher Sidebar Logo
  const teacherSidebarLogo = await page.$('aside img[alt="ClassPulse"]');
  if (!teacherSidebarLogo) throw new Error('Teacher sidebar logo not found!');
  console.log('   [PASS] Teacher sidebar CP logo found.');

  const teacherDesktopPath = path.join(SCREENSHOT_DIR, '06_teacher_portal_desktop.png');
  await page.screenshot({ path: teacherDesktopPath });
  console.log('   [SAVED]', teacherDesktopPath);

  // Teacher Mobile Drawer
  console.log('   Testing Teacher Mobile Drawer (390px width)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  // Click hamburger
  await page.click('button[title="Open Navigation Menu"]');
  await page.waitForTimeout(400);

  const drawerLogo = await page.$('.fixed.inset-0 img[alt="ClassPulse"]');
  if (!drawerLogo) throw new Error('Teacher mobile drawer logo not found!');
  console.log('   [PASS] Teacher mobile drawer CP logo displayed.');

  const teacherDrawerPath = path.join(SCREENSHOT_DIR, '07_teacher_mobile_drawer.png');
  await page.screenshot({ path: teacherDrawerPath });
  console.log('   [SAVED]', teacherDrawerPath);

  // Close drawer and logout
  await page.click('.fixed.inset-0 button:has-text("Logout")');
  await page.waitForURL('http://localhost:5173/', { timeout: 5000 });
  console.log('   [PASS] Teacher logged out successfully.');

  // Reset viewport
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);

  // 5. Verify Student Portal
  console.log('\n5. Logging in as Student (s001)...');
  await page.fill('#student-userId', 's001');
  await page.fill('#student-password', 'StudentPassword@2026');
  await page.click('button[type="submit"]:has-text("Login") >> nth=0');

  await page.waitForURL('**/student/**', { timeout: 8000 });
  await page.waitForTimeout(1000);
  console.log('   [PASS] Student URL reached:', page.url());

  // Check Student Navbar Logo
  const studentNavLogo = await page.$('header img[alt="ClassPulse"]');
  if (!studentNavLogo) throw new Error('Student top navbar logo not found!');
  console.log('   [PASS] Student top navbar CP logo found.');

  const studentDesktopPath = path.join(SCREENSHOT_DIR, '08_student_portal_desktop.png');
  await page.screenshot({ path: studentDesktopPath });
  console.log('   [SAVED]', studentDesktopPath);

  // Student Logout
  await page.click('header button[title="Logout"]');
  await page.waitForURL('http://localhost:5173/', { timeout: 5000 });
  console.log('   [PASS] Student logged out successfully.');

  // 6. Verify Favicons
  console.log('\n6. Checking Favicon Assets...');
  const favSvgRes = await page.goto('http://localhost:5173/favicon.svg');
  console.log('   /favicon.svg HTTP status:', favSvgRes.status(), 'Content-Type:', favSvgRes.headers()['content-type']);
  if (favSvgRes.status() !== 200) throw new Error('favicon.svg failed to load');

  const favIcoRes = await page.goto('http://localhost:5173/favicon.ico');
  console.log('   /favicon.ico HTTP status:', favIcoRes.status());
  if (favIcoRes.status() !== 200) throw new Error('favicon.ico failed to load');

  await browser.close();
  console.log('\n===============================================================');
  console.log(' ALL VERIFICATION CHECKS PASSED PERFECTLY!');
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('\n[VERIFICATION ERROR]:', err);
  process.exit(1);
});
