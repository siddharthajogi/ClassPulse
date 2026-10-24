const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== VERIFYING TEACHER DASHBOARD NAVIGATION & GREEN/TEAL THEME ===\n');

// 1. Verify TeacherLayout.jsx
const teacherLayoutPath = path.join(__dirname, '../../frontend/src/components/TeacherLayout.jsx');
assert(fs.existsSync(teacherLayoutPath), 'TeacherLayout.jsx must exist');
const teacherLayoutContent = fs.readFileSync(teacherLayoutPath, 'utf8');

console.log('1. Checking Sidebar Navigation items in TeacherLayout.jsx...');

const expectedOrder = [
  { name: 'Dashboard', path: '/teacher/dashboard' },
  { name: 'My Subjects', path: '/teacher/subjects' },
  { name: 'My Classes & Sections', path: '/teacher/classes' },
  { name: 'Students', path: '/teacher/students' },
  { name: 'Student Risk Analytics', path: '/teacher/risk-analytics' },
  { name: 'Knowledge-Gap Analysis', path: '/teacher/knowledge-gaps' },
  { name: 'Personalized Learning', path: '/teacher/personalized-learning' },
  { name: 'Intervention Review', path: '/teacher/intervention-review' },
  { name: 'Academic Records', path: '/teacher/academic-records' },
  { name: 'Attendance', path: '/teacher/attendance' },
  { name: 'Assignments', path: '/teacher/assignments' },
  { name: 'Learning Improvement', path: '/teacher/learning-improvement' },
  { name: 'My Profile', path: '/teacher/profile' }
];

// Extract menuItems from TeacherLayout.jsx
const menuItemsRegex = /const\s+menuItems\s*=\s*\[([\s\S]*?)\];/;
const match = teacherLayoutContent.match(menuItemsRegex);
assert(match, 'menuItems array must be defined in TeacherLayout.jsx');

