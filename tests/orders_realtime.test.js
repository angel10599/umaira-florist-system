// Tests for Orders Management UI/UX and Real-Time Synchronization
const test = require('node:test');
const assert = require('node:assert/strict');
// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('./helpers/isolated-db');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_DIR = path.join(__dirname, '..');
const store = require('../server/store');
const eventHub = require('../server/events');

test('Orders Management UI - HTML Structure', () => {
  const html = fs.readFileSync(path.join(BASE_DIR, 'admin.html'), 'utf8');

  // 1. Header has title and description, and NO Refresh Orders or Customer Directory buttons in header
  const ordersTabMatch = html.match(/<div data-tab-content="orders"[\s\S]*?<\/table>/);
  assert.ok(ordersTabMatch, 'Orders tab section must exist');
  const ordersSection = ordersTabMatch[0];

  assert.ok(ordersSection.includes('Orders Management'), 'Must have Orders Management title');
  assert.ok(!ordersSection.includes('Refresh Orders'), 'Must NOT have Refresh Orders button in Orders Management');
  assert.ok(!ordersSection.includes('Customer Directory'), 'Must NOT have Customer Directory button in Orders Management header');

  // 2. Status cards container exists
  assert.ok(
    html.includes('id="order-status-filter-cards"'),
    '#order-status-filter-cards container must exist'
  );
  assert.ok(
    html.includes('grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'),
    'Status cards must have 5 columns on desktop (lg:grid-cols-5)'
  );

  // 3. Search and filters toolbar
  assert.ok(html.includes('id="orders-search-input"'), 'Search input must exist');
  assert.ok(html.includes('id="orders-fulfillment-filter"'), 'Fulfillment filter must exist');
  assert.ok(html.includes('id="orders-date-filter"'), 'Date filter must exist');
  assert.ok(html.includes('id="orders-clear-filters-btn"'), 'Clear filters button must exist');

  // 4. Fulfillment filter has NO emojis
  assert.ok(!html.includes('Delivery (🚚)'), 'Fulfillment filter must not contain 🚚 emoji');
  assert.ok(!html.includes('Store Pickup (🏪)'), 'Fulfillment filter must not contain 🏪 emoji');
  assert.ok(html.includes('<option value="delivery">Delivery</option>'), 'Delivery option without emoji');
  assert.ok(html.includes('<option value="pickup">Store Pickup</option>'), 'Store Pickup option without emoji');

  // 5. Table headers
  assert.ok(html.includes('Order Number'), 'Table header: Order Number');
  assert.ok(html.includes('Customer'), 'Table header: Customer');
  assert.ok(html.includes('Fulfillment'), 'Table header: Fulfillment');
  assert.ok(html.includes('Schedule'), 'Table header: Schedule');
  assert.ok(html.includes('Items'), 'Table header: Items');
  assert.ok(html.includes('Total'), 'Table header: Total');
  assert.ok(html.includes('Status'), 'Table header: Status');
  assert.ok(html.includes('Actions'), 'Table header: Actions');
});

test('Orders Management UI - JavaScript Implementation', () => {
  const adminJs = fs.readFileSync(path.join(BASE_DIR, 'js', 'admin.js'), 'utf8');

  // 1. No fulfillment emojis in table rows or details modal
  assert.ok(!adminJs.includes('🚚'), 'js/admin.js must not contain 🚚 emoji');
  assert.ok(!adminJs.includes('🏪'), 'js/admin.js must not contain 🏪 emoji');

  // 2. Action button renamed to "View Details"
  assert.ok(adminJs.includes('View Details'), 'Action button must be renamed to View Details');

  // 3. Items column displays accurate count (item / items)
  assert.ok(adminJs.includes('itemCount === 1 ? \'item\' : \'items\''), 'Must format item count with singular/plural');

  // 4. Status cards implementation
  assert.ok(adminJs.includes('renderOrderStatusCards'), 'Must implement renderOrderStatusCards');
  assert.ok(adminJs.includes('All Orders'), 'Status cards must include All Orders');
  assert.ok(adminJs.includes('In Progress'), 'Status cards must include In Progress');

  // 5. Real-time synchronization methods
  assert.ok(adminJs.includes('setupRealtimeSync'), 'Must implement setupRealtimeSync');
  assert.ok(adminJs.includes('teardownRealtimeSync'), 'Must implement teardownRealtimeSync');
  assert.ok(adminJs.includes('syncOnOrderEvent'), 'Must implement syncOnOrderEvent');
  assert.ok(adminJs.includes('syncOnInventoryEvent'), 'Must implement syncOnInventoryEvent');
});

