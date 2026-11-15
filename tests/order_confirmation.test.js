// Order confirmation rules on a throw-away database:
//  • confirmation deadlines (pickup: reminder 6 h, auto-confirm 24 h; delivery: reminder 24 h, auto-confirm 48 h)
//  • delivery steps locked in the API (no photo-less "Delivered", no confirming on the customer's behalf)
//  • "Delivery Attempt Failed" → re-attempt or cancel
//  • stock on cancel (automatic only before preparation)
//  • revenue = completed AND paid; completed-but-unpaid shown separately
const iso = require('./helpers/isolated-db');
process.env.ORDER_RATE_LIMIT = '1000';
const store = require('../server/store');
const rules = require('../js/shop-rules.js');
const fs = require('fs');
const path = require('path');

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
const H = 3600000;
const PHOTO = '/assets/uploads/aaaaaaaaaaaaaaaaaaaa.png';

(async () => {
  ({ base } = await iso.startServer());
  const adm = (await call('POST', '/api/admin/login', { username: 'admin', password: iso.adminPassword })).data.token;
  const anaEmail = `ana_${Date.now()}@example.com`;
  const { data: anaReg } = await call('POST', '/api/auth/register', { name: 'Ana Cruz', email: anaEmail, password: 'Password-123', phone: '09171234567' });
  const ana = anaReg?.testOtp
    ? (await call('POST', '/api/auth/verify-otp', { email: anaEmail, otp: anaReg.testOtp })).data?.token
    : null;
  rules.updateShopInfo({ hours: store.getSetting('hours') || {}, pickup: store.getSetting('pickup') || {} });
  const pDate = rules.earliestDate('pickup');
  const pSlot = (rules.availablePickupSlots(pDate)[0] || rules.pickupSlots()[0]).label;
  const pickupOrder = async () => (await call('POST', '/api/orders', { fulfillment: 'pickup', firstName: 'Ana', lastName: 'Cruz', phone: '09171234567',
    email: 'ana@example.com', date: pDate, time: pSlot, paymentMethod: 'Cash on Pickup', giftMessage: '', items: [{ id: 'fl-rose-red', quantity: 1 }] }, ana)).data.orderNumber;
  const deliveryOrder = async (qty = 1) => (await call('POST', '/api/orders', { fulfillment: 'delivery', firstName: 'Ana', lastName: 'Cruz', phone: '09171234567',
    email: 'ana@example.com', address: '12 Rizal Avenue', district: '3', barangay: 'Barangay 300', city: 'Manila', notes: '', date: rules.earliestDate('delivery'),
    time: rules.deliverySlots[0], paymentMethod: 'Cash on Delivery', giftMessage: '', items: [{ id: 'fl-rose-red', quantity: qty }] }, ana)).data.orderNumber;
  const status = (n, s, extra = {}) => call('POST', `/api/admin/orders/${enc(n)}/status`, { status: s, ...extra }, adm);
  const toOutForDelivery = async (n) => { for (const s of ['Confirmed', 'Preparing', 'Out for Delivery']) await status(n, s); };
  const pickupHandedOver = async (n) => {
    for (const s of ['Confirmed', 'Preparing', 'Ready for Pickup']) await status(n, s);
    await call('POST', `/api/admin/orders/${enc(n)}/payments/cash`, { amountReceived: store.get(n).total, confirmReceived: true }, adm);
    return call('POST', `/api/admin/orders/${enc(n)}/confirm-pickup`, {}, adm);
  };
  const custNotes = (n) => store.listNotificationsForCustomer(store.get(n).userId, n, 100);
  const adminNotes = (n) => store.listNotificationsForAdmin(500).filter(x => x.orderNumber === n);
  const actions = (n) => store.get(n).history.map(e => e.action);

  console.log('\n[1] Delivery steps are locked in the status API');
  const d1 = await deliveryOrder();
  await toOutForDelivery(d1);
  for (const s of ['Delivered', 'Delivered — Awaiting Confirmation', 'Delivered — Confirmed', 'Delivery Disputed', 'Delivery Attempt Failed']) {
    const r = await status(d1, s);
    check(`admin cannot set "${s}" through the status endpoint`, r.status === 400 && r.data.code === 'DELIVERY_CONFIRMATION_REQUIRED' && store.get(d1).status === 'Out for Delivery', r.data);
  }
  let r = await call('POST', `/api/admin/orders/${enc(d1)}/pod`, { photoUrl: PHOTO }, adm);
  check('the delivery photo marks it Delivered — Awaiting Confirmation', r.status === 200 && store.get(d1).status === 'Delivered — Awaiting Confirmation');
  check('the photo upload is in the order history', actions(d1).includes('delivery_pod_uploaded'));
  r = await call('POST', `/api/admin/orders/${enc(d1)}/pod`, { photoUrl: PHOTO }, adm);
  check('the photo cannot be uploaded twice (no resetting the customer\'s answer)', r.status === 409);
  r = await status(d1, 'Delivered — Confirmed');
  check('the admin cannot confirm receipt on the customer\'s behalf', r.status === 400 && store.get(d1).status === 'Delivered — Awaiting Confirmation');
  const pend = await deliveryOrder();
  r = await call('POST', `/api/admin/orders/${enc(pend)}/pod`, { photoUrl: PHOTO }, adm);
  check('a pending (unconfirmed) order cannot be marked delivered', r.status === 409 && store.get(pend).status === 'Pending Confirmation');
  const pk = await pickupOrder();
  r = await call('POST', `/api/admin/orders/${enc(pk)}/pod`, { photoUrl: PHOTO }, adm);
  check('proof of delivery is refused for pickup orders', r.status === 400);
  r = await call('POST', `/api/orders/${enc(d1)}/confirm-delivery`, { confirmed: true }, ana);
  check('the customer confirms → Delivered — Confirmed, logged in history', r.status === 200 && store.get(d1).status === 'Delivered — Confirmed' && actions(d1).includes('delivery_receipt_confirmed'));
  r = await call('POST', `/api/orders/${enc(d1)}/confirm-delivery`, { confirmed: true }, ana);
  check('a second confirmation is refused as already confirmed', r.status === 409 && r.data.code === 'ALREADY_CONFIRMED');

  console.log('\n[2] Delivery Attempt Failed');
  const d2 = await deliveryOrder();
  await toOutForDelivery(d2);
  r = await call('POST', `/api/admin/orders/${enc(d2)}/delivery-failed`, { reason: '' }, adm);
  check('a reason is required', r.status === 400 && store.get(d2).status === 'Out for Delivery');
  r = await call('POST', `/api/admin/orders/${enc(d2)}/delivery-failed`, { reason: 'Nobody was home' }, ana);
  check('customers cannot use it', r.status === 401);
  r = await call('POST', `/api/admin/orders/${enc(d2)}/delivery-failed`, { reason: 'Nobody was home' }, adm);
  check('recorded → Delivery Attempt Failed with the reason', r.status === 200 && store.get(d2).status === 'Delivery Attempt Failed' && store.get(d2).deliveryFailedReason === 'Nobody was home');
  check('the customer is notified in-app with the reason', custNotes(d2).some(x => x.type === 'delivery_failed' && /Nobody was home/.test(x.message)));
  r = await call('GET', `/api/orders/${enc(d2)}`, null, ana);
  check('the customer sees the reason on the order page', r.data.deliveryFailedReason === 'Nobody was home');
  r = await call('POST', `/api/admin/orders/${enc(d2)}/delivery-failed`, { reason: 'again' }, adm);
  check('cannot be recorded twice in a row', r.status === 409);
  r = await call('POST', `/api/admin/orders/${enc(d2)}/pod`, { photoUrl: PHOTO }, adm);
  check('cannot be marked delivered without re-attempting first', r.status === 409);
  r = await status(d2, 'Out for Delivery');
  check('Re-attempt Delivery → Out for Delivery (logged)', r.status === 200 && store.get(d2).status === 'Out for Delivery' && actions(d2).includes('delivery_reattempt'));
  r = await call('POST', `/api/admin/orders/${enc(d2)}/pod`, { photoUrl: PHOTO }, adm);
  check('…then delivered with a photo', r.status === 200 && store.get(d2).status === 'Delivered — Awaiting Confirmation');
  const pkf = await pickupOrder();
  for (const s of ['Confirmed', 'Preparing']) await status(pkf, s);
  r = await call('POST', `/api/admin/orders/${enc(pkf)}/delivery-failed`, { reason: 'x' }, adm);
  check('not available for pickup orders', r.status === 400);
  const d3 = await deliveryOrder();
  await toOutForDelivery(d3);
  await call('POST', `/api/admin/orders/${enc(d3)}/delivery-failed`, { reason: 'Wrong address' }, adm);
  r = await call('POST', `/api/admin/orders/${enc(d3)}/reject`, { reason: 'Customer unreachable' }, adm);
  check('a failed delivery can be cancelled', r.status === 200 && store.get(d3).status === 'Rejected/Cancelled');

  console.log('\n[3] Pickup deadline: reminder after 6 h, automatic confirmation after 24 h');
  const p1 = await pickupOrder();
  await pickupHandedOver(p1);
  const since = Date.parse(store.get(p1).pickupHandoverAt);
  let o = store.get(p1);
  check('the order shows when it will be confirmed automatically (24 h)', o.confirmationDeadline === new Date(since + 24 * H).toISOString(), o.confirmationDeadline);
  r = await call('GET', `/api/orders/${enc(p1)}`, null, ana);
  check('…and the customer sees that deadline', r.data.confirmationDeadline === o.confirmationDeadline);
  let res = store.runConfirmationDeadlines(since + 5 * H);
  check('nothing happens before 6 h', !res.reminded.includes(p1) && !res.autoConfirmed.includes(p1) && store.get(p1).status === 'Awaiting Customer Confirmation');
  res = store.runConfirmationDeadlines(since + 6.5 * H);
  check('after 6 h the customer gets one reminder', res.reminded.includes(p1) && custNotes(p1).filter(x => x.type === 'confirm_reminder').length === 1);
  res = store.runConfirmationDeadlines(since + 8 * H);
  check('the reminder is not repeated', !res.reminded.includes(p1) && custNotes(p1).filter(x => x.type === 'confirm_reminder').length === 1);
  res = store.runConfirmationDeadlines(since + 24.1 * H);
  o = store.get(p1);
  check('after 24 h → Picked Up, recorded as automatic', res.autoConfirmed.includes(p1) && o.status === 'Picked Up' && o.customerConfirmationStatus === 'auto' && !!o.customerConfirmedAt);
  check('history: shop handover, reminder, automatic confirmation (by the system)', JSON.stringify(actions(p1)) === JSON.stringify(['pickup_handover_confirmed', 'confirmation_reminder_sent', 'pickup_auto_confirmed'])
    && o.history.find(e => e.action === 'pickup_auto_confirmed').actorType === 'system', actions(p1));
  check('customer and admin are notified in-app', custNotes(p1).some(x => x.type === 'order_completed' && /automatically/.test(x.message)) && adminNotes(p1).some(x => x.type === 'pickup_auto_confirmed'));
  check('the payment status is not changed by the automatic confirmation', o.paymentStatus === 'Paid');
  r = await call('POST', `/api/orders/${enc(p1)}/confirm-pickup`, { confirmed: true }, ana);
  check('a late customer confirmation is refused (already confirmed automatically)', r.status === 409 && r.data.code === 'ALREADY_CONFIRMED' && /automatically/.test(r.data.error));
  r = await call('GET', `/api/orders/${enc(p1)}`, null, ana);
  check('the customer sees the automatic step as "Automatic" (no staff usernames)', r.data.history.some(h => h.action === 'pickup_auto_confirmed' && h.by === 'Automatic') && !JSON.stringify(r.data.history).includes('"admin"'));

  const p2 = await pickupOrder();
  await pickupHandedOver(p2);
  await call('POST', `/api/orders/${enc(p2)}/confirm-pickup`, { confirmed: false, reason: 'Not received' }, ana);
  store.runConfirmationDeadlines(Date.now() + 100 * H);
  check('a disputed pickup is never confirmed automatically', store.get(p2).status === 'Pickup Disputed');

  console.log('\n[4] Delivery deadline: reminder after 24 h, automatic confirmation after 48 h');
  const d4 = await deliveryOrder();
  await toOutForDelivery(d4);
  // Staff type a delivery time far in the past: the deadline still counts from the server's own time.
  await call('POST', `/api/admin/orders/${enc(d4)}/pod`, { photoUrl: PHOTO, deliveredAt: '2020-01-01T00:00:00.000Z' }, adm);
  res = store.runConfirmationDeadlines(Date.now());
  check('a back-dated delivery time does not trigger an immediate automatic confirmation', !res.autoConfirmed.includes(d4) && store.get(d4).status === 'Delivered — Awaiting Confirmation');
  const dSince = Date.parse(store.get(d4).confirmationDeadline) - 48 * H;
  res = store.runConfirmationDeadlines(dSince + 23 * H);
  check('no reminder before 24 h', !res.reminded.includes(d4));
  res = store.runConfirmationDeadlines(dSince + 25 * H);
  check('reminder after 24 h', res.reminded.includes(d4) && custNotes(d4).some(x => x.type === 'confirm_reminder'));
  res = store.runConfirmationDeadlines(dSince + 47 * H);
  check('still waiting at 47 h', store.get(d4).status === 'Delivered — Awaiting Confirmation');
  res = store.runConfirmationDeadlines(dSince + 48.1 * H);
  o = store.get(d4);
  check('after 48 h → Delivered — Confirmed, recorded as automatic', res.autoConfirmed.includes(d4) && o.status === 'Delivered — Confirmed' && o.customerConfirmationStatus === 'auto');
  check('Cash on Delivery stays Unpaid (confirmation never marks money received)', o.paymentStatus === 'Unpaid');
  check('admin notified of the automatic confirmation', adminNotes(d4).some(x => x.type === 'delivery_auto_confirmed'));
  r = await call('POST', `/api/orders/${enc(d4)}/confirm-delivery`, { confirmed: false, reason: 'late report' }, ana);
  check('an issue cannot be reported after the automatic confirmation', r.status === 409);

  console.log('\n[5] Stock on cancel');
  const stock = () => store.getFlower('fl-rose-red').stockCount;
  let before = stock();
  const c1 = await deliveryOrder(3);
  r = await call('POST', `/api/admin/orders/${enc(c1)}/reject`, { reason: 'Customer changed mind' }, adm);
  check('cancelled before preparation → stems returned automatically', r.status === 200 && stock() === before);
  before = stock();
  const c2 = await deliveryOrder(3);
  for (const s of ['Confirmed', 'Preparing']) await status(c2, s);
  r = await call('POST', `/api/admin/orders/${enc(c2)}/reject`, { reason: 'Recipient moved away' }, adm);
  check('cancelled after preparation started → stems NOT returned by default', r.status === 200 && stock() === before - 3);
  check('the history records that the stock was not returned', store.get(c2).history.some(e => e.action === 'order_cancelled' && /not returned/.test(e.note) && e.actor === 'admin'));
  before = stock();
  const c3 = await deliveryOrder(3);
  for (const s of ['Confirmed', 'Preparing']) await status(c3, s);
  r = await call('POST', `/api/admin/orders/${enc(c3)}/reject`, { reason: 'Bouquet never made', restoreStock: true }, adm);
  check('…returned when the admin ticks "Return the flowers to stock"', r.status === 200 && stock() === before);
  r = await call('POST', `/api/admin/orders/${enc(c3)}/reject`, { reason: 'again', restoreStock: true }, adm);
  check('stock is never returned twice', r.status === 400 && stock() === before);

  console.log('\n[6] Revenue = completed AND paid');
  const st = (await call('GET', '/api/admin/stats', null, adm)).data;
  const all = (await call('GET', '/api/admin/orders?limit=500', null, adm)).data.orders;
  const done = all.filter(x => rules.DONE_ORDER_STATUSES.includes(x.status));
  const expPaid = done.filter(x => x.paymentStatus === 'Paid').reduce((a, x) => a + x.total, 0);
  const expUnpaid = done.filter(x => x.paymentStatus !== 'Paid').reduce((a, x) => a + x.total, 0);
  check('dashboard revenue counts only completed and paid orders', st.totalRevenue === expPaid && expPaid > 0, { got: st.totalRevenue, expPaid });
  check('completed-but-unpaid orders are reported separately', st.completedUnpaidAmount === expUnpaid && expUnpaid > 0 && st.completedUnpaidOrders === done.filter(x => x.paymentStatus !== 'Paid').length, { got: st.completedUnpaidAmount, expUnpaid });
  const rep = (await call('GET', '/api/admin/reports/data?range=today', null, adm)).data;
  check('reports: realized revenue = completed and paid', Math.round(rep.kpis.realizedRevenue * 100) === Math.round(expPaid * 100), { got: rep.kpis.realizedRevenue, expPaid });
  check('reports: completed-but-unpaid amount', Math.round(rep.kpis.completedUnpaidAmount * 100) === Math.round(expUnpaid * 100), { got: rep.kpis.completedUnpaidAmount, expUnpaid });
  check('reports: net sales and gross sales unchanged in meaning', rep.kpis.totalRevenue + rep.kpis.cancelledAmount === rep.kpis.grossSales);

  console.log('\n[7] One status definition for server and admin console');
  check('"Delivered — Confirmed" counts as completed; failed deliveries count as in progress',
    rules.DONE_ORDER_STATUSES.includes('Delivered — Confirmed') && rules.ACTIVE_ORDER_STATUSES.includes('Delivery Attempt Failed'));
  const adminJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin.js'), 'utf8');
  check('the admin console no longer hard-codes "completed" as Delivered / Picked Up only', !adminJs.includes("['Delivered', 'Picked Up'].includes("));
  check('no email is sent by any confirmation step', !/mailer|sendMail|queueEmail/.test(fs.readFileSync(path.join(__dirname, '..', 'server', 'store.js'), 'utf8')));

  console.log(`\nORDER CONFIRMATION RESULT: ${pass} passed, ${fail} failed`);
  if (fail) console.log('Failures:\n - ' + failures.join('\n - '));
  iso.stopServer();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
