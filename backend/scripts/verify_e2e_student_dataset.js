/**
 * verify_e2e_student_dataset.js
 * 
 * End-to-end verification of Admin-Created Student Test Data:
 * 1. Admin login & verification of Manage Students, Classes, Subjects
 * 2. Teacher t001 login: My Subjects, My Classes, Students filtering & visibility
 * 3. Teacher t002 login: Isolation to ECE First Year Sec A
 * 4. Teacher t003 login: Isolation to EEE Third Year Sec A
 * 5. Teacher t004 login: Isolation to CSE Second Year Sec A & Third Year Sec A
 * 6. Security & Authorization guard tests (unauthorized section access rejected)
 */

const http = require('http');

function makeRequest({ path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        ...headers
      }
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
    throw new Error(`Login failed for ${userId} (${role}): ${JSON.stringify(res.data)}`);
  }
  return res.cookie;
}

async function run() {
  console.log('\n======================================================');
  console.log(' STARTING END-TO-END VERIFICATION: CLASS PULSE DATASET');
  console.log('======================================================\n');

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

  // ------------------------------------------------------------------
  // 1. Admin Verification
  // ------------------------------------------------------------------
  console.log('--- 1. Testing Admin Portal (User: 0001) ---');
  const adminCookie = await login('0001', 'StudyPoint@Admin2026', 'admin');
  assert(!!adminCookie, 'Admin authenticated with session cookie');

  const studentsRes = await makeRequest({
    path: '/api/admin/students',
    headers: { Cookie: adminCookie }
  });
  assert(studentsRes.statusCode === 200, 'GET /api/admin/students returns 200 OK');
  const adminStudents = studentsRes.data?.students || [];
  assert(adminStudents.length >= 15, `Admin sees all students in Manage Students (Count: ${adminStudents.length})`);

  // Verify distribution in Admin view
  const yearsRepresented = new Set(adminStudents.map(s => s.yearOfStudy).filter(Boolean));
  assert(yearsRepresented.has('First Year'), 'First Year students present in Admin view');
  assert(yearsRepresented.has('Second Year'), 'Second Year students present in Admin view');
  assert(yearsRepresented.has('Third Year'), 'Third Year students present in Admin view');
  assert(yearsRepresented.has('Fourth Year'), 'Fourth Year students present in Admin view');

  const deptsRepresented = new Set(adminStudents.map(s => s.department).filter(Boolean));
  assert(deptsRepresented.has('Computer Science and Engineering'), 'CSE present in Admin view');
  assert(deptsRepresented.has('Electronics and Communication Engineering'), 'ECE present in Admin view');
  assert(deptsRepresented.has('Electrical and Electronics Engineering'), 'EEE present in Admin view');

  // Verify Admin Classes view
  const classesRes = await makeRequest({
    path: '/api/admin/classes',
    headers: { Cookie: adminCookie }
  });
  assert(classesRes.statusCode === 200, 'GET /api/admin/classes returns 200 OK');
  const classes = classesRes.data?.classes || [];
  assert(classes.length >= 8, `Configured classes present in Admin view (Count: ${classes.length})`);

  // ------------------------------------------------------------------
  // 2. Teacher t001 Verification
  // ------------------------------------------------------------------
  console.log('\n--- 2. Testing Teacher t001 (Prof. Jogi Umadevi - Multi-Year & Multi-Section) ---');
  const t001Cookie = await login('t001', 'StudyPoint@Teacher2026', 'teacher');
  assert(!!t001Cookie, 'Teacher t001 authenticated');

  const t001ClassesRes = await makeRequest({
    path: '/api/teacher/classes',
    headers: { Cookie: t001Cookie }
  });
  assert(t001ClassesRes.statusCode === 200, 'GET /api/teacher/classes returns 200 OK');
  const t001Classes = t001ClassesRes.data?.classes || [];
  assert(t001Classes.length === 4, `Teacher t001 is assigned to exactly 4 sections (Actual: ${t001Classes.length})`);

  const t001SubjectsRes = await makeRequest({
    path: '/api/teacher/subjects',
    headers: { Cookie: t001Cookie }
  });
  assert(t001SubjectsRes.statusCode === 200, 'GET /api/teacher/subjects returns 200 OK');
  const t001Subjects = t001SubjectsRes.data?.subjects || [];
  assert(t001Subjects.length >= 3, `Teacher t001 has subjects assigned (Count: ${t001Subjects.length})`);

  // Unfiltered Students for t001
  const t001StudentsRes = await makeRequest({
    path: '/api/teacher/students',
    headers: { Cookie: t001Cookie }
  });
  assert(t001StudentsRes.statusCode === 200, 'GET /api/teacher/students returns 200 OK');
  const t001Students = t001StudentsRes.data?.students || [];
  assert(t001Students.length === 7, `Teacher t001 sees exactly 7 authorized students (Actual: ${t001Students.length})`);

  // Student IDs check for t001
  const t001StudentIds = t001Students.map(s => s.studentId.toUpperCase());
  assert(t001StudentIds.includes('STU2026001') && t001StudentIds.includes('STU2026002'), 't001 sees STU2026001 and STU2026002 (2nd Yr Sec B)');
  assert(t001StudentIds.includes('STU2026003') && t001StudentIds.includes('STU2026004'), 't001 sees STU2026003 and STU2026004 (1st Yr Sec A)');
  assert(t001StudentIds.includes('STU2026005') && t001StudentIds.includes('STU2026006'), 't001 sees STU2026005 and STU2026006 (1st Yr Sec B)');
  assert(t001StudentIds.includes('STU2026015'), 't001 sees STU2026015 (4th Yr Sec A)');
  assert(!t001StudentIds.includes('STU2026007'), 't001 CANNOT see ECE student STU2026007 (Boundary preserved)');
  assert(!t001StudentIds.includes('STU2026009'), 't001 CANNOT see CSE Sec A student STU2026009 (Boundary preserved)');
  assert(!t001StudentIds.includes('STU2026013'), 't001 CANNOT see EEE student STU2026013 (Boundary preserved)');

  // Filter: First Year
  const t001Yr1Res = await makeRequest({
    path: '/api/teacher/students?yearOfStudy=First%20Year',
    headers: { Cookie: t001Cookie }
  });
  const t001Yr1Students = t001Yr1Res.data?.students || [];
  assert(t001Yr1Students.length === 4, `t001 filtered by 'First Year' returns 4 students (Actual: ${t001Yr1Students.length})`);

  // Filter: Second Year
  const t001Yr2Res = await makeRequest({
    path: '/api/teacher/students?yearOfStudy=Second%20Year',
    headers: { Cookie: t001Cookie }
  });
  const t001Yr2Students = t001Yr2Res.data?.students || [];
  assert(t001Yr2Students.length === 2, `t001 filtered by 'Second Year' returns 2 students (Actual: ${t001Yr2Students.length})`);

  // Filter: Fourth Year
  const t001Yr4Res = await makeRequest({
    path: '/api/teacher/students?yearOfStudy=Fourth%20Year',
    headers: { Cookie: t001Cookie }
  });
  const t001Yr4Students = t001Yr4Res.data?.students || [];
  assert(t001Yr4Students.length === 1, `t001 filtered by 'Fourth Year' returns 1 student (Actual: ${t001Yr4Students.length})`);

  // Combined Filter: Year + Department + Section
  const cseSecB = t001Classes.find(c => c.section === 'B' && (c.yearOfStudy === 'Second Year' || c.semester === '3rd'));
  if (cseSecB) {
    const combinedRes = await makeRequest({
      path: `/api/teacher/students?yearOfStudy=Second%20Year&department=Computer%20Science%20and%20Engineering&classId=${cseSecB._id}`,
      headers: { Cookie: t001Cookie }
    });
    const combinedStudents = combinedRes.data?.students || [];
    assert(combinedStudents.length === 2, `Combined Year+Dept+Section filter returns exactly 2 students in Sec B (Actual: ${combinedStudents.length})`);
  }

  // ------------------------------------------------------------------
  // 3. Teacher t002 Verification (Single Section: ECE 1st Yr Sec A)
  // ------------------------------------------------------------------
  console.log('\n--- 3. Testing Teacher t002 (Dr. Rajesh Sharma - ECE First Year Only) ---');
  const t002Cookie = await login('t002', 'StudyPoint@Teacher2026', 'teacher');
  assert(!!t002Cookie, 'Teacher t002 authenticated');

  const t002ClassesRes = await makeRequest({
    path: '/api/teacher/classes',
    headers: { Cookie: t002Cookie }
  });
  const t002Classes = t002ClassesRes.data?.classes || [];
  assert(t002Classes.length === 1, `Teacher t002 assigned to exactly 1 section (Actual: ${t002Classes.length})`);
  assert(t002Classes[0]?.department === 'Electronics and Communication Engineering', 't002 class is ECE');

  const t002StudentsRes = await makeRequest({
    path: '/api/teacher/students',
    headers: { Cookie: t002Cookie }
  });
  const t002Students = t002StudentsRes.data?.students || [];
  assert(t002Students.length === 2, `Teacher t002 sees exactly 2 students (Actual: ${t002Students.length})`);
  const t002Ids = t002Students.map(s => s.studentId.toUpperCase());
  assert(t002Ids.includes('STU2026007') && t002Ids.includes('STU2026008'), 't002 sees only ECE students STU2026007 and STU2026008');

  // ------------------------------------------------------------------
  // 4. Teacher t003 Verification (Single Section: EEE 3rd Yr Sec A)
  // ------------------------------------------------------------------
  console.log('\n--- 4. Testing Teacher t003 (Dr. Priya Nair - EEE Third Year Only) ---');
  const t003Cookie = await login('t003', 'StudyPoint@Teacher2026', 'teacher');
  assert(!!t003Cookie, 'Teacher t003 authenticated');

  const t003StudentsRes = await makeRequest({
    path: '/api/teacher/students',
    headers: { Cookie: t003Cookie }
  });
  const t003Students = t003StudentsRes.data?.students || [];
  assert(t003Students.length === 2, `Teacher t003 sees exactly 2 students (Actual: ${t003Students.length})`);
  const t003Ids = t003Students.map(s => s.studentId.toUpperCase());
  assert(t003Ids.includes('STU2026013') && t003Ids.includes('STU2026014'), 't003 sees only EEE students STU2026013 and STU2026014');

  // ------------------------------------------------------------------
  // 5. Teacher t004 Verification (CSE 2nd Yr Sec A + 3rd Yr Sec A)
  // ------------------------------------------------------------------
  console.log('\n--- 5. Testing Teacher t004 (Prof. Anand Verma - CSE Distinct Sections) ---');
  const t004Cookie = await login('t004', 'StudyPoint@Teacher2026', 'teacher');
  assert(!!t004Cookie, 'Teacher t004 authenticated');

  const t004StudentsRes = await makeRequest({
    path: '/api/teacher/students',
    headers: { Cookie: t004Cookie }
  });
  const t004Students = t004StudentsRes.data?.students || [];
  assert(t004Students.length === 4, `Teacher t004 sees exactly 4 authorized students (Actual: ${t004Students.length})`);
  const t004Ids = t004Students.map(s => s.studentId.toUpperCase());
  assert(t004Ids.includes('STU2026009') && t004Ids.includes('STU2026010'), 't004 sees 2nd Yr CSE Sec A (STU2026009, 010)');
  assert(t004Ids.includes('STU2026011') && t004Ids.includes('STU2026012'), 't004 sees 3rd Yr CSE Sec A (STU2026011, 012)');

  // ------------------------------------------------------------------
  // 6. Security and Authorization Bounds Test
  // ------------------------------------------------------------------
  console.log('\n--- 6. Security & Authorization Boundary Checks ---');
  // t002 tries to query a CSE section belonging to t001
  if (cseSecB) {
    const unauthorizedRes = await makeRequest({
      path: `/api/teacher/classes/${cseSecB._id}`,
      headers: { Cookie: t002Cookie }
    });
    assert(unauthorizedRes.statusCode === 403 || unauthorizedRes.statusCode === 404, `t002 unauthorized section access rejected with status ${unauthorizedRes.statusCode}`);

    const unauthorizedStudentsRes = await makeRequest({
      path: `/api/teacher/students?classId=${cseSecB._id}`,
      headers: { Cookie: t002Cookie }
    });
    assert(unauthorizedStudentsRes.statusCode === 403, 't002 unauthorized student query rejected with 403 Forbidden');
  }

  console.log('\n======================================================');
  console.log(` VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('[FATAL ERROR IN E2E VERIFICATION]:', err);
  process.exit(1);
});
