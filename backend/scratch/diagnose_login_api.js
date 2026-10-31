const http = require('http');

function testLogin(userId, password, role) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ userId, password, role });
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let body = {};
        try { body = JSON.parse(data); } catch (e) { body = data; }
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 0, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

async function runDiagnostics() {
  console.log('=== Real HTTP Login Tests to Running Backend ===\n');

  console.log('1. Admin (0001) with StudyPoint@Admin2026:');
  const res1 = await testLogin('0001', 'StudyPoint@Admin2026', 'admin');
  console.log('   Status:', res1.statusCode, 'Body:', res1.body);

  console.log('\n2. Admin (0001) with AdminSecurePass@2026:');
  const res2 = await testLogin('0001', 'AdminSecurePass@2026', 'admin');
  console.log('   Status:', res2.statusCode, 'Body:', res2.body);

  console.log('\n3. Teacher (t001) with StudyPoint@Teacher2026:');
  const res3 = await testLogin('t001', 'StudyPoint@Teacher2026', 'teacher');
  console.log('   Status:', res3.statusCode, 'Body:', res3.body);

  console.log('\n4. Teacher (t001) with PermanentPass@UmaDevi2026!:');
  const res4 = await testLogin('t001', 'PermanentPass@UmaDevi2026!', 'teacher');
  console.log('   Status:', res4.statusCode, 'Body:', res4.body);

  console.log('\n5. Teacher (t002) with StudyPoint@Teacher2026:');
  const res5 = await testLogin('t002', 'StudyPoint@Teacher2026', 'teacher');
  console.log('   Status:', res5.statusCode, 'Body:', res5.body);

  console.log('\n6. Teacher (t003) with StudyPoint@Teacher2026:');
  const res6 = await testLogin('t003', 'StudyPoint@Teacher2026', 'teacher');
  console.log('   Status:', res6.statusCode, 'Body:', res6.body);

  console.log('\n7. Invalid Password Test (0001 with WrongPassword@123):');
  const res7 = await testLogin('0001', 'WrongPassword@123', 'admin');
  console.log('   Status:', res7.statusCode, 'Body:', res7.body);

  console.log('\n8. Nonexistent Account Test (nonexistent_user with AnyPass@123):');
  const res8 = await testLogin('nonexistent_user', 'AnyPass@123', 'admin');
  console.log('   Status:', res8.statusCode, 'Body:', res8.body);

  console.log('\n9. Wrong Role Test (0001 with AdminSecurePass@2026 but role="teacher"):');
  const res9 = await testLogin('0001', 'AdminSecurePass@2026', 'teacher');
  console.log('   Status:', res9.statusCode, 'Body:', res9.body);
}

runDiagnostics();
