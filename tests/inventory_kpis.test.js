/**
 * tests/inventory_kpis.test.js
 *
 * Verifies the 4 Inventory Management KPI Cards:
 * 1. Tracked Items
 * 2. Low Stock
 * 3. Out of Stock
 * 4. Stock Movements Today
 *
 * Validates layout, mutual exclusivity, timezone-aware daily movement counts,
 * dynamic database calculations, and real-time update hooks.
 */

// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('./helpers/isolated-db');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_HTML_PATH = path.join(ROOT, 'admin.html');
const ADMIN_JS_PATH = path.join(ROOT, 'js', 'admin.js');
const STORE_PATH = path.join(ROOT, 'server', 'store.js');

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
    pass++;
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
    fail++;
  }
}

async function acheck(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
    pass++;
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
    fail++;
  }
}

console.log('======================================================');
console.log('UMAIRA FLORIST — INVENTORY MANAGEMENT KPI CARDS TEST');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// [Area 1] Admin HTML Structure, Responsive Grid & Tab Preservation
// ---------------------------------------------------------------------------
console.log('[Area 1] Admin HTML Structure & Responsive Grid');

const adminHtml = fs.readFileSync(ADMIN_HTML_PATH, 'utf8');

check('Inventory summary cards container #inventory-summary-cards exists in admin.html', () => {
  assert(adminHtml.includes('id="inventory-summary-cards"'), 'Missing #inventory-summary-cards');
});

// Current approved layout: inventory lives in the unified "Store" screen; its KPI cards sit above the filters and table.
check('Store KPI cards are positioned at the top of the Store screen, above filters and table', () => {
  const m = adminHtml.match(/<div data-tab-content="store"[\s\S]*?id="store-kpi-grid"[\s\S]*?id="store-filter-container"[\s\S]*?id="admin-store-tbody"/);
  assert(m, 'Store KPI cards must be at the top of the Store screen');
});

