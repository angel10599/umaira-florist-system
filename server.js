const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (e) {}

const store = require('./server/store');
const pricing = require('./server/pricing');
const google = require('./server/google');
const mailer = require('./server/mailer');
const { uploadToCloudinary } = require('./server/upload');
const firestoreSync = require('./server/firestore-sync');
const rules = require('./js/shop-rules.js');
const eventHub = require('./server/events');
const { validateFullName, validatePhilippineMobile, validateEmail, validatePassword } = require('./server/validation');

const BASE_DIR = __dirname;
// Tests point UMAIRA_UPLOAD_DIR at a temporary folder so they never add files to the real uploads folder.
const UPLOAD_DIR = process.env.UMAIRA_UPLOAD_DIR || path.join(BASE_DIR, 'assets', 'uploads');

// Awaited before every status-change response so the email completes within the serverless window.
// Fire-and-forget inside store.js is not safe on Vercel: the function freezes after sendJson().
const STATUS_EMAIL_STAGES = new Set(['Confirmed', 'Preparing', 'Ready for Pickup', 'Rider Assigned',
  'On the Way', 'Out for Delivery', 'Awaiting Customer Confirmation',
  'Delivered — Awaiting Confirmation', 'Picked Up', 'Rejected/Cancelled']);
async function notifyStatusByEmail(order, reason) {
  if (!mailer.isConfigured() || !order) return;
  if (!order.email) {
    console.warn(`[mail:status] skipped ${order.orderNumber} — no email on order`);
    return;
  }
  if (!STATUS_EMAIL_STAGES.has(order.status)) return;
  const name = [order.firstName, order.lastName].filter(Boolean).join(' ') || undefined;
  console.log(`[mail:status] sending "${order.status}" -> ${order.email} (${order.orderNumber})`);
  try {
    await mailer.sendOrderStatusEmail({
      to: order.email, name, orderNumber: order.orderNumber,
      status: order.status, fulfillment: order.fulfillment, reason
    });
    console.log(`[mail:status] sent OK -> ${order.email}`);
  } catch (err) {
    console.error(`[mail:status] FAILED -> ${order.email}:`, err && err.message);
  }
}

// Firestore sync listeners — fire-and-forget; failures are logged but never propagated.
if (typeof firestoreSync.enabled === 'function' && firestoreSync.enabled()) {
  eventHub.on('order:created', ({ order }) => {
    if (order) firestoreSync.syncOrder(order).catch(e => console.error('[firestore] order sync:', e.message));
  });
  eventHub.on('order:status', ({ order }) => {
    if (order) firestoreSync.syncOrder(order).catch(e => console.error('[firestore] order sync:', e.message));
  });
  eventHub.on('catalog:updated', async ({ entity, id }) => {
    if (entity === 'flower' && id) {
      const f = await store.getFlower(id);
      if (f) firestoreSync.syncFlower(f).catch(e => console.error('[firestore] flower sync:', e.message));
    } else if (entity === 'bouquet' && id) {
      const b = await store.getBouquet(id);
      if (b) firestoreSync.syncBouquet(b).catch(e => console.error('[firestore] bouquet sync:', e.message));
    }
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.txt': 'text/plain; charset=utf-8'
};

// ---------------------------------------------------------------- admin bootstrap
async function bootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const envPassword = process.env.ADMIN_PASSWORD;
  if (await store.adminCount() > 0) {
    // Admin exists: sync password from ADMIN_PASSWORD env var if set so deployments
    // can rotate credentials without needing access to the change-password UI.
    if (envPassword) {
      if (envPassword.length < 8) { console.error('ADMIN_PASSWORD must be at least 8 characters.'); return; }
      await store.forceSetAdminPassword(username, envPassword);
      console.log('[bootstrap] Admin password synced from ADMIN_PASSWORD env var.');
    }
    return;
  }
  let password = envPassword;
  let generated = false;
  if (!password) { password = crypto.randomBytes(9).toString('base64url'); generated = true; }
  if (password.length < 8) { console.error('ADMIN_PASSWORD must be at least 8 characters.'); process.exit(1); }
  await store.createAdmin(username, password);
  console.log('\n==============================================================');
  console.log(' First start: admin account created.');
  console.log(`   Username: ${username}`);
  console.log(generated ? `   Password: ${password}   (generated - save it now, it is shown only once)` : '   Password: taken from ADMIN_PASSWORD');
  console.log('==============================================================\n');
}

// ---------------------------------------------------------------- helpers
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end(JSON.stringify(body));
}

const buckets = new Map();
function rateLimited(key, limit, windowMs = 60000) {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter(t => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  return recent.length > limit;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (!v.some(t => now - t < 900000)) buckets.delete(k); }, 300000).unref();

