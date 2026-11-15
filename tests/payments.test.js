// Payment workflows on a throw-away database: GCash (verified advance payment), Cash on Pickup and Cash on
// Delivery, BDO retirement with historical records intact, security rules, payment history and in-app notifications.
const iso = require('./helpers/isolated-db');
process.env.ORDER_RATE_LIMIT = '1000';
process.env.PAYMENT_PROOF_RATE_LIMIT = '1000'; // the test submits many proofs from one account
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
  return { status: r.status, data, headers: r.headers };
}
const enc = (n) => encodeURIComponent(n);
const png = () => 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(80)]).toString('base64');
const stockOf = (id) => store.db.prepare('SELECT stock_count s FROM flowers WHERE id = ?').get(id).s;
const status = (n, s) => call('POST', `/api/admin/orders/${enc(n)}/status`, { status: s }, adm);
const events = (n) => store.getOrderPayments(n).events;
let adm;

function delivery(over = {}) {
  return { fulfillment: 'delivery', firstName: 'Ana', lastName: 'Cruz', phone: '09171234567', email: 'ana@example.com',
    address: '12 Rizal Avenue', district: '3', barangay: 'Barangay 300', city: 'Manila', notes: 'Leave with the guard',
    date: rules.earliestDate('delivery'), time: rules.deliverySlots[0], paymentMethod: 'GCash', giftMessage: '',
    items: [{ id: 'fl-rose-red', quantity: 1 }], ...over };
}
function pickup(over = {}) {
  const date = rules.earliestDate('pickup');
  const slot = (rules.availablePickupSlots(date)[0] || rules.pickupSlots()[0]).label;
  return { ...delivery(), fulfillment: 'pickup', address: '', district: '', barangay: '', city: '', notes: '', date, time: slot, paymentMethod: 'Cash on Pickup', ...over };
}

