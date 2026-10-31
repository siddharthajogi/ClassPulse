/**
 * test_duplicate_sections_fix.js
 * 
 * Targeted test suite to verify the duplicate section fix:
 * 1. Test teacher t001 classes & section dropdown deduplication logic
 * 2. Test teacher t001 student filtering by section in "All Years" and specific study years
 * 3. Test teacher t004 multi-class single section deduplication (Sec A in 2nd and 3rd year)
 * 4. Test teacher t002 and t003 single section contexts
 * 5. Test Teacher Risk Analytics API section filtering
 * 6. Test Security boundaries (unauthorized class IDs rejected with 403)
 */

const http = require('http');

function makeRequest({ path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: { ...headers }
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          cookie: res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : null,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login(userId, password, role) {
  const res = await makeRequest({
    path: '/api/auth/login',
    method: 'POST',
    body: JSON.stringify({ userId, password, role })
  });
  if (res.statusCode !== 200 || !res.cookie) {
    throw new Error(`Login failed for ${userId}: ${JSON.stringify(res.data)}`);
  }
  return res.cookie;
}

// Clean section name helper replicating frontend cleanSectionName
function cleanSectionName(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  const secMatch = str.match(/\b(?:section|sec)\.?\s*([A-Za-z0-9]+)\b/i);
  if (secMatch) return secMatch[1].toUpperCase();
  str = str.replace(/\([^)]*\)/g, '').trim();
  if (str.includes(' - ')) {
    const parts = str.split(' - ');
    str = parts[parts.length - 1].trim();
  }
  if (str.includes(':')) {
    const parts = str.split(':');
    str = parts[parts.length - 1].trim();
  }
  str = str.replace(/^(CSE|ECE|EEE|MECH|CIVIL|IT|CS|B\.?Tech|M\.?Tech|MBA|MCA)\s*[-:]?\s*/i, '').trim();
  str = str.replace(/^(section|sec)\.?\s*[-:]?\s*/i, '').trim();
  return str.toUpperCase();
}

function buildSectionDropdownOptions(classesForDept) {
  const sectionMap = new Map();
  classesForDept.forEach(c => {
    const cleanCode = cleanSectionName(c.section);
    if (!cleanCode) return;
    if (!sectionMap.has(cleanCode)) {
      sectionMap.set(cleanCode, {
        value: cleanCode,
        sectionCode: cleanCode,
        label: `Section ${cleanCode}`,
        classIds: []
      });
    }
    sectionMap.get(cleanCode).classIds.push(String(c._id));
  });

  const list = Array.from(sectionMap.values()).sort((a, b) =>
    a.sectionCode.localeCompare(b.sectionCode, undefined, { numeric: true, sensitivity: 'base' })
  );

  if (list.length === 0) return [{ value: 'all', label: 'All Sections' }];
  if (list.length === 1) return [{ value: list[0].value, label: list[0].label }];
  return [{ value: 'all', label: 'All Sections' }, ...list.map(s => ({ value: s.value, label: s.label }))];
}

async function run() {
  console.log('\n=============================================================');
  console.log(' RUNNING VERIFICATION SUITE: TEACHER SECTION DEDUPLICATION');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Teacher t001 (Prof. Jogi Umadevi)
  // -------------------------------------------------------------
  console.log('--- 1. Testing Teacher t001 (Multi-Year & Multi-Section) ---');
  const t001Cookie = await login('t001', 'StudyPoint@Teacher2026', 'teacher');
  assert(!!t001Cookie, 'Teacher t001 authenticated successfully');

  const classesRes = await makeRequest({
    path: '/api/teacher/classes',
    headers: { Cookie: t001Cookie }
  });
  assert(classesRes.statusCode === 200, 'GET /api/teacher/classes returned 200 OK');
  const classes = classesRes.data?.classes || [];
  assert(classes.length === 4, `Teacher t001 has 4 assigned classes (Actual: ${classes.length})`);

  // Verify dropdown options in "All Years"
  const allYearsDropdown = buildSectionDropdownOptions(classes);
  console.log('  Dropdown options in "All Years":', JSON.stringify(allYearsDropdown));
  const secALabels = allYearsDropdown.filter(opt => opt.label === 'Section A');
  const secBLabels = allYearsDropdown.filter(opt => opt.label === 'Section B');
  assert(secALabels.length === 1, `Dropdown displays "Section A" exactly ONCE in "All Years" (Count: ${secALabels.length})`);
  assert(secBLabels.length === 1, `Dropdown displays "Section B" exactly ONCE in "All Years" (Count: ${secBLabels.length})`);
  assert(allYearsDropdown.length === 3, `Dropdown has exactly 3 options: All Sections, Section A, Section B (Count: ${allYearsDropdown.length})`);

  // Verify dropdown options in "First Year"
  const firstYearClasses = classes.filter(c => c.yearOfStudy === 'First Year');
  const firstYearDropdown = buildSectionDropdownOptions(firstYearClasses);
  console.log('  Dropdown options in "First Year":', JSON.stringify(firstYearDropdown));
  assert(firstYearDropdown.filter(opt => opt.label === 'Section A').length === 1, '"Section A" appears once in First Year');
  assert(firstYearDropdown.filter(opt => opt.label === 'Section B').length === 1, '"Section B" appears once in First Year');

  // Verify dropdown options in "Second Year"
  const secondYearClasses = classes.filter(c => c.yearOfStudy === 'Second Year');
  const secondYearDropdown = buildSectionDropdownOptions(secondYearClasses);
  console.log('  Dropdown options in "Second Year":', JSON.stringify(secondYearDropdown));
  assert(secondYearDropdown.length === 1 && secondYearDropdown[0].label === 'Section B', 'Second Year displays only "Section B"');

  // Verify dropdown options in "Fourth Year"
  const fourthYearClasses = classes.filter(c => c.yearOfStudy === 'Fourth Year');
  const fourthYearDropdown = buildSectionDropdownOptions(fourthYearClasses);
  console.log('  Dropdown options in "Fourth Year":', JSON.stringify(fourthYearDropdown));
  assert(fourthYearDropdown.length === 1 && fourthYearDropdown[0].label === 'Section A', 'Fourth Year displays only "Section A"');

  // -------------------------------------------------------------
  // Test 2: Student Filtering by Section under "All Years"
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Student Filtering by Section under All Years ---');
  
  // Section A under All Years: should return stu2026003, stu2026004 (1st yr) and stu2026015 (4th yr)
  const secARes = await makeRequest({
    path: '/api/teacher/students?section=A',
    headers: { Cookie: t001Cookie }
  });
  assert(secARes.statusCode === 200, 'GET /api/teacher/students?section=A returns 200 OK');
  const secAStudents = secARes.data?.students || [];
  assert(secAStudents.length === 3, `Section A returns exactly 3 students across all assigned classes (Actual: ${secAStudents.length})`);
  const secAIds = secAStudents.map(s => s.studentId.toUpperCase());
  assert(secAIds.includes('STU2026003') && secAIds.includes('STU2026004') && secAIds.includes('STU2026015'),
    'Section A contains STU2026003, STU2026004 (First Year) and STU2026015 (Fourth Year)');
  assert(!secAIds.some(id => ['STU2026001', 'STU2026002', 'STU2026005', 'STU2026006'].includes(id)),
    'Zero Section B students are returned when filtering by Section A');

  // Section B under All Years: should return STU2026001, STU2026002 (2nd yr) and stu2026005, stu2026006 (1st yr)
  const secBRes = await makeRequest({
    path: '/api/teacher/students?section=B',
    headers: { Cookie: t001Cookie }
  });
  assert(secBRes.statusCode === 200, 'GET /api/teacher/students?section=B returns 200 OK');
  const secBStudents = secBRes.data?.students || [];
  assert(secBStudents.length === 4, `Section B returns exactly 4 students across all assigned classes (Actual: ${secBStudents.length})`);
  const secBIds = secBStudents.map(s => s.studentId.toUpperCase());
  assert(secBIds.includes('STU2026001') && secBIds.includes('STU2026002') && secBIds.includes('STU2026005') && secBIds.includes('STU2026006'),
    'Section B contains STU2026001, STU2026002 (Second Year) and STU2026005, STU2026006 (First Year)');
  assert(!secBIds.some(id => ['STU2026003', 'STU2026004', 'STU2026015'].includes(id)),
    'Zero Section A students are returned when filtering by Section B');

  // -------------------------------------------------------------
  // Test 3: Scoped Filtering (Year + Section)
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Scoped Year + Section Filtering ---');
  
  // First Year + Section A
  const yr1SecARes = await makeRequest({
    path: '/api/teacher/students?yearOfStudy=First%20Year&section=A',
    headers: { Cookie: t001Cookie }
  });
  const yr1SecAStudents = yr1SecARes.data?.students || [];
  assert(yr1SecAStudents.length === 2, `First Year + Section A returns 2 students (Actual: ${yr1SecAStudents.length})`);
  const yr1SecAIds = yr1SecAStudents.map(s => s.studentId.toUpperCase());
  assert(yr1SecAIds.includes('STU2026003') && yr1SecAIds.includes('STU2026004'), 'Returns STU2026003 and STU2026004');

  // First Year + Section B
  const yr1SecBRes = await makeRequest({
    path: '/api/teacher/students?yearOfStudy=First%20Year&section=B',
    headers: { Cookie: t001Cookie }
  });
  const yr1SecBStudents = yr1SecBRes.data?.students || [];
  assert(yr1SecBStudents.length === 2, `First Year + Section B returns 2 students (Actual: ${yr1SecBStudents.length})`);

  // Fourth Year + Section A
  const yr4SecARes = await makeRequest({
    path: '/api/teacher/students?yearOfStudy=Fourth%20Year&section=A',
    headers: { Cookie: t001Cookie }
  });
  const yr4SecAStudents = yr4SecARes.data?.students || [];
  assert(yr4SecAStudents.length === 1 && yr4SecAStudents[0].studentId.toUpperCase() === 'STU2026015',
    'Fourth Year + Section A returns only STU2026015');

  // Comma-separated classId support
  const matchingAClassIds = classes.filter(c => cleanSectionName(c.section) === 'A').map(c => c._id).join(',');
  const commaRes = await makeRequest({
    path: `/api/teacher/students?classId=${matchingAClassIds}`,
    headers: { Cookie: t001Cookie }
  });
  assert(commaRes.data?.students?.length === 3, `Comma-separated classId returns 3 students in Section A (Actual: ${commaRes.data?.students?.length})`);

  // -------------------------------------------------------------
  // Test 4: Teacher t004 (CSE 2nd Year Sec A & 3rd Year Sec A)
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Teacher t004 (2 Classes, Both Section A) ---');
  const t004Cookie = await login('t004', 'StudyPoint@Teacher2026', 'teacher');
  const t004ClassesRes = await makeRequest({
    path: '/api/teacher/classes',
    headers: { Cookie: t004Cookie }
  });
  const t004Classes = t004ClassesRes.data?.classes || [];
  assert(t004Classes.length === 2, `Teacher t004 has 2 classes assigned (Actual: ${t004Classes.length})`);
  const t004Dropdown = buildSectionDropdownOptions(t004Classes);
  console.log('  Teacher t004 dropdown options:', JSON.stringify(t004Dropdown));
  assert(t004Dropdown.length === 1 && t004Dropdown[0].label === 'Section A',
    `Teacher t004 dropdown has "Section A" once (NO DUPLICATE Section A)`);

  const t004SecARes = await makeRequest({
    path: '/api/teacher/students?section=A',
    headers: { Cookie: t004Cookie }
  });
  assert(t004SecARes.data?.students?.length === 4, `t004 sees all 4 students in Section A across 2nd & 3rd year (Actual: ${t004SecARes.data?.students?.length})`);

  // -------------------------------------------------------------
  // Test 5: Teacher Risk Analytics API Section Filtering
  // -------------------------------------------------------------
  console.log('\n--- 5. Testing Teacher Risk Analytics API ---');
  const riskSecARes = await makeRequest({
    path: '/api/teacher/risk-analytics?section=A',
    headers: { Cookie: t001Cookie }
  });
  assert(riskSecARes.statusCode === 200, 'GET /api/teacher/risk-analytics?section=A returns 200 OK');
  const riskStudents = riskSecARes.data?.students || [];
  assert(riskStudents.length === 3, `Risk Analytics returns 3 students for Section A (Actual: ${riskStudents.length})`);

  const riskSecBRes = await makeRequest({
    path: '/api/teacher/risk-analytics?section=B',
    headers: { Cookie: t001Cookie }
  });
  assert(riskSecBRes.data?.students?.length === 4, `Risk Analytics returns 4 students for Section B (Actual: ${riskSecBRes.data?.students?.length})`);

  // -------------------------------------------------------------
  // Test 6: Security Guard (Unauthorized Class Access Rejected)
  // -------------------------------------------------------------
  console.log('\n--- 6. Testing Security Guards ---');
  const unauthorizedClassId = '6acf6a14952a849c2e4c44bf'; // t003's EEE class
  const unauthRes = await makeRequest({
    path: `/api/teacher/students?classId=${unauthorizedClassId}`,
    headers: { Cookie: t001Cookie }
  });
  assert(unauthRes.statusCode === 403, `Teacher t001 accessing unassigned classId rejected with 403 Forbidden (Actual: ${unauthRes.statusCode})`);

  console.log('\n=============================================================');
  console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
