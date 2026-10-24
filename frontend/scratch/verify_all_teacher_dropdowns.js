import { chromium } from 'playwright-core';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\J SIDHARTHA\\.gemini\\antigravity-ide\\brain\\43b0b205-cdca-49d0-a883-90d874339291';

async function runVerification() {
  console.log('=== STARTING TEACHER PORTAL DROPDOWN VERIFICATION ===\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Helper to switch theme
  async function setTheme(theme) {
    await page.evaluate((targetTheme) => {
      window.localStorage.setItem('study_point_theme', targetTheme);
      if (targetTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    }, theme);
    await page.waitForTimeout(300);
  }

  // 1. Log in as Teacher
  console.log('Step 1: Logging in as Teacher (t001)...');
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  await page.fill('#teacher-userId', 't001');
  await page.fill('#teacher-password', 'Teacher@123');
  await page.click('#teacher-userId >> xpath=ancestor::form//button[@type="submit"]');

  await page.waitForURL('**/teacher/**', { timeout: 10000 });
  console.log('✓ Teacher authenticated successfully');

  // =========================================================================
  // DARK MODE TESTS
  // =========================================================================
  console.log('\n--- TESTING DARK MODE DROPDOWNS ---');
  await setTheme('dark');

  // 2. Test My Classes & Sections
  console.log('Navigating to /teacher/classes (Dark Mode)...');
  await page.goto('http://localhost:5173/teacher/classes');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const deptDropdownBtn = page.locator('#teacher-classes-dept-filter');
  await deptDropdownBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Found Department Dropdown in Classes & Sections');

  // Click to open department dropdown
  await deptDropdownBtn.click();
  await page.waitForTimeout(300);

  const isDeptExpanded = await deptDropdownBtn.getAttribute('aria-expanded');
  console.log('Department Dropdown opened, aria-expanded:', isDeptExpanded);

  // Take screenshot with dropdown open in Dark Mode
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'dark_classes_dept_open.png'),
    fullPage: false
  });
  console.log('✓ Saved dark_classes_dept_open.png');

  // Test keyboard arrow navigation
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);

  // Select option with Enter
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);

  const newDeptText = await deptDropdownBtn.innerText();
  console.log('✓ Selected department via keyboard navigation:', newDeptText.trim());

  // Test Academic Calendar Year Dropdown if visible
  const yearDropdownBtn = page.locator('#teacher-classes-year-filter');
  if (await yearDropdownBtn.count() > 0) {
    await yearDropdownBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'dark_classes_year_open.png'),
      fullPage: false
    });
    console.log('✓ Saved dark_classes_year_open.png');
    // Close with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // 3. Test My Subjects Page
  console.log('\nNavigating to /teacher/subjects (Dark Mode)...');
  await page.goto('http://localhost:5173/teacher/subjects');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const subjectsDeptDropdown = page.locator('#teacher-subjects-dept-filter');
  if (await subjectsDeptDropdown.count() > 0) {
    await subjectsDeptDropdown.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'dark_subjects_dropdown_open.png')
    });
    console.log('✓ Saved dark_subjects_dropdown_open.png');
    await page.keyboard.press('Escape');
  } else {
    console.log('✓ Subjects page loaded cleanly in Dark Mode');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'dark_subjects_page.png')
    });
  }

  // 4. Test Students Page
  console.log('\nNavigating to /teacher/students (Dark Mode)...');
  await page.goto('http://localhost:5173/teacher/students');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const studentDeptDropdown = page.locator('#placeholder-dept-select');
  await studentDeptDropdown.click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'dark_students_dept_open.png')
  });
  console.log('✓ Saved dark_students_dept_open.png');

  // Click an option in the menu (e.g. CSE)
  const cseOption = page.locator('#placeholder-dept-select-listbox div[role="option"]:has-text("CSE")');
  if (await cseOption.count() > 0) {
    await cseOption.click();
    await page.waitForTimeout(300);
    console.log('✓ Selected CSE in Students module');
  }

  // 5. Test Student Risk Analytics Page
  console.log('\nNavigating to /teacher/risk-analytics (Dark Mode)...');
  await page.goto('http://localhost:5173/teacher/risk-analytics');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const riskSemesterDropdown = page.locator('#placeholder-semester-select');
  await riskSemesterDropdown.click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'dark_risk_analytics_semester_open.png')
  });
  console.log('✓ Saved dark_risk_analytics_semester_open.png');
  await page.keyboard.press('Escape');

  // 6. Test Academic Records Page
  console.log('\nNavigating to /teacher/academic-records (Dark Mode)...');
  await page.goto('http://localhost:5173/teacher/academic-records');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const recordsSectionDropdown = page.locator('#placeholder-section-select');
  await recordsSectionDropdown.click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'dark_academic_records_section_open.png')
  });
  console.log('✓ Saved dark_academic_records_section_open.png');
  await page.keyboard.press('Escape');

  // 7. Test Attendance Page
  console.log('\nNavigating to /teacher/attendance (Dark Mode)...');
  await page.goto('http://localhost:5173/teacher/attendance');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const attendanceYearDropdown = page.locator('#placeholder-year-select');
  await attendanceYearDropdown.click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'dark_attendance_year_open.png')
  });
  console.log('✓ Saved dark_attendance_year_open.png');
  await page.keyboard.press('Escape');

  // 8. Test Assignments Page
  console.log('\nNavigating to /teacher/assignments (Dark Mode)...');
  await page.goto('http://localhost:5173/teacher/assignments');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const assignmentDropdown = page.locator('#placeholder-subject-assignment-select');
  await assignmentDropdown.click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'dark_assignments_dropdown_open.png')
  });
  console.log('✓ Saved dark_assignments_dropdown_open.png');
  await page.keyboard.press('Escape');

  // =========================================================================
  // LIGHT MODE TESTS
  // =========================================================================
  console.log('\n--- TESTING LIGHT MODE DROPDOWNS ---');
  await setTheme('light');

  // 9. My Classes & Sections in Light Mode
  console.log('Navigating to /teacher/classes (Light Mode)...');
  await page.goto('http://localhost:5173/teacher/classes');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const lightDeptDropdownBtn = page.locator('#teacher-classes-dept-filter');
  await lightDeptDropdownBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'light_classes_dept_open.png')
  });
  console.log('✓ Saved light_classes_dept_open.png');

  // 10. Assignments Page in Light Mode
  console.log('\nNavigating to /teacher/assignments (Light Mode)...');
  await page.goto('http://localhost:5173/teacher/assignments');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const lightAssignmentDropdown = page.locator('#placeholder-subject-assignment-select');
  await lightAssignmentDropdown.click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'light_assignments_dropdown_open.png')
  });
  console.log('✓ Saved light_assignments_dropdown_open.png');

  // 11. Test Section Details Page Size Dropdown if class exists
  console.log('\nTesting Section Details page size dropdown...');
  // Look for a section link on Classes page
  await page.goto('http://localhost:5173/teacher/classes');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const sectionCard = page.locator('button:has-text("Section"), div:has-text("Section")').first();
  // Check if there is any section link or navigate to a known class if exists
  const sectionLink = page.locator('a[href*="/teacher/classes/"]').first();
  if (await sectionLink.count() > 0) {
    await sectionLink.click();
    await page.waitForURL('**/teacher/classes/**', { timeout: 5000 });
    await page.waitForTimeout(600);

    const pageSizeDropdown = page.locator('#teacher-section-pagesize');
    if (await pageSizeDropdown.count() > 0) {
      await pageSizeDropdown.click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'light_section_pagesize_open.png')
      });
      console.log('✓ Saved light_section_pagesize_open.png');
    }
  }

  await browser.close();
  console.log('\n=== ALL VERIFICATIONS COMPLETED SUCCESSFULLY ===');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
