// Shop settings persistence and the admin-managed GCash configuration, on a throw-away database.
// Guards against settings being returned as {} (async JSON parsing), the QR code being wiped when only the
// name/number is edited, GCash being offered while incomplete, and the order-status regressions from the
// async database migration (invalid jumps accepted, reject + restock crashing).
const iso = require('./helpers/isolated-db');
process.env.ORDER_RATE_LIMIT = '1000';
const crypto = require('crypto');
const db = require('../server/db');
const rules = require('../js/shop-rules.js');

let base, pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; failures.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra).slice(0, 300) : '')); }
}
async function call(method, p, body, token) {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let data; try { data = JSON.parse(t); } catch (_) { data = t; }
  return { status: r.status, data };
}
const png = () => 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(80)]).toString('base64');
const stock = async (id) => (await db.prepare('SELECT stock_count s FROM flowers WHERE id = ?').get(id)).s;

(async () => {
  ({ base } = await iso.startServer());
  const store = require('../server/store');
  const adm = (await call('POST', '/api/admin/login', { username: 'admin', password: iso.adminPassword })).data.token;
  check('admin signed in', !!adm);

  console.log('\n[1] Settings are saved and returned with their real values');
  let r = await call('PUT', '/api/admin/settings', { store: { name: 'Test Florist', tagline: 'Keep me' } }, adm);
  check('save returns the saved section', r.status === 200 && r.data.settings.store.name === 'Test Florist', r.data);
  r = await call('PUT', '/api/admin/settings', { store: { tagline: 'Changed' } }, adm);
  check('partial save keeps the rest of the section', r.data.settings.store.name === 'Test Florist' && r.data.settings.store.tagline === 'Changed', r.data.settings && r.data.settings.store);
  r = await call('GET', '/api/admin/settings', null, adm);
  check('GET returns saved values', r.data.settings.store.name === 'Test Florist', r.data.settings && r.data.settings.store);

  console.log('\n[2] GCash is available only with QR code + account name + number');
  const qr = (await call('POST', '/api/admin/upload', { dataUrl: png(), folder: 'settings' }, adm)).data.url;
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: 'Shop Owner', number: '09171112222', qrImage: qr } } }, adm);
  check('full GCash config saved and returned', r.status === 200 && r.data.settings.payment.gcash.qrImage === qr, r.data);
  r = await call('GET', '/api/catalog');
  check('customers see QR, name and number', r.data.payment.gcash && r.data.payment.gcash.qrImage === qr && r.data.payment.gcash.accountName === 'Shop Owner' && r.data.payment.gcash.number === '09171112222', r.data.payment);
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: 'New Name', number: '09171112222' } } }, adm);
  check('editing name/number keeps the QR code', r.data.settings.payment.gcash.qrImage === qr && r.data.settings.payment.gcash.accountName === 'New Name', r.data.settings && r.data.settings.payment);
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: 'Only Name', number: '' } } }, adm);
  check('name without number refused', r.status === 400);
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: 'New Name', number: '09171112222', qrImage: '' } } }, adm);
  check('QR removed → unavailable to customers', r.status === 200 && (await call('GET', '/api/catalog')).data.payment.gcash === null);
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: '', number: '', qrImage: qr } } }, adm);
  check('QR without name/number → still unavailable', (await call('GET', '/api/catalog')).data.payment.gcash === null && await store.gcashConfigured() === false);

  console.log('\n[3] Orders: GCash enforcement, status rules, reject + restock');
  const email = `ana_${Date.now()}@example.com`;
  const reg = await call('POST', '/api/auth/register', { name: 'Ana Cruz', email, password: 'Password-123', phone: '09171234567' });
  const ana = (await call('POST', '/api/auth/verify-otp', { email, otp: reg.data.testOtp })).data.token;
  check('customer account ready', !!ana);
  const order = (over) => ({ fulfillment: 'delivery', firstName: 'Ana', lastName: 'Cruz', phone: '09171234567', email,
    address: '12 Rizal Avenue', district: '3', barangay: 'Barangay 300', city: 'Manila', notes: '',
    date: rules.earliestDate('delivery'), time: rules.deliverySlots[0], paymentMethod: 'GCash', giftMessage: '',
    items: [{ id: 'fl-rose-red', quantity: 2 }], ...over });
  check('GCash order refused while GCash is unavailable', (await call('POST', '/api/orders', order(), ana)).status === 400);
  await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: 'Shop Owner', number: '09171112222', qrImage: qr } } }, adm);
  check('GCash order accepted once configured', (await call('POST', '/api/orders', order(), ana)).status === 201);

  const before = await stock('fl-rose-red');
  r = await call('POST', '/api/orders', order({ paymentMethod: 'Cash on Delivery' }), ana);
  const n = encodeURIComponent(r.data.orderNumber);
  const afterOrder = await stock('fl-rose-red');
  r = await call('POST', `/api/admin/orders/${n}/status`, { status: 'Picked Up' }, adm);
  check('invalid status jump rejected', r.status >= 400 && r.status < 500, r);
  r = await call('POST', `/api/admin/orders/${n}/reject`, { reason: 'Test' }, adm);
  check('reject succeeds', r.status === 200 && r.data.order.status === 'Rejected/Cancelled', r);
  check('stock returned on reject', (await stock('fl-rose-red')) === afterOrder + 2 && afterOrder + 2 === before);

  r = await call('PUT', '/api/auth/me', { name: 'Ana Cruz', address: { street: '5 Taft Ave', district: '5', barangay: 'Barangay 700', landmark: 'Church' } }, ana);
  check('saved customer address is returned (not {})', r.data.user && r.data.user.address && r.data.user.address.street === '5 Taft Ave', r.data);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) console.log('FAILED: ' + failures.join(' | '));
  iso.stopServer();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
