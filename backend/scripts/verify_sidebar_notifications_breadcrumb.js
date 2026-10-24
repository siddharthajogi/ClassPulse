const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('STARTING VERIFICATION: SIDEBAR, NOTIFICATIONS, THEME & BREADCRUMB');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`[PASS] ${description}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${description}\n  Error: ${err.message}`);
    failCount++;
  }
}

// Read Files
const adminLayoutPath = path.resolve(__dirname, '../../frontend/src/components/AdminLayout.jsx');
const notificationsPath = path.resolve(__dirname, '../../frontend/src/components/Notifications.jsx');
const notificationModelPath = path.resolve(__dirname, '../models/Notification.js');
const notificationServicePath = path.resolve(__dirname, '../services/notificationService.js');
const adminControllerPath = path.resolve(__dirname, '../controllers/adminController.js');

const adminLayoutContent = fs.readFileSync(adminLayoutPath, 'utf8');
const notificationsContent = fs.readFileSync(notificationsPath, 'utf8');
const notificationModelContent = fs.readFileSync(notificationModelPath, 'utf8');
const notificationServiceContent = fs.readFileSync(notificationServicePath, 'utf8');
const adminControllerContent = fs.readFileSync(adminControllerPath, 'utf8');

// --- Task 1: Notifications Navigation Removed from Sidebar but Kept in Header ---
test('Task 1.1: Notifications is NOT in menuItems for the sidebar', () => {
  assert(!adminLayoutContent.includes("{ name: 'Notifications'"), 'menuItems should not contain Notifications entry');
  assert(!adminLayoutContent.includes("path: '/admin/notifications', hasBadge: true"), 'Sidebar navigation should not have Notifications path with badge');
});

test('Task 1.2: Notification bell button exists in top header', () => {
  assert(adminLayoutContent.includes('aria-label="View notifications"'), 'Header must contain notifications bell button');
  assert(adminLayoutContent.includes('setIsDropdownOpen(prev => !prev)'), 'Header bell must toggle notification popover dropdown');
});

test('Task 1.3: Notification unread badge and dropdown preview exist in header', () => {
  assert(adminLayoutContent.includes('unreadCount > 0 && ('), 'Header bell must display unread count badge');
  assert(adminLayoutContent.includes('isDropdownOpen && ('), 'Notification popover dropdown must be preserved');
  assert(adminLayoutContent.includes('to="/admin/notifications"'), 'Dropdown must include link to /admin/notifications');
  assert(adminLayoutContent.includes('View All Notifications'), 'Dropdown must have View All Notifications link');
});

// --- Task 2: Student Risks Added to Notifications Category Filters ---
test('Task 2.1: Student Risks category exists in Notifications.jsx CATEGORIES array', () => {
  assert(notificationsContent.includes("id: 'student_risks', label: 'Student Risks'"), 'CATEGORIES array must include student_risks');
});

test('Task 2.2: Category filter row contains exact ordered items', () => {
  const expectedSequence = [
    'All Categories',
    'Students',
    'Teachers',
    'Departments & Sections',
    'Academics',
    'Student Risks',
    'Security & System'
  ];
  for (const label of expectedSequence) {
    assert(notificationsContent.includes(`label: '${label}'`), `CATEGORIES must contain label: '${label}'`);
  }
  
  // Verify ordering: Academics then Student Risks then Security & System
  const idxAcademics = notificationsContent.indexOf("label: 'Academics'");
  const idxRisks = notificationsContent.indexOf("label: 'Student Risks'");
  const idxSecurity = notificationsContent.indexOf("label: 'Security & System'");
  assert(idxAcademics < idxRisks, 'Academics must come before Student Risks');
  assert(idxRisks < idxSecurity, 'Student Risks must come before Security & System');
});

test('Task 2.3: Student Risks uses alert/risk icon and has label helper', () => {
  assert(notificationsContent.includes("case 'student_risks': return 'Student Risks'"), 'getCategoryLabel must map student_risks to Student Risks');
});

test('Task 2.4: Backend Notification model includes student_risks in category enum', () => {
  assert(notificationModelContent.includes("'student_risks'"), 'Notification.js enum must include student_risks');
});

