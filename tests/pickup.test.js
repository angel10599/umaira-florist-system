// Two-way store pickup confirmation on a throw-away database: the shop confirms the handover, the customer confirms
// receipt (or reports an issue). Neither can confirm for the other; duplicates are refused; history is kept;
// in-app notifications only; delivery orders unaffected.
const iso = require('./helpers/isolated-db');
process.env.ORDER_RATE_LIMIT = '1000';
const store = require('../server/store');
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
const enc = encodeURIComponent;

(async () => {
  ({ base } = await iso.startServer());
  const adm = (await call('POST', '/api/admin/login', { username: 'admin', password: iso.adminPassword })).data.token;
  const reg = async (name) => {
    const email = `${name.toLowerCase().replace(/\W/g, '')}_${Date.now()}@example.com`;
    const r1 = await call('POST', '/api/auth/register', { name, email, password: 'Password-123', phone: '09171234567' });
    if (!r1.data?.testOtp) return null;
    const r2 = await call('POST', '/api/auth/verify-otp', { email, otp: r1.data.testOtp });
    return r2.data?.token || null;
  };
  const ana = await reg('Ana Cruz'), ben = await reg('Ben Reyes');
  rules.updateShopInfo({ hours: store.getSetting('hours') || {}, pickup: store.getSetting('pickup') || {} });
  const date = rules.earliestDate('pickup');
  const slot = (rules.availablePickupSlots(date)[0] || rules.pickupSlots()[0]).label;
  const pickupOrder = async (tok, method = 'Cash on Pickup') => (await call('POST', '/api/orders', {
    fulfillment: 'pickup', firstName: 'Ana', lastName: 'Cruz', phone: '09171234567', email: 'ana@example.com',
    date, time: slot, paymentMethod: method, giftMessage: '', items: [{ id: 'fl-rose-red', quantity: 1 }] }, tok)).data.orderNumber;
  const ready = async (n) => {
    await call('POST', `/api/admin/orders/${enc(n)}/confirm`, {}, adm);
    for (const s of ['Preparing', 'Ready for Pickup']) await call('POST', `/api/admin/orders/${enc(n)}/status`, { status: s }, adm);
    await call('POST', `/api/admin/orders/${enc(n)}/payments/cash`, { amountReceived: store.get(n).total, confirmReceived: true }, adm);
  };
  const handover = (n, tok = adm) => call('POST', `/api/admin/orders/${enc(n)}/confirm-pickup`, {}, tok);
  const answer = (n, tok, body) => call('POST', `/api/orders/${enc(n)}/confirm-pickup`, body, tok);
  const custNotes = (n) => store.listNotificationsForCustomer(store.get(n).userId, n, 100);
  const adminNotes = (n) => store.listNotificationsForAdmin(200).filter(x => x.orderNumber === n);

  console.log('\n[1] Before the handover');
  const p1 = await pickupOrder(ana);
  await ready(p1);
  check('order is Ready for Pickup and paid (cash confirmed)', store.get(p1).status === 'Ready for Pickup' && store.get(p1).paymentStatus === 'Paid');
  let r = await answer(p1, ana, { confirmed: true });
  check('customer cannot confirm receipt before the shop confirms the handover', r.status === 409 && store.get(p1).status === 'Ready for Pickup', r.data);
  for (const s of ['Picked Up', 'Awaiting Customer Confirmation', 'Pickup Disputed']) {
    r = await call('POST', `/api/admin/orders/${enc(p1)}/status`, { status: s }, adm);
    check(`admin cannot set "${s}" through the status endpoint`, r.status === 400 && store.get(p1).status === 'Ready for Pickup', r.data);
  }
  r = await handover(p1, ana);
  check('a customer cannot confirm the handover on the shop\'s behalf', r.status === 401 && store.get(p1).status === 'Ready for Pickup');

  console.log('\n[2] Step 1 — shop confirms the handover');
  r = await handover(p1);
  const o1 = store.get(p1);
  check('Confirm Pickup → Awaiting Customer Confirmation', r.status === 200 && o1.status === 'Awaiting Customer Confirmation', r.data);
  check('the admin identity and date/time are recorded', o1.pickupHandoverBy === 'admin' && !!o1.pickupHandoverAt);
  check('the customer is asked in-app to confirm receipt', custNotes(p1).some(x => x.type === 'pickup_confirm_request'));
  r = await handover(p1);
  check('duplicate handover confirmation is refused', r.status === 409 && r.data.code === 'ALREADY_CONFIRMED');
  check('the order is not complete yet (not counted as Picked Up)', store.get(p1).status !== 'Picked Up');

  console.log('\n[3] Step 2 — customer confirms receipt');
  r = await answer(p1, ben, { confirmed: true });
  check('another customer cannot confirm this order', r.status === 404);
  r = await answer(p1, adm, { confirmed: true });
  check('the admin cannot confirm receipt on the customer\'s behalf', r.status === 401 && store.get(p1).status === 'Awaiting Customer Confirmation');
  r = await call('GET', `/api/orders/${enc(p1)}`, null, ana);
  check('the customer\'s order shows the shop handover time (no staff username)', r.data.pickupHandoverAt === o1.pickupHandoverAt && r.data.history.some(h => h.action === 'pickup_handover_confirmed' && h.by === 'Shop') && !JSON.stringify(r.data.history).includes('admin'));
  r = await answer(p1, ana, { confirmed: true });
  const done = store.get(p1);
  check('Confirm Received → Picked Up', r.status === 200 && done.status === 'Picked Up', r.data);
  check('the customer confirmation date/time is recorded', !!done.customerConfirmedAt && done.customerConfirmationStatus === 'confirmed');
  check('the admin is notified in-app that the customer confirmed receipt', adminNotes(p1).some(x => x.type === 'pickup_confirmed'));
  r = await answer(p1, ana, { confirmed: true });
  check('duplicate customer confirmation is refused', r.status === 409 && r.data.code === 'ALREADY_CONFIRMED');
  check('both confirmations are kept in the order history', (() => { const h = store.get(p1).history.map(e => e.action); return h.includes('pickup_handover_confirmed') && h.includes('pickup_receipt_confirmed'); })());

  console.log('\n[4] Customer reports that they did not receive the order');
  const p2 = await pickupOrder(ana);
  await ready(p2);
  await handover(p2);
  r = await answer(p2, ana, { confirmed: false, reason: 'I was at the shop but nobody handed me the bouquet' });
  check('Report an Issue → Pickup Disputed (instead of Picked Up)', r.status === 200 && store.get(p2).status === 'Pickup Disputed', r.data);
  check('the admin is notified in-app about the issue', adminNotes(p2).some(x => x.type === 'pickup_disputed' && /nobody handed/.test(x.message)));
  r = await answer(p2, ana, { confirmed: false, reason: 'again' });
  check('the issue cannot be reported twice', r.status === 409);
  r = await call('POST', `/api/admin/orders/${enc(p2)}/resolve-dispute`, { notes: 'Checked', finalStatus: 'Picked Up' }, adm);
  check('the shop cannot resolve the issue as "Picked Up" for the customer', r.status === 400 && store.get(p2).status === 'Pickup Disputed');
  r = await call('POST', `/api/admin/orders/${enc(p2)}/resolve-dispute`, { notes: 'Bouquet found at the counter; customer will collect again', finalStatus: 'Ready for Pickup' }, adm);
  check('the shop resolves it by preparing the handover again', r.status === 200 && store.get(p2).status === 'Ready for Pickup');
  r = await handover(p2);
  check('the second handover is confirmed by the shop', r.status === 200 && store.get(p2).status === 'Awaiting Customer Confirmation');
  r = await answer(p2, ana, { confirmed: true });
  check('…and then by the customer → Picked Up', r.status === 200 && store.get(p2).status === 'Picked Up');
  const h2 = store.get(p2).history.map(e => e.action);
  check('the full history is kept in order', JSON.stringify(h2) === JSON.stringify(['pickup_handover_confirmed', 'pickup_issue_reported', 'pickup_issue_resolved', 'pickup_handover_confirmed', 'pickup_receipt_confirmed']), h2);

  const p3 = await pickupOrder(ana);
  await ready(p3); await handover(p3);
  await answer(p3, ana, { confirmed: false, reason: 'Not received yet' });
  r = await answer(p3, ana, { confirmed: true });
  check('a customer who reported an issue can still confirm once they have the order', r.status === 200 && store.get(p3).status === 'Picked Up');

  console.log('\n[5] Payment rule and history integrity');
  const p4 = await pickupOrder(ana);
  await call('POST', `/api/admin/orders/${enc(p4)}/confirm`, {}, adm);
  for (const s of ['Preparing', 'Ready for Pickup']) await call('POST', `/api/admin/orders/${enc(p4)}/status`, { status: s }, adm);
  r = await handover(p4);
  check('an unpaid Cash on Pickup order cannot be handed over', r.status === 409 && r.data.code === 'PAYMENT_NOT_VERIFIED' && store.get(p4).status === 'Ready for Pickup');
  let threw = false; try { store.db.prepare("UPDATE order_events SET note = 'x'").run(); } catch (_) { threw = true; }
  check('confirmation history cannot be edited', threw);
  threw = false; try { store.db.prepare('DELETE FROM order_events').run(); } catch (_) { threw = true; }
  check('confirmation history cannot be deleted', threw);

  console.log('\n[6] Delivery orders are not affected');
  const d = (await call('POST', '/api/orders', { fulfillment: 'delivery', firstName: 'Ana', lastName: 'Cruz', phone: '09171234567', email: 'ana@example.com',
    address: '12 Rizal Avenue', district: '3', barangay: 'Barangay 300', city: 'Manila', notes: '', date: rules.earliestDate('delivery'), time: rules.deliverySlots[0],
    paymentMethod: 'Cash on Delivery', giftMessage: '', items: [{ id: 'fl-rose-red', quantity: 1 }] }, ana)).data.orderNumber;
  for (const s of ['Confirmed', 'Preparing', 'On the Way']) await call('POST', `/api/admin/orders/${enc(d)}/status`, { status: s }, adm);
  r = await handover(d);
  check('Confirm Pickup is refused for delivery orders', r.status === 400);
  await call('POST', `/api/admin/orders/${enc(d)}/pod`, { photoUrl: '/assets/uploads/aaaaaaaaaaaaaaaaaaaa.png' }, adm);
  r = await call('POST', `/api/orders/${enc(d)}/confirm-delivery`, { confirmed: true }, ana);
  check('delivery confirmation still works as before (Delivered — Confirmed)', r.status === 200 && store.get(d).status === 'Delivered — Confirmed');

  console.log('\n[7] In-app only');
  check('pickup confirmation code sends no email', !/mailer|sendMail|queueEmail/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'server', 'store.js'), 'utf8')));

  console.log(`\nPICKUP RESULT: ${pass} passed, ${fail} failed`);
  if (fail) console.log('Failures:\n - ' + failures.join('\n - '));
  iso.stopServer();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
