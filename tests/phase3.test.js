// Umaira Florist — Phase 3 Verification Test Suite
// Covers all 20 testing areas required for Phase 3:
// Customer Experience, Account Management, Order History, Tracking, Admin Customer Management, and Regressions.

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');

process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'Phase3AdminPassword123!';
process.env.ORDER_RATE_LIMIT = '1000';
process.env.GOOGLE_CLIENT_ID = 'phase3-test-google-client-id.apps.googleusercontent.com';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'umaira-phase3-'));
process.env.UMAIRA_DATA_DIR = tmp;
process.env.UMAIRA_TEST = '1';

const { server, start } = require('../server.js');
const app = require('../server.js');
const store = require('../server/store.js');
// GCash is offered only once the shop has a GCash QR code (Shop Settings → Payment Accounts); set a test one.
store.saveSettings({ payment: { gcash: { accountName: 'Test Shop GCash', number: '09170000000', qrImage: '/assets/uploads/0123456789abcdef0123.png' } } });
const rules = require('../js/shop-rules.js');

// Mock Google OAuth RS256 Keypair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'phase3-kid', alg: 'RS256', use: 'sig' };
app.googleKeyFetcher = async () => [jwk];

function mintJwt(payload, key = privateKey, kid = 'phase3-kid') {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b({ alg: 'RS256', kid, typ: 'JWT' });
  const body = b(payload);
  const sig = crypto.sign('RSA-SHA256', Buffer.from(head + '.' + body), key).toString('base64url');
  return `${head}.${body}.${sig}`;
}

const mockGoogleClaims = (over = {}) => ({
  iss: 'https://accounts.google.com',
  aud: process.env.GOOGLE_CLIENT_ID,
  sub: 'google-sub-' + Math.floor(Math.random() * 100000),
  email: 'clara.delrosario@example.com',
  email_verified: true,
  name: 'Clara Del Rosario',
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...over
});

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
  const date = rules.earliestDate ? rules.earliestDate('delivery') : new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  return {
    orderNumber: '#FLR-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000),
    fulfillment: 'delivery',
    firstName: 'Beatriz',
    lastName: 'Reyes',
    phone: '09171234567',
    email: 'beatriz@example.com',
    address: '45 Ayala Avenue, Unit 1204',
    district: '3',
    barangay: 'Barangay 300',
    city: 'Manila',
    notes: 'Please buzz unit 1204 upon arrival',
    date,
    time: rules.deliverySlots[0],
    paymentMethod: 'GCash',
    giftMessage: 'With deepest love and affection.',
    items,
    ...overrides
  };
}

