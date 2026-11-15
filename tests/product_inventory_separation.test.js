/**
 * tests/product_inventory_separation.test.js
 *
 * Dedicated verification suite for UMAIRA FLORIST — PRODUCT & INVENTORY MANAGEMENT IMPROVEMENTS
 * Verifies the complete separation between Product Catalog Management and Stock/Inventory Management.
 */

// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('./helpers/isolated-db');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_HTML = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
const ADMIN_JS = fs.readFileSync(path.join(ROOT, 'js', 'admin.js'), 'utf8');

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
console.log('UMAIRA FLORIST — PRODUCT & INVENTORY SEPARATION TESTS');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// Section 1: Product Management (Catalog Management)
// ---------------------------------------------------------------------------
console.log('[Section 1] Product Management — Catalog Management');

check('Store Management header displays title, subtitle, Categories and Add Item buttons', () => {
  assert(ADMIN_HTML.includes('>Store Management<'), 'Missing Store Management title');
  assert(ADMIN_HTML.includes('Manage bouquets, fresh stems, packaging, and catalog inventory.'), 'Header subtitle should describe the catalog and inventory');
  assert(ADMIN_HTML.includes('openCategoryManageModal()'), 'Missing Categories button');
  assert(ADMIN_HTML.includes('openUnifiedItemModal()'), 'Missing Add Item button');
});

check('Four informational Store KPI cards exist and are not clickable', () => {
  assert(ADMIN_HTML.includes('id="store-kpi-grid"'), 'Missing #store-kpi-grid');
  const body = (() => { const s = ADMIN_JS.replace(/\r\n/g, '\n'); const i = s.indexOf('renderStoreKPIs() {'); return i < 0 ? '' : s.slice(i, s.indexOf('\n  }\n', i)); })();
  for (const card of ['Card 1: Total Bouquets', 'Card 2: Inventory Items', 'Card 3: Low Stock', 'Card 4: Out of Stock']) assert(body.includes(card), 'Missing KPI ' + card);
  assert(!ADMIN_JS.includes('filterByKPI'), 'KPI cards should be informational only without click filtering');
});

check('Search and Filters: one toolbar with search, category, occasion, stock status, sort and Clear Filters', () => {
  for (const id of ['store-search-input', 'store-category-filter', 'store-occasion-filter', 'store-stock-filter', 'store-sort-filter', 'store-clear-filters-btn'])
    assert(ADMIN_HTML.includes('id="' + id + '"'), 'Missing #' + id);
});

check('Store table defines Item, Category, Price, Stock / Availability and Actions columns', () => {
  const theadHtml = (() => { const i = ADMIN_HTML.indexOf('id="admin-store-tbody"'); const t = ADMIN_HTML.lastIndexOf('<thead', i); return t < 0 ? '' : ADMIN_HTML.slice(t, i); })();
  for (const col of ['Item', 'Category', 'Price', 'Stock / Availability', 'Actions']) assert(theadHtml.includes(col), 'Missing ' + col + ' column');
});

check('Product modal edits stock with an adjustment reason (changes are logged as stock movements)', () => {
  assert(ADMIN_HTML.includes('id="admin-product-modal"'), 'Missing #admin-product-modal');
  assert(ADMIN_HTML.includes('id="product-field-name"') && ADMIN_HTML.includes('id="product-field-price"'), 'Missing name/price fields');
  assert(ADMIN_HTML.includes('id="product-field-stock"'), 'Missing stock field');
  assert(ADMIN_HTML.includes('id="product-field-adj-reason"'), 'Missing stock adjustment reason');
});

// ---------------------------------------------------------------------------
// Section 2: Inventory Management (Stock Control)
// ---------------------------------------------------------------------------
console.log('\n[Section 2] Inventory Management — Stock Control');

check('Stock movements can be recorded from the Store screen (Record Stock Movement modal)', () => {
  assert(ADMIN_HTML.includes('id="admin-stock-modal"'), 'Missing #admin-stock-modal');
  assert(ADMIN_JS.includes('openStockAdjustModal('), 'Missing openStockAdjustModal');
});

