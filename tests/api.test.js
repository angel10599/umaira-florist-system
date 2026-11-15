// End-to-end API tests: boots the real server on a throwaway database and drives it over HTTP.
const os = require('os'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'umaira-test-'));
process.env.UMAIRA_DATA_DIR = tmp;
process.env.UMAIRA_TEST = '1';
process.env.UMAIRA_UPLOAD_DIR = path.join(tmp, 'uploads'); // test uploads never land in assets/uploads
process.env.ADMIN_USERNAME = 'admin';
process.env.ORDER_RATE_LIMIT = '1000';
process.env.ADMIN_PASSWORD = 'Test-Admin-Pass-1';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

const app = require('../server.js');
const store = require('../server/store');
const rules = require('../js/shop-rules.js');

// Fake Google signing key so we can mint valid and forged tokens without contacting Google.
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-kid', alg: 'RS256', use: 'sig' };
app.googleKeyFetcher = async () => [jwk];
function jwt(payload, key = privateKey, kid = 'test-kid') {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b({ alg: 'RS256', kid, typ: 'JWT' }), body = b(payload);
  return `${head}.${body}.${crypto.sign('RSA-SHA256', Buffer.from(head + '.' + body), key).toString('base64url')}`;
}
const goodClaims = (o = {}) => ({ iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, sub: 'g-123',
  email: 'gina@example.com', email_verified: true, name: 'Gina Google', exp: Math.floor(Date.now() / 1000) + 600, ...o });

let base, pass = 0, fail = 0;
const failures = [];
async function call(method, p, body, token, hdr = {}) {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...hdr }, body: body ? JSON.stringify(body) : undefined });
  let data; const t = await r.text(); try { data = JSON.parse(t); } catch (e) { data = t; }
  return { status: r.status, data, headers: r.headers };
}
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; failures.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

// A valid delivery order payload for the Manila rules
function orderBody(items, over = {}) {
  const date = rules.earliestDate ? rules.earliestDate('delivery') : new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  return { fulfillment: 'delivery', firstName: 'Ana', lastName: 'Cruz', phone: '09171234567', email: 'ana@example.com',
    address: '12 Rizal Avenue, Unit 4', district: '3', barangay: 'Barangay 300', city: 'Manila', notes: '',
    date, time: rules.deliverySlots[0], paymentMethod: 'GCash', giftMessage: 'Hi', items, ...over };
}