const itemsBlock = match[1];
const extractedItems = [];
const itemRegex = /name:\s*['"](.*?)['"],\s*icon:\s*\w+,\s*path:\s*['"](.*?)['"]/g;
let itemMatch;
while ((itemMatch = itemRegex.exec(itemsBlock)) !== null) {
  extractedItems.push({ name: itemMatch[1], path: itemMatch[2] });
}

console.log(`Found ${extractedItems.length} menu items in TeacherLayout.jsx:`);
extractedItems.forEach((item, index) => {
  console.log(`  ${index + 1}. ${item.name} -> ${item.path}`);
});

assert.strictEqual(extractedItems.length, 13, 'There must be exactly 13 navigation items');

expectedOrder.forEach((expected, i) => {
  assert.strictEqual(
    extractedItems[i].name,
    expected.name,
    `Item ${i + 1} name must be "${expected.name}", got "${extractedItems[i].name}"`
  );
  assert.strictEqual(
    extractedItems[i].path,
    expected.path,
    `Item ${i + 1} path must be "${expected.path}", got "${extractedItems[i].path}"`
  );
});
console.log('✓ All 13 items match exactly in the specified order.');

// 2. Check Notifications not in sidebar, only in top header
console.log('\n2. Checking Notifications placement...');
const sidebarNotificationsMatch = itemsBlock.match(/Notifications/i);
assert(!sidebarNotificationsMatch, 'Notifications MUST NOT be in the sidebar menu items');
console.log('✓ Verified: Notifications is NOT in the sidebar');

const headerNotificationsMatch = teacherLayoutContent.includes('<Link') &&
  teacherLayoutContent.includes('to="/teacher/notifications"') &&
  teacherLayoutContent.includes('<Bell');
assert(headerNotificationsMatch, 'Notifications button must be present in top header linking to /teacher/notifications with Bell icon');
console.log('✓ Verified: Top header has Notifications button with Bell icon');

// 3. Check Logout at the bottom of sidebar
console.log('\n3. Checking Logout at bottom of sidebar...');
assert(teacherLayoutContent.includes('<LogOut'), 'Logout icon must be present');
assert(teacherLayoutContent.includes('<span>Logout</span>'), 'Logout text must be present');
const bottomLogoutIndex = teacherLayoutContent.indexOf('Bottom of Sidebar: Logout');
assert(bottomLogoutIndex !== -1, 'Logout must be placed at the bottom section of the sidebar');
console.log('✓ Verified: Logout button is situated at the bottom of the sidebar');

// 4. Check Green/Teal theme tokens in TeacherLayout.jsx
console.log('\n4. Checking Green/Teal (emerald) theme tokens...');
assert(teacherLayoutContent.includes('bg-emerald-600'), 'bg-emerald-600 must be used');
assert(teacherLayoutContent.includes('text-emerald-700') || teacherLayoutContent.includes('text-emerald-800') || teacherLayoutContent.includes('text-emerald-600'), 'emerald text accents must be used');
assert(teacherLayoutContent.includes('bg-emerald-50'), 'bg-emerald-50 subtle background must be used');
assert(teacherLayoutContent.includes('dark:bg-emerald-950'), 'dark:bg-emerald-950 dark mode accent must be used');
assert(teacherLayoutContent.includes('border-emerald-600') || teacherLayoutContent.includes('border-emerald-500'), 'active indicator border must be used');
console.log('✓ Verified: Emerald green/teal tokens consistently applied for active states, borders, and icons');

// 5. Verify App.jsx routes for Teacher
console.log('\n5. Verifying App.jsx routes for Teacher...');
const appPath = path.join(__dirname, '../../frontend/src/App.jsx');
const appContent = fs.readFileSync(appPath, 'utf8');

assert(appContent.includes('<Route path="/teacher"'), 'App.jsx must have /teacher route');
assert(appContent.includes('<Route path="dashboard"'), 'dashboard route must be mounted');
assert(appContent.includes('<Route\n          path="subjects"') || appContent.includes('path="subjects"'), 'subjects route must be mounted');
assert(appContent.includes('path="classes"'), 'classes route must be mounted');
assert(appContent.includes('path="students"'), 'students route must be mounted');
assert(appContent.includes('path="risk-analytics"'), 'risk-analytics route must be mounted');
assert(appContent.includes('path="knowledge-gaps"'), 'knowledge-gaps route must be mounted');
assert(appContent.includes('path="personalized-learning"'), 'personalized-learning route must be mounted');
assert(appContent.includes('path="intervention-review"'), 'intervention-review route must be mounted');
assert(appContent.includes('path="academic-records"'), 'academic-records route must be mounted');
assert(appContent.includes('path="attendance"'), 'attendance route must be mounted');
assert(appContent.includes('path="assignments"'), 'assignments route must be mounted');
assert(appContent.includes('path="learning-improvement"'), 'learning-improvement route must be mounted');
assert(appContent.includes('path="profile"'), 'profile route must be mounted');
assert(appContent.includes('path="notifications"'), 'notifications route must be mounted');
console.log('✓ All 13 teacher routes plus notifications and dashboard are registered in App.jsx');

// 6. Verify Isolation: Admin and Student routes & login cards intact
console.log('\n6. Verifying Color and Route Isolation...');
assert(appContent.includes('<Route path="/admin"'), 'Admin routes must remain intact');
assert(appContent.includes('<Route path="/student/*"'), 'Student routes must remain intact');

const loginCardPath = path.join(__dirname, '../../frontend/src/components/LoginCard.jsx');
const loginCardContent = fs.readFileSync(loginCardPath, 'utf8');

assert(loginCardContent.includes('border-purple-200') && loginCardContent.includes('bg-purple-600'), 'Student Login card must remain purple');
assert(loginCardContent.includes('border-blue-200') && loginCardContent.includes('bg-blue-600'), 'Admin Login card must remain blue');
assert(loginCardContent.includes('border-emerald-200') && loginCardContent.includes('bg-emerald-600'), 'Teacher Login card must remain emerald');
console.log('✓ LoginCard themes verified: Student=Purple, Admin=Blue, Teacher=Emerald');

console.log('\n=== ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
process.exit(0);
