// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('./tests/helpers/isolated-db');
const http = require('http');

async function runHttpTests() {
  const { port: TEST_PORT } = await iso.startServer(); // own server, free port, isolated database

  console.log(`--- STARTING HTTP API INTEGRATION TESTS ON PORT ${TEST_PORT} ---`);

  function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: 'localhost',
        port: TEST_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };
      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // 1. GET /api/catalog
  const catRes = await request('GET', '/api/catalog');
  if (catRes.status !== 200 || !catRes.data.flowers || !catRes.data.bouquets) {
    throw new Error('GET /api/catalog failed: ' + JSON.stringify(catRes));
  }
  console.log('OK: GET /api/catalog returned ' + catRes.data.flowers.length + ' flowers and ' + catRes.data.bouquets.length + ' bouquets');

  // 2. POST /api/orders — guests are refused; a signed-in customer can order.
  const reg = await request('POST', '/api/auth/register', { name: 'Teresa Magbanua', email: 'teresa_' + Date.now() + '@example.com', password: 'Password-123' });
  if (reg.status !== 201 && reg.status !== 200) throw new Error('Customer registration failed: ' + JSON.stringify(reg.data));
  const custAuth = { Authorization: 'Bearer ' + reg.data.token };
  const orderPayload = {
    fulfillment: 'delivery',
    firstName: 'Teresa',
    lastName: 'Magbanua',
    phone: '09175551234',
    email: 'teresa@magbanua.ph',
    address: '456 Sampaloc St, Unit 3A',
    district: '4',
    barangay: 'Barangay 400',
    city: 'Manila',
    date: require('./js/shop-rules.js').earliestDate('delivery'),
    time: 'Morning (9:00 AM – 12:00 PM)',
    paymentMethod: 'GCash',
    items: [
      { id: 'fl-tulip-pink', quantity: 3 }, // test fixtures (temporary test database)
      { id: 'fl-rose-red', quantity: 2 }
    ]
  };
  const guestRes = await request('POST', '/api/orders', orderPayload);
  if (guestRes.status !== 401) throw new Error('Guest order must be refused with 401, got ' + guestRes.status);
  console.log('OK: Guest checkout is refused (sign-in required)');
  const orderRes = await request('POST', '/api/orders', orderPayload, custAuth);
  if (orderRes.status !== 201) throw new Error('POST /api/orders failed: ' + JSON.stringify(orderRes));
  const orderNum = orderRes.data.orderNumber;
  if (!orderNum.startsWith('#FLR-')) throw new Error('Order number format invalid: ' + orderNum);
  if (orderRes.data.status !== 'Pending Confirmation') throw new Error('Initial status must be Pending Confirmation: ' + orderRes.data.status);
  console.log('OK: Signed-in customer placed order ' + orderNum + ' with initial status: ' + orderRes.data.status);

  // 3. GET /api/orders/:orderNumber (Customer Live Tracking)
  const trackRes = await request('GET', '/api/orders/' + encodeURIComponent(orderNum), null, custAuth);
  if (trackRes.status !== 200 || trackRes.data.status !== 'Pending Confirmation') {
    throw new Error('Customer tracking failed: ' + JSON.stringify(trackRes));
  }
  console.log('OK: Customer live tracking endpoint returned real DB status: ' + trackRes.data.status);

  // 4. RBAC Check: GET /api/admin/orders without token must return 401
  const unauthRes = await request('GET', '/api/admin/orders');
  if (unauthRes.status !== 401) throw new Error('Expected 401 for unauthenticated admin access, got: ' + unauthRes.status);
  console.log('OK: RBAC strictly enforced - unauthenticated request rejected with 401');

  // 5. Admin Login: POST /api/admin/login
  // The isolated test database's admin password (the old built-in default 'umaira2026' is no longer accepted).
  const loginRes = await request('POST', '/api/admin/login', { username: 'admin', password: iso.adminPassword });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error('Admin login failed: ' + JSON.stringify(loginRes));
  }
  const adminToken = loginRes.data.token;
  console.log('OK: Admin authenticated successfully, session token acquired');

  // 6. Admin Get Orders: GET /api/admin/orders with token
  const adminOrdersRes = await request('GET', '/api/admin/orders', null, { 'x-admin-token': adminToken });
  if (adminOrdersRes.status !== 200 || !Array.isArray(adminOrdersRes.data.orders)) {
    throw new Error('Admin list orders failed: ' + JSON.stringify(adminOrdersRes));
  }
  console.log('OK: Admin fetched ' + adminOrdersRes.data.orders.length + ' orders');

  // 7a. GCash is an advance payment: an unpaid order cannot be confirmed; the customer submits proof and the admin verifies it.
  const blocked = await request('POST', `/api/admin/orders/${encodeURIComponent(orderNum)}/status`, { status: 'Confirmed' }, { 'x-admin-token': adminToken });
  if (blocked.status !== 409) throw new Error('Unpaid GCash order must not be confirmed: ' + JSON.stringify(blocked.data));
  const receipt = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), require('crypto').randomBytes(48)]).toString('base64');
  const proof = await request('POST', `/api/orders/${encodeURIComponent(orderNum)}/payments`, { reference: 'HTTP-' + Date.now(), amount: orderRes.data.total, receiptDataUrl: receipt }, custAuth);
  if (proof.status !== 201) throw new Error('Payment proof submission failed: ' + JSON.stringify(proof.data));
  const approved = await request('POST', `/api/admin/orders/${encodeURIComponent(orderNum)}/payments/${proof.data.submission.id}/approve`, { confirmReceived: true }, { 'x-admin-token': adminToken });
  if (approved.status !== 200 || approved.data.order.paymentStatus !== 'Paid') throw new Error('Payment approval failed: ' + JSON.stringify(approved.data));
  console.log('OK: GCash payment proof submitted and verified by admin -> Paid');

  // 7. Admin Confirm Order: POST /api/admin/orders/:orderNumber/confirm
  const confirmRes = await request('POST', `/api/admin/orders/${encodeURIComponent(orderNum)}/confirm`, { note: 'Confirmed by florist master' }, { 'x-admin-token': adminToken });
  if (confirmRes.status !== 200 || confirmRes.data.order.status !== 'Confirmed') {
    throw new Error('Admin confirm order failed: ' + JSON.stringify(confirmRes));
  }
  console.log('OK: Admin confirmed order ' + orderNum + ' -> status: ' + confirmRes.data.order.status);

  // 8. Admin Status Progression: POST /api/admin/orders/:orderNumber/status
  // Progress to Preparing
  const prepRes = await request('POST', `/api/admin/orders/${encodeURIComponent(orderNum)}/status`, {
    status: 'Preparing',
    note: 'Stems cut and conditioned'
  }, { 'x-admin-token': adminToken });
  if (prepRes.status !== 200 || prepRes.data.order.status !== 'Preparing') {
    throw new Error('Admin transition to Preparing failed: ' + JSON.stringify(prepRes));
  }

  // Progress to Rider Assigned with Grab Tracking Link
  const riderRes = await request('POST', `/api/admin/orders/${encodeURIComponent(orderNum)}/status`, {
    status: 'Rider Assigned',
    note: 'Courier pickup by GrabExpress',
    grabTrackingUrl: 'https://grab.com/ph/delivery/grab-express-test-999'
  }, { 'x-admin-token': adminToken });
  if (riderRes.status !== 200 || riderRes.data.order.status !== 'Rider Assigned' || riderRes.data.order.grabTrackingUrl !== 'https://grab.com/ph/delivery/grab-express-test-999') {
    throw new Error('Admin transition to Rider Assigned with Grab URL failed: ' + JSON.stringify(riderRes));
  }
  console.log('OK: Admin progressed status to Rider Assigned with Grab tracking URL');

  // 9. Customer Re-Track to see Live Updates
  const reTrackRes = await request('GET', '/api/orders/' + encodeURIComponent(orderNum), null, custAuth);
  if (reTrackRes.data.status !== 'Rider Assigned' || reTrackRes.data.grabTrackingUrl !== 'https://grab.com/ph/delivery/grab-express-test-999') {
    throw new Error('Customer tracking did not reflect live admin updates: ' + JSON.stringify(reTrackRes));
  }
  console.log('OK: Customer re-tracking verified live status: ' + reTrackRes.data.status + ' and Grab URL: ' + reTrackRes.data.grabTrackingUrl);

  // 10. Check /admin route
  const adminPageRes = await request('GET', '/admin');
  if (adminPageRes.status !== 200 || !adminPageRes.data.includes('<title>Admin Management Console') || !adminPageRes.data.includes('id="admin-login-form"')) {
    throw new Error('GET /admin failed to serve admin.html: ' + JSON.stringify(adminPageRes));
  }
  console.log('OK: /admin route successfully serves standalone admin.html');

  // 11. Customer Authentication Endpoints
  const testCustomerEmail = 'customer_' + Date.now() + '@example.ph';
  // Register
  const regRes = await request('POST', '/api/auth/register', {
    name: 'Maria Clara',
    email: testCustomerEmail,
    password: 'Password123!',
    phone: '09171234567'
  });
  if (regRes.status !== 201 || !regRes.data.token || !regRes.data.user) {
    throw new Error('POST /api/auth/register failed: ' + JSON.stringify(regRes));
  }
  console.log('OK: Customer registered successfully with email: ' + regRes.data.user.email);
  const custToken = regRes.data.token;

  // Duplicate registration check
  const dupRes = await request('POST', '/api/auth/register', {
    name: 'Duplicate Clara',
    email: testCustomerEmail,
    password: 'Password123!'
  });
  if (dupRes.status !== 409) { // 409 Conflict: the email is already registered
    throw new Error('Expected 409 for duplicate email registration, got: ' + dupRes.status);
  }
  console.log('OK: Duplicate registration prevented with 400');

  // Verify GET /api/auth/me
  const meRes = await request('GET', '/api/auth/me', null, { 'x-auth-token': custToken });
  if (meRes.status !== 200 || meRes.data.user.email !== testCustomerEmail) {
    throw new Error('GET /api/auth/me failed: ' + JSON.stringify(meRes));
  }
  console.log('OK: GET /api/auth/me verified customer session token');

  // Login
  const loginCustRes = await request('POST', '/api/auth/login', {
    email: testCustomerEmail,
    password: 'Password123!'
  });
  if (loginCustRes.status !== 200 || !loginCustRes.data.token) {
    throw new Error('POST /api/auth/login failed: ' + JSON.stringify(loginCustRes));
  }
  console.log('OK: POST /api/auth/login authenticated existing customer');

  // Login invalid password
  const badLoginRes = await request('POST', '/api/auth/login', {
    email: testCustomerEmail,
    password: 'WrongPassword!'
  });
  if (badLoginRes.status !== 401) {
    throw new Error('Expected 401 for bad customer password, got: ' + badLoginRes.status);
  }
  console.log('OK: Bad credentials rejected with 401');

  // Google sign-in requires a Google-signed ID token. A bare email/name must never sign anyone in.
  // (Verified Google sign-in is covered by tests/api.test.js with a test signing key.)
  const googleEmail = 'google_user_' + Date.now() + '@gmail.com';
  const googleRes = await request('POST', '/api/auth/google', {
    email: googleEmail,
    name: 'Google Customer',
    picture: 'https://example.com/avatar.jpg'
  });
  if (![401, 503].includes(googleRes.status) || (googleRes.data && googleRes.data.token)) {
    throw new Error('Unverified Google sign-in must be refused (401, or 503 when not configured): ' + JSON.stringify(googleRes.data));
  }
  console.log('OK: POST /api/auth/google refuses unverified sign-in (' + googleRes.status + ')');

  // Customer Logout
  const logoutRes = await request('POST', '/api/auth/logout', null, { 'x-auth-token': custToken });
  if (logoutRes.status !== 200) {
    throw new Error('POST /api/auth/logout failed: ' + JSON.stringify(logoutRes));
  }
  // After logout, token should be invalid
  const loggedOutMe = await request('GET', '/api/auth/me', null, { 'x-auth-token': custToken });
  if (loggedOutMe.status !== 401) {
    throw new Error('Expected 401 for invalidated session token, got: ' + loggedOutMe.status);
  }
  console.log('OK: Customer session token invalidated upon logout');

  console.log('\n======================================================');
  console.log('ALL HTTP SERVER & INTEGRATION TESTS PASSED 100%!');
  console.log('======================================================');
  process.exit(0);
}

runHttpTests().catch(err => {
  console.error('HTTP TEST FAILURE:', err);
  process.exit(1);
});
