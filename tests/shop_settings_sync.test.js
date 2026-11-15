// Dedicated Settings Sync & 24/7 Ordering Integration Test
const os = require('os'), fs = require('fs'), path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'umaira-settings-test-'));
process.env.UMAIRA_DATA_DIR = tmp;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'Test-Admin-Pass-1';
process.env.ORDER_RATE_LIMIT = '1000';
process.env.UMAIRA_TEST = '1';

const app = require('../server.js');
const store = require('../server/store');
const rules = require('../js/shop-rules.js');

let base, pass = 0, fail = 0;
const failures = [];

async function call(method, p, body, token, hdr = {}) {
  const r = await fetch(base + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...hdr
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data;
  const t = await r.text();
  try { data = JSON.parse(t); } catch (e) { data = t; }
  return { status: r.status, data, headers: r.headers };
}

function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ok   ' + name);
  } else {
    fail++;
    failures.push(name);
    console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''));
  }
}

function orderBody(items, over = {}) {
  const date = rules.earliestDate ? rules.earliestDate('delivery') : new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  return {
    fulfillment: 'delivery',
    firstName: 'Maria',
    lastName: 'Santos',
    phone: '09171234567',
    email: 'maria@example.com',
    address: '12 Rizal Avenue, Unit 4',
    district: '3',
    barangay: 'Barangay 300',
    city: 'Manila',
    notes: '',
    date,
    time: rules.deliverySlots[0],
    paymentMethod: 'GCash',
    giftMessage: 'Happy Birthday!',
    items,
    ...over
  };
}