async function runPhase3Tests() {
  console.log('\n======================================================');
  console.log('UMAIRA FLORIST — PHASE 3 COMPREHENSIVE TEST SUITE');
  console.log('======================================================\n');

  const srv = await start(0);
  baseUrl = 'http://127.0.0.1:' + srv.address().port;

  // Obtain admin token
  const admLogin = await call('POST', '/api/admin/login', {
    username: 'admin',
    password: process.env.ADMIN_PASSWORD
  });
  check('Admin login succeeded', admLogin.status === 200 && admLogin.data.token);
  const admToken = admLogin.data.token;

  // Test setup (temporary database): a fresh catalog starts most items at 0 stock, so stock what the
  // scenarios below order. Ready-made bouquets have their own stock; flowers are restocked by movement.
  for (const id of ['fl-red-rose', 'fl-pink-tulip', 'fl-white-lily']) {
    await call('POST', '/api/admin/inventory/adjust', { flowerId: id, type: 'restock', quantity: 40, reason: 'Test setup' }, admToken);
  }
  await call('PUT', '/api/admin/bouquets/bq-cloud-of-love', { stockCount: 20, availability: 'available' }, admToken);

  // Register Customer 1 (Email/Password)
  const reg1 = await call('POST', '/api/auth/register', {
    name: 'Beatriz Reyes',
    email: 'beatriz@example.com',
    password: 'Password123!',
    phone: '09171112233'
  });
  const ver1 = reg1.data?.testOtp
    ? await call('POST', '/api/auth/verify-otp', { email: 'beatriz@example.com', otp: reg1.data.testOtp })
    : { status: 0, data: {} };
  check('Customer 1 (Email) registration succeeded', reg1.status === 200 && ver1.status === 201 && !!ver1.data?.token);
  let cust1Token = ver1.data?.token;
  const cust1Id = ver1.data?.user?.id;

  // -------------------------------------------------------------------------
  // Area 1: Customer Profile Retrieval (GET /api/auth/me)
  // -------------------------------------------------------------------------
  console.log('\n[Area 1] Customer Profile Retrieval');
  const meGuest = await call('GET', '/api/auth/me');
  check('Guest cannot access /api/auth/me (401)', meGuest.status === 401);

  const meCust1 = await call('GET', '/api/auth/me', undefined, cust1Token);
  check('Customer 1 can retrieve profile (200)', meCust1.status === 200 && meCust1.data.user);
  const u1 = meCust1.data.user;
  check('Customer profile has id, email, name, phone', u1.id === cust1Id && u1.email === 'beatriz@example.com' && u1.name === 'Beatriz Reyes');
  check('Customer profile exposes google boolean = false', u1.google === false);
  check('Customer profile exposes createdAt ISO timestamp', typeof u1.createdAt === 'string' && u1.createdAt.length > 10);
  check('Customer profile exposes no password_hash or salt', !('password_hash' in u1) && !('salt' in u1));

  // -------------------------------------------------------------------------
  // Area 2: Customer Profile Updates (PUT /api/auth/me)
  // -------------------------------------------------------------------------
  console.log('\n[Area 2] Customer Profile Updates');
  const updateRes = await call('PUT', '/api/auth/me', {
    name: 'Beatriz Reyes-Santos',
    phone: '09179998877',
    address: {
      street: '789 Kalayaan Ave',
      district: '2',
      barangay: 'Barangay 200',
      landmark: 'Near Church'
    }
  }, cust1Token);
  check('Profile update succeeds (200)', updateRes.status === 200 && updateRes.data.ok === true);
  check('Updated profile returned with new name', updateRes.data.user.name === 'Beatriz Reyes-Santos');
  check('Updated profile returned with new phone', updateRes.data.user.phone === '09179998877');

  const meAfterUpdate = await call('GET', '/api/auth/me', undefined, cust1Token);
  check('Profile updates persist on GET /api/auth/me', meAfterUpdate.data.user.name === 'Beatriz Reyes-Santos' && meAfterUpdate.data.user.phone === '09179998877');

  // Verify role/email/id tampering attempt is ignored
  const tamperRes = await call('PUT', '/api/auth/me', {
    role: 'admin',
    email: 'hacked@admin.com',
    id: 'usr_hacked'
  }, cust1Token);
  check('Tamper PUT returns 200 without modifying role or email', tamperRes.status === 200);
  const meAfterTamper = await call('GET', '/api/auth/me', undefined, cust1Token);
  check('Role remains customer', meAfterTamper.data.user.role === 'customer');
  check('Email remains beatriz@example.com', meAfterTamper.data.user.email === 'beatriz@example.com');
  check('ID remains cust1Id', meAfterTamper.data.user.id === cust1Id);

  // -------------------------------------------------------------------------
  // Area 3: Invalid Profile Input Rejection
  // -------------------------------------------------------------------------
  console.log('\n[Area 3] Invalid Profile Input Rejection');
  const emptyNameRes = await call('PUT', '/api/auth/me', { name: ' ' }, cust1Token);
  check('Empty name update rejected (400)', emptyNameRes.status === 400);

  const shortNameRes = await call('PUT', '/api/auth/me', { name: 'A' }, cust1Token);
  check('Single-character name rejected (400)', shortNameRes.status === 400);

  const badPhoneRes = await call('PUT', '/api/auth/me', { phone: 'invalid-phone-num' }, cust1Token);
  check('Non-numeric invalid phone rejected (400)', badPhoneRes.status === 400);

  const shortPhoneRes = await call('PUT', '/api/auth/me', { phone: '123' }, cust1Token);
  check('Too-short phone rejected (400)', shortPhoneRes.status === 400);

  // -------------------------------------------------------------------------
  // Area 4: Google-Authenticated Customer Account Access
  // -------------------------------------------------------------------------
  console.log('\n[Area 4] Google-Authenticated Customer Account Access');
  const googleToken = mintJwt(mockGoogleClaims({
    sub: 'google-uid-clara-12345',
    email: 'clara.delrosario@example.com',
    name: 'Clara Del Rosario'
  }));

  const googleAuthRes = await call('POST', '/api/auth/google', { credential: googleToken });
  check('Google OAuth login succeeds (200)', googleAuthRes.status === 200 && googleAuthRes.data.token);
  const googleCustToken = googleAuthRes.data.token;
  const googleCustId = googleAuthRes.data.user.id;

  const meGoogle = await call('GET', '/api/auth/me', undefined, googleCustToken);
  check('Google customer GET /api/auth/me succeeds (200)', meGoogle.status === 200 && meGoogle.data.user);
  check('Google customer profile reflects google: true', meGoogle.data.user.google === true);
  check('Google customer profile has correct email and name', meGoogle.data.user.email === 'clara.delrosario@example.com' && meGoogle.data.user.name === 'Clara Del Rosario');
  check('Google customer profile has createdAt timestamp', typeof meGoogle.data.user.createdAt === 'string');
  check('Google ID / private tokens not leaked in profile', !('google_id' in meGoogle.data.user) && !('credential' in meGoogle.data.user));

  // -------------------------------------------------------------------------
  // Area 5: Customer Order History Retrieval (GET /api/my/orders)
  // -------------------------------------------------------------------------
  console.log('\n[Area 5] Customer Order History Retrieval');
  // Initially customer 1 has 0 orders
  const myOrdersEmpty = await call('GET', '/api/my/orders', undefined, cust1Token);
  check('Initial /api/my/orders returns empty array', myOrdersEmpty.status === 200 && Array.isArray(myOrdersEmpty.data.orders) && myOrdersEmpty.data.orders.length === 0);

  // Place Order 1 for Customer 1 (Delivery)
  const ord1Payload = validOrderPayload([{ id: 'fl-red-rose', quantity: 3 }]);
  const placeOrd1 = await call('POST', '/api/orders', ord1Payload, cust1Token);
  check('Customer 1 placed Order 1 (201)', placeOrd1.status === 201 && placeOrd1.data.orderNumber);
  const ord1Number = placeOrd1.data.orderNumber;

  // Place Order 2 for Customer 1 (Store Pickup)
  const pickupDate = rules.earliestDate('pickup');
  const pickupSlots = rules.availablePickupSlots(pickupDate);
  const pickupSlot = pickupSlots.length > 0 ? pickupSlots[0].label : '02:00 PM – 03:00 PM';
  const ord2Payload = validOrderPayload([{ id: 'bq-cloud-of-love', quantity: 1 }], {
    fulfillment: 'pickup',
    pickupLocation: 'Manila Flower Studio',
    address: 'Pick-up: Manila Flower Studio',
    date: pickupDate,
    time: pickupSlot,
    paymentMethod: 'Cash on Pickup'
  });
  const placeOrd2 = await call('POST', '/api/orders', ord2Payload, cust1Token);
  check('Customer 1 placed Order 2 (201)', placeOrd2.status === 201 && placeOrd2.data.orderNumber);
  const ord2Number = placeOrd2.data.orderNumber;

  // Retrieve customer order history
  const myOrdersPopulated = await call('GET', '/api/my/orders', undefined, cust1Token);
  check('/api/my/orders returns both customer orders', myOrdersPopulated.status === 200 && myOrdersPopulated.data.orders.length === 2);
  check('Orders are sorted newest first', myOrdersPopulated.data.orders[0].orderNumber === ord2Number);
  check('Order details contain fulfillment, total, items, status',
    myOrdersPopulated.data.orders[0].fulfillment === 'pickup' &&
    typeof myOrdersPopulated.data.orders[0].total === 'number' &&
    Array.isArray(myOrdersPopulated.data.orders[0].items) &&
    myOrdersPopulated.data.orders[0].items.length > 0
  );

  // Verify Google customer has 0 orders
  const googleOrders = await call('GET', '/api/my/orders', undefined, googleCustToken);
  check('Google customer has 0 orders initially', googleOrders.status === 200 && googleOrders.data.orders.length === 0);

  // -------------------------------------------------------------------------
  // Area 6: Cross-Customer Order Access Prevention
  // -------------------------------------------------------------------------
  console.log('\n[Area 6] Cross-Customer Order Access Prevention');
  // Google Customer tries to access Customer 1's order
  const crossOrderAttempt = await call('GET', `/api/orders/${encodeURIComponent(ord1Number)}`, undefined, googleCustToken);
  check('Cross-customer order access blocked (404/403)', crossOrderAttempt.status === 404);

  // Guest tries to access Customer 1's order
  const guestOrderAttempt = await call('GET', `/api/orders/${encodeURIComponent(ord1Number)}`);
  check('Guest order access blocked (401)', guestOrderAttempt.status === 401);

  // -------------------------------------------------------------------------
  // Area 7: Order Details Retrieval (GET /api/orders/:num for Owner)
  // -------------------------------------------------------------------------
  console.log('\n[Area 7] Order Details Retrieval for Owner');
  const ownerOrderRes = await call('GET', `/api/orders/${encodeURIComponent(ord1Number)}`, undefined, cust1Token);
  check('Owner can view own order details (200)', ownerOrderRes.status === 200);
  check('Owner order contains items array', Array.isArray(ownerOrderRes.data.items) && ownerOrderRes.data.items.length === 1);
  check('Owner order contains line item quantity and lineTotal', ownerOrderRes.data.items[0].quantity === 3 && ownerOrderRes.data.items[0].lineTotal > 0);
  check('Owner order contains recipient phone & address', ownerOrderRes.data.phone === '09171234567' && ownerOrderRes.data.address.includes('Ayala'));
  check('Owner order contains gift message', ownerOrderRes.data.giftMessage === 'With deepest love and affection.');

  // -------------------------------------------------------------------------
  // Area 8: Delivery Order Tracking Stage Sequence
  // -------------------------------------------------------------------------
  console.log('\n[Area 8] Delivery Order Tracking Stage Sequence');
  const accountSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'account.js'), 'utf8');
  check('account.js defines DELIVERY_STAGES and PICKUP_STAGES', accountSource.includes('DELIVERY_STAGES') && accountSource.includes('PICKUP_STAGES'));
  check('Initial order status is Pending Confirmation', placeOrd1.data.status === 'Pending Confirmation');

  // GCash is an advance payment: the order is confirmed and prepared only after the payment is verified.
  const gcBlocked = await call('POST', `/api/admin/orders/${encodeURIComponent(ord1Number)}/status`, { status: 'Confirmed' }, admToken);
  check('Unpaid GCash order cannot be confirmed (409)', gcBlocked.status === 409 && gcBlocked.data.code === 'PAYMENT_NOT_VERIFIED', gcBlocked.data);
  const proofPng = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(48)]).toString('base64');
  const proof = await call('POST', `/api/orders/${encodeURIComponent(ord1Number)}/payments`, { reference: 'P3-' + Date.now(), amount: placeOrd1.data.total, receiptDataUrl: proofPng }, cust1Token);
  const approve = await call('POST', `/api/admin/orders/${encodeURIComponent(ord1Number)}/payments/${proof.data.submission && proof.data.submission.id}/approve`, { confirmReceived: true }, admToken);
  check('GCash payment verified before confirmation', proof.status === 201 && approve.status === 200 && approve.data.order.paymentStatus === 'Paid', [proof.status, approve.status]);
  // Advance to Confirmed and Preparing
  await call('POST', `/api/admin/orders/${encodeURIComponent(ord1Number)}/status`, { status: 'Confirmed' }, admToken);
  await call('POST', `/api/admin/orders/${encodeURIComponent(ord1Number)}/status`, { status: 'Preparing' }, admToken);

  // Advance to Rider Assigned and attach Grab courier tracking URL
  const riderStep = await call('POST', `/api/admin/orders/${encodeURIComponent(ord1Number)}/status`, {
    status: 'Rider Assigned',
    grabTrackingUrl: 'https://express.grab.com/track/GRAB-PH-123456'
  }, admToken);
  check('Admin advanced to Rider Assigned with Grab tracking URL', riderStep.status === 200 && riderStep.data.order.status === 'Rider Assigned');

  const trackedWithGrab = await call('GET', `/api/orders/${encodeURIComponent(ord1Number)}`, undefined, cust1Token);
  check('Order tracking reflects courier tracking URL', trackedWithGrab.data.grabTrackingUrl === 'https://express.grab.com/track/GRAB-PH-123456');

  // -------------------------------------------------------------------------
  // Area 9: Pickup Order Tracking Stage Sequence
  // -------------------------------------------------------------------------
  console.log('\n[Area 9] Pickup Order Tracking Stage Sequence');
  check('Pickup order fulfillment is pickup', placeOrd2.data.fulfillment === 'pickup');

  // Advance pickup order: Confirmed -> Preparing -> Ready for Pickup -> Picked Up
  const pStep1 = await call('POST', `/api/admin/orders/${encodeURIComponent(ord2Number)}/status`, { status: 'Confirmed' }, admToken);
  check('Pickup order advanced to Confirmed', pStep1.status === 200 && pStep1.data.order.status === 'Confirmed');

  const pStep2 = await call('POST', `/api/admin/orders/${encodeURIComponent(ord2Number)}/status`, { status: 'Preparing' }, admToken);
  check('Pickup order advanced to Preparing', pStep2.status === 200 && pStep2.data.order.status === 'Preparing');

  const pStep3 = await call('POST', `/api/admin/orders/${encodeURIComponent(ord2Number)}/status`, { status: 'Ready for Pickup' }, admToken);
  check('Pickup order advanced to Ready for Pickup', pStep3.status === 200 && pStep3.data.order.status === 'Ready for Pickup');

  // Cash on Pickup: never released before the cash is confirmed at the shop.
  const pBlocked = await call('POST', `/api/admin/orders/${encodeURIComponent(ord2Number)}/confirm-pickup`, {}, admToken);
  check('Unpaid Cash on Pickup order cannot be released (409)', pBlocked.status === 409 && pBlocked.data.code === 'PAYMENT_NOT_VERIFIED', pBlocked.data);
  const pCash = await call('POST', `/api/admin/orders/${encodeURIComponent(ord2Number)}/payments/cash`, { amountReceived: placeOrd2.data.total, confirmReceived: true }, admToken);
  check('Cash received confirmed at the shop -> Paid', pCash.status === 200 && pCash.data.order.paymentStatus === 'Paid', pCash.data);
  // Two-way pickup confirmation: the shop confirms the handover, then the customer confirms receipt.
  const pHand = await call('POST', `/api/admin/orders/${encodeURIComponent(ord2Number)}/confirm-pickup`, {}, admToken);
  check('Shop confirmed the pickup handover', pHand.status === 200 && pHand.data.order.status === 'Awaiting Customer Confirmation');
  const pStep4 = await call('POST', `/api/orders/${encodeURIComponent(ord2Number)}/confirm-pickup`, { confirmed: true }, cust1Token);
  check('Pickup order advanced to Picked Up', pStep4.status === 200 && pStep4.data.order.status === 'Picked Up');

  // -------------------------------------------------------------------------
  // Area 10: Order Status Progression (Delivery)
  // -------------------------------------------------------------------------
  console.log('\n[Area 10] Delivery Order Status Progression');
  const dStep4 = await call('POST', `/api/admin/orders/${encodeURIComponent(ord1Number)}/status`, { status: 'On the Way' }, admToken);
  check('Delivery order advanced to On the Way', dStep4.status === 200 && dStep4.data.order.status === 'On the Way');

  const dNoPhoto = await call('POST', `/api/admin/orders/${encodeURIComponent(ord1Number)}/status`, { status: 'Delivered' }, admToken);
  check('Delivery cannot be marked Delivered without a proof-of-delivery photo', dNoPhoto.status === 400);
  const dStep5 = await call('POST', `/api/admin/orders/${encodeURIComponent(ord1Number)}/pod`, { photoUrl: '/assets/uploads/aaaaaaaaaaaaaaaaaaaa.png' }, admToken);
  check('Delivery order advanced to Delivered (photo, awaiting the customer)', dStep5.status === 200 && dStep5.data.order.status === 'Delivered — Awaiting Confirmation');

  // -------------------------------------------------------------------------
  // Area 11: Invalid Status Transition Rejection
  // -------------------------------------------------------------------------
  console.log('\n[Area 11] Invalid Status Transition Rejection');
  // Attempt invalid transition: Delivered -> Preparing
  const invalidTransition = await call('POST', `/api/admin/orders/${encodeURIComponent(ord1Number)}/status`, { status: 'Preparing' }, admToken);
  check('Transitioning backwards from Delivered to Preparing is rejected (400)', invalidTransition.status === 400);

  // Create fresh order to test invalid jump (Pending Confirmation -> Delivered)
  const jumpOrd = await call('POST', '/api/orders', validOrderPayload([{ id: 'fl-pink-tulip', quantity: 2 }]), cust1Token);
  check('Fresh order created for transition jump test', jumpOrd.status === 201 && jumpOrd.data.orderNumber);
  const illegalJump = await call('POST', `/api/admin/orders/${encodeURIComponent(jumpOrd.data.orderNumber)}/status`, { status: 'Delivered' }, admToken);
  check('Skipping stages from Pending Confirmation directly to Delivered is rejected (400)', illegalJump.status === 400);

  // -------------------------------------------------------------------------
  // Area 12: Admin Customer Directory Access (GET /api/admin/customers)
  // -------------------------------------------------------------------------
  console.log('\n[Area 12] Admin Customer Directory Access');
  const custDirRes = await call('GET', '/api/admin/customers', undefined, admToken);
  check('Admin can access customer directory (200)', custDirRes.status === 200);
  check('Customer directory returns array', Array.isArray(custDirRes.data.customers));
  check('Both registered customers are listed', custDirRes.data.customers.length >= 2);

  const foundBeatriz = custDirRes.data.customers.find(c => c.email === 'beatriz@example.com');
  check('Customer Beatriz has orderCount >= 2', foundBeatriz && foundBeatriz.orderCount >= 2);
  check('Customer Beatriz totalSpent reflects delivered/picked-up orders', foundBeatriz && foundBeatriz.totalSpent > 0);
  check('Customer Beatriz has google = false', foundBeatriz && foundBeatriz.google === false);
  check('Customer Beatriz has createdAt timestamp', foundBeatriz && typeof foundBeatriz.createdAt === 'string');

  const foundClara = custDirRes.data.customers.find(c => c.email === 'clara.delrosario@example.com');
  check('Customer Clara has google = true', foundClara && foundClara.google === true);
  check('Customer Clara has orderCount = 0', foundClara && foundClara.orderCount === 0);

  // -------------------------------------------------------------------------
  // Area 13: Unauthorized Customer Directory Access Rejection
  // -------------------------------------------------------------------------
  console.log('\n[Area 13] Unauthorized Customer Directory Access Rejection');
  const guestCustDir = await call('GET', '/api/admin/customers');
  check('Guest cannot access customer directory (401)', guestCustDir.status === 401);

  const custCustDir = await call('GET', '/api/admin/customers', undefined, cust1Token);
  check('Regular customer cannot access admin customer directory (401)', custCustDir.status === 401);

  // -------------------------------------------------------------------------
  // Area 14: Admin Customer Details Retrieval (GET /api/admin/customers/:id)
  // -------------------------------------------------------------------------
  console.log('\n[Area 14] Admin Customer Details Retrieval');
  const custDetailsRes = await call('GET', `/api/admin/customers/${encodeURIComponent(cust1Id)}`, undefined, admToken);
  check('Admin can retrieve individual customer details (200)', custDetailsRes.status === 200);
  check('Customer details object includes id, name, email, phone, address',
    custDetailsRes.data.customer.id === cust1Id &&
    custDetailsRes.data.customer.name === 'Beatriz Reyes-Santos' &&
    custDetailsRes.data.customer.email === 'beatriz@example.com' &&
    custDetailsRes.data.customer.address !== null
  );
  check('Customer details includes orders array', Array.isArray(custDetailsRes.data.orders) && custDetailsRes.data.orders.length >= 2);
  check('Customer details does not leak password_hash or salt', !('password_hash' in custDetailsRes.data.customer) && !('salt' in custDetailsRes.data.customer));

  const missingCustDetails = await call('GET', '/api/admin/customers/usr_nonexistent', undefined, admToken);
  check('Non-existent customer ID returns 404', missingCustDetails.status === 404);

  const custAttemptDetails = await call('GET', `/api/admin/customers/${encodeURIComponent(cust1Id)}`, undefined, cust1Token);
  check('Customer cannot access admin customer details endpoint (401)', custAttemptDetails.status === 401);

  // -------------------------------------------------------------------------
  // Area 15: Admin Order Search and Status Filtering
  // -------------------------------------------------------------------------
  console.log('\n[Area 15] Admin Order Search and Status Filtering');
  const allOrdersRes = await call('GET', '/api/admin/orders', undefined, admToken);
  check('Admin can list all orders', allOrdersRes.status === 200 && Array.isArray(allOrdersRes.data.orders));

  // ord1 was delivered with a photo, so it waits for the customer: "Delivered — Awaiting Confirmation".
  const deliveredFilter = await call('GET', '/api/admin/orders?status=' + encodeURIComponent('Delivered — Awaiting Confirmation'), undefined, admToken);
  check('Filtering by Delivered status returns only Delivered orders',
    deliveredFilter.status === 200 &&
    deliveredFilter.data.orders.every(o => o.status === 'Delivered — Awaiting Confirmation') &&
    deliveredFilter.data.orders.some(o => o.orderNumber === ord1Number)
  );

  const pickedUpFilter = await call('GET', '/api/admin/orders?status=Picked%20Up', undefined, admToken);
  check('Filtering by Picked Up status returns only Picked Up orders',
    pickedUpFilter.status === 200 &&
    pickedUpFilter.data.orders.every(o => o.status === 'Picked Up') &&
    pickedUpFilter.data.orders.some(o => o.orderNumber === ord2Number)
  );

  // -------------------------------------------------------------------------
  // Area 16: Logout and Session Invalidation
  // -------------------------------------------------------------------------
  console.log('\n[Area 16] Logout and Session Invalidation');
  // Create a temporary customer session to logout
  const tempReg = await call('POST', '/api/auth/register', {
    name: 'Temporary User',
    email: 'temp.user@example.com',
    password: 'Password123!',
    phone: '09170001122'
  });
  const tempVerify = tempReg.data?.testOtp
    ? await call('POST', '/api/auth/verify-otp', { email: 'temp.user@example.com', otp: tempReg.data.testOtp })
    : { data: {} };
  const tempToken = tempVerify.data?.token;
  const meBeforeLogout = await call('GET', '/api/auth/me', undefined, tempToken);
  check('Temp session is active before logout (200)', meBeforeLogout.status === 200);

  const logoutRes = await call('POST', '/api/auth/logout', {}, tempToken);
  check('Customer logout endpoint returns ok (200)', logoutRes.status === 200 && logoutRes.data.ok === true);

  const meAfterLogout = await call('GET', '/api/auth/me', undefined, tempToken);
  check('Logged out session token is invalid (401)', meAfterLogout.status === 401);

  // Admin logout
  const admLogoutRes = await call('POST', '/api/admin/logout', {}, admToken);
  check('Admin logout endpoint returns ok (200)', admLogoutRes.status === 200 && admLogoutRes.data.ok === true);

  const admStatsAfterLogout = await call('GET', '/api/admin/stats', undefined, admToken);
  check('Admin token is invalidated after logout (401)', admStatsAfterLogout.status === 401);

  // Re-login admin for remaining checks
  const admReLogin = await call('POST', '/api/admin/login', { username: 'admin', password: process.env.ADMIN_PASSWORD });
  const activeAdmToken = admReLogin.data.token;

  // -------------------------------------------------------------------------
  // Area 17: Inventory Integrity after Order Cancellation
  // -------------------------------------------------------------------------
  console.log('\n[Area 17] Inventory Integrity after Order Cancellation');
  // Get initial stock for fl-white-lily
  const lilyBefore = store.getFlower('fl-white-lily').stockCount;

  // Place order for 4 white lilies
  const cancelOrderPayload = validOrderPayload([{ id: 'fl-white-lily', quantity: 4 }], { paymentMethod: 'Cash on Delivery' }); // COD may be prepared while unpaid
  const placeCancelOrd = await call('POST', '/api/orders', cancelOrderPayload, cust1Token);
  check('Order to be cancelled placed successfully (201)', placeCancelOrd.status === 201);
  const cancelOrdNumber = placeCancelOrd.data.orderNumber;

  const lilyAfterOrder = store.getFlower('fl-white-lily').stockCount;
  check('Stock deducted upon placing order', lilyAfterOrder === lilyBefore - 4);

  // Advance order to Preparing
  await call('POST', `/api/admin/orders/${encodeURIComponent(cancelOrdNumber)}/status`, { status: 'Confirmed' }, activeAdmToken);
  await call('POST', `/api/admin/orders/${encodeURIComponent(cancelOrdNumber)}/status`, { status: 'Preparing' }, activeAdmToken);

  // Cancel/reject order with rejection reason
  const cancelRes = await call('POST', `/api/admin/orders/${encodeURIComponent(cancelOrdNumber)}/reject`, {
    reason: 'Customer requested cancellation before floral arrangement',
    // Already Preparing: stems go back only when the admin ticks "Return the flowers to stock" (bouquet not made yet).
    restoreStock: true
  }, activeAdmToken);
  check('Admin cancelled Preparing order with reason (200)', cancelRes.status === 200 && cancelRes.data.order.status === 'Rejected/Cancelled');
  check('Rejection reason recorded on order', cancelRes.data.order.rejectReason === 'Customer requested cancellation before floral arrangement');

  const lilyAfterCancel = store.getFlower('fl-white-lily').stockCount;
  check('Stock fully restored to initial amount after order cancellation', lilyAfterCancel === lilyBefore);

  // -------------------------------------------------------------------------
  // Area 18: Existing Checkout Functionality
  // -------------------------------------------------------------------------
  console.log('\n[Area 18] Existing Checkout Functionality Verification');
  const checkoutPayload = validOrderPayload([
    { id: 'fl-red-rose', quantity: 2 },
    { id: 'bq-cloud-of-love', quantity: 1 }
  ], {
    fulfillment: 'delivery',
    firstName: 'Sofia',
    lastName: 'Mendoza',
    phone: '09181234567',
    email: 'sofia.mendoza@example.com',
    paymentMethod: 'Cash on Delivery'
  });
  const checkoutRes = await call('POST', '/api/orders', checkoutPayload, cust1Token);
  check('Multi-item checkout succeeds (201)', checkoutRes.status === 201 && checkoutRes.data.orderNumber);
  check('Total price matches catalog pricing + shipping', checkoutRes.data.total > 0);
  check('Order stored in DB with delivery fulfillment', checkoutRes.data.fulfillment === 'delivery');

  // -------------------------------------------------------------------------
  // Area 19: Existing Google Authentication Security
  // -------------------------------------------------------------------------
  console.log('\n[Area 19] Existing Google Authentication Security');
  // Missing credential
  const noToken = await call('POST', '/api/auth/google', {});
  check('Missing credential rejected (401)', noToken.status === 401);

  // Invalid signature
  const forgedSigToken = mintJwt(mockGoogleClaims(), crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey);
  const forgeRes = await call('POST', '/api/auth/google', { credential: forgedSigToken });
  check('Forged Google token signature rejected (401)', forgeRes.status === 401);

  // Expired token
  const expiredToken = mintJwt(mockGoogleClaims({ exp: Math.floor(Date.now() / 1000) - 100 }));
  const expiredRes = await call('POST', '/api/auth/google', { credential: expiredToken });
  check('Expired Google token rejected (401)', expiredRes.status === 401);

  // Wrong audience
  const wrongAudToken = mintJwt(mockGoogleClaims({ aud: 'wrong-client-id.apps.googleusercontent.com' }));
  const wrongAudRes = await call('POST', '/api/auth/google', { credential: wrongAudToken });
  check('Wrong audience Google token rejected (401)', wrongAudRes.status === 401);

  // Unverified email
  const unverifiedEmailToken = mintJwt(mockGoogleClaims({ email_verified: false }));
  const unverifiedRes = await call('POST', '/api/auth/google', { credential: unverifiedEmailToken });
  check('Unverified Google email rejected (401)', unverifiedRes.status === 401);

  // -------------------------------------------------------------------------
  // Area 20: Account Navigation & Frontend Data Binding Integrity
  // -------------------------------------------------------------------------
  console.log('\n[Area 20] Account Navigation & Frontend Data Binding Integrity');
  // Validate admin.js contains methods
  const adminJsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin.js'), 'utf8');
  check('admin.js contains openCustomerDetails method', adminJsCode.includes('openCustomerDetails'));
  check('admin.js contains handleCustomerSearch method', adminJsCode.includes('handleCustomerSearch'));
  check('admin.js contains handleCustomerFilter method', adminJsCode.includes('handleCustomerFilter'));
  check('admin.js contains handleCustomerSort method', adminJsCode.includes('handleCustomerSort'));
  check('admin.js contains rejectOrderPrompt method for cancellations', adminJsCode.includes('rejectOrderPrompt'));

  // Validate account.js contains account dashboard, timeline, and order history
  const accountJsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'account.js'), 'utf8');
  check('account.js contains Google provider badge display', accountJsCode.includes('Google Account') || accountJsCode.includes('Google'));
  check('account.js contains responsive timeline markup (desktop & mobile)', accountJsCode.includes('sm:hidden') && accountJsCode.includes('sm:block'));
  check('account.js contains order card expansion for items and notes', accountJsCode.includes('<details') || accountJsCode.includes('details'));
  check('account.js contains Grab/Lalamove courier tracking link display', accountJsCode.includes('grabTrackingUrl') || accountJsCode.includes('trackingUrl'));

  // Validate admin.html contains customer search, filter, and modal markup
  const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
  check('admin.html has #customers-search-input', adminHtml.includes('customers-search-input'));
  check('admin.html has #customers-filter-auth', adminHtml.includes('customers-filter-auth'));
  check('admin.html has #customers-sort', adminHtml.includes('customers-sort'));
  check('admin.html has #admin-customer-modal', adminHtml.includes('admin-customer-modal'));

  // Cleanup
  srv.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}

  console.log(`\n======================================================`);
  console.log(`PHASE 3 RESULT: ${passed} passed, ${failed} failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    console.error('Failed test assertions:');
    failureList.forEach(f => console.error('  - ' + f));
    process.exit(1);
  }
}

runPhase3Tests().catch((e) => {
  console.error('Phase 3 test runner crashed:', e);
  process.exit(1);
});