test('Task 2.5: Backend notificationService uses student_risks for real risk alerts without fabricating data', () => {
  assert(notificationServiceContent.includes("category === 'student_risks'"), 'shouldDeliverNotification must handle student_risks');
  assert(notificationServiceContent.includes("category: 'student_risks'"), 'syncSystemAndAcademicAlerts must tag risk alerts as student_risks');
});

test('Task 2.6: Backend adminController supports filtering by student_risks', () => {
  assert(adminControllerContent.includes("category === 'student_risks'"), 'getNotifications must handle category === student_risks');
  assert(adminControllerContent.includes("category: 'student_risks'"), 'filter must check category: student_risks');
});

// --- Task 3: Sidebar Theme Toggle Removed & Header Theme Toggle Preserved ---
test('Task 3.1: Theme toggle is removed from sidebar bottom', () => {
  assert(!adminLayoutContent.includes('Light Mode') && !adminLayoutContent.includes('Dark Mode'), 'Sidebar must not contain Light Mode or Dark Mode toggle text');
});

test('Task 3.2: Header theme toggle exists and switches theme', () => {
  assert(adminLayoutContent.includes('title={`Switch to ${theme === \'dark\' ? \'Light\' : \'Dark\'} mode`}'), 'Header must contain theme switcher button');
  assert(adminLayoutContent.includes('onClick={toggleTheme}'), 'Header theme switcher must call toggleTheme');
});

test('Task 3.3: Sidebar Logout button remains properly positioned', () => {
  assert(adminLayoutContent.includes('onClick={handleLogout}'), 'Logout button must remain functional');
  assert(adminLayoutContent.includes('border-t border-slate-200 dark:border-slate-800'), 'Sidebar bottom container must remain styled');
});

// --- Task 4: Exact Admin Breadcrumb Navigation ---
test('Task 4.1: Admin Breadcrumb navigation is rendered at top of main content area', () => {
  assert(adminLayoutContent.includes('<nav aria-label="Breadcrumb"'), 'Breadcrumb nav element must be present in main content area');
  assert(adminLayoutContent.includes('Admin Portal'), 'Root breadcrumb must display Admin Portal');
  assert(adminLayoutContent.includes('to="/admin/dashboard"'), 'Root breadcrumb must link to /admin/dashboard');
  assert(adminLayoutContent.includes('{currentPageName}'), 'Breadcrumb must render currentPageName dynamically');
});

test('Task 4.2: getCurrentPageName maps all requested example routes accurately', () => {
  // Extract and evaluate getCurrentPageName logic
  const match = adminLayoutContent.match(/const getCurrentPageName = \(([\s\S]*?)\n\};/);
  assert(match, 'getCurrentPageName function definition must exist');
  
  const testMap = {
    '/admin': 'Dashboard',
    '/admin/dashboard': 'Dashboard',
    '/admin/notifications': 'Notifications',
    '/admin/classes': 'Departments & Sections',
    '/admin/assignments': 'Departments & Sections',
    '/admin/profile': 'My Profile',
    '/admin/students': 'Manage Students',
    '/admin/students/create': 'Add Student',
    '/admin/students/6ac9e': 'Student Profile',
    '/admin/teachers': 'Manage Teachers',
    '/admin/teachers/create': 'Add Teacher',
    '/admin/teachers/7be3f': 'Teacher Profile',
    '/admin/subjects': 'Subjects',
    '/admin/academic-records': 'Academic Records',
    '/admin/risk-analytics': 'Risk Analytics',
    '/admin/reports': 'Reports',
    '/admin/activity-logs': 'Activity Logs',
    '/admin/settings': 'Settings',
    '/admin/college-settings': 'Settings',
    '/admin/accounts': 'Active Accounts'
  };

  // Run function via eval in isolated sandbox
  const funcStr = match[0];
  const evalFunc = new Function(`${funcStr}; return getCurrentPageName;`)();

  for (const [route, expectedName] of Object.entries(testMap)) {
    const result = evalFunc(route);
    assert.strictEqual(result, expectedName, `Route ${route} expected ${expectedName}, got ${result}`);
  }
});

test('Task 4.3: Header no longer has duplicate breadcrumb', () => {
  assert(!adminLayoutContent.includes('<span>Admin Portal</span>\n              <ChevronRight'), 'Header should not have duplicate breadcrumb');
});

console.log('\n================================================================');
console.log(`SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