(async () => {
  const server = await app.start(0);
  base = 'http://127.0.0.1:' + server.address().port;

  console.log('\n--- 1. Store Information Sync ---');
  // Login as admin via /api/admin/login
  let r = await call('POST', '/api/admin/login', { username: 'admin', password: 'Test-Admin-Pass-1' });
  const adminToken = r.data.token;
  check('Admin login succeeded', r.status === 200 && !!adminToken);

  // Update store info
  const newStore = {
    name: 'Umaira Floral Atelier & Boutique',
    tagline: 'Luxury Art of Floristry',
    phone: '+63 999 888 7777',
    email: 'atelier@umairaflorist.ph',
    address: 'Unit 102 High Street, Bonifacio Global City, Taguig',
    description: 'Bespoke floristry crafted with timeless beauty.'
  };

  r = await call('PUT', '/api/admin/settings', { store: newStore }, adminToken);
  check('Settings updated by admin', r.status === 200 && r.data.ok);

  // Verify GET /api/catalog reflects new store info
  r = await call('GET', '/api/catalog');
  check('Catalog exposes updated store name', r.data.store?.name === newStore.name, r.data.store?.name);
  check('Catalog exposes updated store address', r.data.store?.address === newStore.address);
  check('Catalog exposes updated store phone', r.data.store?.phone === newStore.phone);
  check('Catalog exposes updated store email', r.data.store?.email === newStore.email);

  // Verify GET /api/settings
  r = await call('GET', '/api/settings');
  check('Public /api/settings returns new store info', r.data.store?.name === newStore.name);

  console.log('\n--- 2. Delivery Fee & Free Delivery Threshold Sync ---');
  // Register a customer (OTP flow: register → verify-otp)
  const custRegRes = await call('POST', '/api/auth/register', { name: 'Customer Test', email: 'cust@example.com', password: 'password123', phone: '09171234567' });
  const custVerRes = custRegRes.data?.testOtp
    ? await call('POST', '/api/auth/verify-otp', { email: 'cust@example.com', otp: custRegRes.data.testOtp })
    : { status: 0, data: null };
  const custToken = custVerRes.data?.token;
  check('Customer registered', custRegRes.status === 200 && custVerRes.status === 201 && !!custToken);

  // Test Case A: Default fee 150 with threshold 2500
  // bq-pink-romance is 780 * 2 = 1560 < 2500 => deliveryFee should be 150
  await call('PUT', '/api/admin/settings', {
    delivery: { fee: 150, freeThreshold: 2500, enabled: true, coverage: 'Metro Manila' }
  }, adminToken);

  let orderData = orderBody([{ id: 'bq-pink-romance', quantity: 2 }]);
  r = await call('POST', '/api/orders', orderData, custToken);
  check('Order with subtotal 1560 < 2500 incurs 150 fee', r.status === 201 && r.data.deliveryFee === 150, r.data);

  // Test Case B: Increase threshold to 5000 and fee to 200
  await call('PUT', '/api/admin/settings', {
    delivery: { fee: 200, freeThreshold: 5000, enabled: true }
  }, adminToken);

  // bq-pink-romance 780 * 4 = 3120 < 5000 => deliveryFee should be 200
  orderData = orderBody([{ id: 'bq-pink-romance', quantity: 4 }]);
  r = await call('POST', '/api/orders', orderData, custToken);
  check('Order with subtotal 3120 < 5000 incurs new 200 fee', r.status === 201 && r.data.deliveryFee === 200, r.data);

  // Test Case C: Lower threshold to 1500 -> Same order (subtotal 3120 >= 1500) gets free delivery
  await call('PUT', '/api/admin/settings', {
    delivery: { fee: 200, freeThreshold: 1500, enabled: true }
  }, adminToken);

  orderData = orderBody([{ id: 'bq-pink-romance', quantity: 4 }]);
  r = await call('POST', '/api/orders', orderData, custToken);
  check('Order with subtotal 3120 >= 1500 gets free delivery (0)', r.status === 201 && r.data.deliveryFee === 0, r.data);

  // Test Case D: Store Pickup is ALWAYS 0 delivery fee regardless of subtotal
  const pickupDate = rules.earliestDate ? rules.earliestDate('pickup') : new Date().toISOString().slice(0, 10);
  const pickupSlots = rules.availablePickupSlots ? rules.availablePickupSlots(pickupDate) : rules.pickupSlots(pickupDate);
  const pickupTime = (pickupSlots && pickupSlots.length > 0) ? pickupSlots[0].label : '9:00 AM – 11:00 AM';

  orderData = orderBody([{ id: 'fl-rose-red', quantity: 1 }], {
    fulfillment: 'pickup',
    address: '',
    paymentMethod: 'Cash on Pickup',
    time: pickupTime,
    date: pickupDate
  });
  r = await call('POST', '/api/orders', orderData, custToken);
  check('Store pickup deliveryFee is strictly 0', r.status === 201 && r.data.deliveryFee === 0, r.data);

  console.log('\n--- 3. Fulfillment Toggles (Enable/Disable Delivery & Pickup) ---');
  // Disable delivery
  await call('PUT', '/api/admin/settings', {
    delivery: { enabled: false }
  }, adminToken);

  orderData = orderBody([{ id: 'fl-rose-red', quantity: 1 }], { fulfillment: 'delivery' });
  r = await call('POST', '/api/orders', orderData, custToken);
  check('Delivery order rejected when delivery is disabled', r.status === 400 && /unavailable/i.test(r.data.error), r.data.error);

  // Pickup should still succeed
  orderData = orderBody([{ id: 'fl-rose-red', quantity: 1 }], {
    fulfillment: 'pickup',
    address: '',
    paymentMethod: 'Cash on Pickup',
    time: pickupTime,
    date: pickupDate
  });
  r = await call('POST', '/api/orders', orderData, custToken);
  check('Pickup order succeeds when delivery is disabled', r.status === 201, r.data);

  // Disable pickup, re-enable delivery
  await call('PUT', '/api/admin/settings', {
    delivery: { enabled: true },
    pickup: { enabled: false }
  }, adminToken);

  orderData = orderBody([{ id: 'fl-rose-red', quantity: 1 }], {
    fulfillment: 'pickup',
    address: '',
    paymentMethod: 'Cash on Pickup',
    time: pickupTime,
    date: pickupDate
  });
  r = await call('POST', '/api/orders', orderData, custToken);
  check('Pickup order rejected when pickup is disabled', r.status === 400 && /unavailable/i.test(r.data.error), r.data.error);

  // Re-enable pickup
  await call('PUT', '/api/admin/settings', {
    pickup: { enabled: true }
  }, adminToken);

  console.log('\n--- 4. Operating Hours & 24/7 Online Ordering ---');
  // When acceptingOrders is true, orders are accepted 24/7
  orderData = orderBody([{ id: 'fl-rose-red', quantity: 1 }], { fulfillment: 'delivery' });
  r = await call('POST', '/api/orders', orderData, custToken);
  check('Order placed successfully (24/7 online ordering)', r.status === 201 && r.data.status === 'Pending Confirmation', r.data);

  // Pause online ordering (acceptingOrders = false)
  await call('PUT', '/api/admin/settings', {
    hours: { acceptingOrders: false }
  }, adminToken);

  r = await call('POST', '/api/orders', orderData, custToken);
  check('Order rejected with 403 when acceptingOrders is false', r.status === 403 && /paused/i.test(r.data.error), r.data.error);

  // Re-enable online ordering
  await call('PUT', '/api/admin/settings', {
    hours: { acceptingOrders: true }
  }, adminToken);

  r = await call('POST', '/api/orders', orderData, custToken);
  check('Order accepted again when acceptingOrders is true', r.status === 201, r.data);

  console.log('\n--- 5. Custom Builder Stem Limits & Validation ---');
  // Configure custom builder: minStems = 3, maxStems = 10
  await call('PUT', '/api/admin/settings', {
    custom_builder: { minStems: 3, maxStems: 10 }
  }, adminToken);

  // Check catalog exposed limits
  r = await call('GET', '/api/catalog');
  check('Catalog exposes customBuilder minStems (3)', r.data.customBuilder?.minStems === 3, r.data.customBuilder?.minStems);
  check('Catalog exposes customBuilder maxStems (10)', r.data.customBuilder?.maxStems === 10, r.data.customBuilder?.maxStems);

  // Custom bouquet with 2 stems (below min of 3)
  const tooFewCustom = {
    isCustom: true,
    name: 'Custom Mini',
    quantity: 1,
    specs: {
      mainFlowers: [{ id: 'fl-rose-red', quantity: 2 }],
      wrapping: 'wrp-kraft',
      ribbon: 'rbn-beige-jute'
    }
  };
  r = await call('POST', '/api/orders', orderBody([tooFewCustom]), custToken);
  check('Custom bouquet with too few stems (< 3) rejected', r.status === 400 && /stem/i.test(r.data.error), r.data.error);

  // Custom bouquet with 12 stems (above max of 10)
  const tooManyCustom = {
    isCustom: true,
    name: 'Custom Huge',
    quantity: 1,
    specs: {
      mainFlowers: [{ id: 'fl-rose-red', quantity: 12 }],
      wrapping: 'wrp-kraft',
      ribbon: 'rbn-beige-jute'
    }
  };
  r = await call('POST', '/api/orders', orderBody([tooManyCustom]), custToken);
  check('Custom bouquet with too many stems (> 10) rejected', r.status === 400 && /stem/i.test(r.data.error), r.data.error);

  // Custom bouquet with 5 stems (within [3, 10])
  const validCustom = {
    isCustom: true,
    name: 'Custom Just Right',
    quantity: 1,
    specs: {
      mainFlowers: [{ id: 'fl-rose-red', quantity: 3 }, { id: 'fl-tulip-pink', quantity: 2 }],
      wrapping: 'wrp-kraft',
      ribbon: 'rbn-beige-jute'
    }
  };
  r = await call('POST', '/api/orders', orderBody([validCustom]), custToken);
  check('Custom bouquet with valid stem count (5) accepted', r.status === 201 && r.data.status === 'Pending Confirmation');

  console.log('\n--- 6. Inventory Threshold Sync ---');
  await call('PUT', '/api/admin/settings', {
    inventory: { lowStockThreshold: 15 }
  }, adminToken);

  r = await call('GET', '/api/catalog');
  check('Catalog exposes updated lowStockThreshold (15)', r.data.inventory?.lowStockThreshold === 15, r.data.inventory?.lowStockThreshold);

  console.log('\n====================================');
  console.log(`SETTINGS SYNC TESTS: ${pass} passed, ${fail} failed`);
  console.log('====================================');

  if (failures.length > 0) {
    console.error('Failures:', failures);
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