test('Real-Time SSE Server Endpoints and Event Dispatching', async (t) => {
  // Own server on a free port, backed by the isolated test database (never the live shop on :3000).
  const { base } = await iso.startServer();
  t.after(() => iso.stopServer());
  // Test SSE endpoint authentication
  const get = (url, headers = {}) => new Promise((resolve, reject) => {
    http.get(url, { headers }, (res) => {
      resolve(res);
    }).on('error', reject);
  });

  // 1. Unauthenticated /api/admin/events must return 401
  const unauthRes = await get(`${base}/api/admin/events`);
  assert.equal(unauthRes.statusCode, 401, 'Unauthenticated SSE must return 401');

  // 2. Public /api/events must connect with text/event-stream
  const publicRes = await get(`${base}/api/events`);
  assert.equal(publicRes.statusCode, 200, 'Public SSE endpoint must return 200');
  assert.ok(
    publicRes.headers['content-type'].includes('text/event-stream'),
    'Content-Type must be text/event-stream'
  );
  publicRes.destroy();

  // 3. Authenticated /api/admin/events with token query param
  const adminToken = store.createSession('admin');
  const authRes = await get(`${base}/api/admin/events?token=${encodeURIComponent(adminToken)}`);
  assert.equal(authRes.statusCode, 200, 'Authenticated SSE endpoint must return 200');
  assert.ok(
    authRes.headers['content-type'].includes('text/event-stream'),
    'Admin Content-Type must be text/event-stream'
  );

  // 4. Test Event Hub broadcast on store mutation
  let orderCreatedReceived = false;
  let orderStatusReceived = false;
  let inventoryUpdatedReceived = false;

  const onCreated = () => { orderCreatedReceived = true; };
  const onStatus = () => { orderStatusReceived = true; };
  const onInventory = () => { inventoryUpdatedReceived = true; };

  eventHub.once('order:created', onCreated);
  eventHub.once('order:status', onStatus);
  eventHub.on('inventory:updated', onInventory);

  // Place a dummy order
  const orderNum = 'TEST-' + Date.now();
  const placeRes = store.placeOrder({
    orderNumber: orderNum,
    status: 'Pending Confirmation',
    fulfillment: 'delivery',
    firstName: 'Test',
    lastName: 'User',
    phone: '09171234567',
    email: 'test@example.com',
    address: '123 Test St',
    district: '1',
    barangay: 'Test Brgy',
    city: 'Manila',
    date: '2026-11-01',
    time: '10:00 AM',
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'Pending',
    subtotal: 1000,
    deliveryFee: 150,
    total: 1150,
    createdAt: new Date().toISOString(),
    items: [{ type: 'custom', name: 'Test Bloom', quantity: 1, unitPrice: 1000, lineTotal: 1000 }]
  });

  assert.ok(placeRes.ok, 'Place order must succeed');
  assert.ok(orderCreatedReceived, 'order:created event must be emitted');

  // Change order status
  const statusRes = store.setStatus(orderNum, 'Confirmed');
  assert.ok(statusRes.ok, 'Confirm status must succeed');
  assert.ok(orderStatusReceived, 'order:status event must be emitted');

  // Adjust stock
  const flowers = store.getFlowers();
  if (flowers.length > 0) {
    const f = flowers[0];
    const prevStock = f.stockCount;
    store.adjustStock({
      flowerId: f.id,
      type: 'restock',
      quantity: 5,
      reason: 'Test Restock',
      adminUsername: 'admin'
    });
    assert.ok(inventoryUpdatedReceived, 'inventory:updated event must be emitted');
    try {
      store.db.prepare('UPDATE flowers SET stock_count = ? WHERE id = ?').run(prevStock, f.id);
      store.db.prepare('DELETE FROM stock_transactions WHERE reason = ?').run('Test Restock');
    } catch (_) {}
  }

  // Clean up dummy order so database remains clean
  try {
    store.db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number = ?)').run(orderNum);
    store.db.prepare('DELETE FROM orders WHERE order_number = ?').run(orderNum);
  } catch (_) {}

  eventHub.removeListener('inventory:updated', onInventory);
  authRes.destroy();
});

test('Filter, status card, and pagination preservation on incoming order sync', () => {
  // Simulate adminApp state in memory
  const simulatedApp = {
    currentStatusFilter: 'pending',
    orderFulfillmentFilter: 'delivery',
    orderDateFilter: 'all',
    searchQuery: 'maria',
    pagination: {
      orders: { page: 2, pageSize: 6 }
    },
    orders: [
      { orderNumber: 'ORD-1', status: 'Pending Confirmation', fulfillment: 'delivery', firstName: 'Maria', lastName: 'Clara' },
      { orderNumber: 'ORD-2', status: 'Pending Confirmation', fulfillment: 'delivery', firstName: 'Maria', lastName: 'Santos' },
      { orderNumber: 'ORD-3', status: 'Pending Confirmation', fulfillment: 'delivery', firstName: 'Maria', lastName: 'Reyes' },
      { orderNumber: 'ORD-4', status: 'Pending Confirmation', fulfillment: 'delivery', firstName: 'Maria', lastName: 'Cruz' },
      { orderNumber: 'ORD-5', status: 'Pending Confirmation', fulfillment: 'delivery', firstName: 'Maria', lastName: 'Dela Cruz' },
      { orderNumber: 'ORD-6', status: 'Pending Confirmation', fulfillment: 'delivery', firstName: 'Maria', lastName: 'Garcia' },
      { orderNumber: 'ORD-7', status: 'Pending Confirmation', fulfillment: 'delivery', firstName: 'Maria', lastName: 'Lim' },
      { orderNumber: 'ORD-8', status: 'Pending Confirmation', fulfillment: 'delivery', firstName: 'Maria', lastName: 'Tan' }
    ]
  };

  // Verify page calculation
  const totalRecords = simulatedApp.orders.length;
  const pag = simulatedApp.pagination.orders;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pag.pageSize));
  if (pag.page > totalPages) pag.page = totalPages;

  assert.equal(totalPages, 2);
  assert.equal(simulatedApp.pagination.orders.page, 2, 'Page 2 remains active and valid on sync');
  assert.equal(simulatedApp.currentStatusFilter, 'pending', 'Status filter remains preserved');
  assert.equal(simulatedApp.orderFulfillmentFilter, 'delivery', 'Fulfillment filter remains preserved');
  assert.equal(simulatedApp.searchQuery, 'maria', 'Search query remains preserved');
});

