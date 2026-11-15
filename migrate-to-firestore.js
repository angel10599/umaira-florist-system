// migrate-to-firestore.js — One-time migration of all SQLite data to Cloud Firestore.
// Usage: node migrate-to-firestore.js [--dry-run]
//
// Safety: this script reads from SQLite and WRITES to Firestore. It never modifies SQLite.
// Run with --dry-run to see what would be written without actually writing.
//
// Credentials: requires serviceAccountKey.json at the project root.
// Environment: loads .env automatically.
//
// IMPORTANT — Firebase Auth is NOT migrated.
// This script copies user profile documents to Firestore but does NOT create Firebase
// Authentication accounts. Custom scrypt/SHA-256 tokens are incompatible with Firebase Auth.
// Users continue to sign in with the existing custom auth system unchanged.
//
// DOCUMENT FORMAT NOTE
// Every Firestore document uses the same camelCase field names and computed values as the
// app's own store.js (flowerRow / bouquetRow / rowToOrder). This ensures the runtime
// firestore-sync.js and this script produce identical document shapes, so reruns with
// { merge: true } never create duplicate fields with different naming conventions.
'use strict';
try { process.loadEnvFile('.env'); } catch (_) {}

const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const rules = require('./js/shop-rules.js');

const DRY_RUN = process.argv.includes('--dry-run');

// ---- Init Firebase ----
// Tries serviceAccountKey.json at the project root first, then config/firebase-service-account.json.
function loadServiceAccount() {
  const candidates = [
    path.join(__dirname, 'serviceAccountKey.json'),
    path.join(__dirname, 'config', 'firebase-service-account.json'),
  ];
  for (const p of candidates) {
    try { return require(p); } catch (_) {}
  }
  return null;
}
const serviceAccount = loadServiceAccount();
if (!serviceAccount) {
  console.error(
    '\nFirebase service account key not found.\n' +
    'To fix this:\n' +
    '  1. Go to Firebase Console → Project Settings → Service Accounts\n' +
    '  2. Click "Generate new private key"\n' +
    '  3. Save the downloaded JSON as: serviceAccountKey.json  (project root)\n'
  );
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

// ---- Open SQLite (read-only) ----
const DATA_DIR = process.env.UMAIRA_DATA_DIR || path.join(__dirname, 'data');
const dbPath = path.join(DATA_DIR, 'umaira.db');
let sqlite;
try {
  sqlite = new DatabaseSync(dbPath);
} catch (e) {
  console.error('Could not open SQLite database at', dbPath + ':', e.message);
  process.exit(1);
}

// ---- Helpers ----
function safeParse(s, fb) { try { return JSON.parse(s); } catch (_) { return fb; } }
const BATCH_SIZE = 400; // Firestore allows up to 500 ops per batch

// Writes a flat collection. keyFn returns the document ID string; mapFn transforms the row.
// { merge: true } makes reruns idempotent: existing fields not in `data` are preserved and
// existing fields in `data` are updated. No data is deleted on rerun.
async function writeBatch(collection, rows, keyFn, mapFn) {
  let count = 0;
  if (rows.length === 0) {
    console.log(`  ${DRY_RUN ? '[dry-run] ' : ''}0 docs → ${collection}`);
    return;
  }
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    if (DRY_RUN) {
      console.log(`  [dry-run] would write ${chunk.length} docs to ${collection}`);
      count += chunk.length;
      continue;
    }
    const batch = db.batch();
    for (const row of chunk) {
      const key = keyFn(row);
      const data = mapFn ? mapFn(row) : row;
      batch.set(db.collection(collection).doc(String(key)), data, { merge: true });
    }
    await batch.commit();
    count += chunk.length;
    process.stdout.write(`  wrote ${count}/${rows.length} to ${collection}\r`);
  }
  console.log(`  ${DRY_RUN ? '[dry-run] ' : ''}${count} docs → ${collection}`);
}

// ---- Row transformations (mirror store.js exactly) ----

