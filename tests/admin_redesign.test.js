// Umaira Florist — Admin Dashboard Redesign Test Suite
// Verifies 6-screen navigation architecture, accurate dashboard metrics,
// inventory valuation & stock adjustments, supplier management,
// category management, shop settings persistence, and stock audit logging.

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'RedesignAdmin2026!';
process.env.ORDER_RATE_LIMIT = '1000';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'umaira-redesign-'));
process.env.UMAIRA_DATA_DIR = tmp;
process.env.UMAIRA_TEST = '1';

const { server, start } = require('../server.js');
const store = require('../server/store.js');
// GCash is offered only once the shop has a GCash QR code (Shop Settings → Payment Accounts); set a test one.
store.saveSettings({ payment: { gcash: { accountName: 'Test Shop GCash', number: '09170000000', qrImage: '/assets/uploads/0123456789abcdef0123.png' } } });
const rules = require('../js/shop-rules.js');

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
  console.log('UMAIRA FLORIST — ADMIN DASHBOARD REDESIGN TEST SUITE');
  console.log('======================================================\n');

  const s = await start(0);
  const port = s.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Log in as admin
  const loginRes = await req('POST', '/api/admin/login', {
    username: 'admin',
    password: process.env.ADMIN_PASSWORD
  });
  check('Admin login succeeded', loginRes.status === 200 && loginRes.data && loginRes.data.token);
  const adminToken = loginRes.data?.token;

  // Create a customer for order verification
  const custReg = await req('POST', '/api/auth/register', {
    name: 'Teresa Admin Tester',
    email: 'teresa.tester@example.com',
    password: 'Password123!',
    phone: '09171234567'
  });
  const custVerify = custReg.data?.testOtp
    ? await req('POST', '/api/auth/verify-otp', { email: 'teresa.tester@example.com', otp: custReg.data.testOtp })
    : { status: 0, data: null };
  check('Customer registration succeeded', custReg.status === 200 && custVerify.status === 201 && !!custVerify.data?.token);
  const customerToken = custVerify.data?.token;

  // ------------------------------------------------------------------
  // [Area 1] Navigation Architecture & Template Integrity
  // ------------------------------------------------------------------
  console.log('\n[Area 1] Navigation Architecture & 6-Item Sidebar Integrity');
  const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');

  // Verify exactly 6 primary sidebar navigation items
  const navMatches = adminHtml.match(/data-tab-nav="([^"]+)"/g) || [];
  const primaryTabs = navMatches.map(m => m.replace(/data-tab-nav="|"$/g, '')).filter(t =>
    // Current approved layout: Products + Inventory merged into one "Store" screen; Reports is a primary section.
    ['dashboard', 'orders', 'store', 'suppliers', 'reports', 'settings'].includes(t)
  );
  const uniquePrimaryTabs = [...new Set(primaryTabs)];
  check('Sidebar defines all 6 primary sections', uniquePrimaryTabs.length === 6, uniquePrimaryTabs);
  check('Exactly 6 primary tab buttons in navigation', primaryTabs.length === 6, primaryTabs);

  // Store Management replaced the Products sub-tabs: one table filtered by category/occasion/stock, plus category management.
  check('Store Management has one product table with category, occasion, stock and sort filters',
    ['admin-store-tbody', 'store-category-filter', 'store-occasion-filter', 'store-stock-filter', 'store-sort-filter']
      .every(id => adminHtml.includes(`id="${id}"`)));

  // Stock overview lives in the Store table; movement history has its own searchable, paginated view.
  check('Stock movement history view present (search + pagination)',
    adminHtml.includes('id="history-search-input"') && adminHtml.includes('id="history-pagination"'));

  // Check backward-compatibility IDs
  check('Preserves #admin-stats-grid for stats cards', adminHtml.includes('id="admin-stats-grid"'));
  check('Preserves #admin-orders-tbody for orders table', adminHtml.includes('id="admin-orders-tbody"'));
  check('Store table body #admin-store-tbody present (flowers, materials and bouquets)', adminHtml.includes('id="admin-store-tbody"'));
  check('Preserves customer search/filter inputs for directory integration',
    adminHtml.includes('id="customers-search-input"') &&
    adminHtml.includes('id="customers-filter-auth"') &&
    adminHtml.includes('id="customers-sort"')
  );
  check('Preserves #admin-customer-modal', adminHtml.includes('id="admin-customer-modal"'));
  check('Preserves image upload controls and previews',
    adminHtml.includes('id="flower-image-preview"') &&
    adminHtml.includes('id="flower-file-input"') &&
    adminHtml.includes('id="bouquet-image-preview"') &&
    adminHtml.includes('id="bouquet-file-input"')
  );

  // ------------------------------------------------------------------
  // [Area 2] Endpoint Access Control
  // ------------------------------------------------------------------
  console.log('\n[Area 2] Admin Redesign Endpoint Access Control');
  const endpoints = [
    ['GET', '/api/admin/inventory/summary'],
    ['GET', '/api/admin/inventory/history'],
    ['POST', '/api/admin/inventory/adjust', { flowerId: 'fl-rose-red', type: 'correction', quantity: 10, reason: 'Test' }],
    ['GET', '/api/admin/suppliers'],
    ['POST', '/api/admin/suppliers', { name: 'Test Supplier', phone: '09123456789' }],
    ['GET', '/api/admin/categories'],
    ['POST', '/api/admin/categories', { name: 'Test Cat', type: 'flower' }],
    ['GET', '/api/admin/settings'],
    ['PUT', '/api/admin/settings', { store: { name: 'Test' } }]
  ];

  for (const [m, ep, b] of endpoints) {
    const unauth = await req(m, ep, b, null);
    check(`Guest blocked from ${m} ${ep} (401)`, unauth.status === 401);
    const cust = await req(m, ep, b, customerToken);
    check(`Customer blocked from ${m} ${ep} (401)`, cust.status === 401);
  }

  // ------------------------------------------------------------------
  // [Area 3] Dashboard Statistics Calculation
  // ------------------------------------------------------------------
  console.log('\n[Area 3] Dashboard Metrics & Inventory Valuation');
  const statsRes = await req('GET', '/api/admin/stats', null, adminToken);
  check('Stats endpoint returns 200 for admin', statsRes.status === 200);
  const stats = statsRes.data;
  check('Stats include pendingOrders count', typeof stats?.pendingOrders === 'number');
  check('Stats include activeOrders (in-progress) count', typeof stats?.activeOrders === 'number');
  check('Stats include completedOrdersToday count', typeof stats?.completedOrdersToday === 'number');
  check('Stats include salesToday revenue', typeof stats?.salesToday === 'number');
  check('Stats include activeProducts count', typeof stats?.activeProducts === 'number' && stats.activeProducts > 0);
  check('Stats include lowStock items', Array.isArray(stats?.lowStock) || typeof stats?.lowStock === 'number');
  check('Stats include estimated inventoryValuation', typeof stats?.inventoryValuation === 'number' && stats.inventoryValuation > 0);
  check('Stats include valuationStatus ("complete" or "partial")', stats?.valuationStatus && (stats.valuationStatus === 'complete' || stats.valuationStatus.startsWith('partial')));

  // ------------------------------------------------------------------
  // [Area 4] Inventory Stock Adjustments & Movement Audit Log
  // ------------------------------------------------------------------
  console.log('\n[Area 4] Inventory Stock Adjustments & Audit Trail');
  const invSummary = await req('GET', '/api/admin/inventory/summary', null, adminToken);
  check('Inventory summary returns flowers array', invSummary.status === 200 && Array.isArray(invSummary.data?.flowers));
  const testFlower = invSummary.data.flowers.find(f => f.id === 'fl-rose-red' || f.id === 'fl-red-rose') || invSummary.data.flowers[0];
  const targetFlowerId = testFlower ? testFlower.id : 'fl-rose-red';
  check('Flower has unitCost and valuation', testFlower && typeof testFlower.unitCost === 'number' && typeof testFlower.valuation === 'number');

  const stockBefore = testFlower.stockCount;
  // Test Restock adjustment
  const restockRes = await req('POST', '/api/admin/inventory/adjust', {
    flowerId: targetFlowerId,
    type: 'restock',
    quantity: 25,
    reason: 'Weekly Fresh Batch Delivery',
    supplierId: 'sup-benguet',
    unitCost: 65,
    notes: 'Received in crisp condition'
  }, adminToken);

  check('Restock adjustment succeeded (200)', restockRes.status === 200 && restockRes.data?.ok);
  check('New stock equals before + 25', restockRes.data?.stockCount === stockBefore + 25);

  // Test Damage adjustment
  const damageRes = await req('POST', '/api/admin/inventory/adjust', {
    flowerId: targetFlowerId,
    type: 'damage',
    quantity: 3,
    reason: 'Water bucket leakage',
    notes: 'Wilting on lower stems'
  }, adminToken);
  check('Damage deduction succeeded (200)', damageRes.status === 200 && damageRes.data?.ok);
  check('New stock equals previous - 3', damageRes.data?.stockCount === stockBefore + 25 - 3);

  // Test Oversell / Excessive deduction prevention
  const excessiveRes = await req('POST', '/api/admin/inventory/adjust', {
    flowerId: targetFlowerId,
    type: 'damage',
    quantity: 9999,
    reason: 'Invalid excessive deduction'
  }, adminToken);
  check('Excessive stock reduction rejected (400)', excessiveRes.status === 400);

  // Verify Audit Log / Movement History
  const historyRes = await req('GET', '/api/admin/inventory/history', null, adminToken);
  check('Stock history returns transactions array', historyRes.status === 200 && Array.isArray(historyRes.data?.transactions));
  const recentTx = historyRes.data.transactions[0];
  check('Most recent transaction is the damage adjustment', recentTx && recentTx.flowerId === targetFlowerId && recentTx.type === 'damage');
  check('Transaction records adminUsername', recentTx && recentTx.adminUsername === 'admin');
  check('Transaction records previousStock and newStock accurately',
    recentTx && recentTx.previousStock === stockBefore + 25 && recentTx.newStock === stockBefore + 25 - 3
  );

  // ------------------------------------------------------------------
  // [Area 5] Supplier Management (CRUD & Toggle)
  // ------------------------------------------------------------------
  console.log('\n[Area 5] Supplier Management CRUD & Toggle');
  const supList = await req('GET', '/api/admin/suppliers', null, adminToken);
  check('Suppliers endpoint returns list', supList.status === 200 && Array.isArray(supList.data?.suppliers));
  check('Includes seeded suppliers', supList.data.suppliers.some(s => s.id === 'sup-benguet'));

  // Create new supplier
  const addSupRes = await req('POST', '/api/admin/suppliers', {
    name: 'Tagaytay Highland Blooms Co.',
    contactPerson: 'Mateo Santos',
    phone: '0918-999-8888',
    email: 'orders@tagaytayblooms.ph',
    address: 'Brgy. Sungay West, Tagaytay City, Cavite',
    suppliedFlowers: 'Hydrangeas, Sunflowers, Asters',
    notes: 'Direct farm morning harvest delivery'
  }, adminToken);
  check('Create supplier succeeded (201)', addSupRes.status === 201 && addSupRes.data?.supplier?.id);
  const newSupId = addSupRes.data?.supplier?.id;

  // Retrieve single supplier
  const getSupRes = await req('GET', `/api/admin/suppliers/${newSupId}`, null, adminToken);
  check('Retrieve single supplier succeeded (200)', getSupRes.status === 200 && getSupRes.data?.supplier?.name === 'Tagaytay Highland Blooms Co.');

  // Update supplier
  const updateSupRes = await req('PUT', `/api/admin/suppliers/${newSupId}`, {
    name: 'Tagaytay Highland Blooms & Foliage Co.',
    contactPerson: 'Mateo Santos',
    phone: '0918-999-7777',
    address: 'Brgy. Sungay West, Tagaytay City, Cavite'
  }, adminToken);
  check('Update supplier succeeded (200)', updateSupRes.status === 200 && updateSupRes.data?.supplier?.name.includes('& Foliage'));

  // Toggle supplier inactive
  const toggleOffRes = await req('POST', `/api/admin/suppliers/${newSupId}/toggle`, { isActive: false }, adminToken);
  check('Toggle supplier inactive succeeded (200)', toggleOffRes.status === 200 && toggleOffRes.data?.supplier?.active === false);

  // Toggle supplier active
  const toggleOnRes = await req('POST', `/api/admin/suppliers/${newSupId}/toggle`, { isActive: true }, adminToken);
  check('Toggle supplier active succeeded (200)', toggleOnRes.status === 200 && toggleOnRes.data?.supplier?.active === true);

  // ------------------------------------------------------------------
  // [Area 6] Category Management (CRUD & Protection)
  // ------------------------------------------------------------------
  console.log('\n[Area 6] Category Management CRUD & Protection');
  const catList = await req('GET', '/api/admin/categories', null, adminToken);
  check('Categories endpoint returns categories list', catList.status === 200 && Array.isArray(catList.data?.categories));
  check('Categories include flower and bouquet types',
    catList.data.categories.some(c => c.type === 'flower') &&
    catList.data.categories.some(c => c.type === 'bouquet')
  );

  // Add new category
  const addCatRes = await req('POST', '/api/admin/categories', {
    name: 'Exotic Tropicals',
    type: 'flower',
    description: 'Rare tropical flowers sourced from Mindanao and South America.'
  }, adminToken);
  check('Create category succeeded (201)', addCatRes.status === 201 && addCatRes.data?.category?.id);
  const newCatId = addCatRes.data?.category?.id;

  // Update category
  const updateCatRes = await req('PUT', `/api/admin/categories/${newCatId}`, {
    name: 'Exotic Island Tropicals',
    type: 'flower',
    description: 'Rare tropical cuts from Mindanao and Palawan.'
  }, adminToken);
  check('Update category succeeded (200)', updateCatRes.status === 200 && updateCatRes.data?.category?.name === 'Exotic Island Tropicals');

  // Deactivate category with no products assigned
  const delCatRes = await req('DELETE', `/api/admin/categories/${newCatId}`, null, adminToken);
  check('Deactivate empty category succeeded (200)', delCatRes.status === 200);

  // Attempt to deactivate active category that has flowers (e.g. Roses)
  const rosesCat = catList.data.categories.find(c => c.name.toLowerCase().includes('rose'));
  if (rosesCat) {
    const delRosesRes = await req('DELETE', `/api/admin/categories/${rosesCat.id}`, null, adminToken);
    check('Deactivating category with active products is safely rejected (400)', delRosesRes.status === 400);
  }

  // ------------------------------------------------------------------
  // [Area 7] Shop Settings Persistence
  // ------------------------------------------------------------------
  console.log('\n[Area 7] Shop Settings Persistence in SQLite');
  const getSettingsRes = await req('GET', '/api/admin/settings', null, adminToken);
  check('Get settings returns 200', getSettingsRes.status === 200);
  const currentSettings = getSettingsRes.data?.settings;
  check('Settings include store, delivery, pickup, and hours blocks',
    currentSettings?.store && currentSettings?.delivery && currentSettings?.pickup && currentSettings?.hours
  );

  // Update shop settings
  const newSettingsPayload = {
    store: {
      name: 'Umaira Florist & Botanical Atelier',
      tagline: 'Artisan Floral Creations & Premium Stems',
      phone: '+63 917 555 0199',
      email: 'concierge@umairaflorist.com',
      address: '142 Valero Street, Salcedo Village, Makati City, Metro Manila',
      mapsUrl: 'https://maps.google.com/?q=Salcedo+Village+Makati'
    },
    delivery: {
      defaultFee: 160,
      freeDeliveryThreshold: 2800,
      coverage: 'Makati, BGC, Taguig, Ortigas, San Juan, Quezon City, Manila',
      leadTimeHours: 3
    },
    pickup: {
      address: '142 Valero Street, Salcedo Village, Makati City',
      instructions: 'Curbside or Concierge Desk Pickup (Bay 2)',
      readyTimeMinutes: 45
    },
    hours: {
      monFri: '7:30 AM – 8:30 PM',
      satSun: '8:00 AM – 7:00 PM',
      sameDayCutoff: '3:00 PM',
      specialNotice: 'Special holiday arrangements available by preorder.'
    }
  };

  const updateSettingsRes = await req('PUT', '/api/admin/settings', newSettingsPayload, adminToken);
  check('Update settings succeeded (200)', updateSettingsRes.status === 200);

  // Verify persistence on fresh GET
  const verifySettingsRes = await req('GET', '/api/admin/settings', null, adminToken);
  const persisted = verifySettingsRes.data?.settings;
  check('Store name updated in DB', persisted?.store?.name === 'Umaira Florist & Botanical Atelier');
  check('Delivery fee updated to 160', persisted?.delivery?.defaultFee === 160);
  check('Free delivery threshold updated to 2800', persisted?.delivery?.freeDeliveryThreshold === 2800);
  check('Pickup ready time updated to 45', persisted?.pickup?.readyTimeMinutes === 45);
  check('Operating hours updated', persisted?.hours?.sameDayCutoff === '3:00 PM');

  // ------------------------------------------------------------------
  // [Area 8] Stock Movements Integrated with Order Lifecycle
  // ------------------------------------------------------------------
  console.log('\n[Area 8] Stock Transaction Logging on Order Placement & Cancellation');
  // Current catalog id for White Lily; a fresh catalog starts at 0 stock, so stock it first (temporary test DB only).
  store.adjustStock({ flowerId: 'fl-white-lily', type: 'restock', quantity: 10, reason: 'Test setup', adminUsername: 'admin' });
  const lilyBefore = store.getFlower('fl-white-lily').stockCount;

  // Place valid order for 2 white lilies
  const orderRes = await req('POST', '/api/orders', {
    fulfillment: 'delivery',
    firstName: 'Teresa',
    lastName: 'Tester',
    phone: '09171234567',
    email: 'teresa.tester@example.com',
    address: '12 Rizal Avenue, Unit 4',
    district: '3',
    barangay: 'Barangay 300',
    city: 'Manila',
    date: rules.earliestDate ? rules.earliestDate('delivery') : new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
    time: rules.deliverySlots[0],
    paymentMethod: 'GCash',
    items: [{ id: 'fl-white-lily', quantity: 2 }]
  }, customerToken);

  const orderNumber = orderRes.data?.orderNumber || orderRes.data?.order?.orderNumber;
  check('Customer order placed (201)', orderRes.status === 201 && !!orderNumber);

  const lilyAfterOrder = store.getFlower('fl-white-lily').stockCount;
  check('Stock decremented by 2 stems', lilyAfterOrder === lilyBefore - 2);

  // Check that stock_transactions logged the order fulfillment
  const txHistoryAfterOrder = store.listStockTransactions({ flowerId: 'fl-white-lily', limit: 5 });
  const fulfillmentTx = txHistoryAfterOrder.find(t => t.type === 'order_fulfillment' && t.orderNumber === orderNumber);
  check('Order placement logged "order_fulfillment" in stock_transactions', !!fulfillmentTx);
  check('Fulfillment transaction recorded quantity -2', fulfillmentTx && fulfillmentTx.quantityChange === -2);

  // Admin rejects / cancels order with reason
  const rejectRes = await req('POST', `/api/admin/orders/${encodeURIComponent(orderNumber)}/reject`, {
    reason: 'Customer requested cancellation for pickup schedule'
  }, adminToken);
  check('Admin cancel order succeeded (200)', rejectRes.status === 200);

  const lilyAfterCancel = store.getFlower('fl-white-lily').stockCount;
  check('Flower stock restored to initial count (+2 stems)', lilyAfterCancel === lilyBefore);

  // Check that stock_transactions logged the restoration
  const txHistoryAfterCancel = store.listStockTransactions({ flowerId: 'fl-white-lily', limit: 5 });
  const restorationTx = txHistoryAfterCancel.find(t => t.type === 'order_restoration' && t.orderNumber === orderNumber);
  check('Order cancellation logged "order_restoration" in stock_transactions', !!restorationTx);
  check('Restoration transaction recorded quantity +2', restorationTx && restorationTx.quantityChange === 2);

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`ADMIN REDESIGN RESULTS: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failureList.length > 0) {
    console.error('Failed checks:');
    failureList.forEach(f => console.error(` - ${f}`));
    process.exit(1);
  } else {
    process.exit(0);
  }
})().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