function readJson(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('payload too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { const s = Buffer.concat(chunks).toString('utf8'); resolve(s ? JSON.parse(s) : {}); }
      catch (e) { reject(Object.assign(new Error('bad json'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const clean = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function bearer(req, ...headerNames) {
  for (const h of headerNames) if (req.headers[h]) return String(req.headers[h]);
  const a = req.headers['authorization'] || '';
  return a.startsWith('Bearer ') ? a.slice(7).trim() : '';
}
const getAdminSession = async (req) => store.validateSession(bearer(req, 'x-admin-token'));
const getCustomerSession = async (req) => store.validateCustomerSession(bearer(req, 'x-customer-token', 'x-auth-token'));
// Client address for rate limits and the admin sign-in lockout.
// Behind a reverse proxy (nginx, Caddy, a hosting platform) every connection comes from the proxy, so all
// visitors would share one lockout. Set TRUST_PROXY to the number of proxies in front of the app (usually 1):
// each trusted proxy APPENDS the address it received the request from to X-Forwarded-For, so the real client
// is that many entries from the right. Entries further left are supplied by the client and can be forged,
// so they are never used. Without TRUST_PROXY the header is ignored entirely.
let warnedUntrustedProxy = false;
function clientIp(req) {
  const socketIp = req.socket.remoteAddress || 'unknown';
  const raw = String(process.env.TRUST_PROXY || '').trim().toLowerCase();
  const hops = raw === 'true' ? 1 : Math.max(0, parseInt(raw, 10) || 0);
  const header = req.headers['x-forwarded-for'];
  if (!hops) {
    if (header && !warnedUntrustedProxy) {
      warnedUntrustedProxy = true;
      console.warn('Requests arrive with X-Forwarded-For but TRUST_PROXY is not set: rate limits and the admin sign-in '
        + 'lockout treat every visitor as the proxy. Set TRUST_PROXY=1 if this app runs behind one reverse proxy.');
    }
    return socketIp;
  }
  const chain = String(header || '').split(',').map(s => s.trim()).filter(Boolean);
  return chain.length >= hops ? chain[chain.length - hops] : socketIp;
}

async function generateOrderNumber() {
  const ds = rules.manilaNow().date.replace(/-/g, ''); // shop calendar date (Asia/Manila), not the server's
  for (let i = 0; i < 50; i++) {
    const num = `#FLR-${ds}-${crypto.randomInt(1000, 10000)}`;
    if (!await store.exists(num)) return num;
  }
  return `#FLR-${ds}-${Date.now().toString().slice(-4)}`;
}

const userView = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role,
  google: Boolean(u.google_id || u.google), verified: Boolean(u.verified || u.google_id || u.google),
  createdAt: u.created_at || u.createdAt || '',
  address: u.address || {}
});

// ---------------------------------------------------------------- customer: orders
async function handleCreateOrder(req, res, body) {
  const user = await getCustomerSession(req);
  if (!user) return sendJson(res, 401, { error: 'Please sign in to place an order.' });
  if (rateLimited('order:' + user.id, Number(process.env.ORDER_RATE_LIMIT) || 20)) return sendJson(res, 429, { error: 'Too many order requests. Please wait a minute and try again.' });

  const input = {
    fulfillment: body.fulfillment,
    firstName: clean(body.firstName, 60), lastName: clean(body.lastName, 60),
    phone: clean(body.phone, 30), email: clean(body.email, 120),
    address: clean(body.address, 200), district: clean(body.district, 50),
    barangay: clean(body.barangay, 80), city: clean(body.city, 60), notes: clean(body.notes, 200),
    date: clean(body.date, 10), time: clean(body.time, 60),
    paymentMethod: clean(body.paymentMethod, 40), giftMessage: clean(body.giftMessage, 250)
  };
  // Validate pickup slots / operating days against the SAVED schedule (the browser does the same).
  rules.updateShopInfo({ hours: await store.getSetting('hours') || {}, pickup: await store.getSetting('pickup') || {} });
  const errors = rules.validateOrderInput(input);
  // GCash needs the shop's QR code so the customer knows where to pay (Shop Settings → Payment Accounts).
  if (!errors.paymentMethod && input.paymentMethod === 'GCash' && !await store.gcashConfigured()) {
    errors.paymentMethod = 'GCash payment is not available right now. Please choose Cash on Pickup or Cash on Delivery.';
  }
  if (Object.keys(errors).length) return sendJson(res, 400, { error: 'Please check the highlighted fields.', errors });

  const hoursSetting = await store.getSetting('hours') || {};
  if (hoursSetting.acceptingOrders === false) {
    return sendJson(res, 403, { error: 'Online ordering is temporarily paused. Please check back later.' });
  }

  const deliverySetting = await store.getSetting('delivery') || {};
  if (input.fulfillment === 'delivery' && deliverySetting.enabled === false) {
    return sendJson(res, 400, { error: 'Delivery service is currently unavailable. Please choose store pickup.' });
  }

  const pickupSetting = await store.getSetting('pickup') || {};
  if (input.fulfillment === 'pickup' && pickupSetting.enabled === false) {
    return sendJson(res, 400, { error: 'Store pickup is currently unavailable. Please choose delivery.' });
  }

  // Idempotency: the browser sends one order number per checkout attempt. If it was already
  // saved for this customer (double click, retry after a dropped connection), return that order.
  const clientNum = /^#?FLR-\d{8}-\d{4}$/.test(String(body.orderNumber || '')) ? store_norm(body.orderNumber) : null;
  if (clientNum) {
    const prior = await store.get(clientNum);
    if (prior) {
      // Another customer's order already uses this number: the browser picks a fresh one and retries.
      if (prior.userId !== user.id) return sendJson(res, 409, { error: 'Please try placing your order again.', code: 'ORDER_NUMBER_TAKEN' });
      return sendJson(res, 200, summary(prior, true));
    }
  }

  const priced = await pricing.priceCartItems(body.items, store);
  if (priced.error) return sendJson(res, 400, { error: priced.error });

  const isPickup = input.fulfillment === 'pickup';
  const fee = await pricing.deliveryFee(priced.subtotal, input.fulfillment, store);
  const order = {
    orderNumber: clientNum || await generateOrderNumber(),
    status: 'Pending Confirmation',
    fulfillment: input.fulfillment,
    firstName: input.firstName, lastName: input.lastName, phone: input.phone, email: input.email,
    userId: user.id,
    address: isPickup ? null : input.address, district: isPickup ? null : input.district,
    barangay: isPickup ? null : input.barangay, city: isPickup ? null : 'Manila',
    notes: isPickup ? null : input.notes,
    date: input.date, time: input.time, paymentMethod: input.paymentMethod,
    paymentStatus: 'Unpaid', // every method starts unpaid; only an admin can mark it Paid after verifying the money
    giftMessage: input.giftMessage || null,
    subtotal: priced.subtotal, deliveryFee: fee, total: Math.round((priced.subtotal + fee) * 100) / 100,
    createdAt: new Date().toISOString(), items: priced.rows
  };

  let result;
  try {
    result = await store.placeOrder(order, priced.stockNeeds);
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) { // order-number collision: retry once with a fresh number
      order.orderNumber = await generateOrderNumber();
      try { result = await store.placeOrder(order, priced.stockNeeds); } catch (e2) { console.error('placeOrder failed:', e2); }
    } else console.error('placeOrder failed:', e);
  }
  if (!result) return sendJson(res, 500, { error: 'We could not save your order. Please try again.' });
  if (!result.ok) return sendJson(res, 409, { error: result.error });

  // Remove only the ordered items from the customer's persistent cart, keeping unpurchased items intact
  try {
    const currentCart = await store.getCart(user.id) || [];
    const orderedKeys = new Set((body.items || []).map(i => i.cartItemId || (i.isCustom ? i.customKey : i.id)).filter(Boolean));
    const remainingCart = currentCart.filter(i => {
      const key = i.cartItemId || (i.isCustom ? i.customKey : i.id);
      return !orderedKeys.has(key);
    });
    await store.saveCart(user.id, remainingCart);
  } catch (cartErr) {
    console.error('Failed to update remaining cart items:', cartErr);
  }
  sendJson(res, 201, summary(result.order));

  // Fire-and-forget order confirmation email — never blocks or fails the response
  if (mailer.isConfigured()) {
    const o = result.order;
    mailer.sendOrderConfirmation({
      to: o.email, name: `${o.firstName || ''} ${o.lastName || ''}`.trim(),
      orderNumber: o.orderNumber, fulfillment: o.fulfillment,
      date: o.date, time: o.time,
      paymentMethod: o.paymentMethod, paymentMethodLabel: rules.paymentMethodLabel(o.paymentMethod),
      total: o.total, items: o.items || [], giftMessage: o.giftMessage || null
    }).catch(e => console.error('[mail] order confirmation failed:', e.message));
  }
}
function store_norm(n) { n = String(n).trim(); return n.startsWith('#') ? n : '#' + n; }
const summary = (o, duplicate = false) => ({
  orderNumber: o.orderNumber, status: o.status, fulfillment: o.fulfillment, paymentStatus: o.paymentStatus,
  subtotal: o.subtotal, deliveryFee: o.deliveryFee, total: o.total, createdAt: o.createdAt, duplicate
});

// An order is visible only to the customer who placed it, or to an admin.
async function handleGetOrder(req, res, orderNumber) {
  const order = await store.get(orderNumber);
  const user = await getCustomerSession(req);
  const admin = await getAdminSession(req);
  if (!order || !(admin || (user && order.userId === user.id))) {
    if (!user && !admin) return sendJson(res, 401, { error: 'Please sign in to view this order.' });
    return sendJson(res, 404, { error: 'Order not found. Please verify your order number.' });
  }
  sendJson(res, 200, publicOrder(order));
}
function publicOrder(o) {
  return { orderNumber: o.orderNumber, status: o.status, fulfillment: o.fulfillment,
    customerName: `${o.firstName} ${o.lastName}`.trim(), firstName: o.firstName, lastName: o.lastName,
    phone: o.phone, email: o.email, address: o.address, district: o.district, barangay: o.barangay, city: o.city,
    notes: o.notes, date: o.date, time: o.time, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
    paymentMethodLabel: rules.paymentMethodLabel(o.paymentMethod), paymentKind: o.paymentKind, paidAt: o.paidAt,
    pickupHandoverAt: o.pickupHandoverAt, confirmationDeadline: o.confirmationDeadline, deliveryFailedReason: o.deliveryFailedReason,
    // Confirmation history for the customer: what happened and when (staff usernames are not shown).
    history: (o.history || []).map(e => ({ action: e.action, by: e.actorType === 'customer' ? 'You' : e.actorType === 'system' ? 'Automatic' : 'Shop', note: e.actorType === 'customer' ? e.note : null, createdAt: e.createdAt })),
    giftMessage: o.giftMessage, grabTrackingUrl: o.grabTrackingUrl, rejectReason: o.rejectReason,
    podPhotoUrl: o.podPhotoUrl, podDeliveredAt: o.podDeliveredAt, podAdmin: o.podAdmin, podNotes: o.podNotes,
    customerConfirmationStatus: o.customerConfirmationStatus, customerConfirmedAt: o.customerConfirmedAt,
    customerDisputeReason: o.customerDisputeReason, customerDisputePhotoUrl: o.customerDisputePhotoUrl,
    disputeResolvedAt: o.disputeResolvedAt, disputeResolutionNotes: o.disputeResolutionNotes,
    subtotal: o.subtotal, deliveryFee: o.deliveryFee, total: o.total, createdAt: o.createdAt, updatedAt: o.updatedAt, items: o.items };
}

// ---------------------------------------------------------------- customer: auth
async function handleRegister(req, res, body) {
  if (rateLimited('reg:' + clientIp(req), 15, 600000)) {
    return sendJson(res, 429, { error: 'Too many registration attempts. Please try again later.' });
  }

  // 1. Mandatory 4 fields with strict frontend & backend validation
  const vName = validateFullName(body.name);
  if (!vName.valid) return sendJson(res, 400, { error: vName.error, field: 'name' });

  const vPhone = validatePhilippineMobile(body.phone);
  if (!vPhone.valid) return sendJson(res, 400, { error: vPhone.error, field: 'phone' });

  const vEmail = validateEmail(body.email);
  if (!vEmail.valid) return sendJson(res, 400, { error: vEmail.error, field: 'email' });

  const vPass = validatePassword(body.password);
  if (!vPass.valid) return sendJson(res, 400, { error: vPass.error, field: 'password' });

  const email = vEmail.value;
  const name = vName.value;
  const phone = vPhone.value;
  const password = vPass.value;

  // 2. Uniqueness check against existing verified accounts
  const existingUser = await store.findUserByEmail(email);
  if (existingUser && (existingUser.verified || existingUser.google_id)) {
    return sendJson(res, 409, { error: 'An account with this email address already exists. Please log in.' });
  }

  // Rate limit OTP requests to this email (max 5 per 15 min)
  if (rateLimited('reg-otp:' + email, 5, 900000)) {
    return sendJson(res, 429, { error: 'Too many verification code requests. Please wait a few minutes before trying again.' });
  }

  // 3. Generate secure, unpredictable 6-digit OTP
  const otp = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes validity

  // 4. Store pending registration safely in database
  await store.savePendingRegistration({
    name,
    email,
    phone,
    password,
    otp,
    salt,
    expiresAt
  });

  // 5. Send actual email with OTP
  try {
    await mailer.sendVerificationOTP({ to: email, name, otp });
    
    // In test environment only, provide testOtp for automated test harness
    const isTest = process.env.UMAIRA_TEST === '1' || process.env.NODE_ENV === 'test';
    const resp = {
      ok: true,
      requiresVerification: true,
      email: email,
      message: 'A 6-digit verification code has been sent to your email address.'
    };
    if (isTest) resp.testOtp = otp;

    sendJson(res, 200, resp);
  } catch (err) {
    console.error('Email delivery error during registration:', err.message);
    // Do not leave pending registration if delivery failed completely
    await store.deletePendingRegistration(email);
    return sendJson(res, 503, {
      error: 'Unable to deliver verification email. Please ensure your email address is correct and can receive messages, or try again later.'
    });
  }
}

async function handleVerifyOTP(req, res, body) {
  if (rateLimited('verify-otp:' + clientIp(req), 25, 600000)) {
    return sendJson(res, 429, { error: 'Too many verification attempts. Please wait a few minutes.' });
  }

  const vEmail = validateEmail(body.email);
  if (!vEmail.valid) return sendJson(res, 400, { error: vEmail.error });

  const rawOtp = String(body.otp || '').trim();
  if (!rawOtp || !/^\d{6}$/.test(rawOtp)) {
    return sendJson(res, 400, { error: 'Please enter a valid 6-digit verification code.' });
  }

  const email = vEmail.value;
  const result = await store.verifyAndActivateUser(email, rawOtp);
  if (!result.ok) {
    return sendJson(res, result.status || 400, { error: result.error });
  }

  // Verification successful: issue session token
  const token = await store.createCustomerSession(result.user.id);
  sendJson(res, 201, {
    ok: true,
    token,
    user: userView(result.user),
    message: 'Your email has been successfully verified! Welcome to Umaira Florist.'
  });
  firestoreSync.syncUser(result.user).catch(e => console.error('[firestore] user sync:', e.message));
}

async function handleResendOTP(req, res, body) {
  if (rateLimited('resend-otp-ip:' + clientIp(req), 10, 600000)) {
    return sendJson(res, 429, { error: 'Too many requests. Please wait a few minutes.' });
  }

  const vEmail = validateEmail(body.email);
  if (!vEmail.valid) return sendJson(res, 400, { error: vEmail.error });
  const email = vEmail.value;

  const pending = await store.getPendingRegistration(email);
  const existing = await store.findUserByEmail(email);

  if (!pending && (!existing || existing.verified || existing.google_id)) {
    return sendJson(res, 400, { error: 'No pending registration found for this email. Please register again.' });
  }

  // 60-second cooldown check
  if (pending && pending.last_sent_at) {
    const elapsedMs = Date.now() - new Date(pending.last_sent_at).getTime();
    if (elapsedMs < 60000) {
      const waitSec = Math.ceil((60000 - elapsedMs) / 1000);
      return sendJson(res, 429, {
        error: `Please wait ${waitSec} second${waitSec !== 1 ? 's' : ''} before requesting another code.`,
        cooldownSeconds: waitSec
      });
    }
  }

  // Rate limit OTP requests to this email (max 5 per 15 min)
  if (rateLimited('resend-otp:' + email, 5, 900000)) {
    return sendJson(res, 429, { error: 'Too many verification code requests. Please wait a few minutes.' });
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  if (pending) {
    await store.updatePendingOTP(email, { otp, salt, expiresAt });
  } else if (existing) {
    await store.savePendingRegistration({
      name: existing.name,
      email: existing.email,
      phone: existing.phone || '09170000000',
      existingPasswordHash: existing.password_hash,
      otp,
      salt,
      expiresAt
    });
  }

  const recipientName = (pending && pending.name) || (existing && existing.name) || 'Customer';

  try {
    await mailer.sendVerificationOTP({ to: email, name: recipientName, otp });
    
    const isTest = process.env.UMAIRA_TEST === '1' || process.env.NODE_ENV === 'test';
    const resp = {
      ok: true,
      message: 'A new 6-digit verification code has been sent to your email.'
    };
    if (isTest) resp.testOtp = otp;

    sendJson(res, 200, resp);
  } catch (err) {
    console.error('Failed to resend verification OTP:', err.message);
    return sendJson(res, 503, {
      error: 'Unable to deliver verification email. Please try again later.'
    });
  }
}

async function handleLogin(req, res, body) {
  const email = clean(body.email, 120).toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) return sendJson(res, 400, { error: 'Email and password are required.' });
  if (rateLimited('login:' + clientIp(req), 15, 900000) || rateLimited('loginacct:' + email, 10, 900000)) {
    return sendJson(res, 429, { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' });
  }

  const user = await store.validateCustomerPassword(email, password);
  if (!user) return sendJson(res, 401, { error: 'Invalid email or password.' });

  // Unverified accounts cannot log in
  if (!user.verified && !user.google) {
    return sendJson(res, 403, {
      error: 'Your email address has not been verified yet. Please enter the verification code sent to your email.',
      unverified: true,
      email: user.email
    });
  }

  sendJson(res, 200, { ok: true, token: await store.createCustomerSession(user.id), user: userView(user) });
}

async function handleGoogleAuth(req, res, body) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  if (!clientId) return sendJson(res, 503, { error: 'Google sign-in is not available right now.' });
  if (rateLimited('google:' + clientIp(req), 20, 600000)) return sendJson(res, 429, { error: 'Too many attempts. Please try again later.' });
  let identity;
  try { identity = await google.verifyIdToken(String(body.credential || ''), { clientId, fetchKeys: module.exports.googleKeyFetcher }); }
  catch (e) { return sendJson(res, 401, { error: 'Google sign-in could not be verified. Please try again.' }); }
  const user = await store.upsertGoogleCustomer(identity);
  if (!user) return sendJson(res, 409, { error: 'This email is linked to a different Google account.' });
  sendJson(res, 200, { ok: true, token: await store.createCustomerSession(user.id), user: userView(user) });
  // Fire-and-forget login notification. Delivery failure must never affect the authenticated session.
  mailer.sendGoogleLoginNotification({ to: user.email, name: user.name })
    .catch(e => console.error('[mail] Google login notification failed:', e.message));
  firestoreSync.syncUser(user).catch(e => console.error('[firestore] user sync:', e.message));
}

async function handleForgot(req, res, body) {
  const email = clean(body.email, 120).toLowerCase();
  if (rateLimited('forgot:' + clientIp(req), 5, 900000)) return sendJson(res, 429, { error: 'Too many requests. Please try again later.' });
  const generic = { ok: true, message: 'If an account exists for that email, a password reset link has been sent.' };
  if (!EMAIL_RE.test(email)) return sendJson(res, 200, generic);
  const user = await store.findUserByEmail(email);
  if (user && user.password_hash !== undefined) {
    const token = await store.createPasswordReset(user.id);
    const base = process.env.PUBLIC_URL || `http://${req.headers.host || 'localhost:3000'}`;
    mailer.send({ to: user.email, subject: 'Reset your Umaira Florist password',
      text: `Hello ${user.name},\n\nUse this link within 1 hour to choose a new password:\n${base}/#reset?token=${token}\n\nIf you did not ask for this, you can ignore this email.` })
      .catch(e => console.error('mail failed:', e.message));
  }
  sendJson(res, 200, generic); // same answer whether or not the account exists
}

async function handleReset(req, res, body) {
  const password = String(body.password || '');
  if (password.length < 8 || password.length > 200) return sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
  if (!await store.consumePasswordReset(String(body.token || ''), password)) return sendJson(res, 400, { error: 'This reset link is invalid or has expired. Please request a new one.' });
  sendJson(res, 200, { ok: true });
}

async function handleMe(req, res) {
  const user = await getCustomerSession(req);
  if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
  sendJson(res, 200, { ok: true, user: userView(user) });
}

async function handleUpdateMe(req, res, body) {
  const user = await getCustomerSession(req);
  if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
  const patch = {};
  if (body.name !== undefined) {
    patch.name = clean(body.name, 100);
    if (patch.name.length < 2) return sendJson(res, 400, { error: 'Please enter your full name.' });
  }
  if (body.phone !== undefined) {
    patch.phone = clean(body.phone, 30);
    if (patch.phone && !/^[+\d][\d\s()-]{6,24}$/.test(patch.phone)) return sendJson(res, 400, { error: 'Please enter a valid phone number.' });
  }
  if (body.address !== undefined) {
    const a = body.address || {};
    patch.address = { street: clean(a.street, 200), district: clean(a.district, 50), barangay: clean(a.barangay, 80), landmark: clean(a.landmark, 120) };
  }
  // role, email and id can never be changed through this endpoint.
  const updated = await store.updateProfile(user.id, patch);
  sendJson(res, 200, { ok: true, user: userView(updated) });
  if (updated) firestoreSync.syncUser(updated).catch(e => console.error('[firestore] user sync:', e.message));
}

async function handleLogout(req, res) { await store.destroyCustomerSession(bearer(req, 'x-customer-token', 'x-auth-token')); sendJson(res, 200, { ok: true }); }

async function handleDeleteAccount(req, res, body) {
  const user = await getCustomerSession(req);
  if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
  if (rateLimited('delete-acct:' + clientIp(req), 5, 900000)) {
    return sendJson(res, 429, { error: 'Too many requests. Please wait before trying again.' });
  }
  const fullUser = await store.findUserByEmail(user.email);
  if (!fullUser || fullUser.role !== 'customer') {
    return sendJson(res, 403, { error: 'This account cannot be deleted through this endpoint.' });
  }
  if (fullUser.password_hash) {
    const password = clean(body.password || '', 200);
    if (!password) return sendJson(res, 400, { error: 'Please enter your current password to confirm deletion.' });
    const ok = await store.validateCustomerPassword(user.email, password);
    if (!ok) return sendJson(res, 401, { error: 'Incorrect password. Account was not deleted.' });
  } else {
    // Google-only account: require email re-confirmation
    const confirmEmail = clean(body.confirmEmail || '', 200).toLowerCase().trim();
    if (!confirmEmail || confirmEmail !== user.email.toLowerCase()) {
      return sendJson(res, 400, { error: 'Please type your email address exactly to confirm deletion.' });
    }
  }
  const result = await store.anonymizeCustomer(user.id);
  if (!result.ok) return sendJson(res, 400, { error: result.error });
  sendJson(res, 200, { ok: true, message: 'Your account has been permanently deleted.' });
}

function handleAuthConfig(req, res) { sendJson(res, 200, { googleClientId: process.env.GOOGLE_CLIENT_ID || '' }); }

// ---------------------------------------------------------------- customer: cart
function sanitizeCart(items) {
  if (!Array.isArray(items) || items.length > 50) return null;
  return items.map(i => ({
    cartItemId: clean(i.cartItemId, 60), id: clean(i.id, 80), isCustom: !!i.isCustom, customKey: clean(i.customKey, 400),
    name: clean(i.name, 120), summary: clean(i.summary, 300), price: Number(i.price) || 0,
    quantity: Math.min(50, Math.max(1, parseInt(i.quantity, 10) || 1)), image: clean(i.image, 400),
    message: clean(i.message, 250), specs: i.isCustom && i.specs && typeof i.specs === 'object' ? i.specs : undefined
  }));
}

// ---------------------------------------------------------------- admin
// Admin sign-in lockout: 8 FAILED attempts per address within 15 minutes, for every address
// (local ones included — behind a reverse proxy every request looks local). Successful sign-ins are
// never counted and clear the address's failures, so the real admin and automated tests are unaffected.
const ADMIN_LOGIN_MAX_FAILURES = 8;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
function adminLoginFailures(ip) {
  const key = 'adminfail:' + ip, now = Date.now();
  const recent = (buckets.get(key) || []).filter(t => now - t < ADMIN_LOGIN_WINDOW_MS);
  buckets.set(key, recent);
  return recent;
}
async function handleAdminLogin(req, res, body) {
  const ip = clientIp(req);
  const failures = adminLoginFailures(ip);
  if (failures.length >= ADMIN_LOGIN_MAX_FAILURES) {
    const retryAfter = Math.ceil((failures[0] + ADMIN_LOGIN_WINDOW_MS - Date.now()) / 1000);
    res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
    return sendJson(res, 429, { error: 'Too many failed sign-in attempts. Please wait 15 minutes and try again.' });
  }
  const username = clean(body.username, 50);
  const password = String(body.password || '');
  const who = username && password ? await store.verifyAdmin(username, password) : null;
  if (!who) { failures.push(Date.now()); return sendJson(res, 401, { error: 'Invalid admin credentials.' }); }
  buckets.delete('adminfail:' + ip);
  const adminObj = await store.getAdmin(who);
  sendJson(res, 200, { ok: true, token: await store.createSession(who), username: who, admin: adminObj });
}

const FLOWER_AVAIL = ['available', 'unavailable', 'limited', 'sold_out'];
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const ID_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;
function validImage(v) { return v === '' || /^https:\/\/[^\s"'<>]+$/.test(v) || /^\/?assets\/[\w./-]+$/.test(v) && !v.includes('..'); }

function parseProduct(body, kind) {
  const e = {};
  const name = clean(body.name, 100);
  const price = Number(body.price);
  const availability = clean(body.availability, 20) || 'available';
  const image = clean(body.image, 300);
  const validTypes = ['flower', 'filler', 'foliage', 'wrapping', 'ribbon', 'card', 'accessory', 'supply'];
  const itemType = validTypes.includes(body.itemType) ? body.itemType : 'flower';
  const minPrice = (kind === 'flower' && (itemType === 'card' || itemType === 'ribbon')) ? 0 : 0.01;
  if (name.length < 2) e.name = 'Name is required.';
  if (!Number.isFinite(price) || price < minPrice || price > 100000) {
    e.price = minPrice === 0 ? 'Enter a price 0 or greater.' : 'Enter a price greater than 0.';
  }
  if (!FLOWER_AVAIL.includes(availability)) e.availability = 'Invalid availability.';
  if (!validImage(image)) e.image = 'Image must be an https:// URL or an uploaded file.';
  const out = { name, price: Math.round(price * 100) / 100, availability, image, description: clean(body.description, 300), category: clean(body.category, 60) };
  if (kind === 'flower') {
    if (body.stockCount !== undefined && body.stockCount !== null && body.stockCount !== '') {
      const stock = Number(body.stockCount);
      if (!Number.isInteger(stock) || stock < 0 || stock > 100000) e.stockCount = 'Stock must be a whole number, 0 or more.';
      else out.stockCount = stock;
    }
    out.itemType = itemType;
    out.style = clean(body.style, 100);
    out.botanicalName = clean(body.botanicalName, 100);
    out.color = /^#[0-9a-fA-F]{6}$/.test(String(body.color || '')) ? body.color : '#f43f5e';
    if (body.unitCost !== undefined && body.unitCost !== null && body.unitCost !== '') {
      const uc = Number(body.unitCost);
      if (Number.isFinite(uc) && uc >= 0) out.unitCost = Math.round(uc * 100) / 100;
    }
    if (body.lowStockThreshold !== undefined && body.lowStockThreshold !== null && body.lowStockThreshold !== '') {
      const th = parseInt(body.lowStockThreshold, 10);
      if (!isNaN(th) && th >= 0) out.lowStockThreshold = th;
    }
    const defaultUom = itemType === 'wrapping' ? 'sheets' : (itemType === 'ribbon' ? 'rolls' : (itemType === 'card' ? 'cards' : (itemType === 'supply' ? 'pieces' : 'stems')));
    out.unitOfMeasure = clean(body.unitOfMeasure, 30) || defaultUom;
    if (body.supplierId) out.supplierId = clean(body.supplierId, 60);
    if (body.source) out.source = clean(body.source, 100);
    if (body.adjustmentReason) out.adjustmentReason = clean(body.adjustmentReason, 200);
    if (out.stockCount === 0 && availability === 'available') out.availability = 'sold_out'; // only when stock explicitly 0
  } else {
    out.occasion = clean(body.occasion, 250);
    out.formula = clean(body.formula, 500);
    if (body.specs) out.specs = body.specs;
    if (body.source) out.source = clean(body.source, 100);
    if (body.stockCount !== undefined && body.stockCount !== null && body.stockCount !== '') {
      const stock = Number(body.stockCount);
      if (!Number.isInteger(stock) || stock < 0 || stock > 100000) e.stockCount = 'Stock must be a whole number, 0 or more.';
      else out.stockCount = stock;
    }
    if (body.adjustmentReason) out.adjustmentReason = clean(body.adjustmentReason, 200);
    if (out.stockCount === 0 && availability === 'available') out.availability = 'sold_out';
  }
  return { e, out };
}

async function handleAdminProduct(req, res, kind, idFromUrl, body) {
  const isFlower = kind === 'flower';
  const getOne = isFlower ? async (id) => await store.getFlower(id) : async (id) => await store.getBouquet(id, { raw: true });
  // Updates are merges: a field the request leaves out keeps its saved value (a partial update used to
  // reset botanical name, colour, occasions and threshold to defaults).
  if (idFromUrl) {
    const current = await getOne(idFromUrl);
    if (current) {
      const kept = {};
      for (const [k, v] of Object.entries(current)) if (body[k] === undefined && v !== null && v !== undefined) kept[k] = v;
      delete kept.stockCount; delete kept.stock_count; // stock only changes when explicitly sent (logged as a movement)
      body = { ...kept, ...body };
    }
  }
  const { e, out } = parseProduct(body, kind);
  if (Object.keys(e).length) return sendJson(res, 400, { error: Object.values(e)[0], errors: e });
  const adminSession = await getAdminSession(req);
  if (adminSession) out.adminUsername = adminSession.username;
  let id = idFromUrl || clean(body.id, 60);
  if (id && !ID_RE.test(id)) return sendJson(res, 400, { error: 'Invalid product id.' });
  if (!id) {
    let pfx = 'fl-';
    if (isFlower) {
      if (out.itemType === 'filler') pfx = 'fil-';
      else if (out.itemType === 'foliage') pfx = 'grn-';
      else if (out.itemType === 'wrapping') pfx = 'wrp-';
      else if (out.itemType === 'ribbon') pfx = 'rbn-';
      else if (out.itemType === 'card') pfx = 'crd-';
      else if (out.itemType === 'accessory') pfx = 'acc-';
    } else {
      pfx = 'bq-';
    }
    const base = pfx + (slug(out.name) || 'item');
    id = base; for (let i = 2; await getOne(id); i++) id = `${base}-${i}`;
  } else if (idFromUrl && !(await getOne(id))) return sendJson(res, 404, { error: 'Product not found.' });
  const saved = isFlower ? await store.saveFlower({ ...out, id }) : await store.saveBouquet({ ...out, id });
  sendJson(res, 200, { ok: true, [isFlower ? 'flower' : 'bouquet']: saved });
}

const MAGIC = { png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], gif: [0x47, 0x49, 0x46, 0x38] };
const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
// Decodes a data: URL and checks the file really is an image of the declared type (magic bytes), max 5 MB.
function decodeImage(dataUrl) {
  const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return { error: 'Upload a PNG, JPG, WebP or GIF image.' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0 || buf.length > 5 * 1024 * 1024) return { error: 'Image must be smaller than 5 MB.' };
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const okMagic = ext === 'webp' ? buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP'
    : MAGIC[ext].every((b, i) => buf[i] === b);
  if (!okMagic) return { error: 'That file is not a valid image.' };
  return { buf, ext, mime: IMAGE_MIME[ext] };
}
async function handleAdminUpload(req, res, body, forcedFolder) {
  const img = decodeImage(body.dataUrl);
  if (img.error) return sendJson(res, 400, { error: img.error });
  const folder = forcedFolder || clean(body.folder, 20) || 'misc';
  // In test mode avoid external Cloudinary calls; write to the local upload dir instead.
  if (process.env.UMAIRA_TEST === '1') {
    const fname = crypto.randomBytes(10).toString('hex') + '.' + img.ext;
    const full = path.join(UPLOAD_DIR, fname);
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(full, img.buf);
    return sendJson(res, 201, { ok: true, url: '/assets/uploads/' + fname });
  }
  try {
    const { url, public_id } = await uploadToCloudinary(body.dataUrl, folder);
    sendJson(res, 201, { ok: true, url, public_id });
  } catch (e) {
    console.error('[upload] Cloudinary error:', e.message);
    sendJson(res, 500, { error: 'Image upload failed. Please try again.' });
  }
}

// ---------------------------------------------------------------- payments
// Payment receipts are private (they show account names and numbers): they are stored outside the public
// folders and only served, with no caching, to the customer who owns the order or to an administrator.
// Who may change payment records (checked on every request; the console only mirrors it):
//  • GCash verification (approve / reject proof): administrators only.
//  • Cash confirmation (Cash on Pickup at the counter, remitted Cash on Delivery): administrators, managers and cashiers.
const PAYMENT_ADMIN_ROLES = ['Administrator', 'Owner'];
const CASH_CONFIRM_ROLES = ['Administrator', 'Owner', 'Manager', 'Cashier'];
async function adminWithRole(req, roles) {
  const s = await getAdminSession(req);
  const a = s && await store.getAdmin(s.username);
  return a && roles.includes(a.role) ? a.username : null;
}
const paymentAdmin = async (req) => adminWithRole(req, PAYMENT_ADMIN_ROLES);
const cashAdmin = async (req) => adminWithRole(req, CASH_CONFIRM_ROLES);
async function sendReceipt(res, sub) {
  // Cloudinary-stored receipts: redirect to the signed URL (unguessable but not access-controlled)
  if (sub.receipt_file && sub.receipt_file.startsWith('https://')) {
    res.writeHead(302, { 'Location': sub.receipt_file, 'Cache-Control': 'private, no-store', ...SECURITY_HEADERS });
    return res.end();
  }
  const file = path.join(store.receiptDir(), path.basename(sub.receipt_file));
  fs.readFile(file, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'Receipt file not found.' });
    res.writeHead(200, { 'Content-Type': sub.receipt_mime, 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline', ...SECURITY_HEADERS });
    res.end(data);
  });
}
async function handleSubmitPayment(req, res, orderNumber, body) {
  const user = await getCustomerSession(req);
  if (!user) return sendJson(res, 401, { error: 'Please sign in to submit payment proof.' });
  if (rateLimited('payproof:' + user.id, Number(process.env.PAYMENT_PROOF_RATE_LIMIT) || 6, 600000)) return sendJson(res, 429, { error: 'Too many submissions. Please wait a few minutes and try again.' });
  const order = await store.get(orderNumber);
  if (!order || order.userId !== user.id) return sendJson(res, 404, { error: 'Order not found.' });
  if (!body.receiptDataUrl) return sendJson(res, 400, { error: 'Please attach your payment receipt or screenshot.', field: 'receipt' });
  const img = decodeImage(body.receiptDataUrl);
  if (img.error) return sendJson(res, 400, { error: img.error, field: 'receipt' });
  let receiptFile;
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    // On Vercel / when Cloudinary is configured: upload to cloud so receipts survive redeployment
    try {
      const dataUrl = `data:${img.mime};base64,${img.buf.toString('base64')}`;
      const { url } = await uploadToCloudinary(dataUrl, 'pod');
      receiptFile = url;
    } catch (e) {
      console.error('[upload] Receipt Cloudinary upload failed:', e.message);
      return sendJson(res, 500, { error: 'Failed to upload receipt. Please try again.' });
    }
  } else {
    // Local dev: write to disk
    fs.mkdirSync(store.receiptDir(), { recursive: true });
    receiptFile = crypto.randomBytes(16).toString('hex') + '.' + img.ext;
    fs.writeFileSync(path.join(store.receiptDir(), receiptFile), img.buf);
  }
  let r;
  try {
    r = await store.submitPayment({
      orderNumber, userId: user.id, amount: body.amount, reference: clean(body.reference, 40),
      receipt: { file: receiptFile, mime: img.mime, sha256: crypto.createHash('sha256').update(img.buf).digest('hex') }
    });
  } catch (e) {
    r = /UNIQUE/i.test(String(e.message)) ? { ok: false, status: 409, field: 'reference', error: 'This transaction reference number has already been used. Each payment can only be used once.' } : null;
    if (!r) { console.error('submitPayment failed:', e); r = { ok: false, status: 500, error: 'We could not save your payment proof. Please try again.' }; }
  }
  if (!r.ok) {
    if (receiptFile && !receiptFile.startsWith('https://')) { try { fs.unlinkSync(path.join(store.receiptDir(), receiptFile)); } catch (_) {} }
    return sendJson(res, r.status || 400, { error: r.error, field: r.field, code: r.code });
  }
  sendJson(res, 201, { ok: true, submission: r.submission, order: publicOrder(r.order) });
}

async function handleAdmin(req, res, urlPath, query) {
  const m = req.method;
  let body = {};
  if (m === 'POST' || m === 'PUT') {
    try { body = await readJson(req, urlPath === '/api/admin/upload' ? 8 * 1024 * 1024 : 100 * 1024); }
    catch (e) { return sendJson(res, e.status || 400, { error: e.status === 413 ? 'Payload too large.' : 'Invalid payload.' }); }
  }

  const currentAdminSession = await getAdminSession(req);
  const currentAdminUser = currentAdminSession ? currentAdminSession.username : 'admin';

  // Admin Profile & Settings
  if (urlPath === '/api/admin/profile' && m === 'GET') {
    const admin = await store.getAdmin(currentAdminUser);
    if (!admin) return sendJson(res, 404, { error: 'Admin account not found.' });
    return sendJson(res, 200, { ok: true, admin });
  }
  if (urlPath === '/api/admin/profile' && (m === 'PUT' || m === 'POST')) {
    const displayName = clean(body.displayName, 80);
    const avatarUrl = String(body.avatarUrl || '').trim();
    if (avatarUrl && !validImage(avatarUrl) && !avatarUrl.startsWith('/assets/uploads/')) {
      return sendJson(res, 400, { error: 'Invalid avatar image format.' });
    }
    const updated = await store.updateAdminProfile(currentAdminUser, { displayName, avatarUrl });
    return sendJson(res, 200, { ok: true, admin: updated });
  }

  // Admin Change Password
  if (urlPath === '/api/admin/change-password' && (m === 'POST' || m === 'PUT')) {
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const confirmPassword = String(body.confirmPassword || '');
    if (!currentPassword) return sendJson(res, 400, { error: 'Current password is required.' });
    if (!newPassword) return sendJson(res, 400, { error: 'New password is required.' });
    if (newPassword.length < 8) return sendJson(res, 400, { error: 'New password must be at least 8 characters long.' });
    if (newPassword.length > 200) return sendJson(res, 400, { error: 'New password is too long.' });
    if (newPassword !== confirmPassword) return sendJson(res, 400, { error: 'New password and confirmation do not match.' });
    const resPwd = await store.changeAdminPassword(currentAdminUser, currentPassword, newPassword);
    if (!resPwd.ok) return sendJson(res, 400, { error: resPwd.error });
    return sendJson(res, 200, { ok: true, message: 'Password updated successfully.' });
  }

  if (urlPath === '/api/admin/stats' && m === 'GET') return sendJson(res, 200, await store.stats());
  if (urlPath === '/api/admin/dashboard/analytics' && m === 'GET') {
    const range = query.get('range') || 'last7days';
    const startDate = query.get('startDate') || query.get('start') || '';
    const endDate = query.get('endDate') || query.get('end') || '';
    const data = await store.getDashboardAnalytics({ range, startDate, endDate });
    return sendJson(res, 200, data);
  }
  if (urlPath === '/api/admin/reports/data' && m === 'GET') {
    const range = query.get('range') || 'last7days';
    const startDate = query.get('startDate') || query.get('start') || '';
    const endDate = query.get('endDate') || query.get('end') || '';
    const data = await store.getReportsData({ range, startDate, endDate });
    return sendJson(res, 200, data);
  }
  if (urlPath === '/api/admin/customers' && m === 'GET') return sendJson(res, 200, { customers: await store.listCustomers() });
  const custOne = urlPath.match(/^\/api\/admin\/customers\/([^/]+)$/);
  if (custOne && m === 'GET') {
    const u = await store.findUserById(custOne[1]);
    if (!u) return sendJson(res, 404, { error: 'Customer not found.' });
    const orders = await store.listForUser(u.id);
    return sendJson(res, 200, { customer: u, orders: orders.map(publicOrder) });
  }
  if (urlPath === '/api/admin/upload' && m === 'POST') return handleAdminUpload(req, res, body);

  // ---- payments (reading is open to any admin; changing payment records needs a payment-authorised role)
  if (urlPath === '/api/admin/payments' && m === 'GET') {
    const status = ['pending', 'approved', 'rejected', 'all'].includes(query.get('status')) ? query.get('status') : 'pending';
    return sendJson(res, 200, { submissions: await store.listPaymentSubmissions({ status }), pendingCount: await store.paymentQueueCount() });
  }
  const recMatch = urlPath.match(/^\/api\/admin\/payments\/(\d+)\/receipt$/);
  if (recMatch && m === 'GET') {
    const sub = await store.getPaymentSubmission(recMatch[1]);
    return sub ? await sendReceipt(res, sub) : sendJson(res, 404, { error: 'Payment submission not found.' });
  }
  const opMatch = urlPath.match(/^\/api\/admin\/orders\/([^/]+)\/payments$/);
  if (opMatch && m === 'GET') {
    const p = await store.getOrderPayments(opMatch[1]);
    return p ? sendJson(res, 200, p) : sendJson(res, 404, { error: 'Order not found.' });
  }
  const revMatch = urlPath.match(/^\/api\/admin\/orders\/([^/]+)\/payments\/(\d+)\/(approve|reject)$/);
  const cashMatch = urlPath.match(/^\/api\/admin\/orders\/([^/]+)\/payments\/cash$/);
  if ((revMatch || cashMatch) && m === 'POST') {
    const who = revMatch ? await paymentAdmin(req) : await cashAdmin(req);
    if (!who) return sendJson(res, 403, { error: revMatch ? 'Only administrators can verify GCash payments.' : 'Your account is not allowed to confirm cash payments.' });
    const r = revMatch
      ? await store.reviewPayment({ orderNumber: revMatch[1], submissionId: revMatch[2], decision: revMatch[3], adminUsername: who,
          note: clean(body.note || body.reason, 300), confirmReceived: body.confirmReceived === true, acknowledgeWarnings: body.acknowledgeWarnings === true })
      : await store.confirmCashPayment({ orderNumber: cashMatch[1], adminUsername: who, amountReceived: body.amountReceived,
          note: clean(body.note, 300), confirmReceived: body.confirmReceived === true,
          collectedByCourier: body.collectedByCourier === true, remittedToShop: body.remittedToShop === true });
    return r.ok ? sendJson(res, 200, { ok: true, order: r.order, submission: r.submission })
      : sendJson(res, r.status || 400, { error: r.error, code: r.code, warnings: r.warnings });
  }

  if (urlPath === '/api/admin/orders' && m === 'GET') {
    const limit = Math.min(parseInt(query.get('limit'), 10) || 100, 500);
    const orders = await store.list(limit, query.get('status') || 'all');
    return sendJson(res, 200, { orders });
  }
  const om = urlPath.match(/^\/api\/admin\/orders\/([^/]+)\/(confirm|reject|status)$/);
  if (om && m === 'POST') {
    let r;
    if (om[2] === 'confirm') r = await store.confirm(om[1]);
    else if (om[2] === 'reject') r = await store.reject(om[1], clean(body.reason, 200) || 'Order declined by shop.', { restoreStock: body.restoreStock === true, adminUsername: currentAdminUser });
    else {
      let grab;
      if (body.grabTrackingUrl !== undefined) {
        grab = clean(body.grabTrackingUrl, 300);
        if (grab && !/^https:\/\/[^\s"'<>]+$/.test(grab)) return sendJson(res, 400, { error: 'Tracking link must start with https://' });
      }
      r = await store.setStatus(om[1], clean(body.status, 40), { grabTrackingUrl: grab, rejectReason: body.rejectReason !== undefined ? clean(body.rejectReason, 200) : undefined, adminUsername: currentAdminUser });
    }
    if (r.ok) await notifyStatusByEmail(r.order, om[2] === 'reject' ? (clean(body.reason, 200) || 'Order declined by shop.') : r.order.rejectReason);
    return r.ok ? sendJson(res, 200, { ok: true, order: r.order, unchanged: !!r.unchanged }) : sendJson(res, r.error === 'Order not found.' ? 404 : (r.code === 'PAYMENT_NOT_VERIFIED' ? 409 : 400), { error: r.error, code: r.code });
  }

  // Admin: Confirm Pickup (step 1 of the two-way store pickup confirmation; the customer confirms receipt)
  const pickupMatch = urlPath.match(/^\/api\/admin\/orders\/([^/]+)\/confirm-pickup$/);
  if (pickupMatch && m === 'POST') {
    const r = await store.confirmPickupHandover(pickupMatch[1], { adminUsername: currentAdminUser });
    if (r.ok) await notifyStatusByEmail(r.order);
    return r.ok ? sendJson(res, 200, { ok: true, order: r.order }) : sendJson(res, r.status || 400, { error: r.error, code: r.code });
  }

  // Admin: the courier could not deliver (reason shown to the customer); re-attempt via status "Out for Delivery".
  const failedMatch = urlPath.match(/^\/api\/admin\/orders\/([^/]+)\/delivery-failed$/);
  if (failedMatch && m === 'POST') {
    const r = await store.markDeliveryAttemptFailed(failedMatch[1], { adminUsername: currentAdminUser, reason: clean(body.reason, 300) });
    return r.ok ? sendJson(res, 200, { ok: true, order: r.order }) : sendJson(res, r.status || 400, { error: r.error, code: r.code });
  }

  // Admin Proof of Delivery
  const podMatch = urlPath.match(/^\/api\/admin\/orders\/([^/]+)\/pod$/);
  if (podMatch && m === 'POST') {
    const photoUrl = clean(body.photoUrl, 300);
    if (!photoUrl) return sendJson(res, 400, { error: 'Proof of delivery photo is required.' });
    const notes = clean(body.notes, 500);
    const deliveredAt = clean(body.deliveredAt, 50) || new Date().toISOString();
    const r = await store.setProofOfDelivery(podMatch[1], {
      photoUrl,
      adminUsername: currentAdminUser,
      notes,
      deliveredAt,
      codCashCollected: body.codCashCollected === true // courier collected COD cash; payment stays Unpaid until remitted
    });
    if (r.ok) await notifyStatusByEmail(r.order);
    return r.ok ? sendJson(res, 200, { ok: true, order: r.order }) : sendJson(res, r.status || 400, { error: r.error });
  }

  // Admin Resolve Dispute
  const disputeMatch = urlPath.match(/^\/api\/admin\/orders\/([^/]+)\/resolve-dispute$/);
  if (disputeMatch && m === 'POST') {
    const notes = clean(body.notes, 500);
    const finalStatus = clean(body.finalStatus, 40) || 'Delivered — Confirmed';
    const r = await store.resolveDispute(disputeMatch[1], {
      notes,
      adminUsername: currentAdminUser,
      finalStatus
    });
    return r.ok ? sendJson(res, 200, { ok: true, order: r.order }) : sendJson(res, r.status || 400, { error: r.error });
  }

  // Admin notifications
  if (urlPath === '/api/admin/notifications' && m === 'GET') {
    const limit = Math.min(parseInt(query.get('limit'), 10) || 50, 200);
    const notifs = await store.listNotificationsForAdmin(limit);
    const unreadCount = await store.unreadNotificationCount('admin');
    return sendJson(res, 200, { notifications: notifs, unreadCount });
  }
  const notifReadMatch = urlPath.match(/^\/api\/admin\/notifications\/([^/]+)\/read$/);
  if (notifReadMatch && m === 'POST') {
    await store.markNotificationRead(parseInt(notifReadMatch[1], 10), { recipientType: 'admin' });
    return sendJson(res, 200, { ok: true });
  }
  if (urlPath === '/api/admin/notifications/read-all' && m === 'POST') {
    await store.markAllNotificationsRead('admin');
    return sendJson(res, 200, { ok: true });
  }
  const orderOne = urlPath.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (orderOne && m === 'GET') { const o = await store.get(orderOne[1]); return o ? sendJson(res, 200, { order: o }) : sendJson(res, 404, { error: 'Order not found.' }); }

  for (const [seg, kind] of [['flowers', 'flower'], ['bouquets', 'bouquet']]) {
    if (urlPath === `/api/admin/${seg}` && m === 'GET') {
      const itemType = query.get('itemType') || query.get('type') || 'all';
      return sendJson(res, 200, { [seg]: kind === 'flower' ? await store.getFlowers({ includeArchived: false, itemType }) : await store.getBouquets({ includeArchived: false, raw: true }) });
    }
    if (urlPath === `/api/admin/${seg}` && m === 'POST') return handleAdminProduct(req, res, kind, null, body);
    const one = urlPath.match(new RegExp(`^/api/admin/${seg}/([^/]+)$`));
    if (one && (m === 'PUT' || m === 'POST')) return handleAdminProduct(req, res, kind, one[1], body);
    if (one && m === 'DELETE') {
      const permanent = query.get('permanent') === 'true';
      const ok = kind === 'flower'
        ? (permanent && typeof store.deleteFlower === 'function' ? await store.deleteFlower(one[1], true) : await store.archiveFlower(one[1]))
        : (permanent && typeof store.deleteBouquet === 'function' ? await store.deleteBouquet(one[1], true) : await store.archiveBouquet(one[1]));
      if (ok && ok.ok === false) return sendJson(res, ok.status || 409, { error: ok.error });
      return ok ? sendJson(res, 200, { ok: true, archived: true, deleted: true }) : sendJson(res, 404, { error: 'Product not found.' });
    }
    const restoreMatch = urlPath.match(new RegExp(`^/api/admin/${seg}/([^/]+)/restore$`));
    if (restoreMatch && (m === 'POST' || m === 'PUT')) {
      const ok = kind === 'flower' ? await store.restoreFlower(restoreMatch[1]) : await store.restoreBouquet(restoreMatch[1]);
      return ok ? sendJson(res, 200, { ok: true, restored: true }) : sendJson(res, 404, { error: 'Product not found.' });
    }
  }

  // inventory
  if (urlPath === '/api/admin/inventory/summary' && m === 'GET') {
    return sendJson(res, 200, await store.getInventorySummary());
  }
  if (urlPath === '/api/admin/inventory/history' && m === 'GET') {
    const flowerId = query.get('flowerId') || undefined;
    const type = query.get('type') || undefined;
    const category = query.get('category') || undefined;
    const search = query.get('search') || undefined;
    const startDate = query.get('startDate') || query.get('start') || undefined;
    const endDate = query.get('endDate') || query.get('end') || undefined;
    const limit = Math.min(parseInt(query.get('limit'), 10) || 500, 1000);
    return sendJson(res, 200, { transactions: await store.listStockTransactions({ flowerId, type, category, search, startDate, endDate, limit }) });
  }
  if (urlPath === '/api/admin/inventory/adjust' && m === 'POST') {
    const adminSession = await getAdminSession(req);
    const result = await store.adjustStock({
      flowerId: clean(body.flowerId, 60),
      type: clean(body.type, 20),
      quantity: body.quantity,
      reason: clean(body.reason, 200),
      supplierId: clean(body.supplierId, 60) || null,
      unitCost: body.unitCost !== undefined ? body.unitCost : null,
      notes: clean(body.notes, 200),
      adminUsername: adminSession ? adminSession.username : 'admin'
    });
    return result.ok ? sendJson(res, 200, result) : sendJson(res, 400, { error: result.error });
  }

  // suppliers
  if (urlPath === '/api/admin/suppliers' && m === 'GET') {
    const incInactive = query.get('includeInactive') !== 'false';
    return sendJson(res, 200, { suppliers: await store.getSuppliers({ includeInactive: incInactive }) });
  }
  if (urlPath === '/api/admin/suppliers' && m === 'POST') {
    const name = clean(body.name, 100);
    if (!name || name.length < 2) return sendJson(res, 400, { error: 'Supplier name is required.' });
    const origin = clean(body.origin, 40) || '';
    const categories = Array.isArray(body.categories) ? body.categories.map(c => clean(c, 80)).filter(Boolean) : (typeof body.categories === 'string' && body.categories ? [clean(body.categories, 80)] : []);
    const saved = await store.saveSupplier({
      name,
      contactPerson: clean(body.contactPerson, 100),
      phone: clean(body.phone, 40),
      email: clean(body.email, 120),
      address: clean(body.address, 200),
      origin,
      categories,
      notes: clean(body.notes, 300),
      active: body.active !== undefined ? !!body.active : true
    });
    return sendJson(res, 201, { ok: true, supplier: saved });
  }
  const supToggle = urlPath.match(/^\/api\/admin\/suppliers\/([^/]+)\/toggle$/);
  if (supToggle && (m === 'POST' || m === 'PUT')) {
    const act = body.active !== undefined ? !!body.active : (body.isActive !== undefined ? !!body.isActive : true);
    const updated = await store.toggleSupplierActive(supToggle[1], act);
    return updated ? sendJson(res, 200, { ok: true, supplier: updated }) : sendJson(res, 404, { error: 'Supplier not found.' });
  }
  const supOne = urlPath.match(/^\/api\/admin\/suppliers\/([^/]+)$/);
  if (supOne && m === 'GET') {
    const s = await store.getSupplier(supOne[1]);
    return s ? sendJson(res, 200, { supplier: s }) : sendJson(res, 404, { error: 'Supplier not found.' });
  }
  if (supOne && (m === 'PUT' || m === 'POST')) {
    const name = clean(body.name, 100);
    if (!name || name.length < 2) return sendJson(res, 400, { error: 'Supplier name is required.' });
    const origin = clean(body.origin, 40) || '';
    const categories = Array.isArray(body.categories) ? body.categories.map(c => clean(c, 80)).filter(Boolean) : (typeof body.categories === 'string' && body.categories ? [clean(body.categories, 80)] : []);
    const saved = await store.saveSupplier({
      id: supOne[1],
      name,
      contactPerson: clean(body.contactPerson, 100),
      phone: clean(body.phone, 40),
      email: clean(body.email, 120),
      address: clean(body.address, 200),
      origin,
      categories,
      notes: clean(body.notes, 300),
      active: body.active !== undefined ? !!body.active : true
    });
    return sendJson(res, 200, { ok: true, supplier: saved });
  }

  // categories
  if (urlPath === '/api/admin/categories' && m === 'GET') {
    const incInactive = query.get('includeInactive') !== 'false';
    return sendJson(res, 200, { categories: await store.getCategories({ includeInactive: incInactive }) });
  }
  if (urlPath === '/api/admin/categories' && m === 'POST') {
    const name = clean(body.name, 80);
    if (!name || name.length < 2) return sendJson(res, 400, { error: 'Category name is required.' });
    const existing = (await store.getCategories({ includeInactive: true })).find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return sendJson(res, 409, { error: `Category "${name}" already exists.` });
    const saved = await store.saveCategory({
      name,
      type: ['flower', 'bouquet', 'both'].includes(body.type) ? body.type : 'both',
      description: clean(body.description, 200)
    });
    return sendJson(res, 201, { ok: true, category: saved });
  }
  const catOne = urlPath.match(/^\/api\/admin\/categories\/([^/]+)$/);
  if (catOne && m === 'GET') {
    const c = await store.getCategory(catOne[1]);
    return c ? sendJson(res, 200, { category: c }) : sendJson(res, 404, { error: 'Category not found.' });
  }
  if (catOne && (m === 'PUT' || m === 'POST')) {
    const name = clean(body.name, 80);
    if (!name || name.length < 2) return sendJson(res, 400, { error: 'Category name is required.' });
    const existing = (await store.getCategories({ includeInactive: true })).find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== catOne[1]);
    if (existing) return sendJson(res, 409, { error: `Another category with name "${name}" already exists.` });
    const saved = await store.saveCategory({
      id: catOne[1],
      name,
      type: ['flower', 'bouquet', 'both'].includes(body.type) ? body.type : 'both',
      description: clean(body.description, 200)
    });
    if (saved && saved.ok === false) return sendJson(res, 400, { error: saved.error });
    return sendJson(res, 200, { ok: true, category: saved });
  }
  if (catOne && m === 'DELETE') {
    const resDeact = await store.deactivateCategory(catOne[1]);
    return resDeact.ok ? sendJson(res, 200, resDeact) : sendJson(res, 400, { error: resDeact.error });
  }

  // shop settings
  if (urlPath === '/api/admin/settings' && m === 'GET') {
    return sendJson(res, 200, { settings: await store.getSettings() });
  }
  if (urlPath === '/api/admin/settings' && (m === 'PUT' || m === 'POST')) {
    // The GCash QR code and account are payment records: only payment-authorised administrators may change them.
    if (body && body.payment !== undefined && !await paymentAdmin(req)) {
      return sendJson(res, 403, { error: 'Only administrators can change the GCash payment account and QR code.' });
    }
    const { error, patch } = validateSettingsPatch(body, await store.getSettings());
    if (error) return sendJson(res, 400, { error });
    const saved = await store.saveSettings(patch);
    sendJson(res, 200, { ok: true, settings: saved });
    Object.entries(patch).forEach(([key, val]) => {
      firestoreSync.syncSetting(key, val).catch(e => console.error('[firestore] settings sync:', e.message));
    });
    return;
  }
  // Page decoration management (admin-only save; public read is on /api/decorations)
  if (urlPath === '/api/admin/decorations' && m === 'GET') {
    const decorFile = path.join(BASE_DIR, 'data', 'page-decorations.json');
    try {
      const data = fs.existsSync(decorFile) ? JSON.parse(fs.readFileSync(decorFile, 'utf8')) : {};
      return sendJson(res, 200, { decorations: data });
    } catch (e) {
      return sendJson(res, 200, { decorations: {} });
    }
  }
  if (urlPath === '/api/admin/decorations' && m === 'POST') {
    const page = clean(body.page, 50);
    if (!page) return sendJson(res, 400, { error: 'Page name is required.' });
    const decs = Array.isArray(body.decorations) ? body.decorations : [];
    const valid = decs
      .filter(d => d && d.src && String(d.src).startsWith('/image/backgound/'))
      .map(d => ({
        id: String(d.id || '').slice(0, 64) || Math.random().toString(36).slice(2),
        src: clean(String(d.src), 300),
        x: Math.round(Number(d.x) || 0),
        y: Math.round(Number(d.y) || 0),
        width: Math.max(20, Math.min(2000, Math.round(Number(d.width) || 100))),
        rotation: ((Math.round(Number(d.rotation) || 0)) % 360 + 360) % 360,
        zIndex: Math.max(-10, Math.min(100, Math.round(Number(d.zIndex) || 1))),
        opacity: Math.max(0, Math.min(1, Math.round((Number(d.opacity) || 0.5) * 100) / 100))
      }));
    const decorFile = path.join(BASE_DIR, 'data', 'page-decorations.json');
    let all = {};
    try { all = fs.existsSync(decorFile) ? JSON.parse(fs.readFileSync(decorFile, 'utf8')) : {}; } catch (e) {}
    all[page] = valid;
    try {
      fs.writeFileSync(decorFile, JSON.stringify(all, null, 2), 'utf8');
    } catch (e) {
      return sendJson(res, 500, { error: 'Failed to save decorations.' });
    }
    return sendJson(res, 200, { ok: true, page, count: valid.length });
  }

  return sendJson(res, 404, { error: 'Admin API route not found.' });
}

// ---------------------------------------------------------------- shop settings validation
// Only the sections the Shop Settings screen manages can be written, and every value is checked
// against the merged result (e.g. max stems vs the stored min stems), so the storefront, checkout and
// server pricing can never read a negative fee, an inverted schedule or an impossible stem range.
const SETTINGS_SECTIONS = ['store', 'delivery', 'pickup', 'hours', 'custom_builder', 'inventory', 'payment'];
// Payment accounts are entered by the shop owner; nothing is ever pre-filled. Empty fields = not configured.
function validatePaymentSettings(val, current = {}) {
  const out = {};
  if (val.gcash !== undefined) {
    const g = val.gcash || {};
    const prev = (current && current.gcash) || {};
    const accountName = clean(g.accountName, 80), number = clean(g.number, 20).replace(/[\s-]/g, '');
    if ((accountName || number) && !(accountName && number)) return { error: 'Enter both the GCash account name and number (or leave both empty).' };
    if (number && !/^(09\d{9}|\+639\d{9})$/.test(number)) return { error: 'GCash number must be a mobile number like 09171234567.' };
    if (accountName && accountName.length < 2) return { error: 'Enter the GCash account name.' };
    // The official GCash QR code: an image uploaded through the admin console (Shop Settings → Payment Accounts).
    // It is replaced or removed only when the request explicitly says so (qrImage present); saving the account
    // name or number alone always keeps the QR code that is already configured.
    let qrImage = prev.qrImage || '';
    if (g.qrImage !== undefined) {
      qrImage = clean(g.qrImage, 120);
      if (qrImage && !validImage(qrImage)) return { error: 'Upload the GCash QR code as a PNG, JPG or WebP image.' };
      // Only locally-uploaded files or Cloudinary URLs are accepted — no external links.
      if (qrImage && /^https:\/\//.test(qrImage) && !/^https:\/\/res\.cloudinary\.com\//.test(qrImage))
        return { error: 'GCash QR code must be an image uploaded through the shop. External links are not allowed.' };
      if (qrImage && /^\/assets\//.test(qrImage) && !fs.existsSync(path.join(UPLOAD_DIR, path.basename(qrImage)))) return { error: 'That QR code image was not found. Please upload it again.' };
    }
    out.gcash = { accountName, number, qrImage, updatedAt: new Date().toISOString() };
  }
  // BDO Bank Transfer is no longer offered, so its account details are no longer accepted.
  if (val.bank !== undefined) return { error: 'BDO Bank Transfer is no longer offered, so bank account details cannot be saved.' };
  return { out };
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function validateSettingsPatch(body, current) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Invalid settings payload.' };
  const patch = {};
  for (const [key, val] of Object.entries(body)) {
    if (!SETTINGS_SECTIONS.includes(key)) return { error: `Unknown settings section "${key}".` };
    if (!val || typeof val !== 'object' || Array.isArray(val)) return { error: `Invalid "${key}" settings.` };
    const merged = { ...(current[key] || {}), ...val };
    const num = (v) => (typeof v === 'number' ? v : Number(v));
    // Unknown fields inside an allowed section are kept as-is; known fields are validated/normalised.
    if (key === 'store') {
      const out = { ...val };
      for (const f of ['name', 'tagline', 'phone', 'email', 'address', 'description']) if (val[f] !== undefined) out[f] = clean(val[f], f === 'description' ? 300 : 150);
      if (out.name !== undefined && out.name.length < 2) return { error: 'Store name is required.' };
      if (out.email && !EMAIL_RE.test(out.email)) return { error: 'Enter a valid store email address.' };
      patch.store = out;
    } else if (key === 'delivery') {
      const out = { ...val };
      for (const f of ['fee', 'freeThreshold']) {
        if (val[f] === undefined) continue;
        const n = num(val[f]);
        if (!Number.isFinite(n) || n < 0 || n > 1000000) return { error: f === 'fee' ? 'Delivery fee must be 0 or more.' : 'Free-delivery threshold must be 0 or more.' };
        out[f] = Math.round(n * 100) / 100;
      }
      if (val.enabled !== undefined) out.enabled = val.enabled === true;
      for (const f of ['coverage', 'serviceArea', 'carrier', 'notes']) if (val[f] !== undefined) out[f] = clean(val[f], 200);
      patch.delivery = out;
    } else if (key === 'pickup') {
      const out = { ...val };
      if (val.enabled !== undefined) out.enabled = val.enabled === true;
      for (const f of ['address', 'instructions']) if (val[f] !== undefined) out[f] = clean(val[f], 200);
      if (val.leadTimeHours !== undefined) {
        const h = Number(val.leadTimeHours);
        if (!Number.isFinite(h) || h < 0 || h > 48 || Math.round(h * 2) !== h * 2) return { error: 'Pickup preparation time must be between 0 and 48 hours (in half-hour steps).' };
        out.leadTimeHours = h;
      }
      patch.pickup = out;
    } else if (key === 'hours') {
      const out = { ...val };
      for (const f of ['openingTime', 'closingTime']) {
        if (val[f] === undefined) continue;
        if (!TIME_RE.test(String(val[f]))) return { error: 'Opening and closing times must be valid HH:MM times.' };
        out[f] = String(val[f]);
      }
      if (merged.openingTime && merged.closingTime && TIME_RE.test(merged.openingTime) && TIME_RE.test(merged.closingTime) && merged.closingTime <= merged.openingTime) {
        return { error: 'Closing time must be later than opening time.' };
      }
      if (val.operatingDays !== undefined) {
        out.operatingDays = clean(val.operatingDays, 80);
        if (!out.operatingDays) return { error: 'Operating days are required.' };
      }
      if (val.acceptingOrders !== undefined) out.acceptingOrders = val.acceptingOrders === true;
      patch.hours = out;
    } else if (key === 'custom_builder') {
      const out = { ...val, serviceFee: 0 }; // never an arrangement / assembly fee
      for (const f of ['minStems', 'maxStems']) {
        if (val[f] === undefined) continue;
        const n = num(val[f]);
        if (!Number.isInteger(n) || n < 1 || n > 500) return { error: 'Stem limits must be whole numbers from 1 to 500.' };
        out[f] = n;
      }
      if (num(merged.maxStems) < num(merged.minStems)) return { error: 'Maximum stems cannot be less than minimum stems.' };
      patch.custom_builder = out;
    } else if (key === 'inventory') {
      const n = num(val.lowStockThreshold);
      if (!Number.isInteger(n) || n < 0 || n > 100000) return { error: 'Low-stock threshold must be a whole number, 0 or more.' };
      patch.inventory = { ...val, lowStockThreshold: n };
    } else if (key === 'payment') {
      const r = validatePaymentSettings(val, current.payment);
      if (r.error) return { error: r.error };
      patch.payment = r.out;
    }
  }
  return { patch };
}

// ---------------------------------------------------------------- dispatcher
// GCash is offered to customers only once the shop's official QR code is uploaded; the account name and number
// are shown when entered. Nothing is ever hardcoded or pre-filled.
async function publicPaymentAccounts() {
  const g = (await store.getSetting('payment') || {}).gcash || {};
  return {
    gcash: g.qrImage ? { qrImage: g.qrImage, accountName: g.accountName || '', number: g.number || '' } : null
  };
}

function isPublicPath(p) {
  return p === '/index.html' || p === '/admin.html' || p === '/background-previews.html' || p === '/styles.css' ||
    /^\/js\/[\w.-]+\.js$/.test(p) ||
    (/^\/image\/[\w\s./()\-]+$/i.test(p) && !p.includes('..')) ||
    (/^\/assets\/[\w\s./-]+$/.test(p) && !p.includes('..') && !p.endsWith('README.txt'));
}

async function route(req, res) {
  let urlPath, query;
  try {
    const u = new URL(req.url, 'http://localhost');
    urlPath = decodeURIComponent(u.pathname); query = u.searchParams;
  } catch (e) { res.writeHead(400, SECURITY_HEADERS); return res.end('Bad request'); }
  const m = req.method;

  if (urlPath.startsWith('/api/')) {
    if (m === 'OPTIONS') { res.writeHead(204, SECURITY_HEADERS); return res.end(); } // same-origin only: no CORS headers
    const needsBody = m === 'POST' || m === 'PUT';

    // public
    if (urlPath === '/api/catalog' && m === 'GET') {
      const delSetting = await store.getSetting('delivery') || {};
      const delFee = delSetting.fee !== undefined ? Number(delSetting.fee) : (delSetting.defaultFee !== undefined ? Number(delSetting.defaultFee) : 150);
      const delFree = delSetting.freeThreshold !== undefined ? Number(delSetting.freeThreshold) : (delSetting.freeDeliveryThreshold !== undefined ? Number(delSetting.freeDeliveryThreshold) : 2500);

      return sendJson(res, 200, {
        flowers: await store.getFlowers({ itemType: 'flower' }),
        materials: await store.getFlowers({ includeArchived: false }),
        bouquets: await store.getBouquets(),
        customBuilder: await store.getSetting('custom_builder') || { minStems: 1, maxStems: 50, serviceFee: 0 },
        store: await store.getSetting('store') || {},
        hours: await store.getSetting('hours') || { openingTime: '08:00', closingTime: '20:00', operatingDays: 'Monday – Sunday', acceptingOrders: true },
        inventory: { lowStockThreshold: await store.getGlobalLowStockThreshold() },
        delivery: {
          fee: isNaN(delFee) ? 150 : delFee,
          freeThreshold: isNaN(delFree) ? 2500 : delFree,
          coverage: delSetting.coverage || delSetting.serviceArea || 'City of Manila (Districts 1–6)',
          enabled: delSetting.enabled !== false
        },
        pickup: await store.getSetting('pickup') || { enabled: true },
        payment: await publicPaymentAccounts()
      });
    }
    if ((urlPath === '/api/settings' || urlPath === '/api/shop-settings') && m === 'GET') {
      const delSetting = await store.getSetting('delivery') || {};
      const delFee = delSetting.fee !== undefined ? Number(delSetting.fee) : (delSetting.defaultFee !== undefined ? Number(delSetting.defaultFee) : 150);
      const delFree = delSetting.freeThreshold !== undefined ? Number(delSetting.freeThreshold) : (delSetting.freeDeliveryThreshold !== undefined ? Number(delSetting.freeDeliveryThreshold) : 2500);
      return sendJson(res, 200, {
        ok: true,
        store: await store.getSetting('store') || {},
        hours: await store.getSetting('hours') || { openingTime: '08:00', closingTime: '20:00', operatingDays: 'Monday – Sunday', acceptingOrders: true },
        inventory: { lowStockThreshold: await store.getGlobalLowStockThreshold() },
        customBuilder: await store.getSetting('custom_builder') || { minStems: 1, maxStems: 50, serviceFee: 0 },
        delivery: {
          fee: isNaN(delFee) ? 150 : delFee,
          freeThreshold: isNaN(delFree) ? 2500 : delFree,
          coverage: delSetting.coverage || delSetting.serviceArea || 'City of Manila (Districts 1–6)',
          enabled: delSetting.enabled !== false
        },
        pickup: await store.getSetting('pickup') || { enabled: true },
        payment: await publicPaymentAccounts()
      });
    }
    if (urlPath === '/api/materials' && m === 'GET') {
      return sendJson(res, 200, {
        materials: await store.getFlowers({ includeArchived: false })
      });
    }
    if (urlPath === '/api/auth/config' && m === 'GET') return handleAuthConfig(req, res);

    // decoration images library — dynamically scans image/backgound folder (public, no auth)
    if (urlPath === '/api/decoration-images' && m === 'GET') {
      const imgDir = path.join(BASE_DIR, 'image', 'backgound');
      const supportedExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
      try {
        const files = fs.readdirSync(imgDir);
        const images = files
          .filter(f => supportedExts.has(path.extname(f).toLowerCase()))
          .sort()
          .map(f => ({ name: f, url: '/image/backgound/' + f.replace(/ /g, '%20') }));
        return sendJson(res, 200, { images });
      } catch (e) {
        return sendJson(res, 200, { images: [] });
      }
    }

    // saved page decorations — read by customer SPA on load (public, no auth)
    if (urlPath === '/api/decorations' && m === 'GET') {
      const decorFile = path.join(BASE_DIR, 'data', 'page-decorations.json');
      try {
        const data = fs.existsSync(decorFile) ? JSON.parse(fs.readFileSync(decorFile, 'utf8')) : {};
        return sendJson(res, 200, { decorations: data });
      } catch (e) {
        return sendJson(res, 200, { decorations: {} });
      }
    }

    // admin
    if (urlPath === '/api/admin/login' && m === 'POST') {
      let b; try { b = await readJson(req); } catch (e) { return sendJson(res, 400, { error: 'Invalid payload.' }); }
      return handleAdminLogin(req, res, b);
    }
    if (urlPath === '/api/admin/logout' && m === 'POST') { await store.destroySession(bearer(req, 'x-admin-token')); return sendJson(res, 200, { ok: true }); }
    if (urlPath === '/api/admin/events' && m === 'GET') {
      const token = query.get('token') || bearer(req, 'x-admin-token');
      const admin = await store.validateSession(token);
      if (!admin) return sendJson(res, 401, { error: 'Unauthorized. Admin token required for real-time events.' });

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
      });
      res.write(`: connected (admin: ${admin})\n\n`);

      const sendEvent = (event, data) => {
        try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) {}
      };

      const onOrderCreated = (data) => sendEvent('order:created', data);
      const onOrderStatus = (data) => sendEvent('order:status', data);
      const onInventoryUpdated = (data) => sendEvent('inventory:updated', data);
      const onCatalogUpdated = (data) => sendEvent('catalog:updated', data);
      const onSuppliersUpdated = (data) => sendEvent('suppliers:updated', data);
      const onSettingsUpdated = (data) => sendEvent('settings:updated', data);
      // Admin-only alerts (new payment proof, failed emails…) reach the console immediately.
      const onNotification = (n) => { if (n && n.recipientType === 'admin') sendEvent('notification:created', n); };
      const onPaymentSubmitted = (data) => sendEvent('payment:submitted', data);
      eventHub.on('notification:created', onNotification);
      eventHub.on('payment:submitted', onPaymentSubmitted);

      eventHub.on('order:created', onOrderCreated);
      eventHub.on('order:status', onOrderStatus);
      eventHub.on('inventory:updated', onInventoryUpdated);
      eventHub.on('catalog:updated', onCatalogUpdated);
      eventHub.on('suppliers:updated', onSuppliersUpdated);
      eventHub.on('settings:updated', onSettingsUpdated);

      const pingTimer = setInterval(() => {
        try { res.write(': ping\n\n'); } catch (_) {}
      }, 25000);

      const cleanup = () => {
        clearInterval(pingTimer);
        eventHub.removeListener('order:created', onOrderCreated);
        eventHub.removeListener('order:status', onOrderStatus);
        eventHub.removeListener('inventory:updated', onInventoryUpdated);
        eventHub.removeListener('catalog:updated', onCatalogUpdated);
        eventHub.removeListener('suppliers:updated', onSuppliersUpdated);
        eventHub.removeListener('settings:updated', onSettingsUpdated);
        eventHub.removeListener('notification:created', onNotification);
        eventHub.removeListener('payment:submitted', onPaymentSubmitted);
      };

      req.on('close', cleanup);
      res.on('close', cleanup);
      return;
    }
    if (urlPath === '/api/events' && m === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
      });
      res.write(': connected\n\n');

      const sendEvent = (event, data) => {
        try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) {}
      };

      // This stream is public, so it only says "some order changed": signed-in browsers then re-fetch
      // their OWN orders through the authenticated API. Order numbers and statuses are never broadcast.
      const onOrderStatus = () => sendEvent('order:status', { changed: true });
      const onCatalogUpdated = (data) => sendEvent('catalog:updated', data);
      const onInventoryUpdated = (data) => sendEvent('catalog:updated', { ...data, reason: 'inventory' });
      const onSettingsUpdated = (data) => sendEvent('settings:updated', data);

      eventHub.on('order:status', onOrderStatus);
      eventHub.on('catalog:updated', onCatalogUpdated);
      eventHub.on('inventory:updated', onInventoryUpdated);
      eventHub.on('settings:updated', onSettingsUpdated);

      const pingTimer = setInterval(() => {
        try { res.write(': ping\n\n'); } catch (_) {}
      }, 25000);

      const cleanup = () => {
        clearInterval(pingTimer);
        eventHub.removeListener('order:status', onOrderStatus);
        eventHub.removeListener('catalog:updated', onCatalogUpdated);
        eventHub.removeListener('inventory:updated', onInventoryUpdated);
        eventHub.removeListener('settings:updated', onSettingsUpdated);
      };

      req.on('close', cleanup);
      res.on('close', cleanup);
      return;
    }
    if (urlPath.startsWith('/api/admin/')) {
      if (!await getAdminSession(req)) return sendJson(res, 401, { error: 'Unauthorized. Please sign in as an administrator.' });
      return handleAdmin(req, res, urlPath, query);
    }

    // customer
    if (urlPath === '/api/auth/logout' && m === 'POST') return handleLogout(req, res);
    if (urlPath === '/api/auth/me' && m === 'GET') return handleMe(req, res);
    if (urlPath === '/api/my/orders' && m === 'GET') {
      const u = await getCustomerSession(req);
      return u ? sendJson(res, 200, { orders: (await store.listForUser(u.id)).map(publicOrder) }) : sendJson(res, 401, { error: 'Not authenticated.' });
    }
    if (urlPath === '/api/cart' && m === 'GET') {
      const u = await getCustomerSession(req);
      return u ? sendJson(res, 200, { items: await store.getCart(u.id) }) : sendJson(res, 401, { error: 'Not authenticated.' });
    }
    const gm = urlPath.match(/^\/api\/orders\/([^/]+)$/);
    if (gm && m === 'GET') return handleGetOrder(req, res, gm[1]);
    const cpMatch = urlPath.match(/^\/api\/orders\/([^/]+)\/payments$/);
    if (cpMatch && m === 'GET') {
      const u = await getCustomerSession(req);
      if (!u) return sendJson(res, 401, { error: 'Not authenticated.' });
      const subs = await store.getCustomerPayments(cpMatch[1], u.id);
      return subs ? sendJson(res, 200, { submissions: subs }) : sendJson(res, 404, { error: 'Order not found.' });
    }
    const crMatch = urlPath.match(/^\/api\/orders\/([^/]+)\/payments\/(\d+)\/receipt$/);
    if (crMatch && m === 'GET') {
      const u = await getCustomerSession(req);
      const order = u && await store.get(crMatch[1]);
      const sub = order && order.userId === u.id ? await store.getPaymentSubmission(crMatch[2]) : null;
      return sub && sub.order_number === order.orderNumber ? await sendReceipt(res, sub) : sendJson(res, u ? 404 : 401, { error: u ? 'Receipt not found.' : 'Not authenticated.' });
    }

    if (urlPath === '/api/notifications' && m === 'GET') {
      const u = await getCustomerSession(req);
      if (!u) return sendJson(res, 401, { error: 'Not authenticated.' });
      const orderNumber = query.get('orderNumber') || null;
      const notifs = await store.listNotificationsForCustomer(u.id, orderNumber, 50);
      const unreadCount = await store.unreadNotificationCount('customer', u.id);
      return sendJson(res, 200, { notifications: notifs, unreadCount });
    }

    if (urlPath === '/api/auth/me' && m === 'DELETE') {
      let b = {}; try { b = await readJson(req); } catch (_) {}
      return handleDeleteAccount(req, res, b);
    }

    if (needsBody) {
      let body;
      const bigBody = urlPath === '/api/upload' || /^\/api\/orders\/[^/]+\/payments$/.test(urlPath);
      try { body = await readJson(req, bigBody ? 8 * 1024 * 1024 : 100 * 1024); }
      catch (e) { return sendJson(res, e.status || 400, { error: e.status === 413 ? 'Payload too large.' : 'Invalid request payload.' }); }
      if (urlPath === '/api/upload' && m === 'POST') {
        // Customer photo upload (delivery-issue evidence): signed-in customers only, rate limited.
        const u = await getCustomerSession(req);
        if (!u) return sendJson(res, 401, { error: 'Please sign in to upload a photo.' });
        if (rateLimited('upload:' + u.id, 10, 600000)) return sendJson(res, 429, { error: 'Too many uploads. Please try again later.' });
        return handleAdminUpload(req, res, body, 'disputes');
      }
      if (urlPath === '/api/orders' && m === 'POST') return handleCreateOrder(req, res, body);
      const spMatch = urlPath.match(/^\/api\/orders\/([^/]+)\/payments$/);
      if (spMatch && m === 'POST') return handleSubmitPayment(req, res, spMatch[1], body);

      // Customer confirms receipt (or reports an issue) for a delivery or a store pickup — only their own order.
      const confirmMatch = urlPath.match(/^\/api\/orders\/([^/]+)\/confirm-(?:delivery|pickup)$/);
      if (confirmMatch && m === 'POST') {
        const u = await getCustomerSession(req);
        if (!u) return sendJson(res, 401, { error: 'Please sign in to confirm receiving your order.' });
        const disputePhotoUrl = clean(body.disputePhotoUrl, 300);
        if (disputePhotoUrl && !validImage(disputePhotoUrl)) {
          return sendJson(res, 400, { error: 'Invalid photo reference.' });
        }
        const r = await store.setCustomerDeliveryConfirmation(confirmMatch[1], {
          userId: u.id,
          confirmed: body.confirmed === true,
          reason: clean(body.reason, 500),
          disputePhotoUrl
        });
        return r.ok ? sendJson(res, 200, { ok: true, order: publicOrder(r.order) }) : sendJson(res, r.status || 400, { error: r.error, code: r.code });
      }

      const notifReadCustMatch = urlPath.match(/^\/api\/notifications\/([^/]+)\/read$/);
      if (notifReadCustMatch && m === 'POST') {
        const u = await getCustomerSession(req);
        if (!u) return sendJson(res, 401, { error: 'Not authenticated.' });
        await store.markNotificationRead(parseInt(notifReadCustMatch[1], 10), { recipientType: 'customer', userId: u.id });
        return sendJson(res, 200, { ok: true });
      }
      if (urlPath === '/api/notifications/read-all' && m === 'POST') {
        const u = await getCustomerSession(req);
        if (!u) return sendJson(res, 401, { error: 'Not authenticated.' });
        await store.markAllNotificationsRead('customer', u.id);
        return sendJson(res, 200, { ok: true });
      }

      if (urlPath === '/api/auth/register' && m === 'POST') return handleRegister(req, res, body);
      if (urlPath === '/api/auth/verify-otp' && m === 'POST') return handleVerifyOTP(req, res, body);
      if (urlPath === '/api/auth/resend-otp' && m === 'POST') return handleResendOTP(req, res, body);
      if (urlPath === '/api/auth/login' && m === 'POST') return handleLogin(req, res, body);
      if (urlPath === '/api/auth/google' && m === 'POST') return handleGoogleAuth(req, res, body);
      if (urlPath === '/api/auth/forgot' && m === 'POST') return handleForgot(req, res, body);
      if (urlPath === '/api/auth/reset' && m === 'POST') return handleReset(req, res, body);
      if (urlPath === '/api/auth/me' && m === 'PUT') return handleUpdateMe(req, res, body);
      if (urlPath === '/api/cart' && m === 'PUT') {
        const u = await getCustomerSession(req);
        if (!u) return sendJson(res, 401, { error: 'Not authenticated.' });
        const items = sanitizeCart(body.items);
        if (!items) return sendJson(res, 400, { error: 'Invalid cart.' });
        await store.saveCart(u.id, items);
        return sendJson(res, 200, { ok: true, items });
      }
    }
    return sendJson(res, 404, { error: 'API route not found.' });
  }

  // static files
  if (m !== 'GET' && m !== 'HEAD') { res.writeHead(405, SECURITY_HEADERS); return res.end(); }
  let reqUrl = urlPath === '/' || urlPath === '' ? '/index.html' : urlPath;
  if (reqUrl === '/admin') reqUrl = '/admin.html';
  if (!isPublicPath(reqUrl)) { res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS }); return res.end('404 Not Found'); }
  const filePath = process.env.UMAIRA_UPLOAD_DIR && reqUrl.startsWith('/assets/uploads/')
    ? path.join(UPLOAD_DIR, path.basename(reqUrl))
    : path.join(BASE_DIR, reqUrl);
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS }); return res.end('404 Not Found'); }
    const ext = path.extname(filePath).toLowerCase();
    const html = ext === '.html';
    const isHeroImg = reqUrl === '/image/taniman.jpg';
    const cacheControl = html || ext === '.js' || ext === '.css' || isHeroImg || query.has('v') ? 'no-cache, must-revalidate' : 'public, max-age=3600';
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream', 'Cache-Control': cacheControl, ...SECURITY_HEADERS });
    if (m === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  route(req, res).catch(err => {
    console.error('Unhandled request error:', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Something went wrong. Please try again.' }); else res.end();
  });
});

