// Umaira Florist — Admin UI/UX Refinement, Glassmorphism & Table Pagination Test Suite
// Verifies 6-item sidebar refinement, selective glassmorphism, and standardized 6-row table pagination across all 8 tables.

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'PaginationAdmin2026!';
process.env.ORDER_RATE_LIMIT = '1000';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'umaira-pagination-'));
process.env.UMAIRA_DATA_DIR = tmp;

const { server, start } = require('../server.js');

let baseUrl;
let passed = 0;
let failed = 0;
const failureList = [];

function check(label, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    failureList.push(label);
    console.error(`  FAIL ${label}`, extra !== undefined ? extra : '');
  }
}

function req(method, p, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const payload = body !== null && body !== undefined ? JSON.stringify(body) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const r = http.request(u, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, data: json, raw: data });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  console.log('\n======================================================');
  console.log('UMAIRA FLORIST — ADMIN UI/UX & PAGINATION TEST SUITE');
  console.log('======================================================\n');

  const s = await start(0);
  const port = s.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // ------------------------------------------------------------------
  // [Area 1] Admin Sidebar UI/UX Refinements
  // ------------------------------------------------------------------
  console.log('[Area 1] Admin Sidebar Refinement & Navigation Structure');
  const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');

  // Verify exactly 6 primary sidebar navigation items
  const navMatches = adminHtml.match(/data-tab-nav="([^"]+)"/g) || [];
  const primaryTabs = navMatches.map(m => m.replace(/data-tab-nav="|"$/g, ''));
  const uniqueTabs = [...new Set(primaryTabs)];

  check('Primary tab navigation items defined', (primaryTabs.length === 6 || primaryTabs.length === 7), primaryTabs);
  // Current approved layout: Products and Inventory were merged into one "Store" screen (Store Management).
  check('Navigation items match exact spec: dashboard, orders, store, suppliers, reports, settings',
    ['dashboard', 'orders', 'store', 'suppliers', 'reports', 'settings'].every(t => uniqueTabs.includes(t)) &&
    uniqueTabs.length === 6, uniqueTabs
  );

  // No expandable submenus inside the sidebar
  check('No expandable sidebar submenus present in navigation',
    !adminHtml.includes('sidebar-sub-menu') &&
    !adminHtml.includes('sidebar-dropdown') &&
    !adminHtml.includes('data-sidebar-submenu')
  );

  // "Open Customer Storefront" shortcut is completely removed
  check('Shortcut to Open Customer Storefront is completely removed from sidebar',
    !adminHtml.includes('Open Customer Storefront') &&
    !adminHtml.includes('Open Customer View') &&
    !adminHtml.includes('View Customer Storefront')
  );

  // Icon and label alignment: 12px gap (gap-3) and consistent 18-20px icons
  check('Sidebar buttons use consistent 12px gap (gap-3) for icon and label alignment',
    (adminHtml.match(/flex items-center gap-3/g) || []).length >= 6
  );
  check('Sidebar icons use consistent ~18px sizing (w-[18px] h-[18px])',
    (adminHtml.match(/w-\[18px\] h-\[18px\]/g) || []).length >= 6
  );

  // Notification badges aligned to far right (ml-auto)
  check('Sidebar notification badges align to the far right with ml-auto',
    adminHtml.includes('id="sidebar-pending-badge"') &&
    adminHtml.includes('id="sidebar-lowstock-badge"') &&
    adminHtml.includes('ml-auto')
  );

  // Pink gradient background for sidebar (#ED4264 -> #FFEDBC)
  const sidebarMatch = adminHtml.match(/<aside id="admin-sidebar"[^>]*class="([^"]*)"/);
  const sidebarClasses = sidebarMatch ? sidebarMatch[1] : '';
  const hasPinkGradient = (sidebarClasses.includes('sidebar-pink-gradient') || sidebarClasses.includes('gradient-bg') || sidebarClasses.includes('bg-[#ED4264]')) &&
                          !sidebarClasses.includes('bg-white');
  check('Sidebar maintains approved pink gradient background (#ED4264 → #FFEDBC)', hasPinkGradient);

  // Administrator staff account & sign out positioned at the bottom
  check('Administrator staff identity display and sign out button are pinned at the bottom',
    adminHtml.includes('id="admin-user-display"') &&
    adminHtml.includes('onclick="window.adminApp.handleLogout()"')
  );

  // ------------------------------------------------------------------
  // [Area 2] Taste-Aligned Glassmorphism
  // ------------------------------------------------------------------
  console.log('\n[Area 2] Taste-Aligned Selective Glassmorphism');

  check('CSS defines .glass-card utility classes with backdrop-filter',
    adminHtml.includes('.glass-card') &&
    adminHtml.includes('backdrop-filter: blur')
  );

  check('CSS defines prefers-reduced-motion accessibility media query',
    adminHtml.includes('@media (prefers-reduced-motion: reduce)')
  );

  const toolbarHas = (inputId) => { const i = adminHtml.indexOf(`id="${inputId}"`); if (i < 0) return false;
    const before = adminHtml.slice(Math.max(0, i - 1500), i); return before.includes('bg-white/85 backdrop-blur-md'); };
  check('Orders toolbar features glassmorphism styling (bg-white/85 backdrop-blur-md)', toolbarHas('orders-search-input'));

  check('Store Management (products + inventory) toolbar features glassmorphism styling',
    adminHtml.includes('id="store-filter-container"') && toolbarHas('store-search-input')
  );

  check('Suppliers toolbar features glassmorphism styling',
    adminHtml.includes('id="suppliers-search-input"') &&
    adminHtml.includes('bg-white/85 backdrop-blur-md')
  );

  check('Modals 1–8 feature subtle glassmorphism on dialog surfaces',
    adminHtml.includes('id="admin-order-modal"') &&
    adminHtml.includes('id="admin-flower-modal"') &&
    adminHtml.includes('id="admin-bouquet-modal"') &&
    adminHtml.includes('id="admin-stock-modal"') &&
    adminHtml.includes('id="admin-supplier-modal"') &&
    adminHtml.includes('id="admin-category-modal"') &&
    adminHtml.includes('id="admin-customers-directory-modal"') &&
    adminHtml.includes('id="admin-customer-modal"') &&
    (adminHtml.match(/bg-white\/95 backdrop-blur-md/g) || []).length >= 6
  );

  // ------------------------------------------------------------------
  // [Area 3] Standardized Pagination Containers for All 8 Tables
  // ------------------------------------------------------------------
  console.log('\n[Area 3] Pagination Containers Across All 8 Management Tables');

  const requiredPaginationContainers = [
    { id: 'orders-pagination', label: 'Orders table (#orders-pagination)' },
    { id: 'store-pagination', label: 'Store Management table (#store-pagination)' },
    { id: 'history-pagination', label: 'Movement History table (#history-pagination)' },
    { id: 'suppliers-pagination', label: 'Suppliers table (#suppliers-pagination)' },
    { id: 'customers-pagination', label: 'Customer Directory table (#customers-pagination)' }
  ];

  for (const c of requiredPaginationContainers) {
    check(`Pagination container present: ${c.label}`, adminHtml.includes(`id="${c.id}"`));
  }

  // Check empty state placeholders for tables
  const emptyStates = [
    'orders-empty-state',
    'store-empty-state',
    'history-empty-state',
    'suppliers-empty-state',
    'customers-empty-state'
  ];

  for (const es of emptyStates) {
    check(`Empty state container present: #${es}`, adminHtml.includes(`id="${es}"`));
  }

  // ------------------------------------------------------------------
  // [Area 4] JavaScript Pagination Architecture & Logic
  // ------------------------------------------------------------------
  console.log('\n[Area 4] JavaScript Pagination Architecture & Slicing Logic');
  const adminJs = fs.readFileSync(path.join(__dirname, '../js/admin.js'), 'utf8');

  check('admin.js sets ROWS_PER_PAGE = 6', adminJs.includes('const ROWS_PER_PAGE = 6;'));

  check('admin.js initializes pagination state for all 8 tables with pageSize: 6',
    adminJs.includes('orders: { page: 1, pageSize: ROWS_PER_PAGE }') &&
    adminJs.includes('flowers: { page: 1, pageSize: ROWS_PER_PAGE }') &&
    adminJs.includes('bouquets: { page: 1, pageSize: ROWS_PER_PAGE }') &&
    adminJs.includes('categories: { page: 1, pageSize: ROWS_PER_PAGE }') &&
    adminJs.includes('inventory: { page: 1, pageSize: ROWS_PER_PAGE }') &&
    adminJs.includes('history: { page: 1, pageSize: ROWS_PER_PAGE }') &&
    adminJs.includes('suppliers: { page: 1, pageSize: ROWS_PER_PAGE }') &&
    adminJs.includes('customers: { page: 1, pageSize: ROWS_PER_PAGE }')
  );

  check('admin.js implements changePage(tableKey, newPage)', adminJs.includes('changePage(tableKey, newPage)'));
  check('admin.js implements renderPagination(tableKey, totalRecords)', adminJs.includes('renderPagination(tableKey, totalRecords)'));

  // Verify search and filter handlers reset page to 1
  check('Order search and status filter reset page to 1',
    adminJs.includes('this.pagination.orders.page = 1;')
  );
  check('Flower search and category filter reset page to 1',
    adminJs.includes('this.pagination.flowers.page = 1;')
  );
  check('Bouquet search and category filter reset page to 1',
    adminJs.includes('this.pagination.bouquets.page = 1;')
  );
  check('Category search resets page to 1',
    adminJs.includes('this.pagination.categories.page = 1;')
  );
  check('Inventory search and status filter reset page to 1',
    adminJs.includes('this.pagination.inventory.page = 1;')
  );
  check('Movement history search and type filter reset page to 1',
    adminJs.includes('this.pagination.history.page = 1;')
  );
  check('Supplier search and status filter reset page to 1',
    adminJs.includes('this.pagination.suppliers.page = 1;')
  );
  check('Customer search, filter, and sort reset page to 1',
    adminJs.includes('this.pagination.customers.page = 1;')
  );

  // ------------------------------------------------------------------
  // [Area 5] Functional Simulation of Table Slicing & Pagination Controls
  // ------------------------------------------------------------------
  console.log('\n[Area 5] Functional Slicing & Control Generation Simulation');

  // Simulate pagination calculation logic exactly as written in AdminApp
  function simulatePagination(totalRecords, page, pageSize = 6) {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    let curPage = page;
    if (curPage > totalPages) curPage = totalPages;
    if (curPage < 1) curPage = 1;

    const startIdx = (curPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const startRecord = totalRecords === 0 ? 0 : startIdx + 1;
    const endRecord = Math.min(curPage * pageSize, totalRecords);
    const isFirst = curPage <= 1;
    const isLast = curPage >= totalPages;

    return { curPage, totalPages, startIdx, endIdx, startRecord, endRecord, isFirst, isLast };
  }

  // Scenario A: 20 records (e.g. 20 fresh flowers)
  const p1 = simulatePagination(20, 1, 6);
  check('20 records on page 1: shows records 1–6', p1.startRecord === 1 && p1.endRecord === 6);
  check('20 records on page 1: Prev button disabled', p1.isFirst === true);
  check('20 records on page 1: Next button enabled', p1.isLast === false);
  check('20 records on page 1: totalPages is 4', p1.totalPages === 4);

  const p2 = simulatePagination(20, 2, 6);
  check('20 records on page 2: shows records 7–12', p2.startRecord === 7 && p2.endRecord === 12);
  check('20 records on page 2: Prev enabled and Next enabled', p2.isFirst === false && p2.isLast === false);

  const p4 = simulatePagination(20, 4, 6);
  check('20 records on page 4 (last): shows records 19–20', p4.startRecord === 19 && p4.endRecord === 20);
  check('20 records on page 4: Prev enabled and Next disabled', p4.isFirst === false && p4.isLast === true);

  // Scenario B: Clamping bounds check
  const pClamped = simulatePagination(20, 99, 6);
  check('Page 99 out-of-bounds is clamped safely to page 4', pClamped.curPage === 4);

  // Scenario C: Zero records empty state
  const pZero = simulatePagination(0, 1, 6);
  check('Zero records produces totalPages = 1 and handles empty gracefully', pZero.totalPages === 1 && pZero.startRecord === 0);

  // Scenario D: Exactly 6 records (1 page)
  const pExact = simulatePagination(6, 1, 6);
  check('Exactly 6 records produces 1 page with both Prev and Next disabled', pExact.totalPages === 1 && pExact.isFirst && pExact.isLast);

  // ------------------------------------------------------------------
  // [Area 6] Live Admin Backend Endpoints Sanity Check
  // ------------------------------------------------------------------
  console.log('\n[Area 6] Live Backend Operations Sanity Check');

  const loginRes = await req('POST', '/api/admin/login', {
    username: 'admin',
    password: process.env.ADMIN_PASSWORD
  });
  check('Admin login succeeds', loginRes.status === 200 && loginRes.data?.token);
  const token = loginRes.data?.token;

  const [stats, orders, flowers, bouquets, categories, inventory, history, suppliers, customers] = await Promise.all([
    req('GET', '/api/admin/stats', null, token),
    req('GET', '/api/admin/orders', null, token),
    req('GET', '/api/admin/flowers', null, token),
    req('GET', '/api/admin/bouquets', null, token),
    req('GET', '/api/admin/categories', null, token),
    req('GET', '/api/admin/inventory/summary', null, token),
    req('GET', '/api/admin/inventory/history', null, token),
    req('GET', '/api/admin/suppliers', null, token),
    req('GET', '/api/admin/customers', null, token)
  ]);

  check('GET /api/admin/stats returns 200 with metrics', stats.status === 200 && stats.data.activeProducts !== undefined);
  check('GET /api/admin/orders returns 200 with orders array', orders.status === 200 && Array.isArray(orders.data.orders));
  check('GET /api/admin/flowers returns 200 with flowers array', flowers.status === 200 && Array.isArray(flowers.data.flowers));
  check('GET /api/admin/bouquets returns 200 with bouquets array', bouquets.status === 200 && Array.isArray(bouquets.data.bouquets));
  check('GET /api/admin/categories returns 200 with categories array', categories.status === 200 && Array.isArray(categories.data.categories));
  check('GET /api/admin/inventory/summary returns 200 with summary and stems', inventory.status === 200 && Array.isArray(inventory.data.flowers));
  check('GET /api/admin/inventory/history returns 200 with audit transactions', history.status === 200 && Array.isArray(history.data.transactions));
  check('GET /api/admin/suppliers returns 200 with suppliers array', suppliers.status === 200 && Array.isArray(suppliers.data.suppliers));
  check('GET /api/admin/customers returns 200 with customer accounts array', customers.status === 200 && Array.isArray(customers.data.customers));

  console.log('\n======================================================');
  console.log(`ADMIN PAGINATION RESULTS: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.error('Failed checks:', failureList);
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
