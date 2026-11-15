/**
 * UMAIRA FLORIST — REPORTS OVERVIEW & PDF GENERATION TEST SUITE
 * Tests backend reports aggregation, date filtering, inventory health,
 * UI components, chart containers, and PDF generation logic.
 */

// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('./helpers/isolated-db');
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');

let baseUrl;
let pass = 0;
let fail = 0;

function check(label, condition, extra) {
  if (condition) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.error(`  FAIL ${label}`, extra !== undefined ? extra : '');
  }
}

async function acheck(label, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ok   ${label}`);
  } catch (err) {
    fail++;
    console.error(`  FAIL ${label}`);
    console.error('      ', err.message);
  }
}

function api(method, p, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-admin-token'] = token;
    }
    const payload = body !== null && body !== undefined ? JSON.stringify(body) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const r = http.request(u, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data, json, raw: data });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  console.log('\n======================================================');
  console.log('UMAIRA FLORIST — REPORTS & PDF GENERATION TEST SUITE');
  console.log('======================================================\n');

  const { start } = require('../server.js');
  const s = await start(0);
  const port = s.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ------------------------------------------------------------------
    // [Area 1] Admin HTML Structure & Layout
    // ------------------------------------------------------------------
    console.log('[Area 1] Reports Overview UI & Navigation Architecture');
    const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');

    check('Reports navigation item defined in sidebar (data-tab-nav="reports")',
      adminHtml.includes('data-tab-nav="reports"')
    );

    check('Dedicated Reports screen container defined (data-tab-content="reports")',
      adminHtml.includes('data-tab-content="reports"')
    );

    check('Prominent "Generate Report" button present in upper header',
      adminHtml.includes('openGenerateReportModal()') &&
      adminHtml.includes('Generate Report')
    );

    check('All 4 essential KPI card containers exist',
      adminHtml.includes('id="reports-kpi-revenue"') &&
      adminHtml.includes('id="reports-kpi-orders"') &&
      adminHtml.includes('id="reports-kpi-products"') &&
      adminHtml.includes('id="reports-kpi-aov"')
    );

    check('Global Date Range Filter toolbar present with quick options',
      adminHtml.includes('data-reports-range="today"') &&
      adminHtml.includes('data-reports-range="last7days"') &&
      adminHtml.includes('data-reports-range="last30days"') &&
      adminHtml.includes('data-reports-range="custom"') &&
      adminHtml.includes('id="reports-custom-range-box"')
    );

    check('Sales Performance interactive chart canvas present (#reports-sales-chart)',
      adminHtml.includes('id="reports-sales-chart"')
    );

    check('Order Distribution chart canvas present (#reports-distribution-chart)',
      adminHtml.includes('id="reports-distribution-chart"')
    );

    check('Best-Selling Products table present (#reports-bestsellers-tbody)',
      adminHtml.includes('id="reports-bestsellers-tbody"') && adminHtml.includes('id="reports-bestsellers-empty"')
    );

    check('Inventory Health snapshot section and alerts table present',
      adminHtml.includes('id="reports-inv-instock"') &&
      adminHtml.includes('id="reports-inv-low"') &&
      adminHtml.includes('id="reports-inv-out"') &&
      adminHtml.includes('id="reports-inventory-tbody"') &&
      adminHtml.includes('id="reportsInventory-pagination"')
    );

    check('Recent Transactions compact table and pagination container present',
      adminHtml.includes('id="reports-transactions-tbody"') &&
      adminHtml.includes('id="reportsTransactions-pagination"')
    );

    check('Generate Report Modal defined with report types & PDF options',
      adminHtml.includes('id="admin-report-modal"') &&
      adminHtml.includes('id="report-modal-type"') &&
      adminHtml.includes('id="report-modal-range"') &&
      adminHtml.includes('id="report-format-pdf"') && adminHtml.includes('id="report-format-csv"') &&
      adminHtml.includes('handleGenerateReport(event)')
    );

    check('PDF Preview Modal defined with iframe viewer (#admin-pdf-preview-modal)',
      adminHtml.includes('id="admin-pdf-preview-modal"') &&
      adminHtml.includes('id="admin-pdf-preview-iframe"')
    );

    check('Chart.js and jsPDF libraries loaded via CDN in admin.html',
      adminHtml.includes('chart.umd.min.js') &&
      adminHtml.includes('jspdf.umd.min.js') &&
      adminHtml.includes('jspdf.plugin.autotable')
    );

    check('js/report-pdf.js script included in admin.html',
      adminHtml.includes('src="js/report-pdf.js"')
    );

    // ------------------------------------------------------------------
    // [Area 2] Client-Side JavaScript Methods (admin.js & report-pdf.js)
    // ------------------------------------------------------------------
    console.log('\n[Area 2] JavaScript Reports Engine & PDF Module');
    const adminJs = fs.readFileSync(path.join(__dirname, '../js/admin.js'), 'utf8');
    const reportPdfJs = fs.readFileSync(path.join(__dirname, '../js/report-pdf.js'), 'utf8');

    check('admin.js implements loadReportsData method', adminJs.includes('loadReportsData('));
    check('admin.js implements setReportsDateRange method', adminJs.includes('setReportsDateRange('));
    check('admin.js implements toggleReportsCustomRange and applyReportsCustomRange',
      adminJs.includes('toggleReportsCustomRange(') && adminJs.includes('applyReportsCustomRange(')
    );
    check('admin.js implements renderReportsKPIs method', adminJs.includes('renderReportsKPIs('));
    check('admin.js implements renderReportsCharts method', adminJs.includes('renderReportsCharts('));
    check('admin.js implements renderReportsInventoryHealth method', adminJs.includes('renderReportsInventoryHealth('));
    check('admin.js implements renderReportsTransactionsTable method', adminJs.includes('renderReportsTransactionsTable('));
    check('admin.js registers reportsTransactions pagination with 6-row pageSize',
      adminJs.includes('reportsTransactions: { page: 1, pageSize: ROWS_PER_PAGE }')
    );
    check('admin.js implements openGenerateReportModal and PDF/CSV generation',
      adminJs.includes('openGenerateReportModal(') && adminJs.includes('handleGenerateReport(') &&
      adminJs.includes('_downloadPDFReport(') && adminJs.includes('handleGenerateCSVReport(')
    );
    check('report-pdf.js defines window.ReportPDFGenerator module',
      reportPdfJs.includes('window.ReportPDFGenerator = ReportPDFGenerator;')
    );
    check('report-pdf.js supports all 5 required report types',
      reportPdfJs.includes('_renderCompleteBusinessReport') &&
      reportPdfJs.includes('_renderSalesReport') &&
      reportPdfJs.includes('_renderOrdersReport') &&
      reportPdfJs.includes('_renderProductsReport') &&
      reportPdfJs.includes('_renderInventoryReport')
    );
    check('report-pdf.js uses approved Umaira Florist Atelier color palette',
      reportPdfJs.includes('burgundy: [138, 21, 53]') &&
      reportPdfJs.includes('softPeach: [246, 216, 207]') &&
      reportPdfJs.includes('softIvory: [250, 243, 237]')
    );

    // ------------------------------------------------------------------
    // [Area 3] Live API Reports Endpoint & Data Calculations
    // ------------------------------------------------------------------
    console.log('\n[Area 3] Live Backend Reports Data & Calculation Verification');

    // 1. Security: Guest blocked
    await acheck('Guest is blocked from accessing /api/admin/reports/data', async () => {
      const res = await api('GET', '/api/admin/reports/data');
      assert.equal(res.status, 401, 'Guest must receive 401 Unauthorized');
    });

    // 2. Admin Login
    const loginRes = await api('POST', '/api/admin/login', {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'umaira2026'
    });
    assert(loginRes.ok, 'Admin login failed');
    const token = loginRes.json.token;

    // 3. Fetch default reports data (Last 7 Days)
    const defRes = await api('GET', '/api/admin/reports/data', null, token);
    assert(defRes.ok, 'Failed to fetch default reports data');
    const defData = defRes.json;

    await acheck('GET /api/admin/reports/data returns complete structured response', async () => {
      assert(defData.ok === true, 'Response ok must be true');
      assert.equal(defData.range, 'last7days');
      assert(defData.startDate, 'startDate must be defined');
      assert(defData.endDate, 'endDate must be defined');
      assert(defData.kpis, 'kpis object must be defined');
      assert(Array.isArray(defData.salesPerformance), 'salesPerformance must be an array');
      assert(defData.orderDistribution, 'orderDistribution must be defined');
      assert(Array.isArray(defData.bestSellers), 'bestSellers must be an array');
      assert(Array.isArray(defData.recentTransactions), 'recentTransactions must be an array');
      assert(defData.inventoryHealth, 'inventoryHealth must be defined');
    });

    await acheck('Four KPI cards contain valid numerical metrics', async () => {
      const k = defData.kpis;
      assert(typeof k.totalRevenue === 'number' && k.totalRevenue >= 0, 'totalRevenue must be >= 0');
      assert(typeof k.totalOrders === 'number' && k.totalOrders >= 0, 'totalOrders must be >= 0');
      assert(typeof k.productsSold === 'number' && k.productsSold >= 0, 'productsSold must be >= 0');
      assert(typeof k.averageOrderValue === 'number' && k.averageOrderValue >= 0, 'averageOrderValue must be >= 0');
    });

    await acheck('Revenue calculations exclude cancelled/refunded orders', async () => {
      const k = defData.kpis;
      // Net Revenue should not include cancelled orders
      assert.equal(k.totalRevenue + k.cancelledAmount, k.grossSales, 'Gross sales must equal net revenue + cancelled amount');
      assert(k.cancelledAmount >= 0, 'cancelledAmount must be non-negative');
    });

    await acheck('Date range filter "today" returns matching single-day window', async () => {
      const todayRes = await api('GET', '/api/admin/reports/data?range=today', null, token);
      assert(todayRes.ok);
      const d = todayRes.json;
      assert.equal(d.range, 'today');
      assert.equal(d.startDate, d.endDate, 'Start date and end date must match for "today"');
      // Today is charted by hour (several buckets within the one day), not as a single daily bucket.
      assert(Array.isArray(d.salesPerformance) && d.salesPerformance.length >= 1, 'Today must have at least one bucket');
    });

    await acheck('Date range filter "thismonth" returns current month window', async () => {
      const monthRes = await api('GET', '/api/admin/reports/data?range=thismonth', null, token);
      assert(monthRes.ok);
      const d = monthRes.json;
      assert.equal(d.range, 'thismonth');
      assert(d.startDate.endsWith('-01'), 'Month start date must start on 1st');
      // Month-to-date: from the 1st up to today (Asia/Manila), one bucket per day so far.
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      assert.equal(d.startDate, today.slice(0, 8) + '01', 'Month start must be the 1st of the current month');
      assert.equal(d.endDate, today, 'Month window must end today');
      assert.equal(d.salesPerformance.length, Number(today.slice(8, 10)), 'One daily bucket per day so far this month');
    });

    await acheck('Custom date range query filters accurately', async () => {
      const customRes = await api('GET', '/api/admin/reports/data?range=custom&startDate=2026-10-01&endDate=2026-10-15', null, token);
      assert(customRes.ok);
      const d = customRes.json;
      assert.equal(d.startDate, '2026-10-01');
      assert.equal(d.endDate, '2026-10-15');
      assert.equal(d.salesPerformance.length, 15, '15-day range must produce 15 daily buckets');
    });

    await acheck('Inventory health is real-time and independent of sales date range', async () => {
      const inv = defData.inventoryHealth;
      assert(typeof inv.trackedItems === 'number' && inv.trackedItems > 0, 'trackedItems must be > 0');
      assert(typeof inv.lowStockCount === 'number', 'lowStockCount must be a number');
      assert(typeof inv.outOfStockCount === 'number', 'outOfStockCount must be a number');
      assert(Array.isArray(inv.alertItems), 'alertItems must be an array');
      // Low stock and out of stock are mutually exclusive
      const alertIds = new Set(inv.alertItems.map(i => i.id));
      assert.equal(alertIds.size, inv.alertItems.length, 'No duplicate alert items');
    });

    await acheck('Best-selling products are ranked by quantity descending', async () => {
      const monthRes = await api('GET', '/api/admin/reports/data?range=thismonth', null, token);
      const best = monthRes.json.bestSellers;
      assert(best.length <= 5, 'Must limit to top 5 products');
      for (let i = 0; i < best.length - 1; i++) {
        assert(best[i].quantity >= best[i + 1].quantity, 'Items must be sorted descending by quantity');
      }
    });

  } catch (err) {
    console.error('Fatal error during Reports test execution:', err);
    fail++;
  } finally {
    // Graceful close
    await new Promise((r) => s.close(r));
  }

  console.log('\n======================================================');
  console.log(`REPORTS & PDF TEST RESULT: ${pass} passed, ${fail} failed`);
  console.log('======================================================');

  if (fail > 0) {
    process.exit(1);
  }
})();