check('Inventory health is summarised in the Store KPIs (low stock and out of stock)', () => {
  const body = (() => { const s = ADMIN_JS.replace(/\r\n/g, '\n'); const i = s.indexOf('renderStoreKPIs() {'); return i < 0 ? '' : s.slice(i, s.indexOf('\n  }\n', i)); })();
  assert(body.includes('Card 3: Low Stock') && body.includes('Card 4: Out of Stock'), 'Missing low/out-of-stock KPIs');
  assert(body.includes('getGlobalLowStockThreshold') || ADMIN_JS.includes('const globalTh = this.getGlobalLowStockThreshold()'), 'Low stock must use the Shop Settings threshold');
});

check('Stock overview (Store table) and Stock Movement History are both available', () => {
  assert(ADMIN_HTML.includes('id="admin-store-tbody"'), 'Missing Store stock table');
  assert(ADMIN_HTML.includes('id="admin-stock-history-tbody"') && ADMIN_HTML.includes('id="history-pagination"'), 'Missing Movement History view');
});

check('Stock overview shows each item with its category and stock / availability', () => {
  const theadHtml = (() => { const i = ADMIN_HTML.indexOf('id="admin-store-tbody"'); const t = ADMIN_HTML.lastIndexOf('<thead', i); return t < 0 ? '' : ADMIN_HTML.slice(t, i); })();
  assert(theadHtml.includes('Item') && theadHtml.includes('Category') && theadHtml.includes('Stock / Availability'), 'Store table must show item, category and stock');
});

check('Stock Overview actions include View History and Adjust Stock', () => {
  assert(ADMIN_JS.includes('viewItemHistory('), 'Missing viewItemHistory helper');
  assert(ADMIN_JS.includes('openStockAdjustModal('), 'Missing openStockAdjustModal helper');
});

check('Stock Movement History Table has 8 specified columns', () => {
  const theadMatch = ADMIN_HTML.match(/<thead[\s\S]*?id="admin-stock-history-tbody"/);
  assert(theadMatch, 'Missing stock history thead');
  const theadHtml = theadMatch[0];
  assert(theadHtml.includes('Date &amp; Time'), 'Missing Date & Time column');
  assert(theadHtml.includes('Item / Material'), 'Missing Item / Material column');
  assert(theadHtml.includes('Movement Type'), 'Missing Movement Type column');
  assert(theadHtml.includes('Quantity Change'), 'Missing Quantity Change column');
  assert(theadHtml.includes('Previous Stock'), 'Missing Previous Stock column');
  assert(theadHtml.includes('New Stock'), 'Missing New Stock column');
  assert(theadHtml.includes('Reason / Reference'), 'Missing Reason / Reference column');
  assert(theadHtml.includes('Recorded By'), 'Missing Recorded By column');
});

check('Record Stock Movement Modal includes live preview, type switching, reasons and validation', () => {
  assert(ADMIN_HTML.includes('id="admin-stock-modal"'), 'Missing #admin-stock-modal');
  assert(ADMIN_HTML.includes('id="stock-field-flower"'), 'Missing flower select');
  assert(ADMIN_HTML.includes('id="stock-field-type"'), 'Missing movement type select');
  assert(ADMIN_HTML.includes('id="stock-field-quantity"'), 'Missing quantity input');
  assert(ADMIN_HTML.includes('id="stock-field-reason-select"'), 'Missing reason select');
  assert(ADMIN_HTML.includes('id="stock-preview-box"'), 'Missing stock preview box');
  assert(ADMIN_JS.includes('handleStockTypeChange('), 'Missing handleStockTypeChange');
  assert(ADMIN_JS.includes('Opening Stock'), 'Reasons should support Opening Stock');
  assert(ADMIN_JS.includes('Strict validation against negative stock balances'), 'Strict validation comment should exist');
  assert(ADMIN_JS.includes('Confirm Stock Movement'), 'Confirmation modal dialog should exist');
});

