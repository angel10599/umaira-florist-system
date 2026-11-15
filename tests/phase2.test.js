// Umaira Florist — Phase 2 Verification Test Suite
// Covers all 15 scenarios required for Phase 2:
// Inventory Management, Atomic Deduction & Restoration, Concurrency, and Live Storefront Synchronization.

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'phase2testpassword';
process.env.ORDER_RATE_LIMIT = '500';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'umaira-phase2-'));
process.env.UMAIRA_DATA_DIR = tmp;
process.env.UMAIRA_TEST = '1';

const { server, start } = require('../server.js');
const store = require('../server/store.js');

let baseUrl, admToken, custToken, custId;
let passed = 0;
let failed = 0;

function check(label, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label}`, extra || '');
  }
}

function call(method, p, body, token) {
  return new Promise((resolve) => {
    const u = new URL(p, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(u, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let data = {};
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

function validOrderPayload(items, overrides = {}) {
  return {
    orderNumber: '#FLR-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000),
    fulfillment: 'delivery',
    firstName: 'Maria',
    lastName: 'Santos',
    phone: '09171234567',
    email: 'maria@example.com',
    address: '123 Sampaguita St',
    district: 'District I',
    barangay: 'Barangay 1',
    city: 'Manila',
    notes: 'Please handle with care',
    date: require('../js/shop-rules.js').earliestDate('delivery'), // was a fixed date that is now in the past
    time: 'Morning (9:00 AM – 12:00 PM)',
    paymentMethod: 'Cash on Delivery',
    giftMessage: 'Happy Anniversary!',
    items,
    ...overrides
  };
}

async function runPhase2Tests() {
  console.log('\n--- UMAIRA FLORIST PHASE 2 TEST SUITE ---\n');
  await start(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Bootstrap tokens
  const admRes = await call('POST', '/api/admin/login', { username: 'admin', password: 'phase2testpassword' });
  admToken = admRes.data.token;

  const regRes = await call('POST', '/api/auth/register', {
    name: 'Phase2 Customer',
    email: 'phase2@example.com',
    password: 'Password123!',
    phone: '09170001111'
  });
  const verRes = regRes.data?.testOtp
    ? await call('POST', '/api/auth/verify-otp', { email: 'phase2@example.com', otp: regRes.data.testOtp })
    : { data: {} };
  custToken = verRes.data?.token;
  custId = verRes.data?.user?.id;

  // -------------------------------------------------------------------------
  // Scenario 1: Admin adds flower -> appears in /api/catalog
  // -------------------------------------------------------------------------
  console.log('[Scenario 1] Admin adds flower -> appears in /api/catalog');
  const newFlowerId = 'fl-lavender-test';
  const addFlRes = await call('POST', '/api/admin/flowers', {
    id: newFlowerId,
    name: 'French Fragrant Lavender',
    botanicalName: 'Lavandula angustifolia',
    category: 'Exotics',
    price: 180,
    stockCount: 25,
    availability: 'available',
    image: 'https://images.unsplash.com/photo-1528722828814-77b9b83aafb2',
    description: 'Aromatic French lavender stems with soothing floral scent.'
  }, admToken);
  check('Admin can add a new flower', addFlRes.status === 200 && addFlRes.data.flower.id === newFlowerId);

  const cat1 = await call('GET', '/api/catalog');
  const foundInCatalog = (cat1.data.flowers || []).find(f => f.id === newFlowerId);
  check('New flower appears immediately in public /api/catalog', !!foundInCatalog && foundInCatalog.price === 180);

  // -------------------------------------------------------------------------
  // Scenario 2: Admin edits price -> updated in catalog and checkout pricing
  // -------------------------------------------------------------------------
  console.log('[Scenario 2] Admin edits price -> updated in catalog and checkout pricing');
  const editPriceRes = await call('PUT', `/api/admin/flowers/${newFlowerId}`, {
    name: 'French Fragrant Lavender',
    price: 220,
    stockCount: 25,
    availability: 'available'
  }, admToken);
  check('Admin updates flower price in DB', editPriceRes.status === 200 && editPriceRes.data.flower.price === 220);

  const cat2 = await call('GET', '/api/catalog');
  const cat2Flower = cat2.data.flowers.find(f => f.id === newFlowerId);
  check('Catalog reflects new price (₱220)', cat2Flower && cat2Flower.price === 220);

  // Order with tampered client price of ₱50
  const orderTampered = await call('POST', '/api/orders', validOrderPayload([
    { id: newFlowerId, quantity: 2, price: 50 }
  ]), custToken);
  check('Checkout ignores tampered price and charges DB price (2 × ₱220 = ₱440)', orderTampered.status === 201 && orderTampered.data.subtotal === 440, orderTampered.data);

  // -------------------------------------------------------------------------
  // Scenario 3: Admin updates stock -> customer availability updates
  // -------------------------------------------------------------------------
  console.log('[Scenario 3] Admin updates stock -> customer availability updates');
  const stockDownRes = await call('PUT', `/api/admin/flowers/${newFlowerId}`, {
    name: 'French Fragrant Lavender',
    price: 220,
    stockCount: 5,
    availability: 'limited'
  }, admToken);
  check('Stock set to 5 stems', stockDownRes.status === 200 && stockDownRes.data.flower.stockCount === 5);

  const cat3a = await call('GET', '/api/catalog');
  const flowerLimited = cat3a.data.flowers.find(f => f.id === newFlowerId);
  check('Catalog shows availability = limited and stockCount = 5', flowerLimited && flowerLimited.availability === 'limited' && flowerLimited.stockCount === 5);

  const stockZeroRes = await call('PUT', `/api/admin/flowers/${newFlowerId}`, {
    name: 'French Fragrant Lavender',
    price: 220,
    stockCount: 0,
    availability: 'available' // admin passes 'available', but stock 0 forces sold_out
  }, admToken);
  check('Stock 0 forces sold_out', stockZeroRes.status === 200 && stockZeroRes.data.flower.availability === 'sold_out');

  const cat3b = await call('GET', '/api/catalog');
  const flowerSoldOut = cat3b.data.flowers.find(f => f.id === newFlowerId);
  check('Catalog reflects sold_out immediately', flowerSoldOut && flowerSoldOut.availability === 'sold_out');

  // Reset lavender for subsequent tests
  await call('PUT', `/api/admin/flowers/${newFlowerId}`, {
    name: 'French Fragrant Lavender',
    price: 220,
    stockCount: 30,
    availability: 'available'
  }, admToken);

  // -------------------------------------------------------------------------
  // Scenario 4: Predefined bouquet purchase -> flower stem inventory deducted
  // -------------------------------------------------------------------------
  console.log('[Scenario 4] Predefined bouquet purchase -> flower stem inventory deducted');
  // Approved rule: ready-made bouquets have their OWN stock. Ordering one reduces the bouquet's stock only;
  // the flowers/fillers listed in its recipe are not deducted. (Cloud of Love recipe: White Rose + Baby's Breath.)
  await call('PUT', '/api/admin/bouquets/bq-cloud-of-love', { stockCount: 10, availability: 'available' }, admToken);
  const bqBefore = store.getBouquet('bq-cloud-of-love').stockCount;
  const whiteRoseBefore = store.getFlower('fl-white-rose').stockCount;
  const babysBreathBefore = store.getFlower('fil-babys-breath').stockCount;

  const bqOrder = await call('POST', '/api/orders', validOrderPayload([
    { id: 'bq-cloud-of-love', quantity: 2 }
  ]), custToken);
  check('Ready bouquet order placed successfully', bqOrder.status === 201, bqOrder.data && bqOrder.data.error);
  check('Bouquet stock reduced by exactly 2', store.getBouquet('bq-cloud-of-love').stockCount === bqBefore - 2);
  check('Recipe ingredients NOT deducted (White Rose, Baby\'s Breath unchanged)',
    store.getFlower('fl-white-rose').stockCount === whiteRoseBefore && store.getFlower('fil-babys-breath').stockCount === babysBreathBefore);

  // -------------------------------------------------------------------------
  // Scenario 5: Custom bouquet purchase -> flower stem inventory deducted
  // -------------------------------------------------------------------------
  console.log('[Scenario 5] Custom bouquet purchase -> flower stem inventory deducted');
  for (const id of ['fl-red-rose', 'fl-pink-tulip', 'wrp-kraft']) {
    await call('POST', '/api/admin/inventory/adjust', { flowerId: id, type: 'restock', quantity: 30, reason: 'Test setup' }, admToken);
  }
  const redRoseBefore = store.getFlower('fl-red-rose').stockCount;
  const yellowTulipBefore = store.getFlower('fl-pink-tulip').stockCount;

  const customOrder = await call('POST', '/api/orders', validOrderPayload([
    {
      isCustom: true,
      name: 'Artisan Custom Mix',
      quantity: 1,
      specs: {
        mainFlowers: [
          { id: 'fl-red-rose', quantity: 5 },
          { id: 'fl-pink-tulip', quantity: 3 }
        ],
        wrappings: [{ id: 'wrp-kraft' }]
      }
    }
  ]), custToken);
  check('Custom bouquet order placed successfully', customOrder.status === 201, customOrder.data && customOrder.data.error);

  const redRoseAfter = store.getFlower('fl-red-rose').stockCount;
  const yellowTulipAfter = store.getFlower('fl-pink-tulip').stockCount;
  check('Red rose stems deducted by exactly 5', redRoseBefore - redRoseAfter === 5);
  check('Pink tulip stems deducted by exactly 3', yellowTulipBefore - yellowTulipAfter === 3);

  // -------------------------------------------------------------------------
  // Scenario 6: Insufficient stock -> order rejected with clean error, 0 deduction
  // -------------------------------------------------------------------------
  console.log('[Scenario 6] Insufficient stock -> order rejected with clean error, 0 deduction');
  // Set fl-hydrangea stock to 3
  await call('PUT', '/api/admin/flowers/fl-hydrangea', {
    name: 'Blue Hydrangea',
    price: 200,
    stockCount: 3,
    availability: 'limited'
  }, admToken);

  const hydBefore = store.getFlower('fl-hydrangea').stockCount;
  const overOrder = await call('POST', '/api/orders', validOrderPayload([
    { id: 'fl-hydrangea', quantity: 5 } // demands 5, only 3 available
  ]), custToken);
  check('Overselling rejected with 409 or 400', overOrder.status === 409 || overOrder.status === 400);
  check('Error message is customer-friendly', /left in stock|out of stock|sold out|unavailable/i.test(overOrder.data.error));

  const hydAfter = store.getFlower('fl-hydrangea').stockCount;
  check('Zero stems deducted on failed stock check', hydAfter === hydBefore);

  // -------------------------------------------------------------------------
  // Scenario 7: Order cancellation -> inventory restored exactly once
  // -------------------------------------------------------------------------
  console.log('[Scenario 7] Order cancellation -> inventory restored exactly once');
  // Place an order of 3 French Lavenders
  const lavBefore = store.getFlower(newFlowerId).stockCount;
  const lavOrderRes = await call('POST', '/api/orders', validOrderPayload([
    { id: newFlowerId, quantity: 3 }
  ]), custToken);
  const lavOrderNum = lavOrderRes.data.orderNumber;
  check('Lavender order created', lavOrderRes.status === 201);
  check('Lavender stock reduced by 3', store.getFlower(newFlowerId).stockCount === lavBefore - 3);

  // Admin cancels/rejects the order
  const rejectRes = await call('POST', `/api/admin/orders/${encodeURIComponent(lavOrderNum)}/reject`, {
    reason: 'Customer requested cancellation.'
  }, admToken);
  check('Admin rejects order', rejectRes.status === 200);

  const lavRestored = store.getFlower(newFlowerId).stockCount;
  check('Lavender stock fully restored (+3 stems)', lavRestored === lavBefore);

  // -------------------------------------------------------------------------
  // Scenario 8: Repeated cancellation -> no duplicate restoration
  // -------------------------------------------------------------------------
  console.log('[Scenario 8] Repeated cancellation -> no duplicate restoration');
  // Try to reject or cancel again
  const repeatRejectRes = await call('POST', `/api/admin/orders/${encodeURIComponent(lavOrderNum)}/reject`, {
    reason: 'Trying second rejection'
  }, admToken);
  // Status transition is either disallowed (400) or rejected no-op, but stock must NOT increase
  const lavAfterRepeat = store.getFlower(newFlowerId).stockCount;
  check('Repeated cancel/reject does not double-restore stock', lavAfterRepeat === lavRestored);

  // -------------------------------------------------------------------------
  // Scenario 9: Concurrent orders on last stock -> no overselling, transaction rollback
  // -------------------------------------------------------------------------
  console.log('[Scenario 9] Concurrent orders on last stock -> no overselling');
  // Set sunflower stock to exactly 2
  await call('PUT', '/api/admin/flowers/fl-sunflower', {
    name: 'Classic Sunflower',
    price: 130,
    stockCount: 2,
    availability: 'limited'
  }, admToken);

  // Fire 2 concurrent order requests each asking for 2 sunflowers
  const [resA, resB] = await Promise.all([
    call('POST', '/api/orders', validOrderPayload([{ id: 'fl-sunflower', quantity: 2 }]), custToken),
    call('POST', '/api/orders', validOrderPayload([{ id: 'fl-sunflower', quantity: 2 }]), custToken)
  ]);

  const successCount = (resA.status === 201 ? 1 : 0) + (resB.status === 201 ? 1 : 0);
  const failCount = ((resA.status === 400 || resA.status === 409) ? 1 : 0) + ((resB.status === 400 || resB.status === 409) ? 1 : 0);
  check('Exactly one concurrent order succeeded', successCount === 1);
  check('Exactly one concurrent order failed cleanly', failCount === 1);

  const finalSunStock = store.getFlower('fl-sunflower').stockCount;
  check('Remaining sunflower stock is 0 (never negative)', finalSunStock === 0);
  check('Flower automatically transitioned to sold_out', store.getFlower('fl-sunflower').availability === 'sold_out');

  // -------------------------------------------------------------------------
  // Scenario 10: Stale cart price -> server recalculates with current DB price
  // -------------------------------------------------------------------------
  console.log('[Scenario 10] Stale cart price -> server recalculates with current DB price');
  // Set lily price to 195
  await call('PUT', '/api/admin/flowers/fl-white-lily', {
    name: 'White Oriental Lily',
    price: 195,
    stockCount: 40,
    availability: 'available'
  }, admToken);

  // Browser cart has stale price ₱99
  const staleOrder = await call('POST', '/api/orders', validOrderPayload([
    { id: 'fl-white-lily', quantity: 3, price: 99 }
  ]), custToken);
  check('Order placed with server re-pricing', staleOrder.status === 201);
  check('Subtotal matches DB price (3 × ₱195 = ₱585), not stale ₱99', staleOrder.data.subtotal === 585);

  // -------------------------------------------------------------------------
  // Scenario 11: Deleted/archived product -> cannot be ordered
  // -------------------------------------------------------------------------
  console.log('[Scenario 11] Deleted/archived product -> cannot be ordered');
  // Create and archive a flower
  const tempFlId = 'fl-temp-archived';
  await call('POST', '/api/admin/flowers', {
    id: tempFlId,
    name: 'Temporary Flower',
    price: 100,
    stockCount: 50,
    availability: 'available'
  }, admToken);
  const delRes = await call('DELETE', `/api/admin/flowers/${tempFlId}`, undefined, admToken);
  check('Flower archived via admin DELETE', delRes.status === 200 && delRes.data.archived === true);

  const catArchived = await call('GET', '/api/catalog');
  const isPresentInCatalog = (catArchived.data.flowers || []).some(f => f.id === tempFlId);
  check('Archived flower excluded from /api/catalog', !isPresentInCatalog);

  const tryOrderArchived = await call('POST', '/api/orders', validOrderPayload([
    { id: tempFlId, quantity: 1 }
  ]), custToken);
  check('Ordering archived flower rejected with 400', tryOrderArchived.status === 400);

  // -------------------------------------------------------------------------
  // Scenario 12: Successful checkout -> appears in /api/my/orders and admin /api/admin/orders
  // -------------------------------------------------------------------------
  console.log('[Scenario 12] Successful checkout -> appears in /api/my/orders & admin /api/admin/orders');
  const myOrdersRes = await call('GET', '/api/my/orders', undefined, custToken);
  check('Customer can retrieve own orders', myOrdersRes.status === 200 && Array.isArray(myOrdersRes.data.orders));
  const myOrderNumbers = myOrdersRes.data.orders.map(o => o.orderNumber);
  check('Stale order from Scenario 10 is in customer orders', myOrderNumbers.includes(staleOrder.data.orderNumber));

  const admOrdersRes = await call('GET', '/api/admin/orders', undefined, admToken);
  check('Admin can retrieve all orders', admOrdersRes.status === 200 && Array.isArray(admOrdersRes.data.orders));
  const admOrderNumbers = admOrdersRes.data.orders.map(o => o.orderNumber);
  check('Order is visible to administrator', admOrderNumbers.includes(staleOrder.data.orderNumber));

  // -------------------------------------------------------------------------
  // Scenario 13: Failed checkout -> inventory untouched
  // -------------------------------------------------------------------------
  console.log('[Scenario 13] Failed checkout -> inventory untouched');
  const carnationBefore = store.getFlower('fl-pink-carnation').stockCount;
  // Missing required address and invalid district
  const badOrder = await call('POST', '/api/orders', validOrderPayload([
    { id: 'fl-pink-carnation', quantity: 4 }
  ], { district: 'InvalidDistrict', address: '' }), custToken);
  check('Invalid order payload rejected with 400', badOrder.status === 400);
  const carnationAfter = store.getFlower('fl-pink-carnation').stockCount;
  check('Carnation stock remains completely untouched', carnationAfter === carnationBefore);

  // -------------------------------------------------------------------------
  // Scenario 14: Catalog API failure handling on client
  // -------------------------------------------------------------------------
  console.log('[Scenario 14] Catalog API failure handling on client');
  // Test StateManager error resilience in a simulated node vm
  const vm = require('vm');
  const clientCtx = vm.createContext({
    window: { addEventListener: () => {} },
    document: { addEventListener: () => {}, visibilityState: 'visible' },
    console,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    fetch: async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' })
    }),
    SHOP_RULES: require('../js/shop-rules.js'),
    FLOWER_DATA: { mainFlowers: [], featuredBouquets: [] }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'state.js'), 'utf8'), clientCtx);
  let catalogChangeFired = false;
  clientCtx.appState.on('catalog_change', () => { catalogChangeFired = true; });
  const loadOk = await clientCtx.appState.loadCatalog();
  check('loadCatalog returns false gracefully on 500 error', loadOk === false);
  check('appState.catalogError is set to true', clientCtx.appState.catalogError === true);
  check('appState.catalogReady is set to true', clientCtx.appState.catalogReady === true);
  check('catalog_change event was triggered for UI retry banner', catalogChangeFired === true);

  // -------------------------------------------------------------------------
  // Scenario 15: Phase 1 auth & security regression checks still pass
  // -------------------------------------------------------------------------
  console.log('[Scenario 15] Phase 1 auth & security regression checks');
  // Unauthenticated order rejected
  const guestOrder = await call('POST', '/api/orders', validOrderPayload([{ id: 'fl-red-rose', quantity: 1 }]));
  check('Unauthenticated guest order rejected with 401', guestOrder.status === 401);

  // Admin stats route blocked for customer
  const custStats = await call('GET', '/api/admin/stats', undefined, custToken);
  check('Admin stats blocked for customer with 401', custStats.status === 401);

  // Cross-customer order privacy
  const reg2 = await call('POST', '/api/auth/register', {
    name: 'Customer Two',
    email: 'cust2@example.com',
    password: 'Password123!',
    phone: '09172223333'
  });
  const ver2 = reg2.data?.testOtp
    ? await call('POST', '/api/auth/verify-otp', { email: 'cust2@example.com', otp: reg2.data.testOtp })
    : { data: {} };
  const crossOrderRes = await call('GET', `/api/orders/${encodeURIComponent(staleOrder.data.orderNumber)}`, undefined, ver2.data?.token);
  check('Other customer cannot view another customer order (404/403)', crossOrderRes.status === 404);

  // Cleanup
  server.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}

  console.log(`\n========================================`);
  console.log(`PHASE 2 RESULT: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runPhase2Tests().catch((e) => {
  console.error('Test suite runner crashed:', e);
  process.exit(1);
});