async function start(port = process.env.PORT || 3000) {
  await bootstrapAdmin();
  return new Promise(resolve => server.listen(port, async () => {
    console.log(`Umaira Florist running at http://localhost:${server.address().port}/  (admin: /admin)`);
    console.log(`Storage: ${await store.kind()}`);
    if (!process.env.GOOGLE_CLIENT_ID) console.log('Google sign-in: disabled (set GOOGLE_CLIENT_ID to enable)');
    // Confirmation deadlines (reminders + automatic confirmation): once now, to catch up after downtime, then
    // every 5 minutes.
    const runDeadlines = async () => {
      try {
        const r = await store.runConfirmationDeadlines();
        if (r.reminded.length || r.autoConfirmed.length) console.log(`[deadlines] reminded: ${r.reminded.join(', ') || '-'}; auto-confirmed: ${r.autoConfirmed.join(', ') || '-'}`);
      } catch (e) { console.error('[deadlines]', e.message); }
    };
    await runDeadlines();
    const deadlineTimer = setInterval(runDeadlines, Number(process.env.DEADLINE_CHECK_MS) || 300000);
    deadlineTimer.unref();
    server.once('close', () => clearInterval(deadlineTimer));
    resolve(server);
  }));
}

// Vercel serverless handler: each request re-enters here, DB is initialized lazily by the store proxy.
let _bootstrapped = false;
async function vercelHandler(req, res) {
  if (!process.env.TRUST_PROXY) process.env.TRUST_PROXY = '1';
  if (!_bootstrapped) {
    _bootstrapped = true;
    try { await bootstrapAdmin(); } catch (e) { console.error('[bootstrap]', e); }
  }
  return route(req, res).catch(err => {
    console.error('Unhandled request error:', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Something went wrong. Please try again.' }); else res.end();
  });
}

// Export vercelHandler as the main export so Vercel (which reads package.json "main") accepts
// server.js as a valid serverless function. Named exports are attached as properties so that
// require('./server') destructuring still works in tests and api/index.js.
module.exports = vercelHandler;
module.exports.server = server;
module.exports.start = start;
module.exports.vercelHandler = vercelHandler;
if (require.main === module) {
  process.on('uncaughtException', e => console.error('uncaughtException:', e));
  process.on('unhandledRejection', e => console.error('unhandledRejection:', e));
  start();
}