(async () => {
  const server = await app.start(0);
  base = 'http://127.0.0.1:' + server.address().port;
  console.log('\n[1] Guest / public');
  let r = await call('GET', '/');
  check('homepage served to guests', r.status === 200 && /Umaira/i.test(r.data));
  check('security headers set', r.headers.get('x-content-type-options') === 'nosniff');
  r = await call('GET', '/api/catalog');
  check('catalog is public and from DB', r.status === 200 && r.data.flowers.length >= 20 && r.data.bouquets.length >= 24);
  check('catalog exposes no archived/secret fields', !JSON.stringify(r.data).includes('password'));
  for (const p of ['/api/my/orders', '/api/cart', '/api/auth/me', '/api/admin/stats', '/api/admin/dashboard/analytics', '/api/admin/orders', '/api/admin/customers', '/api/orders/%23FLR-20260101-1111']) {
    r = await call('GET', p); check('guest blocked: GET ' + p, r.status === 401, r.status);
  }
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-rose-red', quantity: 1 }]));
  check('guest cannot place order', r.status === 401);
  r = await call('GET', '/data/umaira.db'); check('database file is not downloadable', r.status === 404);
  r = await call('GET', '/server/store.js'); check('server source not downloadable', r.status === 404);
  r = await call('GET', '/assets/../server.js'); check('path traversal blocked', r.status === 404 || r.status === 400);
  r = await call('GET', '/%E0%A4%A'); check('malformed URL does not crash server', r.status === 400);
  r = await call('GET', '/api/catalog'); check('server still alive after malformed URL', r.status === 200);
  r = await call('GET', '/api/auth/config'); check('auth config only exposes public client id', Object.keys(r.data).join() === 'googleClientId');
  r = await call('POST', '/api/auth/config', { googleClientId: 'evil' }); check('cannot overwrite Google config from the web', r.status === 404);

  console.log('\n[2] Registration & login');
  r = await call('POST', '/api/auth/register', { name: 'A', email: 'bad', password: 'x' });
  check('invalid registration rejected', r.status === 400);
  r = await call('POST', '/api/auth/register', { name: 'Ana Cruz', email: 'ana@example.com', password: 'short' });
  check('short password rejected', r.status === 400);
  r = await call('POST', '/api/auth/register', { name: 'Ana Cruz', email: 'Ana@Example.com', password: 'password123', phone: '0917 123 4567', role: 'admin' });
  check('registration sends OTP and requires verification', r.status === 200 && r.data.requiresVerification && r.data.testOtp, r.data);
  const otp = r.data.testOtp;
  let badOtp = await call('POST', '/api/auth/verify-otp', { email: 'Ana@Example.com', otp: '000000' });
  check('invalid OTP rejected', badOtp.status === 400);
  let v = await call('POST', '/api/auth/verify-otp', { email: 'Ana@Example.com', otp });
  check('registration verified and activated with OTP', v.status === 201 && v.data.token && v.data.user.email === 'ana@example.com', v.data);
  check('self-assigned role ignored (customer)', v.data.user.role === 'customer');
  const ana = v.data.token, anaId = v.data.user.id;
  r = await call('POST', '/api/auth/register', { name: 'Ana Again', email: 'ANA@example.com', phone: '0917 999 8877', password: 'password123' });
  check('duplicate email (case-insensitive) blocked', r.status === 409);
  r = await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'wrongpass' });
  check('wrong password rejected', r.status === 401);
  r = await call('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'whatever1' });
  check('unknown account gives same generic error', r.status === 401 && r.data.error === 'Invalid email or password.');
  r = await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'password123' });
  check('login succeeds with correct credentials', r.status === 200 && r.data.user.id === anaId);
  const ana2 = r.data.token;
  r = await call('GET', '/api/auth/me', null, ana2); check('session token loads profile', r.status === 200 && r.data.user.email === 'ana@example.com');
  const hash = require('node:sqlite') && new (require('node:sqlite').DatabaseSync)(path.join(tmp, 'umaira.db')).prepare('SELECT password_hash FROM users WHERE id=?').get(anaId).password_hash;
  check('password stored as scrypt hash, not plaintext', hash.startsWith('scrypt$') && !hash.includes('password123'));
  r = await call('POST', '/api/auth/logout', {}, ana2);
  r = await call('GET', '/api/auth/me', null, ana2); check('logout invalidates session server-side', r.status === 401);

  console.log('\n[3] Google sign-in');
  r = await call('POST', '/api/auth/google', { email: 'ana@example.com', name: 'Ana' });
  check('email-only Google login (old bypass) rejected', r.status === 401, r.status);
  r = await call('POST', '/api/auth/google', { credential: jwt(goodClaims(), crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey) });
  check('forged token (wrong signature) rejected', r.status === 401);
  r = await call('POST', '/api/auth/google', { credential: jwt(goodClaims({ aud: 'someone-elses-app' })) });
  check('token for another app rejected', r.status === 401);
  r = await call('POST', '/api/auth/google', { credential: jwt(goodClaims({ exp: Math.floor(Date.now() / 1000) - 10 })) });
  check('expired token rejected', r.status === 401);
  r = await call('POST', '/api/auth/google', { credential: jwt(goodClaims({ email_verified: false })) });
  check('unverified Google email rejected', r.status === 401);
  r = await call('POST', '/api/auth/google', { credential: jwt(goodClaims({ email: 'ana@example.com', sub: 'attacker' })) });
  check('verified Google token links to existing account (same user, no duplicate)', r.status === 200 && r.data.user.id === anaId, r.data);
  r = await call('POST', '/api/auth/google', { credential: jwt(goodClaims({ email: 'ana@example.com', sub: 'someone-else' })) });
  check('second, different Google identity cannot take over a linked account', r.status === 409);
  r = await call('POST', '/api/auth/google', { credential: jwt(goodClaims()) });
  check('new customer created via Google', r.status === 200 && r.data.user.email === 'gina@example.com' && r.data.user.role === 'customer');
  const ginaId = r.data.user.id;
  r = await call('POST', '/api/auth/google', { credential: jwt(goodClaims()) });
  check('returning Google customer reuses same record', r.data.user.id === ginaId);
  check('no duplicate customer rows', store.listCustomers().filter(c => c.email === 'gina@example.com').length === 1);

  console.log('\n[4] Password reset');
  r = await call('POST', '/api/auth/forgot', { email: 'ana@example.com' });
  check('reset request answers generically (existing)', r.status === 200 && !JSON.stringify(r.data).match(/[0-9a-f]{64}/));
  const r2 = await call('POST', '/api/auth/forgot', { email: 'nobody@example.com' });
  check('reset request answers identically for unknown email', JSON.stringify(r2.data) === JSON.stringify(r.data));
  const tok = store.createPasswordReset(anaId);
  r = await call('POST', '/api/auth/reset', { token: tok, password: 'short' }); check('weak new password rejected', r.status === 400);
  r = await call('POST', '/api/auth/reset', { token: 'deadbeef', password: 'newpassword1' }); check('bad reset token rejected', r.status === 400);
  r = await call('POST', '/api/auth/reset', { token: tok, password: 'newpassword1' }); check('valid reset token accepted', r.status === 200);
  r = await call('POST', '/api/auth/reset', { token: tok, password: 'another-pass1' }); check('reset token is single-use', r.status === 400);
  r = await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'password123' }); check('old password no longer works', r.status === 401);
  r = await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'newpassword1' }); check('new password works', r.status === 200);
  const anaTok = r.data.token;

  console.log('\n[5] Profile & cart persistence');
  r = await call('PUT', '/api/auth/me', { name: 'Ana C. Cruz', phone: '09999999999', role: 'admin', email: 'hacker@x.com', address: { street: '1 Test St', district: '3', barangay: 'Barangay 300', landmark: 'Near church' } }, anaTok);
  check('profile updated', r.status === 200 && r.data.user.name === 'Ana C. Cruz' && r.data.user.address.street === '1 Test St');
  check('role and email cannot be changed via profile', r.data.user.role === 'customer' && r.data.user.email === 'ana@example.com');
  r = await call('PUT', '/api/auth/me', { name: 'x' }, anaTok); check('invalid profile name rejected', r.status === 400);
  r = await call('PUT', '/api/cart', { items: [{ id: 'fl-rose-red', name: 'Rose', price: 120, quantity: 2 }] }, anaTok);
  check('cart saved', r.status === 200 && r.data.items[0].quantity === 2);
  r = await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'newpassword1' });
  const anaNew = r.data.token;
  r = await call('GET', '/api/cart', null, anaNew); check('cart and profile survive logout/login', r.data.items.length === 1 && r.data.items[0].id === 'fl-rose-red');
  r = await call('GET', '/api/auth/me', null, anaNew); check('profile persisted', r.data.user.phone === '09999999999');

  console.log('\n[6] Ordering, pricing, stock');
  const s0 = store.getFlower('fl-rose-red').stockCount;
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-rose-red', quantity: 3, price: 1 }], { orderNumber: '#FLR-20261009-1234', paymentMethod: 'Cash on Delivery' }), anaNew);
  check('order placed', r.status === 201, r.data);
  check('price comes from DB, tampered client price ignored', r.data.subtotal === 360 && r.data.deliveryFee === 150 && r.data.total === 510, r.data);
  check('stock decremented', store.getFlower('fl-rose-red').stockCount === s0 - 3);
  check('cart cleared after order', (await call('GET', '/api/cart', null, anaNew)).data.items.length === 0);
  const num = r.data.orderNumber;
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-rose-red', quantity: 3 }], { orderNumber: num }), anaNew);
  check('duplicate submission returns same order, no second order', r.status === 200 && r.data.orderNumber === num && r.data.duplicate === true);
  check('stock not decremented twice', store.getFlower('fl-rose-red').stockCount === s0 - 3);
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-rose-red', quantity: 1 }], { fulfillment: 'pickup', paymentMethod: 'Cash on Pickup', date: rules.earliestDate('pickup'), time: (rules.availablePickupSlots(rules.earliestDate('pickup'))[0] || rules.pickupSlots()[0]).label }), anaNew);
  check('pickup order has no delivery fee', r.status === 201 && r.data.deliveryFee === 0, r.data);
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-rose-red', quantity: 25 }]), anaNew);
  check('free delivery at/above threshold', r.status === 201 && r.data.deliveryFee === 0 && r.data.subtotal === 3000, r.data);
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-rose-red', quantity: 50 }, { id: 'fl-rose-red', quantity: 50 }]), anaNew);
  check('cannot oversell stock across lines', r.status === 409 || r.status === 400, r.data);
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-peony-blush', quantity: 1 }]), anaNew);
  check('sold-out product cannot be ordered', r.status === 409 || r.status === 400, r.data);
  for (const bad of [0, -1, 1.5, 51, 'abc']) {
    r = await call('POST', '/api/orders', orderBody([{ id: 'fl-rose-red', quantity: bad }]), anaNew);
    check('invalid quantity rejected: ' + bad, r.status === 400);
  }
  r = await call('POST', '/api/orders', orderBody([{ id: 'does-not-exist', quantity: 1 }]), anaNew); check('unknown product rejected', r.status === 400);
  r = await call('POST', '/api/orders', orderBody([]), anaNew); check('empty cart rejected', r.status === 400);
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-rose-red', quantity: 1 }], { district: '99', barangay: 'Barangay 1' }), anaNew); check('invalid delivery district rejected', r.status === 400);
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-rose-red', quantity: 1 }], { city: 'Makati', address: '1 Ayala Ave, Makati' }), anaNew); check('outside-Manila address rejected', r.status === 400);
  r = await call('POST', '/api/orders', orderBody([{ id: 'bq-pink-romance', quantity: 2 }]), anaNew);
  check('ready-made bouquet priced from DB', r.status === 201 && r.data.subtotal === 1560, r.data);
  r = await call('POST', '/api/orders', orderBody([{ isCustom: true, name: 'Mine', quantity: 1, specs: { mainFlowers: [{ id: 'fl-rose-red', quantity: 2 }, { id: 'fl-tulip-pink', quantity: 1 }], wrapping: 'wrp-kraft', ribbon: 'rbn-beige-jute' } }]), anaNew);
  check('custom bouquet priced from DB + stock reserved', r.status === 201 && r.data.subtotal >= 390, r.data);

  console.log('\n[7] Order privacy & history');
  const gt = (await call('POST', '/api/auth/google', { credential: jwt(goodClaims()) })).data.token;
  r = await call('GET', '/api/my/orders', null, anaNew);
  check('customer sees own orders', r.status === 200 && r.data.orders.length >= 4 && r.data.orders.every(o => o.email === 'ana@example.com'));
  r = await call('GET', '/api/my/orders', null, gt); check('other customer sees none of them', r.status === 200 && r.data.orders.length === 0);
  r = await call('GET', '/api/orders/' + encodeURIComponent(num), null, gt); check("cannot read another customer's order", r.status === 404);
  r = await call('GET', '/api/orders/' + encodeURIComponent(num), null, anaNew); check('owner can read order with items', r.status === 200 && r.data.items.length === 1);

  console.log('\n[8] Admin access control');
  r = await call('POST', '/api/admin/login', { username: 'admin', password: 'umaira2026' }); check('old default admin password rejected', r.status === 401);
  r = await call('POST', '/api/admin/login', { username: 'admin', password: 'wrong' }); check('wrong admin password rejected', r.status === 401);
  r = await call('POST', '/api/admin/login', { username: 'whoever', password: 'Test-Admin-Pass-1' }); check('admin username is checked', r.status === 401);
  r = await call('GET', '/api/admin/stats', null, anaNew); check('customer token cannot use admin API', r.status === 401);
  r = await call('POST', '/api/admin/flowers', { name: 'Hack', price: 1 }, anaNew); check('customer cannot create products', r.status === 401);
  r = await call('POST', '/api/admin/login', { username: 'admin', password: 'Test-Admin-Pass-1' });
  check('admin login succeeds', r.status === 200 && r.data.token);
  const adm = r.data.token;
  r = await call('GET', '/api/my/orders', null, adm); check('admin token is not a customer session', r.status === 401);

  console.log('\n[9] Admin order management -> customer visibility');
  r = await call('GET', '/api/admin/orders', null, adm); check('admin sees all customers\' orders', r.status === 200 && r.data.orders.length >= 4);
  r = await call('POST', `/api/admin/orders/${encodeURIComponent(num)}/status`, { status: 'Delivered' }, adm); check('illegal status jump rejected', r.status === 400);
  r = await call('POST', `/api/admin/orders/${encodeURIComponent(num)}/confirm`, {}, adm); check('admin confirms order', r.status === 200 && r.data.order.status === 'Confirmed');
  r = await call('GET', '/api/orders/' + encodeURIComponent(num), null, anaNew); check('customer sees updated status', r.data.status === 'Confirmed');
  r = await call('GET', '/api/my/orders', null, anaNew); check('order history reflects status', r.data.orders.find(o => o.orderNumber === num).status === 'Confirmed');
  for (const s of ['Preparing', 'Rider Assigned']) r = await call('POST', `/api/admin/orders/${encodeURIComponent(num)}/status`, { status: s, grabTrackingUrl: 'https://grab.com/track/1' }, adm);
  check('tracking link saved', r.data.order.grabTrackingUrl === 'https://grab.com/track/1');
  r = await call('POST', `/api/admin/orders/${encodeURIComponent(num)}/status`, { status: 'On the Way', grabTrackingUrl: 'javascript:alert(1)' }, adm); check('non-https tracking link rejected', r.status === 400);
  await call('POST', `/api/admin/orders/${encodeURIComponent(num)}/status`, { status: 'On the Way' }, adm);
  r = await call('POST', `/api/admin/orders/${encodeURIComponent(num)}/status`, { status: 'Delivered' }, adm);
  check('admin cannot mark a delivery delivered without a photo', r.status === 400 && r.data.code === 'DELIVERY_CONFIRMATION_REQUIRED');
  r = await call('POST', `/api/admin/orders/${encodeURIComponent(num)}/pod`, { photoUrl: '/assets/uploads/aaaaaaaaaaaaaaaaaaaa.png' }, adm);
  check('order delivered with a photo (awaiting the customer)', r.status === 200 && r.data.order.status === 'Delivered — Awaiting Confirmation');
  r = await call('POST', `/api/orders/${encodeURIComponent(num)}/confirm-delivery`, { confirmed: true }, anaNew);
  check('order delivered and confirmed by the customer', r.status === 200 && r.data.order.status === 'Delivered — Confirmed');
  r = await call('POST', `/api/admin/orders/${encodeURIComponent(num)}/reject`, { reason: 'x' }, adm); check('delivered order cannot be cancelled', r.status === 400);

  console.log('\n[10] Cancel restores stock; dashboard maths');
  const before = store.getFlower('fl-rose-red').stockCount;
  const pend = (await call('POST', '/api/orders', orderBody([{ id: 'fl-rose-red', quantity: 4 }]), anaNew)).data.orderNumber;
  check('stock reduced by new order', store.getFlower('fl-rose-red').stockCount === before - 4);
  r = await call('POST', `/api/admin/orders/${encodeURIComponent(pend)}/reject`, { reason: 'Out of town' }, adm);
  check('admin rejects order with reason', r.status === 200 && r.data.order.rejectReason === 'Out of town');
  check('stock restored on cancel', store.getFlower('fl-rose-red').stockCount === before);
  r = await call('GET', '/api/orders/' + encodeURIComponent(pend), null, anaNew); check('customer sees cancellation reason', r.data.status === 'Rejected/Cancelled' && r.data.rejectReason === 'Out of town');
  // The delivered order is Cash on Delivery: completed but unpaid until the remitted cash is confirmed.
  let st = (await call('GET', '/api/admin/stats', null, adm)).data;
  check('completed but unpaid COD is not revenue yet (shown separately)', st.totalRevenue === 0 && st.completedUnpaidAmount === 510 && st.completedUnpaidOrders === 1, st);
  r = await call('POST', `/api/admin/orders/${encodeURIComponent(num)}/payments/cash`, { amountReceived: 510, confirmReceived: true, collectedByCourier: true, remittedToShop: true }, adm);
  check('remitted COD cash confirmed', r.status === 200 && r.data.order.paymentStatus === 'Paid', r.data);
  const all = (await call('GET', '/api/admin/orders?limit=500', null, adm)).data.orders;
  st = (await call('GET', '/api/admin/stats', null, adm)).data;
  const expRev = all.filter(o => rules.DONE_ORDER_STATUSES.includes(o.status) && o.paymentStatus === 'Paid').reduce((a, o) => a + o.total, 0);
  check('dashboard total orders matches DB', st.totalOrders === all.length);
  check('dashboard revenue = completed AND paid orders only', st.totalRevenue === expRev && expRev === 510, { st: st.totalRevenue, expRev });
  check('dashboard counts pending/cancelled correctly', st.pendingOrders === all.filter(o => o.status === 'Pending Confirmation').length && st.cancelledOrders === 1);
  check('dashboard customer count', st.totalCustomers === 2);

  const analytics7 = (await call('GET', '/api/admin/dashboard/analytics?range=last7days', null, adm)).data;
  check('dashboard analytics returns valid structure', analytics7 && analytics7.kpis && analytics7.trend && analytics7.orderDistribution && analytics7.inventoryOverview);
  const expQualRev = all.filter(o => o.status !== 'Rejected/Cancelled').reduce((a, o) => a + o.total, 0);
  check('dashboard analytics revenue matches qualifying orders', analytics7.kpis.totalRevenue === expQualRev);
  check('dashboard analytics inventory counts valid', analytics7.inventoryOverview.totalItems > 0 && analytics7.inventoryOverview.threshold === 20);
  const analyticsToday = (await call('GET', '/api/admin/dashboard/analytics?range=today', null, adm)).data;
  check('dashboard analytics supports today range', analyticsToday && analyticsToday.trend.labels.length > 0);
  const analyticsCustom = (await call('GET', '/api/admin/dashboard/analytics?range=custom&startDate=2026-10-01&endDate=2026-10-31', null, adm)).data;
  check('dashboard analytics supports custom range', analyticsCustom && analyticsCustom.range === 'custom');

  console.log('\n[11] Admin product management -> storefront consistency');
  r = await call('POST', '/api/admin/flowers', { name: 'Test Orchid', category: 'Orchids', price: 0, stockCount: 5 }, adm); check('zero price rejected', r.status === 400);
  r = await call('POST', '/api/admin/flowers', { name: 'Test Orchid', category: 'Orchids', price: 200, stockCount: -2 }, adm); check('negative stock rejected', r.status === 400);
  r = await call('POST', '/api/admin/flowers', { name: 'Test Orchid', category: 'Orchids', price: 200, stockCount: 5, image: 'javascript:alert(1)' }, adm); check('unsafe image URL rejected', r.status === 400);
  r = await call('POST', '/api/admin/flowers', { name: 'Test Orchid', category: 'Orchids', price: 200, stockCount: 5, availability: 'available', description: 'Pretty' }, adm);
  check('admin adds product', r.status === 200 && r.data.flower.id === 'fl-test-orchid', r.data);
  let cat = (await call('GET', '/api/catalog')).data;
  check('new product appears in public catalog', cat.flowers.some(f => f.id === 'fl-test-orchid'));
  r = await call('PUT', '/api/admin/flowers/fl-test-orchid', { name: 'Test Orchid', category: 'Orchids', price: 250, stockCount: 0, availability: 'available' }, adm);
  check('stock 0 forces sold_out (never "available")', r.data.flower.availability === 'sold_out' && r.data.flower.stockCount === 0, r.data);
  cat = (await call('GET', '/api/catalog')).data;
  check('price change reflected in catalog', cat.flowers.find(f => f.id === 'fl-test-orchid').price === 250);
  await call('PUT', '/api/admin/flowers/fl-test-orchid', { name: 'Test Orchid', category: 'Orchids', price: 250, stockCount: 7, availability: 'available' }, adm);
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-test-orchid', quantity: 2 }]), anaNew);
  check('customer is charged the admin-updated price', r.status === 201 && r.data.subtotal === 500, r.data);
  check('stock now 5 after order', store.getFlower('fl-test-orchid').stockCount === 5);
  r = await call('PUT', '/api/admin/bouquets/bq-pink-romance', { name: 'Pink Romance', price: 900, availability: 'available', category: 'Ready-Made Bouquets' }, adm);
  check('admin edits bouquet price', r.status === 200 && r.data.bouquet.price === 900);
  r = await call('POST', '/api/orders', orderBody([{ id: 'bq-pink-romance', quantity: 1 }]), anaNew); check('bouquet charged at new price', r.data.subtotal === 900);
  r = await call('PUT', '/api/admin/bouquets/bq-pink-romance', { name: 'Pink Romance', price: 900, availability: 'sold_out' }, adm);
  r = await call('POST', '/api/orders', orderBody([{ id: 'bq-pink-romance', quantity: 1 }]), anaNew); check('sold-out bouquet cannot be ordered', r.status === 400, r);
  r = await call('PUT', '/api/admin/bouquets/bq-pink-romance', { name: 'Pink Romance', price: 900, availability: 'unavailable' }, adm);
  r = await call('POST', '/api/orders', orderBody([{ id: 'bq-pink-romance', quantity: 1 }]), anaNew); check('unavailable bouquet cannot be ordered', r.status === 400, r);
  r = await call('PUT', '/api/admin/bouquets/bq-pink-romance', { name: 'Pink Romance', price: 900, availability: 'available' }, adm);

  // Occasion synchronization test
  const shopRules = require('../js/shop-rules.js');
  const expectedOccasions = [
    'Birthday', 'Anniversary', "Valentine's Day", "Mother's Day",
    'Graduation', 'Congratulations', 'Sympathy', 'Thank You'
  ];
  check('official occasions centralized in shop-rules', JSON.stringify(shopRules.OFFICIAL_OCCASIONS) === JSON.stringify(expectedOccasions));

  r = await call('PUT', '/api/admin/bouquets/bq-pink-romance', {
    name: 'Pink Romance', price: 900, availability: 'available',
    occasion: "Valentine's Day, Anniversary",
    specs: { occasions: ["Valentine's Day", "Anniversary"] }
  }, adm);
  check('admin updates bouquet occasion', r.status === 200 && r.data.bouquet.occasion === "Valentine's Day, Anniversary");
  cat = (await call('GET', '/api/catalog')).data;
  const syncBq = cat.bouquets.find(b => b.id === 'bq-pink-romance');
  check('updated bouquet occasion visible in public catalog', syncBq && syncBq.occasion === "Valentine's Day, Anniversary" && JSON.stringify(syncBq.specs.occasions) === JSON.stringify(["Valentine's Day", "Anniversary"]));
  r = await call('PUT', '/api/admin/flowers/fl-test-orchid', { name: 'Test Orchid', category: 'Orchids', price: 250, stockCount: 15, availability: 'unavailable' }, adm);
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-test-orchid', quantity: 1 }]), anaNew); check('unavailable product with stock cannot be ordered', r.status === 400, r);
  r = await call('DELETE', '/api/admin/flowers/fl-test-orchid', null, adm); check('admin archives product', r.status === 200);
  cat = (await call('GET', '/api/catalog')).data; check('archived product leaves the storefront', !cat.flowers.some(f => f.id === 'fl-test-orchid'));
  r = await call('POST', '/api/orders', orderBody([{ id: 'fl-test-orchid', quantity: 1 }]), anaNew); check('archived product cannot be ordered', r.status === 400, r.data);
  const oldOrder = (await call('GET', '/api/my/orders', null, anaNew)).data.orders.find(o => o.items.some(i => i.itemId === 'fl-test-orchid'));
  check('past orders keep archived product lines', !!oldOrder);
  r = await call('DELETE', '/api/admin/flowers/nope', null, adm); check('archiving unknown product -> 404', r.status === 404);

  const png = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]).toString('base64');
  r = await call('POST', '/api/admin/upload', { dataUrl: png }, adm); check('admin can upload an image', r.status === 201 && /^\/assets\/uploads\/[0-9a-f]+\.png$/.test(r.data.url), r.data);
  const upUrl = r.data.url; r = await call('GET', upUrl); check('uploaded image is served', r.status === 200);
  try { fs.unlinkSync(path.join(__dirname, '..', upUrl)); } catch (e) {} // keep the project folder clean
  r = await call('POST', '/api/admin/upload', { dataUrl: 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64') }, adm); check('fake image (bad magic bytes) rejected', r.status === 400);
  r = await call('POST', '/api/admin/upload', { dataUrl: png }, anaNew); check('customer cannot upload', r.status === 401);

  console.log('\n[12] Admin customers & logout');
  r = await call('GET', '/api/admin/customers', null, adm);
  check('admin lists customers without secrets', r.status === 200 && r.data.customers.length === 2 && !JSON.stringify(r.data).match(/hash|password/i));
  check('customer order counts correct', r.data.customers.find(c => c.email === 'ana@example.com').orderCount >= 5);
  await call('POST', '/api/admin/logout', {}, adm);
  r = await call('GET', '/api/admin/stats', null, adm); check('admin logout invalidates session', r.status === 401);

  console.log('\n[13] Robustness');
  r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' }); check('malformed JSON -> 400, not crash', r.status === 400);
  r = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x'.repeat(200000) }) }).catch(() => ({ status: 'closed' }));
  check('oversized body refused', r.status === 413 || r.status === 'closed');
  r = await call('GET', '/api/catalog'); check('server healthy at end', r.status === 200);
  let limited = 0; for (let i = 0; i < 20; i++) { const x = await call('POST', '/api/auth/login', { email: 'brute@example.com', password: 'guess' + i }); if (x.status === 429) limited++; }
  check('login brute-force is rate limited', limited > 0, limited);
  // Admin sign-in lockout: applies to local addresses too, counts only FAILED attempts, success resets it.
  for (let i = 0; i < 7; i++) await call('POST', '/api/admin/login', { username: 'admin', password: 'wrong-' + i });
  r = await call('POST', '/api/admin/login', { username: 'admin', password: 'Test-Admin-Pass-1' });
  check('admin: correct password still works after 7 failures (and resets the count)', r.status === 200, r.status);
  const adminCodes = [];
  for (let i = 0; i < 9; i++) adminCodes.push((await call('POST', '/api/admin/login', { username: 'admin', password: 'wrong-again-' + i })).status);
  check('admin: 8 failed attempts from a local address -> 9th is locked (429)', adminCodes.slice(0, 8).every(s => s === 401) && adminCodes[8] === 429, adminCodes);
  r = await call('POST', '/api/admin/login', { username: 'admin', password: 'Test-Admin-Pass-1' });
  check('admin: locked address must wait even with the right password', r.status === 429, r.status);
  // Behind a reverse proxy (TRUST_PROXY=1): each visitor gets their own lockout; forged headers don't help.
  const adminLoginVia = (xff, password) => fetch(base + '/api/admin/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': xff }, body: JSON.stringify({ username: 'admin', password }) }).then(x => x.status);
  check('proxy: without TRUST_PROXY the header is ignored (still the locked local address)', await adminLoginVia('198.51.100.99', 'Test-Admin-Pass-1') === 429);
  process.env.TRUST_PROXY = '1';
  const attacker = [];
  for (let i = 0; i < 9; i++) attacker.push(await adminLoginVia('203.0.113.5', 'bad-' + i));
  check('proxy: attacker behind the proxy is locked after 8 failures', attacker.slice(0, 8).every(s => s === 401) && attacker[8] === 429, attacker);
  check('proxy: the real admin behind the same proxy can still sign in', await adminLoginVia('198.51.100.7', 'Test-Admin-Pass-1') === 200);
  check('proxy: forging X-Forwarded-For does not escape the lock (proxy-appended address is used)',
    await adminLoginVia('198.51.100.7, 203.0.113.5', 'Test-Admin-Pass-1') === 429);
  delete process.env.TRUST_PROXY;

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail) console.log('Failures:\n - ' + failures.join('\n - '));
  server.close(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST RUNNER CRASH', e); process.exit(2); });