// Reads the global low-stock threshold from shop_settings once.
// This is the same value flowerRow/bouquetRow compute at runtime.
function readLowStockThreshold() {
  try {
    const row = sqlite.prepare("SELECT value_json FROM shop_settings WHERE key = 'inventory'").get();
    if (row && row.value_json) {
      const val = safeParse(row.value_json, null);
      const th = parseInt(val && val.lowStockThreshold, 10);
      if (!isNaN(th) && th >= 0) return th;
    }
  } catch (_) {}
  return 20;
}

// Mirrors store.js flowerRow(). Used by both initial migration and firestore-sync.
function toFlowerDoc(f, lowStockThreshold) {
  return {
    id: f.id, name: f.name, botanicalName: f.botanical_name, category: f.category, price: f.price,
    availability: f.availability, stockCount: f.stock_count, description: f.description,
    image: f.image || '', color: f.color, archived: !!f.archived,
    unitCost: f.unit_cost !== null && f.unit_cost !== undefined ? f.unit_cost : null,
    lowStockThreshold,
    unitOfMeasure: f.unit_of_measure || (f.item_type === 'wrapping' ? 'sheets' : f.item_type === 'ribbon' ? 'rolls' : f.item_type === 'card' ? 'cards' : 'stems'),
    itemType: f.item_type || 'flower',
    style: f.style || '',
    supplierId: f.supplier_id || null,
    source: f.source || null,
    createdAt: f.created_at || f.updated_at || null,
    updatedAt: f.updated_at || null,
  };
}

// Mirrors store.js bouquetRow(). salesCount=0 because totals live in order_items.
function toBouquetDoc(b, lowStockThreshold) {
  const specs = b.specs_json ? safeParse(b.specs_json, null) : null;
  const stock = (b.stock_count !== undefined && b.stock_count !== null) ? Number(b.stock_count) : 10;
  return {
    id: b.id, name: b.name, category: b.category, occasion: b.occasion, price: b.price,
    description: b.description, image: b.image || '', formula: b.formula || '', availability: b.availability,
    stockCount: stock, stock_count: stock,
    createdAt: b.created_at || b.updated_at || null,
    updatedAt: b.updated_at || null,
    unitOfMeasure: 'bouquets',
    lowStockThreshold,
    specs,
    primaryFlower: (specs && specs.primaryFlower) || '',
    flowerTypes: (specs && specs.flowerTypes) || [],
    source: (b.source && !b.source.includes('Unverified'))
      ? b.source
      : ((specs && specs.source && !specs.source.includes('Unverified')) ? specs.source : null),
    sources: (specs && Array.isArray(specs.sources))
      ? specs.sources.filter(s => s && !s.includes('Unverified'))
      : (b.source && !b.source.includes('Unverified') ? [b.source] : []),
    salesCount: 0,
    popularity: 0,
    archived: !!b.archived,
  };
}

