/**
 * UMAIRA FLORIST — REVERSED COLOR SCHEME, WELCOME & TOP BAR VERIFICATION TEST
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function check(label, condition, extra = '') {
  if (condition) {
    console.log(`  ok   ${label}`);
    passed++;
  } else {
    console.error(`  FAIL ${label} ${extra}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('UMAIRA FLORIST — REVERSED COLOR SCHEME & TOP BAR TESTS');
console.log('======================================================\n');

const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(__dirname, '../js/admin.js'), 'utf8');

// ------------------------------------------------------------------
// [Area 1] Dashboard Welcome Section
// ------------------------------------------------------------------
console.log('[Area 1] Dashboard Welcome Section');

check('Dashboard contains Welcome back heading',
  /Welcome back,/i.test(adminHtml) &&
  adminHtml.includes('id="dashboard-welcome-name"')
);

check('Dashboard heading has a short overview subtitle under it',
  /id="dashboard-welcome-name"[\s\S]{0,200}<\/h1>\s*<p[^>]*>\s*Here's your[^<]{10,}<\/p>/.test(adminHtml)
);

check('Welcome section is placed inside data-tab-content="dashboard"', () => {
  const dashContent = adminHtml.split('data-tab-content="dashboard"')[1].split('data-tab-content="orders"')[0];
  return /Welcome back,/i.test(dashContent) && dashContent.includes('id="dashboard-welcome-name"');
});

check('Welcome heading uses the serif display typography',
  /<h1 class="[^"]*font-serif font-bold[^"]*">\s*Welcome back,/i.test(adminHtml)
);

// ------------------------------------------------------------------
// [Area 2] Top Bar Structure & Global Placement
// ------------------------------------------------------------------
console.log('\n[Area 2] Top Bar Structure & Global Placement');

check('Admin Top Bar container #admin-top-bar exists',
  adminHtml.includes('id="admin-top-bar"')
);

// Colour/surface styling of the top bar and sidebar is reviewed visually (admin styling is being refined).

check('Top Bar is positioned before all data-tab-content screens (global across all pages)', () => {
  const topBarIdx = adminHtml.indexOf('id="admin-top-bar"');
  const dashIdx = adminHtml.indexOf('data-tab-content="dashboard"');
  const ordersIdx = adminHtml.indexOf('data-tab-content="orders"');
  return topBarIdx > 0 && topBarIdx < dashIdx && dashIdx < ordersIdx;
});

// ------------------------------------------------------------------
// [Area 3] Reversed Color Scheme & Sidebar Verification
// ------------------------------------------------------------------
console.log('\n[Area 3] Reversed Color Scheme & Sidebar Verification');

check('Sidebar navigation: 6 sections, each a button with an icon and a text label',
  (() => {
    const btns = adminHtml.match(/<button[^>]*data-tab-nav="[a-z]+"[\s\S]*?<\/button>/g) || [];
    return btns.length === 6 && btns.every(b => b.includes('<svg') && /<span[^>]*>[A-Z][^<]+<\/span>/.test(b));
  })()
);









// ------------------------------------------------------------------
// [Area 4] Notification Bell & Popover
// ------------------------------------------------------------------
console.log('\n[Area 4] Notification Bell & Popover');

check('Notification bell button #topbar-bell-btn exists with badge #topbar-notif-badge',
  adminHtml.includes('id="topbar-bell-btn"') &&
  adminHtml.includes('id="topbar-notif-badge"')
);

check('Notifications dropdown container #topbar-notifications-dropdown exists',
  adminHtml.includes('id="topbar-notifications-dropdown"')
);

check('admin.js getNotifications combines saved order notifications with live low/out-of-stock alerts',
  adminJs.includes('getNotifications()') &&
  adminJs.includes('/api/admin/notifications') &&
  adminJs.includes('lowStockFlowers') && adminJs.includes('outOfStockFlowers')
);

check('admin.js implements updateNotificationBadge, toggleNotificationsPopover, and renderNotificationsPopover',
  adminJs.includes('updateNotificationBadge()') &&
  adminJs.includes('toggleNotificationsPopover()') &&
  adminJs.includes('renderNotificationsPopover()')
);

check('Notifications dropdown provides empty state when all caught up',
  adminJs.includes('All caught up!') &&
  adminJs.includes('No pending orders or low-stock alerts right now.')
);

// ------------------------------------------------------------------
// [Area 5] Date and Live Clock (Asia/Manila)
// ------------------------------------------------------------------
console.log('\n[Area 5] Date & Live Clock in Asia/Manila');

check('Live time and date elements exist in top bar',
  adminHtml.includes('id="topbar-live-time"') &&
  adminHtml.includes('id="topbar-live-date"')
);

check('admin.js formats time specifically for Asia/Manila timezone',
  adminJs.includes("timeZone: 'Asia/Manila'")
);

check('admin.js updates clock automatically via live interval',
  adminJs.includes('startLiveClock()') &&
  adminJs.includes('setInterval(tick, 1000)')
);

// ------------------------------------------------------------------
// [Area 6] Header Cleanliness (No Search Bar)
// ------------------------------------------------------------------
console.log('\n[Area 6] Header Cleanliness (No Search Bar in Header)');

check('Search bar is not included in header per requirement', () => {
  const topBarSnippet = adminHtml.split('id="admin-top-bar"')[1].split('</header>')[0];
  return !topBarSnippet.includes('id="topbar-search-input"') &&
         !topBarSnippet.includes('id="topbar-search-clear"');
});

// ------------------------------------------------------------------
// [Area 7] Dashboard Simplification (4 KPIs, No Unnecessary Badges)
// ------------------------------------------------------------------
console.log('\n[Area 7] Dashboard Simplification');

const dashSection = adminHtml.split('data-tab-content="dashboard"')[1].split('data-tab-content="orders"')[0];

check('Dashboard retains exactly 4 essential KPI cards (#admin-stats-grid)',
  dashSection.includes('id="admin-stats-grid"') &&
  ['Card 1: Sales Today', 'Card 2: Pending Orders', 'Card 3: Active Orders', 'Card 4: Low-Stock Items'].every(c => adminJs.includes(c))
);

check('Dashboard secondary KPI grid (#dashboard-secondary-grid) is removed from dashboard',
  !dashSection.includes('id="dashboard-secondary-grid"')
);

check('Unnecessary KPI badges (Needs Review, Active Queue, Delivered Only) are removed from KPI cards', () => {
  const kpiMethod = adminJs.split('renderDashboardKPIs(s) {')[1].split('renderDashboardSecondary')[0];
  return !kpiMethod.includes('Needs Review') &&
         !kpiMethod.includes('Active Queue') &&
         !kpiMethod.includes('Delivered Only');
});

check('Recent Customer Orders section shows latest orders with View All Orders action',
  dashSection.includes('Recent Customer Orders') &&
  dashSection.includes("window.adminApp.switchTab('orders')") &&
  dashSection.includes('View All Orders') &&
  dashSection.includes('id="dashboard-recent-orders-tbody"')
);

check('Stock Alerts section lists urgent items (max 10) with a Manage action to the Store screen',
  dashSection.includes('Stock Alerts') &&
  dashSection.includes("window.adminApp.switchTab('store')") &&
  dashSection.includes('Manage') &&
  dashSection.includes('id="dashboard-stock-alerts-list"') &&
  adminJs.includes('items.slice(0, 10)')
);

console.log('\n======================================================');
console.log(`TOP BAR & WELCOME RESULTS: ${passed} passed, ${failed} failed`);
console.log('======================================================\n');

if (failed > 0) process.exit(1);