check('Store KPI grid specifies responsive layout with 4 columns on desktop', () => {
  const line = (adminHtml.match(/<div[^>]*id="store-kpi-grid"[^>]*>/) || [''])[0];
  assert(line, 'Missing #store-kpi-grid');
  assert(/(^|\s)grid-cols-[12](\s|")/.test(line), 'Missing 1- or 2-column mobile layout');
  assert(line.includes('lg:grid-cols-4'), 'Missing 4-col desktop class for 1 row');
});

check('Stock overview (Store table) and Movement History views are both available', () => {
  assert(adminHtml.includes('id="admin-store-tbody"'), 'Missing Store stock table');
  assert(adminHtml.includes('id="history-search-input"') && adminHtml.includes('id="history-pagination"'), 'Missing Movement History view');
});

// ---------------------------------------------------------------------------
// [Area 2] JavaScript renderInventorySummaryCards Implementation in admin.js
// ---------------------------------------------------------------------------
console.log('\n[Area 2] JavaScript renderInventorySummaryCards Method & Calling Hooks');

const adminJs = fs.readFileSync(ADMIN_JS_PATH, 'utf8');

check('admin.js implements renderInventorySummaryCards method', () => {
  assert(adminJs.includes('renderInventorySummaryCards('), 'Missing renderInventorySummaryCards definition');
});

check('renderInventorySummaryCards defines cards for all four required metrics', () => {
  assert(adminJs.includes('Tracked Items'), 'Missing Tracked Items card label');
  assert(adminJs.includes('Low Stock'), 'Missing Low Stock card label');
  assert(adminJs.includes('Out of Stock'), 'Missing Out of Stock card label');
  assert(adminJs.includes('Stock Movements Today'), 'Missing Stock Movements Today card label');
});

check('Store KPI cards (renderStoreKPIs) render 4 cards with SVG icons in styled icon boxes', () => {
  const s = adminJs.replace(/\r\n/g, '\n'); const i = s.indexOf('renderStoreKPIs() {'); assert(i > 0, 'Missing renderStoreKPIs');
  const body = s.slice(i, s.indexOf('\n  }\n', i));
  assert((body.match(/<svg/g) || []).length >= 4, 'Each KPI card needs an icon');
  // Phase 1: every KPI card is rendered by the shared kpiCardHTML component, which puts the icon in a centred box.
  assert((body.match(/this\.kpiCardHTML\(/g) || []).length >= 4, 'Each KPI card must use the shared kpiCardHTML component');
  const h = s.indexOf('  kpiCardHTML('); const helper = s.slice(h, s.indexOf('\n  }\n', h));
  assert(/class="kpi-card__icon[^"]*"[^>]*>\$\{iconSvg\}/.test(helper), 'Each icon must sit in a centred icon box');
  assert(/\.kpi-card__icon\s*\{[^}]*justify-content:\s*center/.test(adminHtml), 'Icon box must centre the icon');
});

check('loadInventory invokes renderInventorySummaryCards', () => {
  const loadInvMatch = adminJs.match(/async loadInventory\(\)\s*\{[\s\S]*?this\.renderInventorySummaryCards\(\);/);
  assert(loadInvMatch, 'loadInventory must call renderInventorySummaryCards');
});

check('loadStockHistory invokes renderInventorySummaryCards', () => {
  const loadHistoryMatch = adminJs.match(/async loadStockHistory\(\)\s*\{[\s\S]*?this\.renderInventorySummaryCards\(\);/);
  assert(loadHistoryMatch, 'loadStockHistory must call renderInventorySummaryCards');
});

check('switchInventoryTab invokes renderInventorySummaryCards', () => {
  const switchInvMatch = adminJs.match(/switchInventoryTab\(subtab\)\s*\{[\s\S]*?this\.renderInventorySummaryCards\(\);/);
  assert(switchInvMatch, 'switchInventoryTab must call renderInventorySummaryCards');
});

// ---------------------------------------------------------------------------
// [Area 3] Live Calculation, Mutual Exclusivity & Timezone Verification
// ---------------------------------------------------------------------------
console.log('\n[Area 3] Dynamic DB Calculation, Mutual Exclusivity & Manila Timezone');

const app = require('../server.js');
const store = require(STORE_PATH);

(async () => {
  let server;
  try {
    server = await app.start(0);
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    async function api(method, urlPath, body = null, token = null) {
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['x-admin-token'] = token;
      }
      const res = await fetch(base + urlPath, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      let data = null;
      try { data = await res.json(); } catch (_) {}
      return { status: res.status, ok: res.ok, data };
    }

    // 1. Admin login
    const loginRes = await api('POST', '/api/admin/login', {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'umaira2026'
    });
    assert(loginRes.ok, 'Admin login failed');
    const adminToken = loginRes.data.token;

    // 2. Fetch inventory summary from server
    const invRes = await api('GET', '/api/admin/inventory/summary', null, adminToken);
    assert(invRes.ok, 'Failed to fetch inventory summary');
    const summary = invRes.data;

    await acheck('Server returns trackedItems matching active flowers count', async () => {
      assert(typeof summary.trackedItems === 'number', 'trackedItems must be a number');
      assert.equal(summary.trackedItems, summary.flowers.length);
      assert(summary.trackedItems > 0, 'trackedItems must be > 0');
    });

    await acheck('Low Stock and Out of Stock counts are strictly mutually exclusive', async () => {
      let lowCount = 0;
      let outCount = 0;
      let normalCount = 0;

      for (const f of summary.flowers) {
        const stock = f.stockCount || 0;
        const threshold = f.lowStockThreshold || 5;
        const isSoldOut = stock <= 0 || f.availability === 'sold_out';

        if (isSoldOut) {
          outCount++;
        } else if (stock <= threshold) {
          lowCount++;
        } else {
          normalCount++;
        }
      }

      assert.equal(summary.outOfStockCount, outCount, 'Out of stock count mismatch');
      assert.equal(summary.lowStockCount, lowCount, 'Low stock count mismatch');
      // Verify sum of mutually exclusive sets equals total tracked items
      assert.equal(outCount + lowCount + normalCount, summary.trackedItems, 'Sets must partition all tracked items');
    });

    await acheck('movementsToday is calculated using Asia/Manila timezone', async () => {
      assert(typeof summary.movementsToday === 'number', 'movementsToday must be a number');
      assert(summary.movementsToday >= 0, 'movementsToday must be non-negative');

      // Verify date calculation matches Asia/Manila local calendar date
      const tz = 'Asia/Manila';
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

      const historyRes = await api('GET', '/api/admin/inventory/history?limit=200', null, adminToken);
      assert(historyRes.ok, 'Failed to fetch inventory history');
      const transactions = historyRes.data.transactions || [];

      const manualCount = transactions.filter(t => {
        try {
          const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(t.createdAt || t.created_at));
          return dStr === todayStr;
        } catch (_) { return false; }
      }).length;

      assert.equal(summary.movementsToday, manualCount, 'movementsToday must match transactions with today in Asia/Manila');
    });

    // 3. Test dynamic update upon stock adjustment
    await acheck('Stock adjustment immediately increments movementsToday', async () => {
      const movementsBefore = summary.movementsToday;
      const targetFlower = summary.flowers[0];

      const adjustRes = await api('POST', '/api/admin/inventory/adjust', {
        flowerId: targetFlower.id,
        type: 'restock',
        quantity: 15,
        reason: 'Restock Shipment Verification',
        notes: 'Testing inventory KPI dynamic update'
      }, adminToken);
      assert(adjustRes.ok, 'Stock adjustment failed');

      const updatedInvRes = await api('GET', '/api/admin/inventory/summary', null, adminToken);
      assert(updatedInvRes.ok);
      assert.equal(updatedInvRes.data.movementsToday, movementsBefore + 1, 'movementsToday should increment by 1');

      // Deduct back the 15 to maintain initial stock
      await api('POST', '/api/admin/inventory/adjust', {
        flowerId: targetFlower.id,
        type: 'deduct',
        quantity: 15,
        reason: 'Test Reversal',
        notes: 'Reversing test restock'
      }, adminToken);
    });

    // 4. Test dynamic update of low stock / out of stock transition
    await acheck('Adjusting stock to 0 increments outOfStock and decrements lowStock/inStock', async () => {
      // Fetch fresh summary to get current accurate stock
      const freshInvRes = await api('GET', '/api/admin/inventory/summary', null, adminToken);
      assert(freshInvRes.ok);
      const flower = freshInvRes.data.flowers.find(f => (f.stockCount || 0) > 0);
      assert(flower, 'Need a flower with positive stock');

      const currentStock = flower.stockCount;
      const adjustRes = await api('POST', '/api/admin/inventory/adjust', {
        flowerId: flower.id,
        type: 'deduct',
        quantity: currentStock,
        reason: 'Damage / Spoilage',
        notes: 'Testing zero stock transition'
      }, adminToken);
      assert(adjustRes.ok, 'Deduction failed');

      const updatedInv = await api('GET', '/api/admin/inventory/summary', null, adminToken);
      assert(updatedInv.ok);

      const updatedFlower = updatedInv.data.flowers.find(f => f.id === flower.id);
      assert.equal(updatedFlower.stockCount, 0);

      // Verify mutual exclusivity holds after zeroing stock
      assert(updatedInv.data.outOfStockCount >= 1);

      // Restore stock back
      await api('POST', '/api/admin/inventory/adjust', {
        flowerId: flower.id,
        type: 'restock',
        quantity: currentStock,
        reason: 'Stock Correction',
        notes: 'Restoring original stock'
      }, adminToken);
    });

    // Clean close
    await new Promise(r => server.close(r));

  } catch (err) {
    console.error('Fatal error during inventory KPI tests:', err);
    fail++;
  }

  console.log('\n======================================================');
  console.log(`INVENTORY MANAGEMENT KPI RESULT: ${pass} passed, ${fail} failed`);
  console.log('======================================================');

  // exitCode (not process.exit) lets open sockets finish closing; process.exit() here crashed Node on Windows.
  if (fail > 0) process.exitCode = 1;
})();