(async () => {
  ({ base } = await iso.startServer());
  adm = (await call('POST', '/api/admin/login', { username: 'admin', password: iso.adminPassword })).data.token;
  const reg = async (name) => {
    const email = `${name.toLowerCase().replace(/\W/g, '')}_${Date.now()}@example.com`;
    const r1 = await call('POST', '/api/auth/register', { name, email, password: 'Password-123', phone: '09171234567' });
    if (!r1.data?.testOtp) return null;
    const r2 = await call('POST', '/api/auth/verify-otp', { email, otp: r1.data.testOtp });
    return r2.data?.token || null;
  };
  const ana = await reg('Ana Cruz'), ben = await reg('Ben Reyes');
  check('admin and two customer test accounts ready', !!adm && !!ana && !!ben);
  rules.updateShopInfo({ hours: store.getSetting('hours') || {}, pickup: store.getSetting('pickup') || {} });
  const stock0 = stockOf('fl-rose-red');

  console.log('\n[1] Payment methods offered');
  check('checkout methods are exactly GCash, Cash on Pickup, Cash on Delivery', JSON.stringify(rules.paymentMethods) === JSON.stringify(['GCash', 'Cash on Pickup', 'Cash on Delivery']));
  let r = await call('POST', '/api/orders', delivery({ paymentMethod: 'Bank Transfer' }), ana);
  check('BDO Bank Transfer is refused for new orders', r.status === 400 && /no longer available/.test(r.data.errors && r.data.errors.paymentMethod), r.data);
  r = await call('POST', '/api/orders', delivery({ paymentMethod: 'QR Ph' }), ana);
  check('QR Ph is refused for new orders', r.status === 400 && !!(r.data.errors && r.data.errors.paymentMethod));
  r = await call('PUT', '/api/admin/settings', { payment: { bank: { accountName: 'X', accountNumber: '001234567890' } } }, adm);
  check('BDO account details can no longer be saved in settings', r.status === 400);

  console.log('\n[2] GCash QR code management (never hardcoded)');
  store.db.prepare("DELETE FROM shop_settings WHERE key = 'payment'").run(); // start from "not set up" (test DB only)
  r = await call('GET', '/api/catalog');
  check('without a QR code GCash is not offered to customers', r.data.payment && r.data.payment.gcash === null, r.data.payment);
  r = await call('POST', '/api/orders', delivery(), ana);
  check('a GCash order is refused while no QR code is configured', r.status === 400 && /not available/.test(r.data.errors && r.data.errors.paymentMethod), r.data);
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: 'Shop', number: '0917', qrImage: '' } } }, adm);
  check('invalid GCash number refused', r.status === 400);
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { qrImage: 'https://evil.example/qr.png' } } }, adm);
  check('QR code must be an image uploaded to the shop (no outside links)', r.status === 400);
  const qrUp = await call('POST', '/api/admin/upload', { dataUrl: png() }, adm);
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: 'Umaira Test GCash', number: '0917 111 2222', qrImage: qrUp.data.url } } }, adm);
  check('admin uploads and saves the official GCash QR code and account', qrUp.status === 201 && r.status === 200 && r.data.settings.payment.gcash.qrImage === qrUp.data.url && r.data.settings.payment.gcash.number === '09171112222', r.data);
  r = await call('GET', '/api/catalog');
  check('storefront receives exactly the saved QR code and account', r.data.payment.gcash.qrImage === qrUp.data.url && r.data.payment.gcash.accountName === 'Umaira Test GCash' && !('bank' in r.data.payment));
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: 'Umaira Test GCash 2', number: '09171112222' } } }, adm);
  check('saving the account details without a new QR keeps the configured QR code', r.status === 200 && r.data.settings.payment.gcash.qrImage === qrUp.data.url && r.data.settings.payment.gcash.accountName === 'Umaira Test GCash 2', r.data);
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: '', number: '', qrImage: '/assets/uploads/ffffffffffffffffffff.png' } } }, adm);
  check('a QR image that does not exist on the server is refused (configured QR untouched)', r.status === 400 && store.getSetting('payment').gcash.qrImage === qrUp.data.url);
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: '', number: '', qrImage: '' } } }, adm);
  check('an administrator can remove the QR code from settings; the uploaded image file is kept', r.status === 200 && !store.getSetting('payment').gcash.qrImage && (await fetch(base + qrUp.data.url)).status === 200);
  await call('PUT', '/api/admin/settings', { payment: { gcash: { accountName: 'Umaira Test GCash', number: '09171112222', qrImage: qrUp.data.url } } }, adm);
  const qrFile = await fetch(base + qrUp.data.url);
  check('the QR image can be displayed and downloaded by customers', qrFile.status === 200 && /image\//.test(qrFile.headers.get('content-type') || ''));

  console.log('\n[3] GCash: verified advance payment before confirmation and preparation');
  r = await call('POST', '/api/orders', delivery(), ana);
  const g = r.data.orderNumber, gOrder = store.get(g);
  check('GCash order placed: order Pending Confirmation, payment Unpaid', r.status === 201 && r.data.status === 'Pending Confirmation' && r.data.paymentStatus === 'Unpaid', r.data);
  r = await call('POST', `/api/admin/orders/${enc(g)}/confirm`, {}, adm);
  check('unpaid GCash order cannot be confirmed', r.status === 409 && r.data.code === 'PAYMENT_NOT_VERIFIED', r.data);
  r = await status(g, 'Preparing');
  check('…and cannot be prepared', r.status !== 200 && store.get(g).status === 'Pending Confirmation');

  r = await call('POST', `/api/orders/${enc(g)}/payments`, { reference: '1234567890123', amount: 100, receiptDataUrl: png() });
  check('guest cannot submit payment proof', r.status === 401);
  r = await call('POST', `/api/orders/${enc(g)}/payments`, { reference: '1234567890123', amount: 100, receiptDataUrl: png() }, ben);
  check("another customer cannot submit proof for Ana's order", r.status === 404);
  r = await call('POST', `/api/orders/${enc(g)}/payments`, { reference: '1234567890123', amount: gOrder.total }, ana);
  check('receipt image is required', r.status === 400 && r.data.field === 'receipt');
  r = await call('POST', `/api/orders/${enc(g)}/payments`, { reference: 'AB1', amount: gOrder.total, receiptDataUrl: png() }, ana);
  check('reference number is required', r.status === 400 && r.data.field === 'reference');
  r = await call('POST', `/api/orders/${enc(g)}/payments`, { reference: '1234567890123', amount: 0, receiptDataUrl: png() }, ana);
  check('amount sent is required', r.status === 400 && r.data.field === 'amount');
  r = await call('POST', `/api/orders/${enc(g)}/payments`, { reference: '1234567890123', amount: 100, receiptDataUrl: 'data:image/png;base64,' + Buffer.from('not an image').toString('base64') }, ana);
  check('a fake image is refused', r.status === 400);
  check('refused submissions change nothing', store.get(g).paymentStatus === 'Unpaid' && store.getCustomerPayments(g, gOrder.userId).length === 0);

  const gReceipt = png();
  r = await call('POST', `/api/orders/${enc(g)}/payments`, { reference: '1234 5678 90123', amount: gOrder.total, receiptDataUrl: gReceipt }, ana);
  const gSub = r.data.submission;
  check('valid proof accepted → Pending Verification', r.status === 201 && r.data.order.paymentStatus === 'Pending Verification', r.data);
  check('uploading a receipt never marks the order Paid', store.get(g).paymentStatus !== 'Paid' && !store.get(g).paidAt);
  r = await call('POST', `/api/orders/${enc(g)}/payments`, { reference: '9999999999999', amount: gOrder.total, receiptDataUrl: png() }, ana);
  check('a second proof while one is pending is refused', r.status === 409);
  r = await call('GET', `/api/orders/${enc(g)}/payments`, null, ana);
  check('customer order details show reference, amount and proof status', r.status === 200 && r.data.submissions[0].reference === '1234 5678 90123' && r.data.submissions[0].amountSubmitted === gOrder.total && r.data.submissions[0].status === 'pending');
  r = await call('GET', `/api/orders/${enc(g)}`, null, ana);
  check('customer order shows payment method, payment status and order status separately', r.data.paymentMethodLabel === 'GCash' && r.data.paymentStatus === 'Pending Verification' && r.data.status === 'Pending Confirmation');

  const note = store.listNotificationsForAdmin(50).find(n => n.type === 'payment_submitted' && n.orderNumber === g);
  check('admin is notified in-app with customer, order, amounts, reference and time',
    note && note.data.customerName === 'Ana Cruz' && note.data.amountDue === gOrder.total && note.data.amountSubmitted === gOrder.total && note.data.reference === '1234 5678 90123' && !!note.data.submittedAt && note.data.submissionId === gSub.id, note);
  r = await call('GET', '/api/admin/payments?status=pending', null, adm);
  check('pending GCash submissions are listed for verification', r.data.submissions.some(s => s.orderNumber === g && s.customerName === 'Ana Cruz'));
  r = await fetch(base + `/api/admin/payments/${gSub.id}/receipt`, { headers: { Authorization: 'Bearer ' + adm } });
  check('admin can view the exact receipt', r.status === 200 && Buffer.from(await r.arrayBuffer()).equals(Buffer.from(gReceipt.split(',')[1], 'base64')));
  check('receipts are private (no token → 401, other customer → 404, not under public folders)',
    (await fetch(base + `/api/admin/payments/${gSub.id}/receipt`)).status === 401 &&
    (await fetch(base + `/api/orders/${enc(g)}/payments/${gSub.id}/receipt`, { headers: { Authorization: 'Bearer ' + ben } })).status === 404 &&
    !(await fetch(base + '/assets/uploads/' + store.getPaymentSubmission(gSub.id).receipt_file)).ok);

  r = await call('POST', `/api/admin/orders/${enc(g)}/payments/${gSub.id}/approve`, { confirmReceived: true }, ana);
  check('a customer cannot approve a payment (direct API call)', r.status === 401);
  r = await call('POST', `/api/admin/orders/${enc(g)}/payments/${gSub.id}/approve`, {}, adm);
  check('approval requires confirming the money actually arrived', r.status === 400 && r.data.code === 'CONFIRM_RECEIVED' && store.get(g).paymentStatus === 'Pending Verification');
  r = await call('POST', `/api/admin/orders/${enc(g)}/payments/${gSub.id}/approve`, { confirmReceived: true }, adm);
  check('Approve Payment → Paid, with the responsible admin and time recorded', r.status === 200 && r.data.order.paymentStatus === 'Paid' && r.data.order.paidBy === 'admin' && !!r.data.order.paidAt, r.data);
  check('approval did not change the order status', store.get(g).status === 'Pending Confirmation');
  r = await call('POST', `/api/admin/orders/${enc(g)}/payments/${gSub.id}/approve`, { confirmReceived: true }, adm);
  check('the same proof cannot be approved twice', r.status === 409);
  check('customer notified in-app that the payment was verified', store.listNotificationsForCustomer(gOrder.userId, g).some(n => n.type === 'payment_approved'));
  r = await call('POST', `/api/admin/orders/${enc(g)}/payments/cash`, { amountReceived: gOrder.total, confirmReceived: true }, adm);
  check('"Confirm Cash Received" is refused for GCash', r.status === 409);
  r = await call('POST', `/api/admin/orders/${enc(g)}/confirm`, {}, adm);
  check('Paid GCash order can now be confirmed', r.status === 200 && r.data.order.status === 'Confirmed');
  r = await status(g, 'Preparing');
  check('…and prepared', r.status === 200 && r.data.order.status === 'Preparing');
  check('payment and order statuses stay independent (Paid · Preparing)', store.get(g).paymentStatus === 'Paid' && store.get(g).status === 'Preparing');

  console.log('\n[4] GCash rejection, duplicates and resubmission');
  r = await call('POST', '/api/orders', delivery(), ben);
  const g2 = r.data.orderNumber, g2Order = store.get(g2);
  r = await call('POST', `/api/orders/${enc(g2)}/payments`, { reference: '12345678-90123', amount: g2Order.total, receiptDataUrl: png() }, ben);
  check('a reference already used on another order is refused (spacing/case ignored)', r.status === 409 && r.data.code === 'DUPLICATE_REFERENCE', r.data);
  check('…without revealing which order used it', !String(r.data.error).includes(g));
  r = await call('POST', `/api/orders/${enc(g2)}/payments`, { reference: 'gc-ref-0001', amount: g2Order.total - 50, receiptDataUrl: gReceipt }, ben);
  const s2 = r.data.submission;
  const warn = store.getOrderPayments(g2).submissions[0].warnings.map(w => w.code);
  check('wrong amount and a previously used receipt are flagged as suspicious', r.status === 201 && warn.includes('amount_mismatch') && warn.includes('duplicate_receipt'), warn);
  r = await call('POST', `/api/admin/orders/${enc(g2)}/payments/${s2.id}/approve`, { confirmReceived: true }, adm);
  check('a flagged proof cannot be approved without acknowledging the warnings and a note', r.status === 409 && r.data.code === 'REVIEW_REQUIRED');
  r = await call('POST', `/api/admin/orders/${enc(g2)}/payments/${s2.id}/reject`, {}, adm);
  check('Reject Payment requires a reason', r.status === 400 && r.data.code === 'REASON_REQUIRED');
  r = await call('POST', `/api/admin/orders/${enc(g2)}/payments/${s2.id}/reject`, { note: 'Amount is short by 50 pesos' }, adm);
  check('Reject Payment → Rejected; order stays unpaid and unconfirmed', r.status === 200 && store.get(g2).paymentStatus === 'Rejected' && store.get(g2).status === 'Pending Confirmation');
  check('customer sees the reason in-app', store.listNotificationsForCustomer(g2Order.userId, g2).some(n => n.type === 'payment_rejected' && /short by 50/.test(n.message)));
  r = await call('GET', `/api/orders/${enc(g2)}/payments`, null, ben);
  check('customer order details show the rejection reason (no internal warnings)', r.data.submissions[0].status === 'rejected' && /short by 50/.test(r.data.submissions[0].rejectionReason) && !('warnings' in r.data.submissions[0]));
  r = await call('POST', `/api/admin/orders/${enc(g2)}/confirm`, {}, adm);
  check('rejected GCash order still cannot be confirmed', r.status === 409);
  r = await call('POST', `/api/orders/${enc(g2)}/payments`, { reference: 'GC REF 0001', amount: g2Order.total, receiptDataUrl: png() }, ben);
  check('the rejected reference cannot simply be re-sent', r.status === 409);
  r = await call('POST', `/api/orders/${enc(g2)}/payments`, { reference: 'GC-REF-0002', amount: g2Order.total, receiptDataUrl: png() }, ben);
  const s3 = r.data.submission;
  check('customer resubmits new proof → Pending Verification', r.status === 201 && store.get(g2).paymentStatus === 'Pending Verification');
  r = await call('POST', `/api/admin/orders/${enc(g2)}/payments/${s3.id}/approve`, { confirmReceived: true }, adm);
  check('resubmitted proof approved → Paid', r.status === 200 && store.get(g2).paymentStatus === 'Paid');
  const h2 = store.getOrderPayments(g2);
  check('every submission and decision stays in the payment history', h2.submissions.length === 2 && h2.events.length === 4 &&
    h2.submissions.some(s => s.status === 'rejected' && s.reviewNote === 'Amount is short by 50 pesos' && s.reviewedBy === 'admin' && s.reviewedAt));

  console.log('\n[5] Cash on Pickup: prepared while Unpaid, released only after the cash is confirmed');
  r = await call('POST', '/api/orders', pickup(), ana);
  const c = r.data.orderNumber, cOrder = store.get(c);
  check('COP order placed without advance payment: Pending · Unpaid', r.status === 201 && cOrder.status === 'Pending Confirmation' && cOrder.paymentStatus === 'Unpaid' && cOrder.paymentMethod === 'Cash on Pickup', r.data);
  r = await call('POST', `/api/orders/${enc(c)}/payments`, { reference: 'CASH000001', amount: cOrder.total, receiptDataUrl: png() }, ana);
  check('COP never asks for a receipt upload', r.status === 409);
  r = await call('POST', `/api/admin/orders/${enc(c)}/payments/cash`, { amountReceived: cOrder.total, confirmReceived: true }, adm);
  check('cash cannot be confirmed before the order is confirmed', r.status === 409 && r.data.code === 'NOT_READY');
  r = await call('POST', `/api/admin/orders/${enc(c)}/confirm`, {}, adm);
  check('admin confirms the order while Unpaid', r.status === 200 && store.get(c).status === 'Confirmed' && store.get(c).paymentStatus === 'Unpaid');
  await status(c, 'Preparing'); await status(c, 'Ready for Pickup');
  check('order reaches Preparing and Ready for Pickup while Unpaid', store.get(c).status === 'Ready for Pickup' && store.get(c).paymentStatus === 'Unpaid');
  r = await call('POST', `/api/admin/orders/${enc(c)}/confirm-pickup`, {}, adm);
  check('order cannot be released (handed over) before payment is confirmed', r.status === 409 && r.data.code === 'PAYMENT_NOT_VERIFIED' && store.get(c).status === 'Ready for Pickup', r.data);
  r = await call('POST', `/api/admin/orders/${enc(c)}/payments/cash`, { amountReceived: cOrder.total }, adm);
  check('Confirm Cash Received requires confirming the cash is actually in hand', r.status === 400 && r.data.code === 'CONFIRM_RECEIVED');
  r = await call('POST', `/api/admin/orders/${enc(c)}/payments/cash`, { amountReceived: cOrder.total - 10, confirmReceived: true }, adm);
  check('a different amount needs a note', r.status === 409 && r.data.code === 'REVIEW_REQUIRED');
  r = await call('POST', `/api/admin/orders/${enc(c)}/payments/cash`, { amountReceived: cOrder.total, confirmReceived: true }, adm);
  check('Confirm Cash Received → Paid, with the responsible person and time', r.status === 200 && r.data.order.paymentStatus === 'Paid' && r.data.order.paidBy === 'admin' && !!r.data.order.paidAt);
  r = await call('POST', `/api/admin/orders/${enc(c)}/payments/cash`, { amountReceived: cOrder.total, confirmReceived: true }, adm);
  check('duplicate cash confirmation is refused', r.status === 409 && r.data.code === 'ALREADY_PAID');
  r = await call('POST', `/api/admin/orders/${enc(c)}/confirm-pickup`, {}, adm);
  check('after payment the shop hands it over (Awaiting Customer Confirmation)', r.status === 200 && store.get(c).status === 'Awaiting Customer Confirmation');
  r = await call('POST', `/api/orders/${enc(c)}/confirm-pickup`, { confirmed: true }, ana);
  check('the customer confirms receipt → Picked Up', r.status === 200 && store.get(c).status === 'Picked Up');
  check('customer gets in-app updates (cash received, order completed)', (() => { const ns = store.listNotificationsForCustomer(cOrder.userId, c).map(n => n.type); return ns.includes('payment_approved') && ns.includes('order_completed') && ns.includes('order_ready_pickup'); })());

  console.log('\n[6] Cash on Delivery: Paid only after the remitted cash is confirmed');
  r = await call('POST', '/api/orders', delivery({ paymentMethod: 'Cash on Delivery' }), ana);
  const d = r.data.orderNumber, dOrder = store.get(d);
  check('COD order placed without advance payment: Pending · Unpaid, with recipient and instructions', r.status === 201 && dOrder.paymentStatus === 'Unpaid' && dOrder.status === 'Pending Confirmation' && dOrder.notes === 'Leave with the guard');
  r = await call('POST', `/api/admin/orders/${enc(d)}/confirm`, {}, adm);
  check('admin confirms the COD order while Unpaid', r.status === 200);
  for (const s of ['Preparing', 'Rider Assigned', 'Out for Delivery']) await status(d, s);
  check('COD order prepared and dispatched (Out for Delivery) while Unpaid', store.get(d).status === 'Out for Delivery' && store.get(d).paymentStatus === 'Unpaid');
  r = await call('POST', `/api/admin/orders/${enc(d)}/payments/cash`, { amountReceived: dOrder.total, confirmReceived: true, collectedByCourier: true, remittedToShop: true }, adm);
  check('cash cannot be confirmed before delivery', r.status === 409 && r.data.code === 'NOT_DELIVERED');
  r = await call('POST', `/api/admin/orders/${enc(d)}/pod`, { photoUrl: '/assets/uploads/aaaaaaaaaaaaaaaaaaaa.png', codCashCollected: true }, adm);
  check('delivered with proof of delivery: payment stays Unpaid', r.status === 200 && store.get(d).status === 'Delivered — Awaiting Confirmation' && store.get(d).paymentStatus === 'Unpaid', r.data);
  check('courier cash collection is recorded in the payment history (still Unpaid)', events(d).some(e => e.action === 'cash_collected_by_courier' && e.toStatus === 'Unpaid'));
  r = await call('POST', `/api/admin/orders/${enc(d)}/payments/cash`, { amountReceived: dOrder.total, confirmReceived: true }, adm);
  check('confirmation is refused until the cash is remitted to the shop', r.status === 400 && r.data.code === 'REMITTANCE_REQUIRED' && store.get(d).paymentStatus === 'Unpaid');
  r = await call('POST', `/api/admin/orders/${enc(d)}/payments/cash`, { amountReceived: dOrder.total, confirmReceived: true, remittedToShop: true }, adm);
  check('remitted cash confirmed → Paid, with the verifying admin and time', r.status === 200 && r.data.order.paymentStatus === 'Paid' && r.data.order.paidBy === 'admin' && !!r.data.order.paidAt);
  r = await call('POST', `/api/admin/orders/${enc(d)}/payments/cash`, { amountReceived: dOrder.total, confirmReceived: true, remittedToShop: true }, adm);
  check('duplicate confirmation refused', r.status === 409);
  // A second COD order delivered without recording the collection at POD: confirmation records it.
  r = await call('POST', '/api/orders', delivery({ paymentMethod: 'Cash on Delivery' }), ben);
  const d2 = r.data.orderNumber;
  for (const s of ['Confirmed', 'Preparing', 'On the Way']) await status(d2, s);
  await call('POST', `/api/admin/orders/${enc(d2)}/pod`, { photoUrl: '/assets/uploads/aaaaaaaaaaaaaaaaaaaa.png' }, adm);
  check('reaching Delivered does not mark COD Paid', store.get(d2).status === 'Delivered — Awaiting Confirmation' && store.get(d2).paymentStatus === 'Unpaid');
  r = await call('POST', `/api/admin/orders/${enc(d2)}/payments/cash`, { amountReceived: store.get(d2).total, confirmReceived: true, remittedToShop: true }, adm);
  check('collection must be confirmed when it was not recorded at delivery', r.status === 400 && r.data.code === 'COLLECTION_REQUIRED');
  r = await call('POST', `/api/admin/orders/${enc(d2)}/payments/cash`, { amountReceived: store.get(d2).total, confirmReceived: true, collectedByCourier: true, remittedToShop: true }, adm);
  check('…then collection and remittance are recorded and the order is Paid', r.status === 200 && events(d2).some(e => e.action === 'cash_collected_by_courier') && events(d2).some(e => e.action === 'cash_received'));

  console.log('\n[7] Authorisation and payment history integrity');
  store.createAdmin('teststaff', 'Staff-Pass-12345', 'Test Staff');
  store.db.prepare("UPDATE admin_users SET role = 'Staff' WHERE username = 'teststaff'").run();
  store.createAdmin('testcashier', 'Cashier-Pass-12345', 'Test Cashier');
  store.db.prepare("UPDATE admin_users SET role = 'Cashier' WHERE username = 'testcashier'").run();
  const staff = (await call('POST', '/api/admin/login', { username: 'teststaff', password: 'Staff-Pass-12345' })).data.token;
  const cashier = (await call('POST', '/api/admin/login', { username: 'testcashier', password: 'Cashier-Pass-12345' })).data.token;
  r = await call('POST', '/api/orders', delivery(), ana);
  const g3 = r.data.orderNumber;
  r = await call('POST', `/api/orders/${enc(g3)}/payments`, { reference: 'GC-777777777', amount: store.get(g3).total, receiptDataUrl: png() }, ana);
  const s4 = r.data.submission;
  r = await call('POST', `/api/admin/orders/${enc(g3)}/payments/${s4.id}/approve`, { confirmReceived: true }, staff);
  check('an unauthorised admin account cannot verify GCash payments', r.status === 403 && store.get(g3).paymentStatus === 'Pending Verification');
  r = await call('POST', `/api/admin/orders/${enc(g3)}/payments/${s4.id}/approve`, { confirmReceived: true }, cashier);
  check('a cashier cannot verify GCash payments either', r.status === 403);
  r = await call('POST', '/api/orders', pickup(), ben);
  const c2 = r.data.orderNumber;
  await call('POST', `/api/admin/orders/${enc(c2)}/confirm`, {}, adm);
  r = await call('POST', `/api/admin/orders/${enc(c2)}/payments/cash`, { amountReceived: store.get(c2).total, confirmReceived: true }, staff);
  check('an unauthorised account cannot confirm cash', r.status === 403 && store.get(c2).paymentStatus === 'Unpaid');
  r = await call('POST', `/api/admin/orders/${enc(c2)}/payments/cash`, { amountReceived: store.get(c2).total, confirmReceived: true }, cashier);
  check('an authorised cashier can confirm cash and is recorded as responsible', r.status === 200 && r.data.order.paidBy === 'testcashier');
  r = await call('POST', `/api/admin/orders/${enc(c2)}/payments/cash`, { amountReceived: 1, confirmReceived: true });
  check('cash confirmation without signing in is refused', r.status === 401);
  const qrBefore = store.getSetting('payment').gcash.qrImage;
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { qrImage: '' } } }, staff);
  check('an unauthorised account cannot replace or remove the GCash QR code', r.status === 403 && store.getSetting('payment').gcash.qrImage === qrBefore);
  r = await call('PUT', '/api/admin/settings', { payment: { gcash: { qrImage: '' } } }, cashier);
  check('a cashier cannot change the GCash QR code either', r.status === 403 && store.getSetting('payment').gcash.qrImage === qrBefore);
  r = await call('PUT', '/api/admin/settings', { inventory: { lowStockThreshold: 20 } }, staff);
  check('other shop settings are unaffected by the payment restriction', r.status === 200);
  let threw = false; try { store.db.prepare("UPDATE payment_events SET note = 'edited'").run(); } catch (_) { threw = true; }
  check('payment history cannot be edited', threw);
  threw = false; try { store.db.prepare('DELETE FROM payment_events').run(); } catch (_) { threw = true; }
  check('payment history cannot be deleted', threw);
  threw = false; try { store.db.prepare('DELETE FROM payment_submissions').run(); } catch (_) { threw = true; }
  check('payment submissions cannot be deleted', threw);

  console.log('\n[8] Historical BDO orders stay intact');
  // An order saved before BDO was retired (inserted directly, as it would exist in an older database).
  const uAna = store.get(g).userId;
  store.db.prepare(`INSERT INTO orders (order_number, user_id, status, fulfillment_type, first_name, last_name, phone, email, address, district, barangay, city,
    schedule_date, schedule_time, payment_method, payment_status, subtotal, delivery_fee, total, created_at, updated_at)
    VALUES ('#FLR-20261001-4321', ?, 'Pending Confirmation', 'delivery', 'Ana', 'Cruz', '09171234567', 'ana@example.com', '12 Rizal Avenue', '3', 'Barangay 300', 'Manila',
    '2026-10-02', ?, 'Bank Transfer', 'Awaiting payment', 1000, 150, 1150, '2026-10-01T02:00:00.000Z', '2026-10-01T02:00:00.000Z')`).run(uAna, rules.deliverySlots[0]);
  const bdo = store.get('#FLR-20261001-4321');
  check('historical BDO order reads correctly (label, Unpaid, raw value untouched)', bdo.paymentMethod === 'Bank Transfer' && rules.paymentMethodLabel(bdo.paymentMethod) === 'BDO Bank Transfer' && bdo.paymentStatus === 'Unpaid' &&
    store.db.prepare("SELECT payment_status s FROM orders WHERE order_number = '#FLR-20261001-4321'").get().s === 'Awaiting payment');
  r = await call('POST', `/api/orders/${enc('#FLR-20261001-4321')}/payments`, { reference: 'BDO-HIST-0001', amount: 1150, receiptDataUrl: png() }, ana);
  check('an existing BDO order can still be finished (proof → verification)', r.status === 201);
  r = await call('POST', `/api/admin/orders/${enc('#FLR-20261001-4321')}/payments/${r.data.submission.id}/approve`, { confirmReceived: true }, adm);
  check('…and its payment record is kept', r.status === 200 && store.getOrderPayments('#FLR-20261001-4321').events.length === 2);

  console.log('\n[9] In-app notifications only — no email');
  check('no email module is part of the order or payment workflow', !fs.existsSync(path.join(__dirname, '..', 'server', 'emails.js')) && !fs.existsSync(path.join(__dirname, '..', 'server', 'email-dispatch.js')));
  const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'payments.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'server', 'store.js'), 'utf8');
  check('order and payment code never sends email', !/mailer|queueEmail|email_log/.test(src));
  check('everything above worked with no email configuration', !process.env.MAIL_WEBHOOK_URL);
  const adminTypes = store.listNotificationsForAdmin(200).map(n => n.type);
  check('admin notified in-app of new orders and GCash proofs', adminTypes.includes('order_new') && adminTypes.includes('payment_submitted'));
  const custTypes = store.listNotificationsForCustomer(gOrder.userId, null, 200).map(n => n.type);
  check('customer receives order and payment updates in-app', ['order_received', 'payment_submitted', 'payment_approved', 'order_confirmed', 'order_preparing'].every(t => custTypes.includes(t)), custTypes);
  const before = store.listNotificationsForCustomer(gOrder.userId, g, 200).length;
  r = await call('POST', `/api/admin/orders/${enc(g)}/status`, { status: 'Preparing', grabTrackingUrl: 'https://grab.example/track/1' }, adm);
  check('saving without a status change sends no duplicate notification', r.status === 200 && r.data.unchanged === true && store.listNotificationsForCustomer(gOrder.userId, g, 200).length === before);

  console.log('\n[10] Inventory unaffected by payment actions');
  const ordersUsingRose = store.db.prepare("SELECT COALESCE(SUM(quantity),0) q FROM order_items WHERE item_id = 'fl-rose-red'").get().q;
  check('stock changed only by orders placed (not by payments)', stockOf('fl-rose-red') === stock0 - ordersUsingRose, [stock0, stockOf('fl-rose-red'), ordersUsingRose]);

  console.log(`\nPAYMENTS RESULT: ${pass} passed, ${fail} failed`);
  if (fail) console.log('Failures:\n - ' + failures.join('\n - '));
  iso.stopServer();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