// Mirrors store.js rowToOrder(). Requires pre-indexed child rows.
const AWAITING_STATUS = {
  pickup: 'Awaiting Customer Confirmation',
  delivery: 'Delivered — Awaiting Confirmation',
};
function toOrderDoc(r, { itemsByOrderId, eventsByOrderNum, paySubsByOrderNum, payEventsByOrderNum }) {
  const kind = r.fulfillment_type === 'pickup' ? 'pickup' : 'delivery';
  let confirmationDeadline = null;
  if (r.status === AWAITING_STATUS[kind]) {
    const since = Date.parse(
      r.awaiting_confirmation_since
      || (kind === 'pickup' ? r.pickup_handover_at : null)
      || r.updated_at
      || ''
    );
    if (Number.isFinite(since)) {
      confirmationDeadline = new Date(
        since + rules.CONFIRMATION_DEADLINES[kind].autoConfirmAfterHours * 3600000
      ).toISOString();
    }
  }
  return {
    // Core identity — matches rowToOrder exactly
    id: r.order_number, orderNumber: r.order_number, userId: r.user_id || null, status: r.status,
    fulfillment: r.fulfillment_type, firstName: r.first_name, lastName: r.last_name,
    phone: r.phone, email: r.email, address: r.address, district: r.district, barangay: r.barangay,
    city: r.city, notes: r.notes, date: r.schedule_date, time: r.schedule_time,
    paymentMethod: r.payment_method,
    paymentStatus: rules.normalizePaymentStatus(r.payment_status),
    paymentKind: rules.paymentKind(r.payment_method),
    paidAt: r.paid_at || null, paidBy: r.paid_by || null,
    paidAmount: r.paid_amount == null ? null : r.paid_amount,
    pickupHandoverBy: r.pickup_handover_by || null, pickupHandoverAt: r.pickup_handover_at || null,
    deliveryFailedReason: r.delivery_failed_reason || null,
    confirmationDeadline,
    giftMessage: r.gift_message || null,
    grabTrackingUrl: r.grab_tracking_url || null, rejectReason: r.reject_reason || null,
    subtotal: r.subtotal, deliveryFee: r.delivery_fee, total: r.total,
    podPhotoUrl: r.pod_photo_url || null, podDeliveredAt: r.pod_delivered_at || null,
    podAdmin: r.pod_admin || null, podNotes: r.pod_notes || null,
    customerConfirmationStatus: r.customer_confirmation_status || 'pending',
    customerConfirmedAt: r.customer_confirmed_at || null,
    customerDisputeReason: r.customer_dispute_reason || null,
    customerDisputePhotoUrl: r.customer_dispute_photo_url || null,
    disputeResolvedAt: r.dispute_resolved_at || null,
    disputeResolutionNotes: r.dispute_resolution_notes || null,
    createdAt: r.created_at, updatedAt: r.updated_at,

    // Items — matches rowToOrder exactly (field is "type", not "itemType")
    items: (itemsByOrderId[r.id] || []).map(i => ({
      bouquetName: i.bouquet_name || null, type: i.item_type, itemId: i.item_id || null,
      name: i.name, quantity: i.quantity, unitPrice: i.unit_price,
      lineTotal: i.line_total, cardMessage: i.card_message || null,
    })),

    // Status audit trail — field name "history" matches rowToOrder exactly
    history: (eventsByOrderNum[r.order_number] || []).map(e => ({
      action: e.action, actorType: e.actor_type, actor: e.actor,
      note: e.note || null, createdAt: e.created_at,
    })),

    // Payment submissions — Firestore-only extra field (not in rowToOrder)
    // receipt_file (local server path) and receipt_sha256 intentionally excluded
    payments: (paySubsByOrderNum[r.order_number] || []).map(p => ({
      id: p.id, method: p.method, amountDue: p.amount_due, amountSubmitted: p.amount_submitted,
      reference: p.reference, status: p.status, submittedAt: p.submitted_at,
      reviewedBy: p.reviewed_by || null, reviewedAt: p.reviewed_at || null,
      reviewNote: p.review_note || null,
    })),

    // Payment audit trail — Firestore-only extra field (not in rowToOrder)
    paymentHistory: (payEventsByOrderNum[r.order_number] || []).map(e => ({
      id: e.id, submissionId: e.submission_id, action: e.action,
      fromStatus: e.from_status, toStatus: e.to_status, actorType: e.actor_type,
      actor: e.actor, amount: e.amount, note: e.note || null, createdAt: e.created_at,
    })),
  };
}