// ---------------------------------------------------------------------------
// Section 3: Live Integration & Synchronization
// ---------------------------------------------------------------------------
console.log('\n[Section 3] Live Database & API Synchronization');

function api(method, urlPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...(token ? { 'Cookie': `admin_token=${token}`, 'x-admin-token': token } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: json });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

let TEST_PORT = 0; // own server on a free port with the isolated test database (never the live shop)
(async () => {
  try {
    TEST_PORT = (await iso.startServer()).port;
    // 1. Authenticate as Admin
    const loginRes = await api('POST', '/api/admin/login', {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'umaira2026'
    });
    assert(loginRes.ok, 'Failed to log in as admin');
    const adminToken = loginRes.data.token;

    // 2. Fetch an existing flower
    const flowersRes = await api('GET', '/api/admin/flowers', null, adminToken);
    assert(flowersRes.ok && flowersRes.data.flowers.length > 0, 'Could not retrieve flowers');
    const flower = flowersRes.data.flowers[0];
    const initialStock = flower.stockCount;

    // 3. Test Product Catalog Update: Editing product info MUST preserve existing stock
    await acheck('Product catalog edit preserves existing stock count without resetting', async () => {
      const editRes = await api('POST', '/api/admin/flowers', {
        id: flower.id,
        name: flower.name,
        price: flower.price,
        category: flower.category,
        availability: 'available',
        description: flower.description,
        unitOfMeasure: flower.unitOfMeasure
        // Note: stockCount is intentionally omitted, simulating product modal save
      }, adminToken);

      assert(editRes.ok, 'Failed to update flower catalog');
      assert.equal(editRes.data.flower.stockCount, initialStock, `Stock count should remain ${initialStock}, got ${editRes.data.flower.stockCount}`);
    });

    // 4. Test Stock Movement: Negative balance prevention
    await acheck('Strict validation prevents deducting more than current stock', async () => {
      const deductRes = await api('POST', '/api/admin/inventory/adjust', {
        flowerId: flower.id,
        type: 'deduct',
        quantity: initialStock + 500, // Exceeds available stock
        reason: 'Damage / Spoilage'
      }, adminToken);

      assert.equal(deductRes.status, 400, 'Over-deduction should return 400 Bad Request');
      assert(deductRes.data.error.includes('stock is only'), 'Error should specify insufficient stock');
    });

    // 5. Test Stock Movement: Restock / Stock In records audit trail
    await acheck('Stock In successfully updates available stock and logs transaction', async () => {
      const addQty = 10;
      const restockRes = await api('POST', '/api/admin/inventory/adjust', {
        flowerId: flower.id,
        type: 'restock',
        quantity: addQty,
        reason: 'Opening Stock (Product Initialization)',
        notes: 'Verification test'
      }, adminToken);

      assert(restockRes.ok, 'Failed to record restock movement');
      assert.equal(restockRes.data.previousStock, initialStock, 'Previous stock should match initial');
      assert.equal(restockRes.data.newStock, initialStock + addQty, 'New stock should reflect addition');

      // Verify transaction in stock history
      const histRes = await api('GET', '/api/admin/inventory/history?limit=10', null, adminToken);
      assert(histRes.ok, 'Failed to fetch stock history');
      const latest = histRes.data.transactions[0];
      assert.equal(latest.flowerId, flower.id, 'Latest transaction should match tested flower');
      assert.equal(latest.type, 'restock', 'Transaction type should be restock');
      assert.equal(latest.quantityChange, addQty, 'Transaction quantity change should be +10');

      // Revert test addition to keep DB clean
      await api('POST', '/api/admin/inventory/adjust', {
        flowerId: flower.id,
        type: 'deduct',
        quantity: addQty,
        reason: 'Test Cleanup'
      }, adminToken);
    });

    console.log('\n======================================================');
    console.log(`TEST SUITE FINISHED: ${pass} passed, ${fail} failed`);
    console.log('======================================================');
    process.exitCode = fail > 0 ? 1 : 0;
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    iso.stopServer();
  }
})();
