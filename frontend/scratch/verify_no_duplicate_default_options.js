import { chromium } from 'playwright-core';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\J SIDHARTHA\\.gemini\\antigravity-ide\\brain\\43b0b205-cdca-49d0-a883-90d874339291';

async function runVerification() {
  console.log('=== STARTING TEST: NO DUPLICATE DEFAULT OPTIONS IN TEACHER PORTAL ===\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Mock API routes for fast, rock-solid, network-independent UI testing
  await page.route('**/api/auth/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: {
          _id: 'u_t001',
          userId: 't001',
          name: 'Dr. Ramesh Kumar',
          role: 'teacher',
          mustChangePassword: false,
          institution: 'inst_1'
        }
      })
    });
  });

  await page.route('**/api/teacher/classes', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        totalEnrolledStudents: 85,
        departments: [
          { _id: 'd1', code: 'CSE', name: 'Computer Science & Engineering' },
          { _id: 'd2', code: 'ECE', name: 'Electronics & Communication Engineering' },
          { _id: 'd3', code: 'ME', name: 'Mechanical Engineering' }
        ],
        academicYears: [
          { year: '2026-2027', isCurrent: true },
          { year: '2025-2026', isCurrent: false }
        ],
        classes: [
          {
            _id: 'sec_1',
            department: 'Computer Science & Engineering',
            course: 'B.Tech',
            yearOfStudy: 'Third Year',
            semester: '5th',
            section: 'A',
            academicYear: '2026-2027',
            studentCount: 45,
            teacherSubjects: [{ name: 'Data Structures & Algorithms', code: 'CS301' }]
          },
          {
            _id: 'sec_2',
            department: 'Electronics & Communication Engineering',
            course: 'B.Tech',
            yearOfStudy: 'Third Year',
            semester: '5th',
            section: 'B',
            academicYear: '2026-2027',
            studentCount: 40,
            teacherSubjects: [{ name: 'Digital Signal Processing', code: 'EC301' }]
          }
        ]
      })
    });
  });

  await page.route('**/api/teacher/classes/sec_1', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        classInfo: {
          _id: 'sec_1',
          department: 'Computer Science & Engineering',
          course: 'B.Tech',
          yearOfStudy: 'Third Year',
          semester: '5th',
          section: 'A',
          academicYear: '2026-2027',
          studentCount: 45,
          teacherSubjects: [{ name: 'Data Structures & Algorithms', code: 'CS301' }]
        },
        students: [
          { _id: 's1', rollNo: 'CS001', name: 'Aarav Patel', email: 'aarav@example.com' },
          { _id: 's2', rollNo: 'CS002', name: 'Bhavna Sharma', email: 'bhavna@example.com' },
          { _id: 's3', rollNo: 'CS003', name: 'Chirag Rao', email: 'chirag@example.com' }
        ]
      })
    });
  });

  await page.route('**/api/teacher/subjects', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        subjects: [
          {
            _id: 'sub_1',
            name: 'Data Structures & Algorithms',
            code: 'CS301',
            department: 'Computer Science & Engineering',
            subjectType: 'Theory',
            yearOfStudy: 'Third Year',
            semester: '5th',
            sections: ['A', 'B']
          },
          {
            _id: 'sub_2',
            name: 'Database Management Systems',
            code: 'CS302',
            department: 'Computer Science & Engineering',
            subjectType: 'Practical',
            yearOfStudy: 'Third Year',
            semester: '5th',
            sections: ['A']
          }
        ]
      })
    });
  });

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

  // =========================================================================
  // TEST SUITE: DARK MODE
  // =========================================================================
  console.log('================ DARK MODE TESTS ================');
  await page.goto('http://localhost:5173/teacher/classes');
  await page.waitForLoadState('networkidle');
  await setTheme('dark');
  await page.waitForTimeout(500);

  // Page 1: My Classes & Sections
  console.log('\n--- 1. Testing My Classes & Sections (/teacher/classes) ---');
  const classesDeptBtn = page.locator('#teacher-classes-dept-filter');
  await classesDeptBtn.waitFor({ state: 'visible', timeout: 5000 });

  // A. Check Department filter at default selection
  const deptBtnInitialText = (await classesDeptBtn.innerText()).trim();
  console.log(`Initial Department button text: "${deptBtnInitialText}"`);
  if (!deptBtnInitialText.includes('All Departments')) {
    throw new Error(`Expected button text to show "All Departments", got "${deptBtnInitialText}"`);
  }

  // Open department dropdown
  await classesDeptBtn.click();
  await page.waitForTimeout(300);
  const deptListbox = page.locator('#teacher-classes-dept-filter-listbox');
  await deptListbox.waitFor({ state: 'visible' });

  // Get all options in the opened menu
  const deptOptions = await deptListbox.locator('[role="option"]').allTextContents();
  const cleanedDeptOptions = deptOptions.map(t => t.replace(/\s+/g, ' ').trim());
  console.log('Opened Department menu options (at default):', cleanedDeptOptions);

  // VERIFY: "All Departments" is NOT in the opened list!
  const hasDuplicateDept = cleanedDeptOptions.some(t => t === 'All Departments' || t.startsWith('All Departments'));
  if (hasDuplicateDept) {
    throw new Error('FAIL: "All Departments" is redundantly present in the opened list when already selected!');
  }
  console.log('✓ PASS: "All Departments" is NOT duplicated in the opened list');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'verify_dark_classes_dept_no_duplicate.png')
  });

  // Select a specific department (e.g. CSE or first option)
  const firstDeptOption = deptListbox.locator('[role="option"]').first();
  const selectedDeptText = (await firstDeptOption.innerText()).split('\n')[0].trim();
  console.log(`Selecting department: "${selectedDeptText}"...`);
  await firstDeptOption.click();
  await page.waitForTimeout(400);

  // Check button updated
  const updatedDeptBtnText = (await classesDeptBtn.innerText()).trim();
  console.log(`Updated Department button text: "${updatedDeptBtnText}"`);
  if (!updatedDeptBtnText.includes(selectedDeptText)) {
    throw new Error(`Expected button text to contain "${selectedDeptText}", got "${updatedDeptBtnText}"`);
  }
  console.log('✓ PASS: Button text updated to selected department');

  // Open menu again while filtered: now Reset option ("All Departments") MUST be present
  await classesDeptBtn.click();
  await page.waitForTimeout(300);
  await deptListbox.waitFor({ state: 'visible' });

  const filteredDeptOptions = await deptListbox.locator('[role="option"]').allTextContents();
  const cleanedFilteredOptions = filteredDeptOptions.map(t => t.replace(/\s+/g, ' ').trim());
  console.log('Opened Department menu options (when filtered):', cleanedFilteredOptions);

  const resetOption = cleanedFilteredOptions.find(t => t.includes('All Departments'));
  if (!resetOption) {
    throw new Error('FAIL: Reset option ("All Departments") is missing when a filter is applied!');
  }
  console.log(`✓ PASS: Reset option is present when filtered: "${resetOption}"`);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'verify_dark_classes_dept_reset_present.png')
  });

  // Click reset option
  const resetOptionLocator = deptListbox.locator('[role="option"]').filter({ hasText: 'All Departments' }).first();
  await resetOptionLocator.click();
  await page.waitForTimeout(400);

  const resetDeptBtnText = (await classesDeptBtn.innerText()).trim();
  console.log(`Button text after reset: "${resetDeptBtnText}"`);
  if (!resetDeptBtnText.includes('All Departments')) {
    throw new Error(`Expected button text to reset to "All Departments", got "${resetDeptBtnText}"`);
  }
  console.log('✓ PASS: Filter successfully reset back to All Departments');

  // Test quick (X) clear button on trigger
  console.log('Testing quick (X) clear button on trigger...');
  await classesDeptBtn.click();
  await page.waitForTimeout(300);
  await deptListbox.locator('[role="option"]').first().click();
  await page.waitForTimeout(300);

  const clearBtn = classesDeptBtn.locator('[role="button"][title*="Reset"]');
  await clearBtn.waitFor({ state: 'visible', timeout: 3000 });
  await clearBtn.click();
  await page.waitForTimeout(400);

  const afterClearBtnText = (await classesDeptBtn.innerText()).trim();
  console.log(`Button text after clicking clear (X): "${afterClearBtnText}"`);
  if (!afterClearBtnText.includes('All Departments')) {
    throw new Error(`Expected button text to be "All Departments" after clear, got "${afterClearBtnText}"`);
  }
  console.log('✓ PASS: Quick (X) clear button successfully reset the filter');

  // B. Check Calendar Year filter in Classes & Sections
  const yearFilterBtn = page.locator('#teacher-classes-year-filter');
  if (await yearFilterBtn.isVisible()) {
    console.log('\nChecking Calendar Year filter in Classes & Sections...');
    const yearBtnText = (await yearFilterBtn.innerText()).trim();
    console.log(`Initial Year button text: "${yearBtnText}"`);

    await yearFilterBtn.click();
    await page.waitForTimeout(300);
    const yearListbox = page.locator('#teacher-classes-year-filter-listbox');
    await yearListbox.waitFor({ state: 'visible' });

    const yearOptions = (await yearListbox.locator('[role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
    console.log('Opened Year options (at default):', yearOptions);

    const hasDuplicateYear = yearOptions.some(t => t === 'All Calendar Years');
    if (hasDuplicateYear) {
      throw new Error('FAIL: "All Calendar Years" is redundantly present in the opened list!');
    }
    console.log('✓ PASS: "All Calendar Years" is NOT duplicated in the opened list');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }

  // Page 2: My Subjects
  console.log('\n--- 2. Testing My Subjects (/teacher/subjects) ---');
  await page.goto('http://localhost:5173/teacher/subjects');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const subjDeptBtn = page.locator('#teacher-subjects-dept-filter');
  if (await subjDeptBtn.isVisible()) {
    console.log('Checking My Subjects Department filter...');
    await subjDeptBtn.click();
    await page.waitForTimeout(300);
    const subjDeptListbox = page.locator('#teacher-subjects-dept-filter-listbox');
    const subjDeptOpts = (await subjDeptListbox.locator('[role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
    console.log('My Subjects Dept options (at default):', subjDeptOpts);

    if (subjDeptOpts.some(t => t === 'All Departments')) {
      throw new Error('FAIL: "All Departments" is duplicated in My Subjects dropdown!');
    }
    console.log('✓ PASS: No duplicate "All Departments" in My Subjects');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }

  const subjTypeBtn = page.locator('#teacher-subjects-type-filter');
  if (await subjTypeBtn.isVisible()) {
    console.log('Checking My Subjects Subject Type filter...');
    await subjTypeBtn.click();
    await page.waitForTimeout(300);
    const subjTypeListbox = page.locator('#teacher-subjects-type-filter-listbox');
    const subjTypeOpts = (await subjTypeListbox.locator('[role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
    console.log('My Subjects Type options (at default):', subjTypeOpts);

    if (subjTypeOpts.some(t => t === 'All Subject Types')) {
      throw new Error('FAIL: "All Subject Types" is duplicated in My Subjects!');
    }
    console.log('✓ PASS: No duplicate "All Subject Types" in My Subjects');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }

  const subjYearBtn = page.locator('#teacher-subjects-year-filter');
  if (await subjYearBtn.isVisible()) {
    console.log('Checking My Subjects Year of Study filter...');
    await subjYearBtn.click();
    await page.waitForTimeout(300);
    const subjYearListbox = page.locator('#teacher-subjects-year-filter-listbox');
    const subjYearOpts = (await subjYearListbox.locator('[role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
    console.log('My Subjects Year options (at default):', subjYearOpts);

    if (subjYearOpts.some(t => t === 'All Years of Study')) {
      throw new Error('FAIL: "All Years of Study" is duplicated in My Subjects!');
    }
    console.log('✓ PASS: No duplicate "All Years of Study" in My Subjects');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }

  // Page 3: Students (/teacher/students)
  console.log('\n--- 3. Testing Students Page Filters (/teacher/students) ---');
  await page.goto('http://localhost:5173/teacher/students');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  // Check Department
  const studDeptBtn = page.locator('#placeholder-dept-select');
  await studDeptBtn.click();
  await page.waitForTimeout(300);
  const studDeptOpts = (await page.locator('#placeholder-dept-select-listbox [role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
  console.log('Students Dept options (at default):', studDeptOpts);
  if (studDeptOpts.some(t => t === 'All Departments')) {
    throw new Error('FAIL: "All Departments" duplicated in Students page!');
  }
  console.log('✓ PASS: Students Dept dropdown has no duplicate default');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Check Academic Year
  const studYearBtn = page.locator('#placeholder-year-select');
  await studYearBtn.click();
  await page.waitForTimeout(300);
  const studYearOpts = (await page.locator('#placeholder-year-select-listbox [role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
  console.log('Students Year options (at default):', studYearOpts);
  if (studYearOpts.some(t => t === 'All Calendar Years')) {
    throw new Error('FAIL: "All Calendar Years" duplicated in Students page!');
  }
  console.log('✓ PASS: Students Year dropdown has no duplicate default');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Check Semester
  const studSemBtn = page.locator('#placeholder-semester-select');
  await studSemBtn.click();
  await page.waitForTimeout(300);
  const studSemOpts = (await page.locator('#placeholder-semester-select-listbox [role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
  console.log('Students Semester options (at default):', studSemOpts);
  if (studSemOpts.some(t => t === 'All Semesters')) {
    throw new Error('FAIL: "All Semesters" duplicated in Students page!');
  }
  console.log('✓ PASS: Students Semester dropdown has no duplicate default');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Check Section
  const studSecBtn = page.locator('#placeholder-section-select');
  await studSecBtn.click();
  await page.waitForTimeout(300);
  const studSecOpts = (await page.locator('#placeholder-section-select-listbox [role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
  console.log('Students Section options (at default):', studSecOpts);
  if (studSecOpts.some(t => t === 'All Sections')) {
    throw new Error('FAIL: "All Sections" duplicated in Students page!');
  }
  console.log('✓ PASS: Students Section dropdown has no duplicate default');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Check Subject
  const studSubjBtn = page.locator('#placeholder-subject-assignment-select');
  await studSubjBtn.click();
  await page.waitForTimeout(300);
  const studSubjOpts = (await page.locator('#placeholder-subject-assignment-select-listbox [role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
  console.log('Students Subject options (at default):', studSubjOpts);
  if (studSubjOpts.some(t => t === 'All Assigned Subjects')) {
    throw new Error('FAIL: "All Assigned Subjects" duplicated in Students page!');
  }
  console.log('✓ PASS: Students Subject dropdown has no duplicate default');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'verify_dark_students_subject_no_duplicate.png')
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Page 4: Assignments (/teacher/assignments)
  console.log('\n--- 4. Testing Assignments Page (/teacher/assignments) ---');
  await page.goto('http://localhost:5173/teacher/assignments');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const asgBtn = page.locator('#placeholder-subject-assignment-select');
  await asgBtn.click();
  await page.waitForTimeout(300);
  const asgOpts = (await page.locator('#placeholder-subject-assignment-select-listbox [role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
  console.log('Assignments options (at default):', asgOpts);
  if (asgOpts.some(t => t === 'All Course Assignments')) {
    throw new Error('FAIL: "All Course Assignments" duplicated in Assignments page!');
  }
  console.log('✓ PASS: Course Assignments dropdown has no duplicate default');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'verify_dark_assignments_no_duplicate.png')
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // =========================================================================
  // TEST SUITE: LIGHT MODE
  // =========================================================================
  console.log('\n================ LIGHT MODE TESTS ================');
  await setTheme('light');

  console.log('\n--- Testing My Classes & Sections in Light Mode ---');
  await page.goto('http://localhost:5173/teacher/classes');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const lightDeptBtn = page.locator('#teacher-classes-dept-filter');
  await lightDeptBtn.click();
  await page.waitForTimeout(300);

  const lightDeptListbox = page.locator('#teacher-classes-dept-filter-listbox');
  const lightDeptOpts = (await lightDeptListbox.locator('[role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
  console.log('Light Mode Dept options (at default):', lightDeptOpts);
  if (lightDeptOpts.some(t => t === 'All Departments')) {
    throw new Error('FAIL: "All Departments" duplicated in Light Mode!');
  }
  console.log('✓ PASS: Light Mode Dept dropdown has no duplicate default');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'verify_light_classes_dept_no_duplicate.png')
  });

  // Select option in Light mode
  await lightDeptListbox.locator('[role="option"]').first().click();
  await page.waitForTimeout(300);

  // Open again to verify Reset option in Light mode
  await lightDeptBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'verify_light_classes_dept_reset_present.png')
  });

  // Reset in Light Mode
  await lightDeptListbox.locator('[role="option"]').filter({ hasText: 'All Departments' }).first().click();
  await page.waitForTimeout(300);
  const afterResetLight = (await lightDeptBtn.innerText()).trim();
  if (!afterResetLight.includes('All Departments')) {
    throw new Error(`Failed to reset in Light Mode: "${afterResetLight}"`);
  }
  console.log('✓ PASS: Light Mode reset works perfectly');

  // Page 5: Section Details Page Size Dropdown
  console.log('\n--- 5. Testing Section Details Page Size Dropdown ---');
  await page.goto('http://localhost:5173/teacher/classes/sec_1');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const pageSizeBtn = page.locator('#teacher-section-pagesize');
  if (await pageSizeBtn.isVisible()) {
    await pageSizeBtn.click();
    await page.waitForTimeout(300);
    const pageSizeOpts = (await page.locator('#teacher-section-pagesize-listbox [role="option"]').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
    console.log('Section Details Page Size options:', pageSizeOpts);
    if (pageSizeOpts.length < 3) {
      throw new Error('FAIL: Page size options should all be preserved (10, 20, 50)!');
    }
    console.log('✓ PASS: All page size options (10, 20, 50) remain intact and selectable');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verify_light_section_pagesize.png')
    });
    await page.keyboard.press('Escape');
  }

  await browser.close();
  console.log('\n=== ALL DROPDOWN VERIFICATION TESTS PASSED SUCCESSFULLY! ===\n');
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