// ---- Migrate ----
async function run() {
  console.log(DRY_RUN ? '=== DRY RUN — no Firestore writes ===' : '=== Migrating SQLite → Firestore ===');

  const lowStockThreshold = readLowStockThreshold();

  // ------------------------------------------------------------------
  // USERS
  // Customers only. password_hash intentionally excluded.
  // admin_users are kept local — their custom-auth passwords are not
  // compatible with Firebase Auth and must never leave the server.
  // ------------------------------------------------------------------
  const users = sqlite.prepare(
    "SELECT id, email, name, phone, google_id, role, verified, address_json, created_at, updated_at " +
    "FROM users WHERE role = 'customer'"
  ).all();
  const totalUsers = sqlite.prepare("SELECT COUNT(*) n FROM users").get().n;
  console.log(`\nUsers: ${users.length} customers  (${totalUsers - users.length} admin skipped — stays local)`);
  await writeBatch('users', users, r => r.id, r => ({
    id: r.id, email: r.email, name: r.name, phone: r.phone || null,
    googleId: r.google_id || null, role: r.role, verified: !!r.verified,
    address: r.address_json ? safeParse(r.address_json, null) : null,
    createdAt: r.created_at, updatedAt: r.updated_at || null,
  }));

  // ------------------------------------------------------------------
  // FLOWERS — all rows including archived (archived flag preserved)
  // Document shape mirrors flowerRow() in store.js.
  // ------------------------------------------------------------------
  const flowers = sqlite.prepare('SELECT * FROM flowers').all();
  const activeF = flowers.filter(r => !r.archived).length;
  console.log(`\nFlowers: ${flowers.length} total  (${activeF} active, ${flowers.length - activeF} archived)`);
  await writeBatch('flowers', flowers, r => r.id, r => toFlowerDoc(r, lowStockThreshold));

  // ------------------------------------------------------------------
  // BOUQUETS — all rows including archived
  // Document shape mirrors bouquetRow() in store.js.
  // ------------------------------------------------------------------
  const bouquets = sqlite.prepare('SELECT * FROM bouquets').all();
  const activeB = bouquets.filter(r => !r.archived).length;
  console.log(`\nBouquets: ${bouquets.length} total  (${activeB} active, ${bouquets.length - activeB} archived)`);
  await writeBatch('bouquets', bouquets, r => r.id, r => toBouquetDoc(r, lowStockThreshold));

  // ------------------------------------------------------------------
  // ORDERS — with embedded items, history, and payment data
  //
  // Core fields mirror rowToOrder() in store.js exactly.
  // "items"   → order_items rows (field name "type" matches rowToOrder)
  // "history" → order_events rows (field name matches rowToOrder)
  // "payments"        → payment_submissions (Firestore-only, not in rowToOrder)
  // "paymentHistory"  → payment_events      (Firestore-only, not in rowToOrder)
  //
  // receipt_file and receipt_sha256 excluded from payments — local paths are
  // meaningless in Firestore and payment proofs are private server-side files.
  // ------------------------------------------------------------------
  const allItems       = sqlite.prepare('SELECT * FROM order_items').all();
  const allOrderEvents = sqlite.prepare('SELECT * FROM order_events').all();
  const allPaySubs     = sqlite.prepare('SELECT * FROM payment_submissions').all();
  const allPayEvents   = sqlite.prepare('SELECT * FROM payment_events').all();

  const itemsByOrderId     = groupBy(allItems,       r => r.order_id);
  const eventsByOrderNum   = groupBy(allOrderEvents,  r => r.order_number);
  const paySubsByOrderNum  = groupBy(allPaySubs,      r => r.order_number);
  const payEventsByOrderNum = groupBy(allPayEvents,   r => r.order_number);

  const orders = sqlite.prepare('SELECT * FROM orders').all();
  console.log(
    `\nOrders: ${orders.length} orders  ` +
    `(embedding ${allItems.length} items, ${allOrderEvents.length} events, ` +
    `${allPaySubs.length} payment submissions, ${allPayEvents.length} payment history entries)`
  );
  await writeBatch('orders', orders, r => r.order_number, r =>
    toOrderDoc(r, { itemsByOrderId, eventsByOrderNum, paySubsByOrderNum, payEventsByOrderNum })
  );

  // ------------------------------------------------------------------
  // SUPPLIERS
  // ------------------------------------------------------------------
  const suppliers = sqlite.prepare('SELECT * FROM suppliers').all();
  console.log(`\nSuppliers: ${suppliers.length}`);
  await writeBatch('suppliers', suppliers, r => r.id, r => ({
    id: r.id, name: r.name, contactPerson: r.contact_person || null, phone: r.phone || null,
    email: r.email || null, address: r.address || null, origin: r.origin || null,
    categories: r.categories_json ? safeParse(r.categories_json, []) : [],
    notes: r.notes || null, active: !!r.active,
    createdAt: r.created_at, updatedAt: r.updated_at || null,
  }));

  // ------------------------------------------------------------------
  // CATEGORIES
  // ------------------------------------------------------------------
  const categories = sqlite.prepare('SELECT * FROM categories').all();
  console.log(`\nCategories: ${categories.length}`);
  await writeBatch('categories', categories, r => r.id, r => ({
    id: r.id, name: r.name, type: r.type, description: r.description || null,
    active: !!r.active, createdAt: r.created_at, updatedAt: r.updated_at || null,
  }));

  // ------------------------------------------------------------------
  // STOCK TRANSACTIONS — inventory history
  // ------------------------------------------------------------------
  const stockTxns = sqlite.prepare('SELECT * FROM stock_transactions').all();
  console.log(`\nStock transactions: ${stockTxns.length}`);
  await writeBatch('stock_transactions', stockTxns, r => String(r.id), r => ({
    id: r.id, flowerId: r.flower_id, transactionType: r.transaction_type,
    quantityChange: r.quantity_change, previousStock: r.previous_stock, newStock: r.new_stock,
    unitCost: r.unit_cost !== null && r.unit_cost !== undefined ? r.unit_cost : null,
    reason: r.reason || null, supplierId: r.supplier_id || null, orderNumber: r.order_number || null,
    adminUsername: r.admin_username || null, createdAt: r.created_at,
  }));

  // ------------------------------------------------------------------
  // SETTINGS
  // SQLite table: shop_settings   Firestore collection: settings
  // Name intentionally shortened. The firestore-sync.js runtime service
  // writes to 'settings' as well — consistent.
  // ------------------------------------------------------------------
  const settings = sqlite.prepare('SELECT key, value_json, updated_at FROM shop_settings').all();
  console.log(`\nSettings: ${settings.length}  (SQLite: shop_settings → Firestore: settings)`);
  await writeBatch('settings', settings, r => r.key, r => ({
    key: r.key, value: safeParse(r.value_json, r.value_json), updatedAt: r.updated_at,
  }));

  // ------------------------------------------------------------------
  // INTENTIONALLY SKIPPED TABLES
  // ------------------------------------------------------------------
  console.log('\nSkipped (not migrated):');
  const skipped = [
    ['pending_registrations', 'ephemeral OTP state; expires automatically'],
    ['admin_users',           'admin auth is custom/local-only; never in Firestore'],
    ['admin_sessions',        'ephemeral session tokens'],
    ['customer_sessions',     'ephemeral session tokens'],
    ['password_resets',       'ephemeral one-time tokens'],
    ['carts',                 'transient shopping cart data'],
    ['notifications',         'transient in-app notifications'],
    ['email_log',             'server-side delivery audit log'],
    ['sqlite_sequence',       'SQLite-internal auto-increment counters'],
  ];
  for (const [table, reason] of skipped) {
    const n = (() => { try { return sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n; } catch(_) { return '?'; } })();
    console.log(`  ${table.padEnd(26)} ${String(n).padStart(3)} rows — ${reason}`);
  }

  // ------------------------------------------------------------------
  // FIREBASE AUTH NOTE
  // ------------------------------------------------------------------
  console.log('\nFirebase Auth:');
  console.log('  User documents written to Firestore (collection: users).');
  console.log('  Firebase Auth accounts NOT created — custom scrypt tokens are incompatible.');
  console.log('  Existing sign-in flow is unchanged.');

  console.log('\nMigration complete.');
}

// ---- Utility ----
function groupBy(rows, keyFn) {
  const map = {};
  for (const row of rows) {
    const k = keyFn(row);
    if (!map[k]) map[k] = [];
    map[k].push(row);
  }
  return map;
}

run().catch(e => { console.error('Migration failed:', e); process.exit(1); });
