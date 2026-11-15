// Umaira Florist data layer. SQLite (node:sqlite, Node 22.5+) is the single source of truth for
// products, stock, customers, carts, orders and sessions. Schema: db/schema.sql.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const LIVE_DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_DIR = process.env.UMAIRA_DATA_DIR || LIVE_DATA_DIR;
// Safety net: a test must never open the shop's real database. Tests get their own temporary
// database by requiring tests/helpers/isolated-db.js before the server or store.
(function refuseLiveDatabaseInTests() {
  const main = (require.main && require.main.filename) || '';
  const isTestRun = process.env.UMAIRA_TEST === '1' || process.env.NODE_ENV === 'test'
    || /[\\/]tests[\\/]/.test(main) || /(^|[\\/])test[-_][^\\/]*$/.test(main) || /\.test\.js$/.test(main);
  if (isTestRun && path.resolve(DATA_DIR) === path.resolve(LIVE_DATA_DIR)) {
    throw new Error('Refusing to open the live database (data/umaira.db) from a test. Require tests/helpers/isolated-db.js first.');
  }
})();
fs.mkdirSync(DATA_DIR, { recursive: true });

const { DatabaseSync } = require('node:sqlite');
const eventHub = require('./events');
const rules = require('../js/shop-rules.js');
const payments = require('./payments');
const {
  PHILIPPINE_CATEGORIES,
  READY_MADE_BOUQUETS,
  ALL_FLOWERS_AND_MATERIALS
} = require('./philippines_catalog');

// ---- Seed catalog (only used to fill an EMPTY catalog; never overwrites admin edits) ----
let defaultCatalog = { mainFlowers: [], featuredBouquets: [] };
try {
  const ctx = vm.createContext({ window: {}, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'), ctx);
  defaultCatalog = vm.runInContext('FLOWER_DATA', ctx);
} catch (e) {
  console.warn('Could not load seed catalog from js/data.js:', e.message);
}

// ---- Order status flow ----
const VALID_TRANSITIONS = {
  delivery: {
    'Pending Confirmation': ['Confirmed', 'Rejected/Cancelled'],
    'Confirmed': ['Preparing', 'Rejected/Cancelled'],
    'Preparing': ['Rider Assigned', 'On the Way', 'Out for Delivery', 'Rejected/Cancelled'],
    'Rider Assigned': ['On the Way', 'Out for Delivery', 'Rejected/Cancelled'],
    // Delivered only with a proof-of-delivery photo (setProofOfDelivery); "Delivered" without a photo is
    // kept only for older orders already in that status.
    'On the Way': ['Delivered — Awaiting Confirmation', 'Out for Delivery', 'Delivery Attempt Failed', 'Rejected/Cancelled'],
    'Out for Delivery': ['Delivered — Awaiting Confirmation', 'On the Way', 'Delivery Attempt Failed', 'Rejected/Cancelled'],
    'Delivery Attempt Failed': ['Out for Delivery', 'On the Way', 'Rejected/Cancelled'],
    'Delivered — Awaiting Confirmation': ['Delivered — Confirmed', 'Delivery Disputed'],
    'Delivered': ['Delivered — Confirmed', 'Delivery Disputed'],
    'Delivery Disputed': ['Delivered — Confirmed', 'Preparing', 'Out for Delivery', 'Rejected/Cancelled'],
    'Delivered — Confirmed': [],
    'Rejected/Cancelled': []
  },
  pickup: {
    'Pending Confirmation': ['Confirmed', 'Rejected/Cancelled'],
    'Confirmed': ['Preparing', 'Rejected/Cancelled'],
    'Preparing': ['Ready for Pickup', 'Rejected/Cancelled'],
    // Two-way pickup confirmation: the shop confirms the handover, then the customer confirms receipt.
    'Ready for Pickup': ['Awaiting Customer Confirmation', 'Rejected/Cancelled'],
    'Awaiting Customer Confirmation': ['Picked Up', 'Pickup Disputed'],
    'Pickup Disputed': ['Picked Up', 'Ready for Pickup', 'Rejected/Cancelled'],
    'Picked Up': [],
    'Rejected/Cancelled': []
  }
};
// Pickup steps that only one party may take (never through the generic admin status endpoint):
// the admin's handover goes through confirmPickupHandover (records who and when); 'Picked Up' and
// 'Pickup Disputed' are the customer's own answer (setCustomerDeliveryConfirmation).
const PICKUP_PARTY_STEPS = ['Awaiting Customer Confirmation', 'Picked Up', 'Pickup Disputed'];
// Delivery steps with their own action (never the generic status endpoint): the proof-of-delivery upload
// ("Delivered — Awaiting Confirmation"), the customer's answer ("Delivered — Confirmed" / "Delivery Disputed"),
// a failed attempt (needs a reason) and the photo-less "Delivered" (older orders only).
const DELIVERY_PARTY_STEPS = ['Delivered — Awaiting Confirmation', 'Delivered — Confirmed', 'Delivery Disputed', 'Delivered', 'Delivery Attempt Failed'];
// Cancelling before preparation starts returns the stems automatically; afterwards only if the admin says so.
const AUTO_RESTOCK_STATUSES = ['Pending Confirmation', 'Confirmed'];
const ACTIVE_STATUSES = rules.ACTIVE_ORDER_STATUSES;
const DONE_STATUSES = rules.DONE_ORDER_STATUSES;
const CORE_CATEGORY_IDS = ['cat-ready-made-bouquets', 'cat-fresh-flowers', 'cat-fillers-foliage', 'cat-wrapping-materials', 'cat-ribbons', 'cat-message-cards', 'cat-greeting-cards'];

// Order rows store one line per custom-bouquet component. A row belongs to a custom bouquet when it is a
// material, or a flower whose bouquet name differs from the flower itself (single stems store their own name).
const CUSTOM_COMPONENT_TYPES = ['filler', 'greenery', 'foliage', 'wrapping', 'ribbon', 'card'];
function isCustomComponent(it) {
  if (!it || !it.bouquetName || it.type === 'ready_bouquet') return false;
  if (CUSTOM_COMPONENT_TYPES.includes(it.type)) return true;
  return it.type === 'flower' && it.bouquetName !== it.name;
}

// ---- Password hashing (scrypt; legacy pbkdf2 hashes still verify and are upgraded on login) ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  try {
    if (stored.startsWith('scrypt$')) {
      const [, salt, hash] = stored.split('$');
      const test = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
      return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
    }
    if (stored.includes(':')) { // legacy salt:pbkdf2(1000)
      const [salt, hash] = stored.split(':');
      const test = crypto.pbkdf2Sync(String(password), salt, 1000, 64, 'sha512');
      const orig = Buffer.from(hash, 'hex');
      return orig.length === test.length && crypto.timingSafeEqual(test, orig);
    }
  } catch (e) { /* fall through */ }
  return false;
}
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function normalizeOrderNum(n) {
  if (!n) return '';
  const c = String(n).trim();
  return c.startsWith('#') ? c : '#' + c;
}

function open(customDbOrPath) {
  let db;
  if (customDbOrPath && typeof customDbOrPath === 'object') {
    db = customDbOrPath;
  } else if (typeof customDbOrPath === 'string') {
    db = new DatabaseSync(customDbOrPath);
  } else {
    db = new DatabaseSync(path.join(DATA_DIR, 'umaira.db'));
  }
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');

  const tableCols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
  // A product with stock history or past orders is never hard-deleted: reports and the audit trail need it.
  const permanentDeleteBlocker = (id) => {
    const moves = db.prepare('SELECT count(*) n FROM stock_transactions WHERE flower_id = ?').get(id).n;
    const sold = db.prepare('SELECT count(*) n FROM order_items WHERE item_id = ?').get(id).n;
    if (!moves && !sold) return null;
    const why = [moves ? `${moves} stock movement(s)` : '', sold ? `${sold} order line(s)` : ''].filter(Boolean).join(' and ');
    return { ok: false, status: 409, error: `This product has ${why} on record, so it cannot be permanently deleted. Archive it instead — it will be hidden from the shop and its history kept.` };
  };
  const hasTable = (t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);

  // Old session tables stored raw tokens; sessions are short-lived so they are simply recreated.
  for (const t of ['admin_sessions', 'customer_sessions']) {
    if (hasTable(t) && !tableCols(t).includes('token_hash')) db.exec(`DROP TABLE ${t}`);
  }

  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const lines = schema.split('\n');
  const tableSql = lines.filter(l => !/^CREATE INDEX/i.test(l)).join('\n');
  const indexSql = lines.filter(l => /^CREATE INDEX/i.test(l)).join('\n');
  db.exec(tableSql);

  // Additive migrations for databases created by earlier versions.
  const addCol = (table, col, def) => { if (!tableCols(table).includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); };
  addCol('orders', 'user_id', 'TEXT');
  addCol('orders', 'district', 'TEXT');
  addCol('orders', 'notes', 'TEXT');
  addCol('orders', 'grab_tracking_url', 'TEXT');
  addCol('orders', 'reject_reason', 'TEXT');
  addCol('orders', 'stock_restored', 'INTEGER NOT NULL DEFAULT 0');
  addCol('orders', 'pod_photo_url', 'TEXT');
  addCol('orders', 'pod_delivered_at', 'TEXT');
  addCol('orders', 'pod_admin', 'TEXT');
  addCol('orders', 'pod_notes', 'TEXT');
  addCol('orders', 'customer_confirmation_status', "TEXT DEFAULT 'pending'");
  addCol('orders', 'customer_confirmed_at', 'TEXT');
  addCol('orders', 'customer_dispute_reason', 'TEXT');
  addCol('orders', 'customer_dispute_photo_url', 'TEXT');
  addCol('orders', 'dispute_resolved_at', 'TEXT');
  addCol('orders', 'dispute_resolution_notes', 'TEXT');
  addCol('orders', 'paid_at', 'TEXT');      // set only when an admin confirms the money was received
  addCol('orders', 'paid_by', 'TEXT');
  addCol('orders', 'paid_amount', 'REAL');
  addCol('orders', 'pickup_handover_by', 'TEXT');   // admin who confirmed the pickup handover
  addCol('orders', 'pickup_handover_at', 'TEXT');
  // Server time when the order started waiting for the customer's confirmation (pickup handover or delivery
  // photo). The automatic-confirmation deadline counts from here, never from a time typed by staff.
  addCol('orders', 'awaiting_confirmation_since', 'TEXT');
  addCol('orders', 'confirm_reminder_sent_at', 'TEXT');
  addCol('orders', 'delivery_failed_reason', 'TEXT');
  addCol('flowers', 'archived', 'INTEGER NOT NULL DEFAULT 0');
  addCol('flowers', 'created_at', 'TEXT');   // for "Recently Added" / "Newest First" sorting
  addCol('bouquets', 'created_at', 'TEXT');
  addCol('flowers', 'updated_at', 'TEXT');
  addCol('flowers', 'unit_cost', 'REAL');
  addCol('flowers', 'low_stock_threshold', 'INTEGER NOT NULL DEFAULT 5');
  addCol('flowers', 'unit_of_measure', "TEXT NOT NULL DEFAULT 'stems'");
  addCol('flowers', 'item_type', "TEXT NOT NULL DEFAULT 'flower'");
  addCol('flowers', 'style', 'TEXT');
  addCol('flowers', 'supplier_id', 'TEXT REFERENCES suppliers(id)');
  addCol('flowers', 'source', "TEXT");
  addCol('bouquets', 'archived', 'INTEGER NOT NULL DEFAULT 0');
  addCol('bouquets', 'specs_json', 'TEXT');
  addCol('bouquets', 'source', "TEXT");
  addCol('bouquets', 'stock_count', 'INTEGER NOT NULL DEFAULT 10');
  addCol('bouquets', 'updated_at', 'TEXT');
  try { db.exec("UPDATE bouquets SET stock_count = 10 WHERE stock_count IS NULL;"); } catch (_) {}
  addCol('users', 'address_json', 'TEXT');
  addCol('users', 'updated_at', 'TEXT');
  addCol('users', 'verified', 'INTEGER NOT NULL DEFAULT 0');
  try {
    db.exec(`
      UPDATE users SET verified = 1
      WHERE google_id IS NOT NULL 
         OR id IN (SELECT DISTINCT user_id FROM orders WHERE user_id IS NOT NULL);
    `);
  } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_registrations (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      otp_salt TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      resend_count INTEGER NOT NULL DEFAULT 0,
      last_sent_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  addCol('admin_users', 'display_name', 'TEXT');
  addCol('admin_users', 'avatar_url', 'TEXT');
  addCol('admin_users', 'role', "TEXT NOT NULL DEFAULT 'Administrator'");
  addCol('admin_users', 'updated_at', 'TEXT');
  addCol('suppliers', 'origin', 'TEXT');
  addCol('suppliers', 'categories_json', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'admin')),
      user_id TEXT,
      order_number TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  addCol('notifications', 'data_json', 'TEXT'); // structured details (e.g. a payment submission) for rich admin alerts
  // Order history of confirmations (pickup handover by the shop, receipt / issue by the customer, resolutions).
  // Append-only: rows can never be edited or deleted.
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('customer','admin','system')),
      actor TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_number);
    CREATE TRIGGER IF NOT EXISTS order_events_no_update BEFORE UPDATE ON order_events
      BEGIN SELECT RAISE(ABORT, 'order history is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS order_events_no_delete BEFORE DELETE ON order_events
      BEGIN SELECT RAISE(ABORT, 'order history is append-only'); END;
  `);
  db.exec(indexSql);

  // Seed catalog only when a table is empty, so admin edits are never overwritten on restart.
  const now = () => new Date().toISOString();
  const isCatalogReset = (() => {
    try {
      const row = db.prepare("SELECT value_json FROM shop_settings WHERE key = 'catalog_reset'").get();
      return !!(row && JSON.parse(row.value_json).reset);
    } catch (_) { return false; }
  })();

  if (!isCatalogReset && db.prepare('SELECT COUNT(*) c FROM flowers').get().c === 0 && defaultCatalog.mainFlowers.length) {
    const ins = db.prepare(`INSERT INTO flowers (id,name,botanical_name,category,price,availability,stock_count,description,image,color,archived,unit_cost,low_stock_threshold,unit_of_measure,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`);
    for (const f of defaultCatalog.mainFlowers) {
      const defaultCost = f.price ? Math.round(f.price * 0.45 * 100) / 100 : 50;
      ins.run(f.id, f.name, f.botanicalName || '', f.category || '', f.price, f.availability || 'available',
        Number.isInteger(f.stockCount) ? f.stockCount : 0, f.description || '', f.image || '', f.color || '#f43f5e',
        defaultCost, 5, 'stems', now());
    }
  }
  if (!isCatalogReset && db.prepare('SELECT COUNT(*) c FROM bouquets').get().c === 0 && defaultCatalog.featuredBouquets.length) {
    const ins = db.prepare(`INSERT INTO bouquets (id,name,category,occasion,price,description,image,formula,availability,specs_json,archived,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`);
    for (const b of defaultCatalog.featuredBouquets) {
      ins.run(b.id, b.name, b.category || (b.categories && b.categories[0]) || 'Premium Bouquets',
        b.occasion || (b.occasions && b.occasions[0]) || '', b.price, b.description || '', b.image || '',
        b.formula || '', b.availability || 'available', b.specs ? JSON.stringify(b.specs) : null, now());
    }
  } else if (defaultCatalog.featuredBouquets && defaultCatalog.featuredBouquets.length) {
    // Backfill specs_json for seeded bouquets if null
    const upSpecs = db.prepare('UPDATE bouquets SET specs_json = ? WHERE id = ? AND specs_json IS NULL');
    for (const b of defaultCatalog.featuredBouquets) {
      if (b.specs) {
        try { upSpecs.run(JSON.stringify(b.specs), b.id); } catch (_) {}
      }
    }
  }

  // Seed builder materials (fillers, foliage, wrapping, ribbons, cards) if not already in flowers table
  const hasMaterials = db.prepare("SELECT COUNT(*) c FROM flowers WHERE item_type != 'flower'").get().c > 0;
  if (!isCatalogReset && !hasMaterials) {
    const insMat = db.prepare(`INSERT OR IGNORE INTO flowers (id,name,botanical_name,category,price,availability,stock_count,description,image,color,item_type,style,archived,unit_cost,low_stock_threshold,unit_of_measure,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`);
    // Fillers
    if (Array.isArray(defaultCatalog.fillerFlowers)) {
      for (const f of defaultCatalog.fillerFlowers) {
        const cost = f.price ? Math.round(f.price * 0.45 * 100) / 100 : 35;
        // Fresh installs only: use the core category names (the old ones did not exist as categories).
        insMat.run(f.id, f.name, f.botanicalName || '', 'Fillers & Foliage', f.price || 80, 'available',
          40, f.description || '', f.image || '', '#ec4899', 'filler', '', cost, 5, 'stems', now());
      }
    }
    // Greenery / Foliage
    if (Array.isArray(defaultCatalog.greenery)) {
      for (const g of defaultCatalog.greenery) {
        const cost = g.price ? Math.round(g.price * 0.45 * 100) / 100 : 25;
        insMat.run(g.id, g.name, g.botanicalName || '', 'Fillers & Foliage', g.price || 60, 'available',
          35, g.description || '', g.image || '', '#15803d', 'foliage', '', cost, 5, 'stems', now());
      }
    }
    // Wrapping Papers
    if (Array.isArray(defaultCatalog.wrappingOptions)) {
      for (const w of defaultCatalog.wrappingOptions) {
        const cost = w.price ? Math.round(w.price * 0.4 * 100) / 100 : 20;
        insMat.run(w.id, w.name, '', 'Wrapping Materials', w.price || 50, 'available',
          50, w.description || '', w.image || '', w.colorHex || '#c2a382', 'wrapping', 'Matte Finish', cost, 10, 'sheets', now());
      }
    }
    // Ribbons
    if (Array.isArray(defaultCatalog.ribbonOptions)) {
      for (const r of defaultCatalog.ribbonOptions) {
        const cost = r.price ? Math.round(r.price * 0.35 * 100) / 100 : 10;
        insMat.run(r.id, r.name, '', 'Ribbons', r.price || 25, 'available',
          25, `${r.style || 'Satin'} decorative floral ribbon.`, '', r.colorHex || '#f472b6', 'ribbon', r.style || 'Satin', cost, 5, 'rolls', now());
      }
    }
    // Message Cards
    if (Array.isArray(defaultCatalog.cardDesigns)) {
      for (const c of defaultCatalog.cardDesigns) {
        insMat.run(c.id, c.name, '', 'Greeting Cards', 0, 'available',
          100, `Card design theme: ${c.theme || 'Artisanal'}`, '', '#FAF3ED', 'card', c.theme || 'Standard', 5, 20, 'cards', now());
      }
    }
  }

  // Seed default suppliers if empty
  if (db.prepare('SELECT COUNT(*) c FROM suppliers').get().c === 0) {
    const insSup = db.prepare(`INSERT INTO suppliers (id,name,contact_person,phone,email,address,origin,categories_json,notes,active,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`);
    const defaultSuppliers = [
      { id: 'sup-benguet', name: 'Benguet Highland Blooms', contact: 'Mateo Baguilat', phone: '+63 917 554 2101', email: 'orders@benguetblooms.ph', address: 'La Trinidad, Benguet', origin: 'Domestic', categories: ['Fresh Flowers', 'Fillers & Foliage'], notes: 'Primary farm partner for roses, lisianthus, statice, and chrysanthemums.' },
      { id: 'sup-manila-imports', name: 'Dutch & Ecuador Flora Manila', contact: 'Carmela Sison', phone: '+63 920 882 1433', email: 'carmela@floraimportsph.com', address: 'Pasay City, Metro Manila', origin: 'Local', categories: ['Fresh Flowers'], notes: 'Direct air-cargo importer of Dutch tulips, Ecuadorian garden roses, and hydrangeas.' },
      { id: 'sup-davao-foliage', name: 'Davao Foliage & Tropics', contact: 'Ramon Alcantara', phone: '+63 918 334 9088', email: 'sales@davaofoliage.ph', address: 'Calinan, Davao City', origin: 'Domestic', categories: ['Fillers & Foliage'], notes: 'Local grower of premium spiral eucalyptus, silver dollar, and monstera foliage.' }
    ];
    for (const s of defaultSuppliers) insSup.run(s.id, s.name, s.contact, s.phone, s.email, s.address, s.origin, JSON.stringify(s.categories), s.notes, now(), now());
  }

  // Backfill origins and categories for known default suppliers if not already classified
  try {
    db.prepare(`UPDATE suppliers SET origin = 'Domestic', categories_json = '["Fresh Flowers","Fillers & Foliage"]' WHERE id = 'sup-benguet' AND (origin IS NULL OR origin = '')`).run();
    db.prepare(`UPDATE suppliers SET origin = 'Local', categories_json = '["Fresh Flowers"]' WHERE id = 'sup-manila-imports' AND (origin IS NULL OR origin = '')`).run();
    db.prepare(`UPDATE suppliers SET origin = 'Domestic', categories_json = '["Fillers & Foliage"]' WHERE id = 'sup-davao-foliage' AND (origin IS NULL OR origin = '')`).run();
  } catch (_) {}

  // Seed default categories if empty
  if (db.prepare('SELECT COUNT(*) c FROM categories').get().c === 0) {
    const insCat = db.prepare(`INSERT INTO categories (id,name,type,description,active,created_at,updated_at)
      VALUES (?,?,?,?,1,?,?)`);
    const defaultCats = [
      { id: 'cat-ready-made-bouquets', name: 'Ready-Made Bouquets', type: 'bouquet', description: 'Curated artisanal floral arrangements ready for immediate gifting and celebrations.' },
      { id: 'cat-fresh-flowers', name: 'Fresh Flowers', type: 'flower', description: 'Individual fresh-cut flower stems sourced from Benguet highlands and international growers.' },
      { id: 'cat-fillers-foliage', name: 'Fillers & Foliage', type: 'both', description: 'Delicate filler flowers and lush green foliage for volume, texture, and bespoke crafting.' },
      { id: 'cat-wrapping-materials', name: 'Wrapping Materials', type: 'both', description: 'Modern Korean matte wrapping, natural rustic kraft paper, and premium waterproof sheets.' },
      { id: 'cat-ribbons', name: 'Ribbons', type: 'both', description: 'Glossy satin, sheer organza, textured grosgrain, velvet, and rustic burlap ribbons.' },
      { id: 'cat-greeting-cards', name: 'Greeting Cards', type: 'both', description: 'Artisanal sentiment cards for birthdays, anniversaries, graduations, and custom messages.' }
    ];
    for (const c of defaultCats) insCat.run(c.id, c.name, c.type, c.description, now(), now());
  }

  // Seed default shop settings if empty
  if (db.prepare('SELECT COUNT(*) c FROM shop_settings').get().c === 0) {
    const insSet = db.prepare(`INSERT INTO shop_settings (key, value_json, updated_at) VALUES (?,?,?)`);
    const defaultSettings = {
      store: {
        name: 'Umaira Florist Atelier',
        tagline: 'Luxury Botanical Arrangements & Custom Bouquets',
        address: '128 Rosa Street, BGC, Taguig City, Metro Manila',
        phone: '+63 917 892 4310',
        email: 'concierge@umairaflorist.com',
        description: 'Bespoke florist atelier crafting luxury arrangements and curated botanical gifts.'
      },
      delivery: {
        enabled: true,
        fee: 150,
        freeThreshold: 2500,
        carrier: 'Grab Delivery',
        serviceArea: 'City of Manila (Districts 1–6)',
        notes: 'Exclusively servicing Manila addresses with verified Grab courier live tracking.'
      },
      pickup: {
        enabled: true,
        address: '128 Rosa Street, BGC, Taguig City, Metro Manila',
        instructions: 'Present your Order Number at the Atelier counter upon arrival.',
        leadTimeHours: 2
      },
      hours: {
        openingTime: '08:00',
        closingTime: '20:00',
        operatingDays: 'Monday – Sunday',
        acceptingOrders: true
      },
      custom_builder: {
        minStems: 1,
        maxStems: 50,
        serviceFee: 0
      },
      inventory: {
        lowStockThreshold: 20
      }
    };
    for (const [k, v] of Object.entries(defaultSettings)) {
      insSet.run(k, JSON.stringify(v), now());
    }
  }

  // Ensure centralized inventory threshold exists in shop_settings
  db.prepare(`INSERT OR IGNORE INTO shop_settings (key, value_json, updated_at) VALUES ('inventory', '{"lowStockThreshold":20}', ?)`).run(now());

  // Populate unit_cost for existing flowers that have NULL unit_cost so valuation is immediately functional
  db.prepare(`UPDATE flowers SET unit_cost = ROUND(price * 0.45, 2) WHERE unit_cost IS NULL AND price > 0`).run();

  // Seed Phase 2 Catalog (8 Official Bouquets, 16 Flowers & Foliage, 15 Materials)
  seedPhase2Catalog(db, now);

  // One-time migration: sync the live catalog to exactly the 8 official bouquets.
  // Archives any bouquets not in the official list; upserts the official 8 with correct data.
  (function syncCatalogV1() {
    const done = db.prepare("SELECT value_json FROM shop_settings WHERE key='catalog_sync_v1'").get();
    if (done) return;
    const { PHASE2_BOUQUETS } = require('./phase2_catalog');
    const keepIds = PHASE2_BOUQUETS.map(b => b.id);
    const t = now();
    // Archive all bouquets not in the official 8
    if (keepIds.length > 0) {
      db.prepare('UPDATE bouquets SET archived=1, updated_at=? WHERE id NOT IN (' +
        keepIds.map(() => '?').join(',') + ')').run(t, ...keepIds);
    }
    // Upsert each official bouquet with the correct data
    const ups = db.prepare(`INSERT INTO bouquets (id,name,category,occasion,price,description,image,formula,availability,specs_json,archived,updated_at,source)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, category=excluded.category, occasion=excluded.occasion,
        price=excluded.price, description=excluded.description,
        formula=excluded.formula, availability=excluded.availability,
        specs_json=excluded.specs_json, archived=0, updated_at=excluded.updated_at`);
    for (const b of PHASE2_BOUQUETS) {
      ups.run(b.id, b.name, b.category, b.occasion, b.price, b.description || '',
        b.image || '', b.formula || '', b.availability || 'available',
        b.specs ? JSON.stringify(b.specs) : null, t, null);
    }
    db.prepare(`INSERT OR IGNORE INTO shop_settings (key,value_json,updated_at) VALUES ('catalog_sync_v1',?,?)`)
      .run(JSON.stringify({ synced: true, bouquets: keepIds.length, at: t }), t);
  })();

  // Products created before created_at existed: use the earliest recorded evidence — the catalog import time
  // for imported items, the first stock movement, or the last update. New products get the real time on insert.
  (function backfillCreatedAt() {
    let importedAt = null; const importedIds = new Set();
    try { importedAt = JSON.parse((db.prepare("SELECT value_json FROM shop_settings WHERE key = 'phase2_catalog'").get() || {}).value_json || '{}').initialized_at || null; } catch (_) {}
    try { const c = require('./phase2_catalog'); [...c.PHASE2_FLOWERS, ...c.PHASE2_MATERIALS, ...c.PHASE2_BOUQUETS].forEach(x => importedIds.add(x.id)); } catch (_) {}
    const firstMove = db.prepare('SELECT MIN(created_at) m FROM stock_transactions WHERE flower_id = ?');
    for (const table of ['flowers', 'bouquets']) {
      const set = db.prepare(`UPDATE ${table} SET created_at = ? WHERE id = ? AND created_at IS NULL`);
      for (const r of db.prepare(`SELECT id, updated_at FROM ${table} WHERE created_at IS NULL`).all()) {
        const evidence = [importedIds.has(r.id) ? importedAt : null, firstMove.get(r.id).m, r.updated_at].filter(Boolean).sort();
        set.run(evidence[0] || now(), r.id);
      }
    }
  })();

  if (process.env.UMAIRA_DATA_DIR && process.env.UMAIRA_DATA_DIR.includes('test')) {
    try {
      const insFl = db.prepare(`INSERT OR REPLACE INTO flowers (id,name,botanical_name,category,price,availability,stock_count,description,image,color,item_type,style,archived,unit_cost,low_stock_threshold,unit_of_measure,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,5,'stems',?)`);
      insFl.run('fl-rose-red','Red Rose','Rosa grandiflora','Fresh Flowers',120,'available',100,'Classic red rose stem','','#dc2626','flower','',55,now());
      insFl.run('fl-tulip-pink','Pink Tulip','Tulipa gesneriana','Fresh Flowers',150,'available',50,'Fresh pink tulip stem','','#ec4899','flower','',70,now());
      insFl.run('fl-peony-blush','Blush Peony','Paeonia lactiflora','Fresh Flowers',350,'sold_out',0,'Blush peony stem','','#f472b6','flower','',160,now());
      // Test fixtures use the same category names and item types as the live catalog.
      insFl.run('wrp-kraft','Kraft Paper Wrapping','','Wrapping Materials',50,'available',50,'Natural kraft wrapping sheet','','#b45309','wrapping','[{"name":"Natural Brown","hex":"#C2A382"}]',20,now());
      insFl.run('rbn-beige-jute','Beige Jute Ribbon','','Ribbons',30,'available',50,'Rustic jute twine ribbon','','#78350f','ribbon','[{"name":"Natural Jute","hex":"#D4C3A3"}]',10,now());

      db.prepare(`INSERT OR REPLACE INTO bouquets (id,name,category,occasion,price,description,image,availability,archived,updated_at,specs_json,source)
        VALUES ('bq-pink-romance','Pink Romance','Ready-Made Bouquets','Valentine''s',780,'A delightful arrangement of pink blooms.','','available',0,?,'{"mainFlowers":[{"id":"fl-rose-red","name":"Red Rose","quantity":3}],"materials":[]}','Local Benguet / Baguio')`).run(now());
      // Test databases only: a placeholder GCash QR setting so order-flow tests can use GCash. (The live shop
      // starts with no QR code; GCash stays unavailable until the owner uploads the real one.)
      db.prepare(`INSERT OR IGNORE INTO shop_settings (key, value_json, updated_at) VALUES ('payment', ?, ?)`)
        .run(JSON.stringify({ gcash: { accountName: 'Test Shop GCash', number: '09170000000', qrImage: '/assets/uploads/0123456789abcdef0123.png' } }), now());
    } catch (_) {}
  }

  // Run a function inside an IMMEDIATE transaction (write lock up front, so stock checks are race-free).
  function tx(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); db.exec('COMMIT'); return r; }
    catch (e) { try { db.exec('ROLLBACK'); } catch (_) {} throw e; }
  }

  const itemsOf = (orderId) => db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId);
  // When an order waiting for the customer's confirmation will be confirmed automatically (null otherwise).
  // Older rows without awaiting_confirmation_since fall back to the handover / delivery-photo time.
  const AWAITING_STATUS = { pickup: 'Awaiting Customer Confirmation', delivery: 'Delivered — Awaiting Confirmation' };
  const awaitingSinceOf = (r) => r.awaiting_confirmation_since || (r.fulfillment_type === 'pickup' ? r.pickup_handover_at : null) || r.updated_at || null;
  function confirmationDeadlineOf(r) {
    const kind = r.fulfillment_type === 'pickup' ? 'pickup' : 'delivery';
    if (r.status !== AWAITING_STATUS[kind]) return null;
    const since = Date.parse(awaitingSinceOf(r) || '');
    if (!Number.isFinite(since)) return null;
    return new Date(since + rules.CONFIRMATION_DEADLINES[kind].autoConfirmAfterHours * 3600000).toISOString();
  }
  const rowToOrder = (r) => ({
    id: r.order_number, orderNumber: r.order_number, userId: r.user_id || null, status: r.status,
    fulfillment: r.fulfillment_type, firstName: r.first_name, lastName: r.last_name,
    phone: r.phone, email: r.email, address: r.address, district: r.district, barangay: r.barangay,
    city: r.city, notes: r.notes, date: r.schedule_date, time: r.schedule_time,
    paymentMethod: r.payment_method, paymentStatus: rules.normalizePaymentStatus(r.payment_status),
    paymentKind: rules.paymentKind(r.payment_method),
    paidAt: r.paid_at || null, paidBy: r.paid_by || null, paidAmount: r.paid_amount == null ? null : r.paid_amount,
    pickupHandoverBy: r.pickup_handover_by || null, pickupHandoverAt: r.pickup_handover_at || null,
    deliveryFailedReason: r.delivery_failed_reason || null,
    confirmationDeadline: confirmationDeadlineOf(r),
    history: db.prepare('SELECT action, actor_type, actor, note, created_at FROM order_events WHERE order_number = ? ORDER BY id').all(r.order_number)
      .map(e => ({ action: e.action, actorType: e.actor_type, actor: e.actor, note: e.note, createdAt: e.created_at })),
    giftMessage: r.gift_message,
    grabTrackingUrl: r.grab_tracking_url || null, rejectReason: r.reject_reason || null,
    subtotal: r.subtotal, deliveryFee: r.delivery_fee, total: r.total,
    podPhotoUrl: r.pod_photo_url || null,
    podDeliveredAt: r.pod_delivered_at || null,
    podAdmin: r.pod_admin || null,
    podNotes: r.pod_notes || null,
    customerConfirmationStatus: r.customer_confirmation_status || 'pending',
    customerConfirmedAt: r.customer_confirmed_at || null,
    customerDisputeReason: r.customer_dispute_reason || null,
    customerDisputePhotoUrl: r.customer_dispute_photo_url || null,
    disputeResolvedAt: r.dispute_resolved_at || null,
    disputeResolutionNotes: r.dispute_resolution_notes || null,
    createdAt: r.created_at, updatedAt: r.updated_at,
    items: itemsOf(r.id).map(i => ({
      bouquetName: i.bouquet_name, type: i.item_type, itemId: i.item_id, name: i.name,
      quantity: i.quantity, unitPrice: i.unit_price, lineTotal: i.line_total, cardMessage: i.card_message
    }))
  });
  const byNumber = (n) => {
    const norm = normalizeOrderNum(n);
    return db.prepare('SELECT * FROM orders WHERE order_number = ? OR order_number = ?').get(norm, norm.replace('#', ''));
  };

  function getGlobalLowStockThreshold() {
    try {
      const row = db.prepare("SELECT value_json FROM shop_settings WHERE key = 'inventory'").get();
      if (row && row.value_json) {
        const val = safeParse(row.value_json, null);
        const th = parseInt(val && val.lowStockThreshold, 10);
        if (!isNaN(th) && th >= 0) return th;
      }
    } catch (_) {}
    return 20; // Default centralized low-stock threshold of 20 units
  }

  const flowerRow = (f) => ({
    id: f.id, name: f.name, botanicalName: f.botanical_name, category: f.category, price: f.price,
    availability: f.availability, stockCount: f.stock_count, description: f.description,
    image: f.image || '', color: f.color, archived: !!f.archived,
    unitCost: f.unit_cost !== null && f.unit_cost !== undefined ? f.unit_cost : null,
    lowStockThreshold: getGlobalLowStockThreshold(),
    unitOfMeasure: f.unit_of_measure || (f.item_type === 'wrapping' ? 'sheets' : f.item_type === 'ribbon' ? 'rolls' : f.item_type === 'card' ? 'cards' : 'stems'),
    itemType: f.item_type || 'flower',
    style: f.style || '',
    supplierId: f.supplier_id || null,
    source: f.source || null,
    createdAt: f.created_at || f.updated_at || null,
    updatedAt: f.updated_at || null
  });
  const bouquetRow = (b, salesCount = 0) => {
    const specs = b.specs_json ? safeParse(b.specs_json, null) : null;
    const stock = (b.stock_count !== undefined && b.stock_count !== null) ? Number(b.stock_count) : 10;
    return {
      id: b.id, name: b.name, category: b.category, occasion: b.occasion, price: b.price,
      description: b.description, image: b.image || '', formula: b.formula || '', availability: b.availability,
      stockCount: stock,
      stock_count: stock,
      createdAt: b.created_at || b.updated_at || null,
      updatedAt: b.updated_at || null,
      unitOfMeasure: 'bouquets',
      lowStockThreshold: getGlobalLowStockThreshold(),
      specs: specs,
      primaryFlower: (specs && specs.primaryFlower) || '',
      flowerTypes: (specs && specs.flowerTypes) || [],
      source: (b.source && !b.source.includes('Unverified')) ? b.source : ((specs && specs.source && !specs.source.includes('Unverified')) ? specs.source : null),
      sources: (specs && Array.isArray(specs.sources)) ? specs.sources.filter(s => s && !s.includes('Unverified')) : (b.source && !b.source.includes('Unverified') ? [b.source] : []),
      salesCount: salesCount,
      popularity: salesCount,
      archived: !!b.archived
    };
  };

  const publicUser = (u) => u && ({
    id: u.id, email: u.email, name: u.name, phone: u.phone || '', role: u.role,
    google: Boolean(u.google_id), verified: Boolean(u.verified || u.google_id), createdAt: u.created_at,
    address: u.address_json ? safeParse(u.address_json, {}) : {}
  });
  function safeParse(s, fb) { try { return JSON.parse(s); } catch (e) { return fb; } }

  // In-app notice for a status that has no other customer notification (all others are created in setStatus
  // and the delivery-confirmation paths). Order and payment updates are in-app only: no email is sent.
  function statusNotice(updated, prevStatus, newStatus) {
    if (!updated || newStatus === prevStatus || newStatus !== 'Picked Up') return;
    try {
      api.createNotification({ recipientType: 'customer', userId: updated.userId, orderNumber: updated.orderNumber,
        title: 'Order Completed', message: `Your order ${updated.orderNumber} has been picked up. Thank you for choosing Umaira Florist!`,
        type: 'order_completed', link: `/index.html#track=${updated.orderNumber}` });
    } catch (_) {}
  }

  const api = {
    kind: 'SQLite (' + path.join(DATA_DIR, 'umaira.db') + ')',
    tx,

    // ------------------------------------------------------------------ orders
    exists(n) { return !!byNumber(n); },
    get(n) { const r = byNumber(n); return r ? rowToOrder(r) : null; },
    list(limit = 100, statusFilter = null) {
      let q = 'SELECT * FROM orders'; const p = [];
      if (statusFilter && statusFilter !== 'all') { q += ' WHERE status = ?'; p.push(statusFilter); }
      q += ' ORDER BY id DESC LIMIT ?'; p.push(limit);
      return db.prepare(q).all(...p).map(rowToOrder);
    },
    listForUser(userId, limit = 100) {
      return db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(userId, limit).map(rowToOrder);
    },

    /**
     * Atomically: check stock for every flower used, decrement it, and save the order + items.
     * `stockNeeds` is { flowerId: stemsNeeded }. Returns { ok, order } or { ok:false, error }.
     */
    placeOrder(o, stockNeeds) {
      return tx(() => {
        for (const [id, need] of Object.entries(stockNeeds || {})) {
          if (need <= 0) continue;
          const f = db.prepare('SELECT * FROM flowers WHERE id = ?').get(id);
          if (f) {
            if (f.archived) return { ok: false, error: 'An item in your cart is no longer available.' };
            if (f.availability === 'unavailable' || f.availability === 'sold_out' || f.stock_count <= 0) return { ok: false, error: `${f.name} is currently unavailable for purchase.` };
            if (f.stock_count < need) return { ok: false, error: `Only ${f.stock_count} stem(s) of ${f.name} left in stock.` };
          } else {
            const bq = db.prepare('SELECT * FROM bouquets WHERE id = ?').get(id);
            if (bq) {
              if (bq.archived) return { ok: false, error: 'An item in your cart is no longer available.' };
              if (bq.availability === 'unavailable' || bq.availability === 'sold_out' || (bq.stock_count !== undefined && bq.stock_count <= 0)) return { ok: false, error: `${bq.name} is currently unavailable for purchase.` };
              if (bq.stock_count !== undefined && bq.stock_count < need) return { ok: false, error: `Only ${bq.stock_count} bouquet(s) of ${bq.name} left in stock.` };
            } else {
              return { ok: false, error: 'An item in your cart is no longer available.' };
            }
          }
        }
        const res = db.prepare(`INSERT INTO orders (
          order_number, user_id, status, fulfillment_type, first_name, last_name, phone, email,
          address, district, barangay, city, notes, schedule_date, schedule_time,
          payment_method, payment_status, gift_message, subtotal, delivery_fee, total, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          o.orderNumber, o.userId || null, o.status, o.fulfillment, o.firstName, o.lastName, o.phone, o.email || null,
          o.address || null, o.district || null, o.barangay || null, o.city || null, o.notes || null, o.date, o.time,
          o.paymentMethod, o.paymentStatus, o.giftMessage || null, o.subtotal, o.deliveryFee, o.total, o.createdAt, o.createdAt);
        const ins = db.prepare('INSERT INTO order_items (order_id,bouquet_name,item_type,item_id,name,quantity,unit_price,line_total,card_message) VALUES (?,?,?,?,?,?,?,?,?)');
        for (const i of o.items) ins.run(res.lastInsertRowid, i.bouquetName || null, i.type, i.itemId || null, i.name, i.quantity, i.unitPrice, i.lineTotal, i.cardMessage || null);
        for (const [id, need] of Object.entries(stockNeeds || {})) {
          if (need <= 0) continue;
          const fl = db.prepare('SELECT stock_count, unit_cost FROM flowers WHERE id = ?').get(id);
          if (fl) {
            const prev = fl.stock_count;
            const next = Math.max(0, prev - need);
            db.prepare(`UPDATE flowers SET stock_count = stock_count - ?,
              availability = CASE
                WHEN stock_count - ? <= 0 THEN 'sold_out'
                WHEN stock_count - ? <= ? AND availability = 'available' THEN 'limited'
                ELSE availability
              END, updated_at = ? WHERE id = ?`)
              .run(need, need, need, getGlobalLowStockThreshold(), now(), id);

            try {
              db.prepare(`INSERT INTO stock_transactions
                (flower_id, transaction_type, quantity_change, previous_stock, new_stock, unit_cost, reason, supplier_id, order_number, admin_username, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
                .run(id, 'order_fulfillment', -need, prev, next, fl.unit_cost, `Order ${o.orderNumber}`, null, o.orderNumber, 'system', now());
            } catch (_) {}
          } else {
            const bq = db.prepare('SELECT stock_count FROM bouquets WHERE id = ?').get(id);
            if (bq) {
              const prev = bq.stock_count !== undefined && bq.stock_count !== null ? bq.stock_count : 10;
              const next = Math.max(0, prev - need);
              db.prepare(`UPDATE bouquets SET stock_count = stock_count - ?,
                availability = CASE
                  WHEN stock_count - ? <= 0 THEN 'sold_out'
                  ELSE availability
                END, updated_at = ? WHERE id = ?`)
                .run(need, need, now(), id);

              try {
                db.prepare(`INSERT INTO stock_transactions
                  (flower_id, transaction_type, quantity_change, previous_stock, new_stock, unit_cost, reason, supplier_id, order_number, admin_username, created_at)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
                  .run(id, 'order_fulfillment', -need, prev, next, null, `Order ${o.orderNumber}`, null, o.orderNumber, 'system', now());
              } catch (_) {}
            }
          }
        }
        const placed = api.get(o.orderNumber);
        try {
          eventHub.emit('order:created', { orderNumber: o.orderNumber, order: placed });
          eventHub.emit('inventory:updated', { reason: `Order ${o.orderNumber} placed` });
        } catch (_) {}

        try {
          api.createNotification({
            recipientType: 'admin',
            orderNumber: o.orderNumber,
            title: 'New Order Received',
            message: `Order ${o.orderNumber} placed by ${o.firstName} ${o.lastName}. Total: ₱${Number(o.total || 0).toLocaleString()} • ${rules.paymentMethodLabel(o.paymentMethod)} (Unpaid)`,
            type: 'order_new',
            link: '/admin.html#orders'
          });
          api.createNotification({
            recipientType: 'customer',
            userId: o.userId || null,
            orderNumber: o.orderNumber,
            title: 'Order Received',
            message: `Your order ${o.orderNumber} has been received and is awaiting confirmation.`,
            type: 'order_received',
            link: `/index.html#track=${o.orderNumber}`
          });
        } catch (_) {}

        return { ok: true, order: placed };
      });
    },

    validateTransition(cur, next, fulfillment) {
      const flow = fulfillment === 'pickup' ? VALID_TRANSITIONS.pickup : VALID_TRANSITIONS.delivery;
      return (flow[cur] || []).includes(next);
    },
    setStatus(n, newStatus, extra = {}) {
      return tx(() => {
        const row = byNumber(n);
        if (!row) return { ok: false, error: 'Order not found.' };
        n = row.order_number; // canonical "#FLR-..." form for messages, events and logs
        const order = rowToOrder(row);
        let grab = extra.grabTrackingUrl !== undefined ? extra.grabTrackingUrl : order.grabTrackingUrl;
        const reason = extra.rejectReason !== undefined ? extra.rejectReason : order.rejectReason;
        // Saving an order without changing its status (e.g. adding a courier tracking link) only updates
        // those details: no status notification or email is sent again.
        if (newStatus === order.status) {
          db.prepare('UPDATE orders SET grab_tracking_url=?, reject_reason=?, updated_at=? WHERE id=?').run(grab || null, reason || null, now(), row.id);
          const same = api.get(n);
          try { eventHub.emit('order:status', { orderNumber: n, status: newStatus, previousStatus: newStatus, order: same }); } catch (_) {}
          return { ok: true, order: same, unchanged: true };
        }
        if (order.fulfillment === 'pickup' && PICKUP_PARTY_STEPS.includes(newStatus)) {
          return { ok: false, code: 'PICKUP_CONFIRMATION_REQUIRED', error: newStatus === 'Awaiting Customer Confirmation'
            ? 'Use "Confirm Pickup" when the order is physically handed over to the customer.'
            : `Only the customer can mark a store pickup as "${newStatus}" — they confirm receipt (or report an issue) from their order page.` };
        }
        if (order.fulfillment !== 'pickup' && DELIVERY_PARTY_STEPS.includes(newStatus)) {
          const why = {
            'Delivered — Awaiting Confirmation': 'Use "Upload POD & Mark Delivered": a delivery is marked delivered only with a proof-of-delivery photo.',
            'Delivered': 'Use "Upload POD & Mark Delivered": a delivery is marked delivered only with a proof-of-delivery photo.',
            'Delivery Attempt Failed': 'Use "Delivery Attempt Failed" and give the reason, so the customer is told what happened.'
          }[newStatus] || `Only the customer can mark a delivery as "${newStatus}" — they confirm receipt (or report an issue) from their order page.`;
          return { ok: false, code: 'DELIVERY_CONFIRMATION_REQUIRED', error: why };
        }
        if (!api.validateTransition(order.status, newStatus, order.fulfillment)) {
          return { ok: false, error: `Cannot change status from "${order.status}" to "${newStatus}" for ${order.fulfillment} orders.` };
        }
        // Payment rules shared with the admin console (js/shop-rules.js): GCash must be Paid before Confirmed /
        // Preparing; Cash on Pickup must be Paid before Picked Up; Cash on Delivery is never blocked here.
        const blocked = rules.paymentBlocksStatus(order.paymentMethod, order.paymentStatus, newStatus);
        if (blocked) return { ok: false, code: 'PAYMENT_NOT_VERIFIED', error: `${n}: ${blocked}` };
        // Payment status is never changed here: reaching Picked Up / Delivered does not mean the money was received.
        db.prepare('UPDATE orders SET status=?, grab_tracking_url=?, reject_reason=?, updated_at=? WHERE id=?')
          .run(newStatus, grab || null, reason || null, now(), row.id);
        // A cancelled/rejected order returns its stems to stock, exactly once — automatically only if it is
        // cancelled before preparation starts. Once the bouquet is being made (or has left the shop) the stems are
        // used, so they go back only when the admin says so (extra.restoreStock === true).
        const restock = newStatus === 'Rejected/Cancelled' && !row.stock_restored
          && (AUTO_RESTOCK_STATUSES.includes(order.status) || extra.restoreStock === true);
        if (newStatus === 'Rejected/Cancelled') {
          api.logOrderEvent(n, 'order_cancelled', extra.adminUsername ? 'admin' : 'system', extra.adminUsername || null,
            `${reason || 'Cancelled'} — ${restock ? 'stock returned' : 'stock not returned (already used)'}`);
        }
        if (order.status === 'Delivery Attempt Failed' && (newStatus === 'Out for Delivery' || newStatus === 'On the Way')) {
          api.logOrderEvent(n, 'delivery_reattempt', extra.adminUsername ? 'admin' : 'system', extra.adminUsername || null, 'Delivery re-attempted');
        }
        if (restock) {
          for (const it of itemsOf(row.id)) {
            if (['flower', 'filler', 'greenery', 'wrapping', 'ribbon', 'card', 'accessory'].includes(it.item_type) && it.item_id) {
              const fl = db.prepare('SELECT stock_count, unit_cost, low_stock_threshold FROM flowers WHERE id = ?').get(it.item_id);
              const prev = fl ? fl.stock_count : 0;
              const next = prev + it.quantity;
              // Restored stock never un-hides an item the admin marked "unavailable".
              db.prepare(`UPDATE flowers SET stock_count = stock_count + ?,
                availability = CASE
                  WHEN availability = 'unavailable' THEN availability
                  WHEN stock_count + ? > ? THEN 'available'
                  WHEN stock_count + ? > 0 THEN 'limited'
                  ELSE availability
                END, updated_at = ? WHERE id = ?`)
                .run(it.quantity, it.quantity, getGlobalLowStockThreshold(), it.quantity, now(), it.item_id);
              try {
                db.prepare(`INSERT INTO stock_transactions
                  (flower_id, transaction_type, quantity_change, previous_stock, new_stock, unit_cost, reason, supplier_id, order_number, admin_username, created_at)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
                  .run(it.item_id, 'order_restoration', it.quantity, prev, next, fl ? fl.unit_cost : null, `Order ${n} Cancelled`, null, n, 'system', now());
              } catch (_) {}
            } else if (it.item_type === 'ready_bouquet' && it.item_id) {
              const bq = db.prepare('SELECT stock_count FROM bouquets WHERE id = ?').get(it.item_id);
              if (bq) {
                const prev = bq.stock_count !== undefined && bq.stock_count !== null ? bq.stock_count : 0;
                const next = prev + it.quantity;
                db.prepare(`UPDATE bouquets SET stock_count = stock_count + ?,
                  availability = CASE
                    WHEN stock_count + ? > 0 AND availability = 'sold_out' THEN 'available'
                    ELSE availability
                  END, updated_at = ? WHERE id = ?`)
                  .run(it.quantity, it.quantity, now(), it.item_id);
                try {
                  db.prepare(`INSERT INTO stock_transactions
                    (flower_id, transaction_type, quantity_change, previous_stock, new_stock, unit_cost, reason, supplier_id, order_number, admin_username, created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
                    .run(it.item_id, 'order_restoration', it.quantity, prev, next, null, `Order ${n} Cancelled`, null, n, 'system', now());
                } catch (_) {}
              }
            }
          }
          db.prepare('UPDATE orders SET stock_restored = 1 WHERE id = ?').run(row.id);
        }
        const updated = api.get(n);
        try {
          eventHub.emit('order:status', { orderNumber: n, status: newStatus, previousStatus: order.status, order: updated });
          if (restock) {
            eventHub.emit('inventory:updated', { reason: `Order ${n} cancelled (stock restored)` });
          }
        } catch (_) {}

        try {
          if (newStatus === 'Confirmed') {
            api.createNotification({
              recipientType: 'customer',
              userId: updated.userId,
              orderNumber: n,
              title: 'Order Confirmed',
              message: `Your order ${n} has been confirmed by Umaira Florist Atelier.`,
              type: 'order_confirmed',
              link: `/index.html#track=${n}`
            });
          } else if (newStatus === 'Preparing') {
            api.createNotification({
              recipientType: 'customer',
              userId: updated.userId,
              orderNumber: n,
              title: 'Preparing Your Blooms',
              message: `Our florists are handcrafting your floral arrangement for ${n}.`,
              type: 'order_preparing',
              link: `/index.html#track=${n}`
            });
          } else if (newStatus === 'Out for Delivery' || newStatus === 'On the Way') {
            api.createNotification({
              recipientType: 'customer',
              userId: updated.userId,
              orderNumber: n,
              title: 'Out for Delivery',
              message: `Your order ${n} is on its way to you!${updated.grabTrackingUrl ? ' Live courier tracking is available.' : ''}`,
              type: 'order_out_for_delivery',
              link: `/index.html#track=${n}`
            });
          } else if (newStatus === 'Ready for Pickup') {
            api.createNotification({
              recipientType: 'customer',
              userId: updated.userId,
              orderNumber: n,
              title: 'Ready for Pickup',
              message: `Your order ${n} is fresh and ready for pickup at our Atelier.`,
              type: 'order_ready_pickup',
              link: `/index.html#track=${n}`
            });
          } else if (newStatus === 'Rejected/Cancelled') {
            api.createNotification({
              recipientType: 'customer',
              userId: updated.userId,
              orderNumber: n,
              title: 'Order Cancelled',
              message: `Your order ${n} was cancelled. ${reason ? 'Reason: ' + reason : ''}`,
              type: 'order_cancelled',
              link: `/index.html#track=${n}`
            });
          }
        } catch (_) {}
        statusNotice(updated, order.status, newStatus);

        return { ok: true, order: updated };
      });
    },
    confirm(n) { return api.setStatus(n, 'Confirmed'); },
    reject(n, reason = 'Order declined by shop.', opts = {}) {
      // Cancelling twice would only overwrite the original reason: refuse it.
      const cur = byNumber(n);
      if (cur && cur.status === 'Rejected/Cancelled') return { ok: false, error: 'This order is already cancelled.' };
      return api.setStatus(n, 'Rejected/Cancelled', { rejectReason: reason, restoreStock: opts.restoreStock === true, adminUsername: opts.adminUsername });
    },

    // The courier could not deliver (nobody home, guard refused, wrong address…). The customer is told why;
    // the shop then re-attempts the delivery ("Out for Delivery") or cancels the order.
    markDeliveryAttemptFailed(n, { adminUsername, reason }) {
      return tx(() => {
        const row = byNumber(n);
        if (!row) return { ok: false, status: 404, error: 'Order not found.' };
        n = row.order_number;
        const order = rowToOrder(row);
        if (order.fulfillment === 'pickup') return { ok: false, status: 400, error: 'Delivery Attempt Failed is only for delivery orders.' };
        const why = String(reason || '').trim();
        if (!why) return { ok: false, status: 400, error: 'Give the reason the delivery failed (the customer will see it).' };
        if (!['On the Way', 'Out for Delivery'].includes(order.status)) {
          return { ok: false, status: 409, error: `Only an order that is out for delivery can be marked as a failed attempt (current status: ${order.status}).` };
        }
        const ts = now();
        db.prepare("UPDATE orders SET status='Delivery Attempt Failed', delivery_failed_reason=?, updated_at=? WHERE id=?").run(why, ts, row.id);
        api.logOrderEvent(n, 'delivery_attempt_failed', 'admin', adminUsername, why);
        const updated = api.get(n);
        try {
          api.createNotification({ recipientType: 'customer', userId: row.user_id, orderNumber: n, title: 'Delivery Attempt Unsuccessful',
            message: `We could not deliver order ${n}: ${why}. The shop will contact you to arrange another delivery.`,
            type: 'delivery_failed', link: `/index.html#track=${n}` });
        } catch (_) {}
        try { eventHub.emit('order:status', { orderNumber: n, status: updated.status, previousStatus: order.status, order: updated }); } catch (_) {}
        return { ok: true, order: updated };
      });
    },

    setProofOfDelivery(n, { photoUrl, adminUsername, notes, deliveredAt, codCashCollected = false }) {
      return tx(() => {
        const row = byNumber(n);
        if (!row) return { ok: false, error: 'Order not found.' };
        n = row.order_number; // canonical "#FLR-..." form for messages, events and logs
        if (!photoUrl) return { ok: false, error: 'Proof of delivery photo is required.' };
        const order = rowToOrder(row);
        if (order.fulfillment === 'pickup') return { ok: false, error: 'Proof of delivery is only for delivery orders.' };
        // "Rider Assigned" is accepted because the console offers "Upload POD" there (the rider may deliver directly).
        if (!['Rider Assigned', 'On the Way', 'Out for Delivery'].includes(order.status)) {
          return { ok: false, status: 409, error: `Only an order that is out for delivery can be marked delivered (current status: ${order.status}).` };
        }
        const delAt = deliveredAt || now();
        const newStatus = 'Delivered — Awaiting Confirmation';
        const ts = now();
        // A delivery photo is not proof of payment: Cash on Delivery stays Unpaid until the shop confirms the
        // remitted cash ("Confirm Cash Received").
        db.prepare(`UPDATE orders SET status=?, pod_photo_url=?, pod_delivered_at=?, pod_admin=?, pod_notes=?, customer_confirmation_status='pending',
          customer_confirmed_at=NULL, awaiting_confirmation_since=?, confirm_reminder_sent_at=NULL, updated_at=? WHERE id=?`)
          .run(newStatus, photoUrl, delAt, adminUsername || 'Admin', notes || null, ts, ts, row.id);
        api.logOrderEvent(n, 'delivery_pod_uploaded', 'admin', adminUsername || 'admin', notes ? `Delivered with photo — ${notes}` : 'Delivered with photo');
        // Courier collected the COD cash at the door: recorded in the payment history, payment stays Unpaid.
        if (codCashCollected && order.paymentMethod === 'Cash on Delivery' && order.paymentStatus !== 'Paid') {
          api.recordCodCollection(row, adminUsername || 'admin', row.total, 'Recorded with proof of delivery');
        }

        const updated = api.get(n);

        try {
          api.createNotification({
            recipientType: 'customer',
            userId: updated.userId,
            orderNumber: n,
            title: 'Order Delivered — Please Confirm',
            message: `Your order ${n} has been marked as delivered. Please review the delivery photo and confirm if you received it. If we don't hear from you within ${rules.CONFIRMATION_DEADLINES.delivery.autoConfirmAfterHours} hours, it will be confirmed automatically.`,
            type: 'delivery_pod',
            link: `/index.html#track=${n}`
          });
        } catch (_) {}

        try {
          eventHub.emit('order:status', { orderNumber: n, status: newStatus, previousStatus: order.status, order: updated });
        } catch (_) {}

        return { ok: true, order: updated };
      });
    },

    // ------------------------------------------------------------------ confirmation deadlines
    // Called by the server every few minutes (and once at start-up, so it catches up after downtime).
    // Customers who neither confirm nor report an issue get one reminder; when the deadline passes the order is
    // confirmed automatically and recorded as "Automatic". Disputed orders are never touched, and the payment
    // status is never changed here. `at` (ms) is only passed by tests.
    runConfirmationDeadlines(at = Date.now()) {
      const result = { reminded: [], autoConfirmed: [] };
      const rows = db.prepare(`SELECT order_number FROM orders WHERE status IN (?, ?)`).all(AWAITING_STATUS.pickup, AWAITING_STATUS.delivery);
      for (const { order_number } of rows) {
        try {
          tx(() => {
            const row = byNumber(order_number);
            if (!row) return;
            const kind = row.fulfillment_type === 'pickup' ? 'pickup' : 'delivery';
            if (row.status !== AWAITING_STATUS[kind]) return; // answered meanwhile
            const since = Date.parse(awaitingSinceOf(row) || '');
            if (!Number.isFinite(since)) return;
            const hours = (at - since) / 3600000;
            const cfg = rules.CONFIRMATION_DEADLINES[kind];
            const n = row.order_number;
            const ts = new Date(at).toISOString();
            if (hours >= cfg.autoConfirmAfterHours) {
              const finalStatus = kind === 'pickup' ? 'Picked Up' : 'Delivered — Confirmed';
              db.prepare(`UPDATE orders SET status=?, customer_confirmation_status='auto', customer_confirmed_at=?, updated_at=? WHERE id=?`)
                .run(finalStatus, ts, ts, row.id);
              api.logOrderEvent(n, kind === 'pickup' ? 'pickup_auto_confirmed' : 'delivery_auto_confirmed', 'system', null,
                `No confirmation or issue report within ${cfg.autoConfirmAfterHours} hours — confirmed automatically`);
              const updated = api.get(n);
              const what = kind === 'pickup' ? 'picked up' : 'delivered';
              try {
                api.createNotification({ recipientType: 'customer', userId: row.user_id, orderNumber: n, title: 'Order Completed',
                  message: `Order ${n} was marked as ${what} automatically because no issue was reported within ${cfg.autoConfirmAfterHours} hours. Thank you for ordering with us!`,
                  type: 'order_completed', link: `/index.html#track=${n}` });
                api.createNotification({ recipientType: 'admin', orderNumber: n, title: kind === 'pickup' ? 'Pickup Auto-Confirmed' : 'Delivery Auto-Confirmed',
                  message: `Order ${n} was confirmed automatically: the customer did not respond within ${cfg.autoConfirmAfterHours} hours.`,
                  type: kind === 'pickup' ? 'pickup_auto_confirmed' : 'delivery_auto_confirmed', link: '/admin.html#orders' });
              } catch (_) {}
              try { eventHub.emit('order:status', { orderNumber: n, status: finalStatus, previousStatus: row.status, order: updated }); } catch (_) {}
              result.autoConfirmed.push(n);
            } else if (hours >= cfg.remindAfterHours && !row.confirm_reminder_sent_at) {
              db.prepare('UPDATE orders SET confirm_reminder_sent_at=? WHERE id=?').run(ts, row.id);
              const deadline = new Date(since + cfg.autoConfirmAfterHours * 3600000);
              const when = deadline.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
              api.logOrderEvent(n, 'confirmation_reminder_sent', 'system', null, `Customer reminded to confirm receipt (automatic confirmation on ${when})`);
              try {
                api.createNotification({ recipientType: 'customer', userId: row.user_id, orderNumber: n, title: 'Did You Receive Your Order?',
                  message: `Please confirm that you received order ${n}, or report an issue. If we don't hear from you by ${when}, it will be marked as received automatically.`,
                  type: 'confirm_reminder', link: `/index.html#track=${n}` });
              } catch (_) {}
              result.reminded.push(n);
            }
          });
        } catch (e) { console.error('[deadlines]', order_number, e.message); }
      }
      return result;
    },

    // ------------------------------------------------------------------ two-way store pickup confirmation
    logOrderEvent(orderNumber, action, actorType, actor, note = null) {
      db.prepare('INSERT INTO order_events (order_number, action, actor_type, actor, note, created_at) VALUES (?,?,?,?,?,?)')
        .run(orderNumber, action, actorType, actor || null, note, now());
    },

    // Step 1 (shop): the order was physically handed over. Records the admin and time, then asks the customer
    // to confirm receipt. The order is NOT complete until the customer confirms (step 2).
    confirmPickupHandover(n, { adminUsername }) {
      return tx(() => {
        const row = byNumber(n);
        if (!row) return { ok: false, status: 404, error: 'Order not found.' };
        n = row.order_number;
        const order = rowToOrder(row);
        if (order.fulfillment !== 'pickup') return { ok: false, status: 400, error: 'Confirm Pickup is only for store pickup orders.' };
        if (['Awaiting Customer Confirmation', 'Picked Up', 'Pickup Disputed'].includes(order.status)) {
          return { ok: false, status: 409, code: 'ALREADY_CONFIRMED', error: `The handover of ${n} was already confirmed${order.pickupHandoverBy ? ' by ' + order.pickupHandoverBy : ''}${order.pickupHandoverAt ? ' on ' + order.pickupHandoverAt : ''}.` };
        }
        if (order.status !== 'Ready for Pickup') return { ok: false, status: 409, error: `Mark the order Ready for Pickup before confirming the handover (current status: ${order.status}).` };
        const blocked = rules.paymentBlocksStatus(order.paymentMethod, order.paymentStatus, 'Awaiting Customer Confirmation');
        if (blocked) return { ok: false, status: 409, code: 'PAYMENT_NOT_VERIFIED', error: `${n}: ${blocked}` };
        const ts = now();
        db.prepare(`UPDATE orders SET status='Awaiting Customer Confirmation', pickup_handover_by=?, pickup_handover_at=?,
          customer_confirmation_status='pending', customer_confirmed_at=NULL, awaiting_confirmation_since=?, confirm_reminder_sent_at=NULL,
          updated_at=? WHERE id=?`).run(adminUsername, ts, ts, ts, row.id);
        api.logOrderEvent(n, 'pickup_handover_confirmed', 'admin', adminUsername, 'Order handed over to the customer at the shop');
        const updated = api.get(n);
        try {
          api.createNotification({ recipientType: 'customer', userId: row.user_id, orderNumber: n,
            title: 'Please Confirm You Received Your Order',
            message: `The shop confirmed that order ${n} was handed over to you. Please confirm receipt (or report an issue) on your order page. If we don't hear from you within ${rules.CONFIRMATION_DEADLINES.pickup.autoConfirmAfterHours} hours, it will be confirmed automatically.`,
            type: 'pickup_confirm_request', link: `/index.html#track=${n}` });
        } catch (_) {}
        try { eventHub.emit('order:status', { orderNumber: n, status: updated.status, previousStatus: order.status, order: updated }); } catch (_) {}
        return { ok: true, order: updated };
      });
    },

    // Step 2 (customer only): confirm receipt → Picked Up, or report that the order was not received.
    // Called inside setCustomerDeliveryConfirmation's transaction for pickup orders.
    customerPickupAnswer(row, order, { confirmed, reason, disputePhotoUrl }) {
      const n = row.order_number;
      if (order.status === 'Picked Up') return { ok: false, status: 409, code: 'ALREADY_CONFIRMED', error: order.customerConfirmationStatus === 'auto'
        ? 'This order was already confirmed automatically because no issue was reported in time.'
        : `You already confirmed receiving this order${order.customerConfirmedAt ? ' on ' + order.customerConfirmedAt : ''}.` };
      const canConfirm = ['Awaiting Customer Confirmation', 'Pickup Disputed'];
      const canDispute = ['Awaiting Customer Confirmation'];
      if (!(confirmed ? canConfirm : canDispute).includes(order.status)) {
        return { ok: false, status: 409, error: order.status === 'Pickup Disputed'
          ? 'Your issue report is already being reviewed by the shop.'
          : 'You can confirm or report this pickup only after the shop has confirmed handing it over to you.' };
      }
      const ts = now();
      if (confirmed) {
        db.prepare(`UPDATE orders SET status='Picked Up', customer_confirmation_status='confirmed', customer_confirmed_at=?, updated_at=? WHERE id=?`).run(ts, ts, row.id);
        api.logOrderEvent(n, 'pickup_receipt_confirmed', 'customer', row.user_id, 'Customer confirmed receiving the order');
        const updated = api.get(n);
        try {
          api.createNotification({ recipientType: 'admin', orderNumber: n, title: 'Pickup Confirmed by Customer',
            message: `${row.first_name} ${row.last_name} confirmed receiving order ${n}. The pickup is fully confirmed.`, type: 'pickup_confirmed', link: '/admin.html#orders' });
          api.createNotification({ recipientType: 'customer', userId: row.user_id, orderNumber: n, title: 'Order Completed',
            message: `Thank you for confirming that you received order ${n}. Enjoy your flowers!`, type: 'order_completed', link: `/index.html#track=${n}` });
        } catch (_) {}
        try { eventHub.emit('order:status', { orderNumber: n, status: 'Picked Up', previousStatus: order.status, order: updated }); } catch (_) {}
        return { ok: true, order: updated };
      }
      const why = String(reason || '').trim() || 'Customer reported the order was not received';
      db.prepare(`UPDATE orders SET status='Pickup Disputed', customer_confirmation_status='disputed', customer_dispute_reason=?, customer_dispute_photo_url=?, updated_at=? WHERE id=?`)
        .run(why, disputePhotoUrl || null, ts, row.id);
      api.logOrderEvent(n, 'pickup_issue_reported', 'customer', row.user_id, why);
      const updated = api.get(n);
      try {
        api.createNotification({ recipientType: 'admin', orderNumber: n, title: '⚠️ Pickup Issue Reported',
          message: `${row.first_name} ${row.last_name} reported a problem with the pickup of order ${n}: ${why}`, type: 'pickup_disputed', link: '/admin.html#orders' });
        api.createNotification({ recipientType: 'customer', userId: row.user_id, orderNumber: n, title: 'Issue Report Received',
          message: `We received your report about order ${n}. The shop will review it and contact you.`, type: 'pickup_disputed', link: `/index.html#track=${n}` });
      } catch (_) {}
      try { eventHub.emit('order:status', { orderNumber: n, status: 'Pickup Disputed', previousStatus: order.status, order: updated }); } catch (_) {}
      return { ok: true, order: updated };
    },

    setCustomerDeliveryConfirmation(n, { userId, confirmed, reason, disputePhotoUrl }) {
      return tx(() => {
        const row = byNumber(n);
        // Only the customer who placed the order may confirm or dispute it (same answer as "not found").
        if (!row || !userId || row.user_id !== userId) return { ok: false, status: 404, error: 'Order not found.' };
        n = row.order_number; // canonical "#FLR-..." form for messages, events and logs
        const order = rowToOrder(row);
        if (order.fulfillment === 'pickup') return api.customerPickupAnswer(row, order, { confirmed, reason, disputePhotoUrl });
        if (order.status === 'Delivered — Confirmed') {
          return { ok: false, status: 409, code: 'ALREADY_CONFIRMED', error: order.customerConfirmationStatus === 'auto'
            ? 'This delivery was already confirmed automatically because no issue was reported in time.'
            : order.customerConfirmationStatus === 'resolved' ? 'This delivery was already closed by the shop after reviewing your report.'
            : 'You already confirmed receiving this delivery.' };
        }
        // Receipt can only be confirmed/disputed once the shop has marked the order as delivered.
        const canConfirm = ['Delivered — Awaiting Confirmation', 'Delivered', 'Delivery Disputed'];
        const canDispute = ['Delivered — Awaiting Confirmation', 'Delivered'];
        if (!(confirmed ? canConfirm : canDispute).includes(order.status)) {
          return { ok: false, status: 409, error: confirmed
            ? 'This order has not been marked as delivered yet.'
            : 'A delivery issue can only be reported after the shop marks the order as delivered.' };
        }

        if (confirmed) {
          const newStatus = 'Delivered — Confirmed';
          db.prepare(`UPDATE orders SET status=?, customer_confirmation_status='confirmed', customer_confirmed_at=?, updated_at=? WHERE id=?`)
            .run(newStatus, now(), now(), row.id);
          api.logOrderEvent(n, 'delivery_receipt_confirmed', 'customer', row.user_id, 'Customer confirmed receiving the delivery');

          const updated = api.get(n);
          try {
            api.createNotification({
              recipientType: 'admin',
              orderNumber: n,
              title: 'Delivery Confirmed by Customer',
              message: `Order ${n} has been confirmed as received by the customer.`,
              type: 'delivery_confirmed',
              link: '/admin.html#orders'
            });
            api.createNotification({
              recipientType: 'customer',
              userId: updated.userId,
              orderNumber: n,
              title: 'Delivery Confirmed',
              message: `Thank you for confirming receipt of order ${n}. We hope your fresh blooms bring joy!`,
              type: 'delivery_confirmed',
              link: `/index.html#track=${n}`
            });
          } catch (_) {}

          try {
            eventHub.emit('order:status', { orderNumber: n, status: newStatus, previousStatus: order.status, order: updated });
          } catch (_) {}

          return { ok: true, order: updated };
        } else {
          const newStatus = 'Delivery Disputed';
          db.prepare(`UPDATE orders SET status=?, customer_confirmation_status='disputed', customer_dispute_reason=?, customer_dispute_photo_url=?, updated_at=? WHERE id=?`)
            .run(newStatus, reason || 'Customer reported order not received', disputePhotoUrl || null, now(), row.id);
          api.logOrderEvent(n, 'delivery_issue_reported', 'customer', row.user_id, reason || 'Customer reported order not received');

          const updated = api.get(n);
          try {
            api.createNotification({
              recipientType: 'admin',
              orderNumber: n,
              title: '⚠️ Delivery Disputed',
              message: `Customer reported that Order ${n} was not received. Please review the delivery. Reason: ${reason || 'No description provided'}`,
              type: 'delivery_disputed',
              link: '/admin.html#orders'
            });
            api.createNotification({
              recipientType: 'customer',
              userId: updated.userId,
              orderNumber: n,
              title: 'Dispute Under Review',
              message: `We received your report regarding order ${n}. Our atelier concierge is reviewing the delivery photo and courier details.`,
              type: 'delivery_disputed',
              link: `/index.html#track=${n}`
            });
          } catch (_) {}

          try {
            eventHub.emit('order:status', { orderNumber: n, status: newStatus, previousStatus: order.status, order: updated });
          } catch (_) {}

          return { ok: true, order: updated };
        }
      });
    },

    resolveDispute(n, { notes, adminUsername, finalStatus = 'Delivered — Confirmed' }) {
      return tx(() => {
        const row = byNumber(n);
        if (!row) return { ok: false, error: 'Order not found.' };
        n = row.order_number; // canonical "#FLR-..." form for messages, events and logs
        const order = rowToOrder(row);
        const isPickup = order.fulfillment === 'pickup';
        if (order.status !== (isPickup ? 'Pickup Disputed' : 'Delivery Disputed')) return { ok: false, error: 'Only disputed orders can be resolved.' };
        // A pickup dispute is never closed as "Picked Up" by the shop: only the customer can confirm receipt.
        // The shop either prepares the handover again (both confirm again) or cancels the order.
        const outcomes = isPickup ? ['Ready for Pickup', 'Rejected/Cancelled'] : VALID_TRANSITIONS.delivery['Delivery Disputed'];
        if (!outcomes.includes(finalStatus)) {
          return { ok: false, error: `"${finalStatus}" is not a valid outcome for a disputed ${isPickup ? 'pickup' : 'delivery'}.` };
        }

        db.prepare(`UPDATE orders SET status=?, customer_confirmation_status='resolved', dispute_resolved_at=?, dispute_resolution_notes=?, updated_at=? WHERE id=?`)
          .run(finalStatus, now(), notes || 'Dispute resolved by admin', now(), row.id);
        const outcomeLabel = finalStatus === 'Delivered — Confirmed' ? 'Delivered — Resolved by Shop' : finalStatus;
        api.logOrderEvent(n, isPickup ? 'pickup_issue_resolved' : 'delivery_issue_resolved', 'admin', adminUsername || 'admin',
          `${outcomeLabel}: ${notes || 'Dispute resolved by admin'}`);

        const updated = api.get(n);
        try {
          api.createNotification({
            recipientType: 'customer',
            userId: updated.userId,
            orderNumber: n,
            title: 'Dispute Resolved',
            message: `The inquiry regarding order ${n} has been resolved: ${notes || 'Case closed by support.'}`,
            type: 'dispute_resolved',
            link: `/index.html#track=${n}`
          });
          api.createNotification({
            recipientType: 'admin',
            orderNumber: n,
            title: 'Dispute Resolved',
            message: `Dispute on order ${n} resolved by ${adminUsername || 'Admin'}.`,
            type: 'dispute_resolved',
            link: '/admin.html#orders'
          });
        } catch (_) {}

        try {
          eventHub.emit('order:status', { orderNumber: n, status: finalStatus, previousStatus: order.status, order: updated });
        } catch (_) {}

        return { ok: true, order: updated };
      });
    },

    stats() {
      const c = (sql, ...p) => db.prepare(sql).get(...p).c;
      const placeholders = (a) => a.map(() => '?').join(',');
      // Revenue = completed AND paid. Completed orders whose money was never confirmed are reported separately.
      const PAID = "LOWER(TRIM(COALESCE(payment_status,''))) = 'paid'";
      const revenue = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE status IN (${placeholders(DONE_STATUSES)}) AND ${PAID}`).get(...DONE_STATUSES).s;
      const unpaidDone = db.prepare(`SELECT COALESCE(SUM(total),0) s, COUNT(*) c FROM orders WHERE status IN (${placeholders(DONE_STATUSES)}) AND NOT (${PAID})`).get(...DONE_STATUSES);
      const pipeline = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE status = 'Pending Confirmation' OR status IN (${placeholders(ACTIVE_STATUSES)})`).get(...ACTIVE_STATUSES).s;
      const today = new Date().toISOString().slice(0, 10);
      
      const salesToday = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE status IN (${placeholders(DONE_STATUSES)}) AND (substr(updated_at,1,10) = ? OR schedule_date = ?)`).get(...DONE_STATUSES, today, today).s;
      const completedToday = c(`SELECT COUNT(*) c FROM orders WHERE status IN (${placeholders(DONE_STATUSES)}) AND (substr(updated_at,1,10) = ? OR schedule_date = ?)`, ...DONE_STATUSES, today, today);
      const pendingCount = c("SELECT COUNT(*) c FROM orders WHERE status = 'Pending Confirmation'");
      const inProgressCount = c(`SELECT COUNT(*) c FROM orders WHERE status IN (${placeholders(ACTIVE_STATUSES)})`, ...ACTIVE_STATUSES);

      // Inventory valuation: sum of (stock_count * unit_cost)
      const flowers = db.prepare("SELECT stock_count, unit_cost FROM flowers WHERE archived = 0").all();
      let totalValuation = 0;
      let valuedStems = 0;
      let unvaluedStems = 0;
      for (const fl of flowers) {
        if (fl.unit_cost !== null && fl.unit_cost !== undefined && fl.unit_cost > 0) {
          totalValuation += fl.stock_count * fl.unit_cost;
          valuedStems++;
        } else {
          unvaluedStems++;
        }
      }

      return {
        totalOrders: c('SELECT COUNT(*) c FROM orders'),
        pendingOrders: pendingCount,
        activeOrders: inProgressCount,
        deliveredOrders: c(`SELECT COUNT(*) c FROM orders WHERE status IN (${placeholders(DONE_STATUSES)})`, ...DONE_STATUSES),
        cancelledOrders: c("SELECT COUNT(*) c FROM orders WHERE status = 'Rejected/Cancelled'"),
        totalRevenue: revenue,            // completed (Delivered / Picked Up) AND paid orders only
        completedUnpaidAmount: unpaidDone.s,
        completedUnpaidOrders: unpaidDone.c,
        pipelineValue: pipeline,          // pending + in-progress orders
        ordersToday: c('SELECT COUNT(*) c FROM orders WHERE substr(created_at,1,10) = ?', today),
        salesToday: Math.round(salesToday * 100) / 100,
        completedOrdersToday: completedToday,
        totalCustomers: c('SELECT COUNT(*) c FROM users'),
        activeProducts: c('SELECT COUNT(*) c FROM flowers WHERE archived = 0') + c('SELECT COUNT(*) c FROM bouquets WHERE archived = 0'),
        lowStock: [
          ...db.prepare("SELECT id,name,stock_count,unit_of_measure FROM flowers WHERE archived = 0 AND (stock_count > 0 AND stock_count <= ?) ORDER BY stock_count ASC, name").all(getGlobalLowStockThreshold())
            .map(f => ({ id: f.id, name: f.name, stockCount: f.stock_count, lowStockThreshold: getGlobalLowStockThreshold(), unitOfMeasure: f.unit_of_measure || 'stems' })),
          ...db.prepare("SELECT id,name,stock_count FROM bouquets WHERE archived = 0 AND (stock_count > 0 AND stock_count <= ?) ORDER BY stock_count ASC, name").all(getGlobalLowStockThreshold())
            .map(b => ({ id: b.id, name: b.name, stockCount: b.stock_count, lowStockThreshold: getGlobalLowStockThreshold(), unitOfMeasure: 'bouquets' }))
        ].slice(0, 20),
        inventoryValuation: Math.round(totalValuation * 100) / 100,
        valuationStatus: unvaluedStems === 0 ? 'complete' : (valuedStems > 0 ? `partial (${unvaluedStems} unpriced)` : 'unavailable'),
        recentOrders: db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 5").all().map(rowToOrder),
        topProducts: db.prepare(`SELECT oi.name name, SUM(oi.quantity) qty, SUM(oi.line_total) revenue
          FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'Rejected/Cancelled'
          GROUP BY oi.item_type, oi.item_id, oi.name ORDER BY revenue DESC LIMIT 5`).all()
      };
    },

    // ------------------------------------------------------------------ business reports
    getReportsData(filters = {}) {
      const tz = 'Asia/Manila';
      const now = new Date();
      const nowStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);

      let range = filters.range || 'last7days';
      let start = filters.startDate;
      let end = filters.endDate || nowStr;

      if (range === 'today') {
        start = nowStr;
        end = nowStr;
      } else if (range === 'last7days') {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        start = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
        end = nowStr;
      } else if (range === 'last30days') {
        const d = new Date(now);
        d.setDate(d.getDate() - 29);
        start = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
        end = nowStr;
      } else if (range === 'thismonth') {
        const ym = nowStr.slice(0, 7);
        start = `${ym}-01`;
        end = nowStr;
      } else if (range === 'custom') {
        start = filters.startDate || nowStr;
        end = filters.endDate || nowStr;
      } else {
        range = 'last7days';
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        start = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
        end = nowStr;
      }

      if (start > end) {
        const tmp = start;
        start = end;
        end = tmp;
      }

      const rawOrders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
      const allOrders = rawOrders.map(rowToOrder);

      const filteredOrders = allOrders.filter(o => {
        try {
          const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(o.createdAt || o.created_at));
          return dateStr >= start && dateStr <= end;
        } catch (_) {
          return false;
        }
      });

      const completedOrders = filteredOrders.filter(o => DONE_STATUSES.includes(o.status));
      const cancelledOrders = filteredOrders.filter(o => o.status === 'Rejected/Cancelled');
      const nonCancelledOrders = filteredOrders.filter(o => o.status !== 'Rejected/Cancelled');
      // Realized revenue = completed AND paid; completed-but-unpaid orders (e.g. Cash on Delivery not yet remitted)
      // are shown separately instead of being counted as money received.
      const isRealized = (o) => DONE_STATUSES.includes(o.status) && o.paymentStatus === 'Paid';
      const completedUnpaid = completedOrders.filter(o => o.paymentStatus !== 'Paid');

      const realizedRevenue = Math.round(completedOrders.filter(isRealized).reduce((sum, o) => sum + (Number(o.total) || 0), 0) * 100) / 100;
      const completedUnpaidAmount = Math.round(completedUnpaid.reduce((sum, o) => sum + (Number(o.total) || 0), 0) * 100) / 100;
      const netRevenue = Math.round(nonCancelledOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) * 100) / 100;
      const cancelledAmount = Math.round(cancelledOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) * 100) / 100;
      const grossSales = Math.round(filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) * 100) / 100;

      const totalOrdersCount = filteredOrders.length;
      const completedOrdersCount = completedOrders.length;
      const cancelledOrdersCount = cancelledOrders.length;
      const activeOrdersCount = nonCancelledOrders.length;

      // Extract products from non-cancelled orders without double-counting bouquet ingredients
      const validItems = [];
      const flowerCategoryCache = new Map();
      const getFlowerCategory = (id) => {
        if (!id) return 'Fresh Flowers';
        if (flowerCategoryCache.has(id)) return flowerCategoryCache.get(id);
        try {
          const row = db.prepare('SELECT category FROM flowers WHERE id = ?').get(id);
          const cat = row && row.category ? row.category : 'Fresh Flowers';
          flowerCategoryCache.set(id, cat);
          return cat;
        } catch (_) {
          return 'Fresh Flowers';
        }
      };

      for (const o of nonCancelledOrders) {
        if (!Array.isArray(o.items)) continue;
        const customBouquetGroups = new Map();

        for (const it of o.items) {
          if (isCustomComponent(it)) {
            // Custom bouquet = one product line, counted per bouquet (not per stem/material).
            const key = `${o.orderNumber}_${it.bouquetName || 'Custom'}_${it.cardMessage || ''}`;
            if (!customBouquetGroups.has(key)) {
              customBouquetGroups.set(key, {
                orderNumber: o.orderNumber,
                createdAt: o.createdAt,
                name: 'Custom Bespoke Bouquet',
                category: 'Bespoke Bouquets',
                itemType: 'custom_bouquet',
                quantity: 1,
                lineTotal: 0
              });
            }
            const grp = customBouquetGroups.get(key);
            grp.lineTotal += Number(it.lineTotal) || 0;
            // Every custom bouquet has exactly one row per wrapping, so its quantity = bouquets ordered.
            if (it.type === 'wrapping') grp.quantity = Math.max(grp.quantity, Number(it.quantity) || 1);
          } else if (it.type === 'ready_bouquet') {
            validItems.push({
              orderNumber: o.orderNumber,
              createdAt: o.createdAt,
              name: it.name || it.bouquetName || 'Ready-Made Bouquet',
              category: 'Ready-Made Bouquets',
              itemType: 'ready_bouquet',
              itemId: it.itemId,
              quantity: Number(it.quantity) || 1,
              lineTotal: Number(it.lineTotal) || 0
            });
          } else {
            // Standalone flower/item
            validItems.push({
              orderNumber: o.orderNumber,
              createdAt: o.createdAt,
              name: it.name || 'Floral Item',
              category: getFlowerCategory(it.itemId),
              itemType: it.type || 'flower',
              itemId: it.itemId,
              quantity: Number(it.quantity) || 1,
              lineTotal: Number(it.lineTotal) || 0
            });
          }
        }

        for (const cb of customBouquetGroups.values()) {
          cb.lineTotal = Math.round(cb.lineTotal * 100) / 100;
          validItems.push(cb);
        }
      }

      const productsSold = validItems.reduce((sum, i) => sum + i.quantity, 0);

      // Average Order Value (AOV): net revenue across valid qualifying orders
      let averageOrderValue = 0;
      if (activeOrdersCount > 0) {
        averageOrderValue = Math.round((netRevenue / activeOrdersCount) * 100) / 100;
      }

      // Sales Performance Breakdown
      const isSingleDay = start === end;
      const salesPerformance = [];

      if (isSingleDay) {
        // Hourly breakdown for single day
        const hourlyBuckets = [
          { hour: 8, label: '8:00 AM' },
          { hour: 10, label: '10:00 AM' },
          { hour: 12, label: '12:00 PM' },
          { hour: 14, label: '2:00 PM' },
          { hour: 16, label: '4:00 PM' },
          { hour: 18, label: '6:00 PM' },
          { hour: 20, label: '8:00 PM' },
          { hour: 22, label: '10:00 PM' }
        ];

        const hourlyMap = new Map();
        for (const hb of hourlyBuckets) {
          hourlyMap.set(hb.hour, {
            date: start,
            label: hb.label,
            hour: hb.hour,
            revenue: 0,
            realizedRevenue: 0,
            grossSales: 0,
            orders: 0,
            itemsSold: 0
          });
        }

        for (const o of filteredOrders) {
          try {
            const dt = new Date(o.createdAt || o.created_at);
            const hour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(dt), 10) % 24;
            let closest = 8;
            for (const hb of hourlyBuckets) {
              if (hour >= hb.hour) closest = hb.hour;
            }
            const bucket = hourlyMap.get(closest);
            if (bucket) {
              bucket.orders++;
              bucket.grossSales += Number(o.total) || 0;
              if (o.status !== 'Rejected/Cancelled') {
                bucket.revenue += Number(o.total) || 0;
                if (isRealized(o)) {
                  bucket.realizedRevenue += Number(o.total) || 0;
                }
              }
            }
          } catch (_) {}
        }

        for (const it of validItems) {
          try {
            const dt = new Date(it.createdAt);
            const hour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(dt), 10) % 24;
            let closest = 8;
            for (const hb of hourlyBuckets) {
              if (hour >= hb.hour) closest = hb.hour;
            }
            const bucket = hourlyMap.get(closest);
            if (bucket) bucket.itemsSold += it.quantity;
          } catch (_) {}
        }

        for (const b of hourlyMap.values()) {
          salesPerformance.push({
            ...b,
            revenue: Math.round(b.revenue * 100) / 100,
            realizedRevenue: Math.round(b.realizedRevenue * 100) / 100,
            grossSales: Math.round(b.grossSales * 100) / 100
          });
        }
      } else {
        // Multi-day breakdown
        const dailyMap = new Map();
        const curDate = new Date(`${start}T00:00:00+08:00`);
        const targetEndDate = new Date(`${end}T00:00:00+08:00`);

        let safety = 0;
        while (curDate <= targetEndDate && safety < 366) {
          const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(curDate);
          const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: tz }).format(curDate);
          dailyMap.set(dStr, {
            date: dStr,
            label,
            revenue: 0,
            realizedRevenue: 0,
            grossSales: 0,
            cancelledSales: 0,
            orders: 0,
            itemsSold: 0
          });
          curDate.setDate(curDate.getDate() + 1);
          safety++;
        }

        for (const o of filteredOrders) {
          try {
            const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(o.createdAt || o.created_at));
            if (dailyMap.has(dStr)) {
              const bucket = dailyMap.get(dStr);
              bucket.orders++;
              bucket.grossSales += Number(o.total) || 0;
              if (o.status === 'Rejected/Cancelled') {
                bucket.cancelledSales += Number(o.total) || 0;
              } else {
                bucket.revenue += Number(o.total) || 0;
                if (isRealized(o)) {
                  bucket.realizedRevenue += Number(o.total) || 0;
                }
              }
            }
          } catch (_) {}
        }

        for (const it of validItems) {
          try {
            const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(it.createdAt));
            if (dailyMap.has(dStr)) {
              dailyMap.get(dStr).itemsSold += it.quantity;
            }
          } catch (_) {}
        }

        for (const b of dailyMap.values()) {
          salesPerformance.push({
            ...b,
            revenue: Math.round(b.revenue * 100) / 100,
            realizedRevenue: Math.round(b.realizedRevenue * 100) / 100,
            grossSales: Math.round(b.grossSales * 100) / 100
          });
        }
      }

      // Order Distribution
      const rawStatuses = {};
      for (const o of filteredOrders) {
        const s = o.status || 'Pending Confirmation';
        rawStatuses[s] = (rawStatuses[s] || 0) + 1;
      }

      const orderDistribution = {
        pending: rawStatuses['Pending Confirmation'] || 0,
        processing: ACTIVE_STATUSES.reduce((sum, st) => sum + (rawStatuses[st] || 0), 0),
        completed: DONE_STATUSES.reduce((sum, st) => sum + (rawStatuses[st] || 0), 0),
        cancelled: rawStatuses['Rejected/Cancelled'] || 0,
        raw: rawStatuses
      };

      // Best-selling products (Full dataset for frontend pagination at 6 records/page)
      const prodMap = new Map();
      for (const it of validItems) {
        const key = it.name || 'Floral Item';
        if (!prodMap.has(key)) {
          prodMap.set(key, {
            name: key,
            category: it.category || 'General',
            itemType: it.itemType || 'product',
            quantity: 0,
            revenue: 0
          });
        }
        const pRec = prodMap.get(key);
        pRec.quantity += Number(it.quantity) || 0;
        pRec.revenue += Number(it.lineTotal) || 0;
      }

      const bestSellers = Array.from(prodMap.values())
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
        .map(p => ({
          ...p,
          revenue: Math.round(p.revenue * 100) / 100
        }));

      // Recent transactions (Full dataset for frontend pagination at 6 records/page)
      const recentTransactions = filteredOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        date: new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(o.createdAt || o.created_at)),
        createdAt: o.createdAt,
        customerName: o.customerName || (o.firstName ? `${o.firstName} ${o.lastName || ''}`.trim() : 'Guest'),
        recipientName: o.recipientName || '',
        total: Number(o.total) || 0,
        status: o.status,
        fulfillment: o.fulfillment || 'delivery',
        paymentMethod: o.paymentMethod || 'cash',
        paymentStatus: o.paymentStatus || 'Pending'
      }));

      // Inventory health snapshot (Real-time snapshot using Global Low-Stock Threshold)
      const activeFlowers = db.prepare('SELECT * FROM flowers WHERE archived = 0').all();
      const activeBouquets = db.prepare('SELECT * FROM bouquets WHERE archived = 0').all();
      let lowStockCount = 0;
      let outOfStockCount = 0;
      let inStockCount = 0;
      const allInventoryItems = [];

      const globalThreshold = getGlobalLowStockThreshold();
      for (const f of activeFlowers) {
        const stock = Number(f.stock_count || 0);
        const threshold = globalThreshold;
        const isSoldOut = stock <= 0 || f.availability === 'sold_out';

        let status = 'in_stock';
        if (isSoldOut) {
          outOfStockCount++;
          status = 'out_of_stock';
        } else if (stock <= threshold) {
          lowStockCount++;
          status = 'low_stock';
        } else {
          inStockCount++;
        }

        allInventoryItems.push({
          id: f.id,
          name: f.name,
          category: f.category || 'Fresh Flowers',
          itemType: f.item_type || 'flower',
          stockCount: stock,
          threshold,
          unitOfMeasure: f.unit_of_measure || 'stems',
          status
        });
      }

      for (const b of activeBouquets) {
        const stock = Number(b.stock_count !== undefined && b.stock_count !== null ? b.stock_count : 0);
        const threshold = globalThreshold;
        const isSoldOut = stock <= 0 || b.availability === 'sold_out';

        let status = 'in_stock';
        if (isSoldOut) {
          outOfStockCount++;
          status = 'out_of_stock';
        } else if (stock <= threshold) {
          lowStockCount++;
          status = 'low_stock';
        } else {
          inStockCount++;
        }

        allInventoryItems.push({
          id: b.id,
          name: b.name,
          category: b.category || 'Ready-Made Bouquets',
          itemType: 'ready_bouquet',
          stockCount: stock,
          threshold,
          unitOfMeasure: 'bouquets',
          status
        });
      }

      allInventoryItems.sort((a, b) => {
        const statusRank = { out_of_stock: 0, low_stock: 1, in_stock: 2 };
        if (statusRank[a.status] !== statusRank[b.status]) {
          return statusRank[a.status] - statusRank[b.status];
        }
        return a.stockCount - b.stockCount;
      });

      // Stock movements in selected period (Philippine timezone, full dataset, robust data mapping)
      const rawStockTx = db.prepare(`
        SELECT t.*, 
               COALESCE(f.name, b.name, t.flower_id) AS flower_name,
               COALESCE(f.category, b.category, 'Ready-Made Bouquets') AS category,
               COALESCE(f.unit_of_measure, CASE WHEN b.id IS NOT NULL THEN 'bouquets' ELSE 'units' END) AS unit_of_measure,
               s.name AS supplier_name
        FROM stock_transactions t
        LEFT JOIN flowers f ON f.id = t.flower_id
        LEFT JOIN bouquets b ON b.id = t.flower_id
        LEFT JOIN suppliers s ON s.id = t.supplier_id
        ORDER BY t.id DESC
      `).all();

      const stockMovements = rawStockTx.filter(t => {
        try {
          const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(t.created_at));
          return dStr >= start && dStr <= end;
        } catch (_) {
          return false;
        }
      }).map(r => {
        const rawName = r.flower_name || r.flower_id;
        const cleanName = rawName ? String(rawName).replace(/^(fl|bq)-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Not Available';
        const displayName = r.flower_name && r.flower_name !== r.flower_id ? r.flower_name : cleanName;

        return {
          id: r.id,
          flowerId: r.flower_id,
          flower_id: r.flower_id,
          flowerName: displayName,
          flower_name: displayName,
          productName: displayName,
          category: r.category || 'General',
          unitOfMeasure: r.unit_of_measure || 'units',
          type: r.transaction_type,
          transactionType: r.transaction_type,
          transaction_type: r.transaction_type,
          quantityChange: r.quantity_change != null ? r.quantity_change : null,
          changeAmount: r.quantity_change != null ? r.quantity_change : null,
          quantity_change: r.quantity_change != null ? r.quantity_change : null,
          change_amount: r.quantity_change != null ? r.quantity_change : null,
          previousStock: r.previous_stock != null ? r.previous_stock : null,
          previous_stock: r.previous_stock != null ? r.previous_stock : null,
          previous_quantity: r.previous_stock != null ? r.previous_stock : null,
          newStock: r.new_stock != null ? r.new_stock : null,
          new_stock: r.new_stock != null ? r.new_stock : null,
          new_quantity: r.new_stock != null ? r.new_stock : null,
          unitCost: r.unit_cost,
          reason: r.reason || 'Not Available',
          supplierId: r.supplier_id,
          supplierName: r.supplier_name || null,
          orderNumber: r.order_number,
          order_number: r.order_number,
          adminUsername: r.admin_username || 'Admin',
          performed_by: r.admin_username || 'Admin',
          createdAt: r.created_at,
          created_at: r.created_at
        };
      });

      return {
        ok: true,
        range,
        startDate: start,
        endDate: end,
        kpis: {
          totalRevenue: netRevenue,
          realizedRevenue,
          completedUnpaidAmount,
          completedUnpaidOrders: completedUnpaid.length,
          grossSales,
          cancelledAmount,
          totalOrders: totalOrdersCount,
          completedOrders: completedOrdersCount,
          cancelledOrders: cancelledOrdersCount,
          activeOrders: activeOrdersCount,
          productsSold,
          averageOrderValue
        },
        salesPerformance,
        orderDistribution,
        bestSellers,
        recentTransactions,
        stockMovements,
        inventoryHealth: {
          threshold: globalThreshold,
          lowStockThreshold: globalThreshold,
          trackedItems: activeFlowers.length + activeBouquets.length,
          lowStockCount,
          outOfStockCount,
          inStockCount,
          alertItems: allInventoryItems.filter(i => i.status !== 'in_stock'),
          items: allInventoryItems,
          trackedItemsList: allInventoryItems
        }
      };
    },

    getDashboardAnalytics(filters = {}) {
      const tz = 'Asia/Manila';
      const now = new Date();
      const nowStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);

      let range = filters.range || 'last7days';
      let start = filters.startDate;
      let end = filters.endDate || nowStr;

      let prevStart = '';
      let prevEnd = '';

      if (range === 'today') {
        start = nowStr;
        end = nowStr;
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        prevStart = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(y);
        prevEnd = prevStart;
      } else if (range === 'last30days') {
        const d = new Date(now);
        d.setDate(d.getDate() - 29);
        start = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
        end = nowStr;

        const pdEnd = new Date(d);
        pdEnd.setDate(pdEnd.getDate() - 1);
        prevEnd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(pdEnd);
        const pdStart = new Date(pdEnd);
        pdStart.setDate(pdStart.getDate() - 29);
        prevStart = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(pdStart);
      } else if (range === 'thismonth') {
        const ym = nowStr.slice(0, 7);
        start = `${ym}-01`;
        end = nowStr;

        const [year, month] = ym.split('-').map(Number);
        const prevMonthDate = new Date(year, month - 2, 1);
        const prevYm = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
        prevStart = `${prevYm}-01`;
        const dayOfMonth = parseInt(nowStr.slice(8, 10), 10);
        const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
        const prevDay = Math.min(dayOfMonth, daysInPrevMonth);
        prevEnd = `${prevYm}-${String(prevDay).padStart(2, '0')}`;
      } else if (range === 'custom') {
        start = filters.startDate || nowStr;
        end = filters.endDate || nowStr;
        if (start > end) {
          const tmp = start; start = end; end = tmp;
        }
        const sDate = new Date(`${start}T00:00:00+08:00`);
        const eDate = new Date(`${end}T00:00:00+08:00`);
        const durationDays = Math.max(1, Math.round((eDate - sDate) / 864e5) + 1);

        const pe = new Date(sDate);
        pe.setDate(pe.getDate() - 1);
        prevEnd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(pe);

        const ps = new Date(pe);
        ps.setDate(ps.getDate() - (durationDays - 1));
        prevStart = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(ps);
      } else {
        range = 'last7days';
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        start = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
        end = nowStr;

        const pdEnd = new Date(d);
        pdEnd.setDate(pdEnd.getDate() - 1);
        prevEnd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(pdEnd);
        const pdStart = new Date(pdEnd);
        pdStart.setDate(pdStart.getDate() - 6);
        prevStart = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(pdStart);
      }

      if (start > end) {
        const tmp = start; start = end; end = tmp;
      }

      const rawOrders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
      const allOrders = rawOrders.map(rowToOrder);

      const currentPeriodOrders = allOrders.filter(o => {
        try {
          const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(o.createdAt || o.created_at));
          return dateStr >= start && dateStr <= end;
        } catch (_) {
          return false;
        }
      });

      const previousPeriodOrders = allOrders.filter(o => {
        try {
          const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(o.createdAt || o.created_at));
          return dateStr >= prevStart && dateStr <= prevEnd;
        } catch (_) {
          return false;
        }
      });

      const currentQualifying = currentPeriodOrders.filter(o => o.status !== 'Rejected/Cancelled');
      const currentRevenue = Math.round(currentQualifying.reduce((sum, o) => sum + (Number(o.total) || 0), 0) * 100) / 100;

      const prevQualifying = previousPeriodOrders.filter(o => o.status !== 'Rejected/Cancelled');
      const previousRevenue = Math.round(prevQualifying.reduce((sum, o) => sum + (Number(o.total) || 0), 0) * 100) / 100;

      let revenueGrowth = null;
      if (previousRevenue > 0) {
        revenueGrowth = Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 1000) / 10;
      }

      const totalOrders = currentPeriodOrders.length;
      const previousOrders = previousPeriodOrders.length;
      let ordersGrowth = null;
      if (previousOrders > 0) {
        ordersGrowth = Math.round(((totalOrders - previousOrders) / previousOrders) * 1000) / 10;
      }

      const pendingOrdersCount = db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'Pending Confirmation' OR status = 'pending'").get().c;
      // Same definition of "active" as the Orders screen and /api/admin/stats.
      const activeOrdersCount = allOrders.filter(o => ACTIVE_STATUSES.includes(o.status)).length;

      const todayOrders = allOrders.filter(o => {
        try {
          const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(o.createdAt || o.created_at));
          return dStr === nowStr && o.status !== 'Rejected/Cancelled';
        } catch (_) { return false; }
      });
      const salesToday = Math.round(todayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) * 100) / 100;

      const globalTh = getGlobalLowStockThreshold();
      const bouquetsRows = db.prepare('SELECT id, name, stock_count, availability, image FROM bouquets WHERE archived = 0').all();
      const flowersRows = db.prepare('SELECT id, name, category, stock_count, availability, item_type, unit_of_measure, image FROM flowers WHERE archived = 0').all();

      let inStockCount = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      const allInventoryItems = [
        ...bouquetsRows.map(b => ({
          id: b.id,
          name: b.name,
          category: 'Ready-Made Bouquets',
          stockCount: Number(b.stock_count || 0),
          unitOfMeasure: 'bouquets'
        })),
        ...flowersRows.map(f => ({
          id: f.id,
          name: f.name,
          category: f.category || f.item_type || 'Fresh Flowers',
          stockCount: Number(f.stock_count || 0),
          unitOfMeasure: f.unit_of_measure || 'units'
        }))
      ];

      for (const item of allInventoryItems) {
        const sc = item.stockCount;
        if (sc > globalTh) inStockCount++;
        else if (sc > 0) lowStockCount++;
        else outOfStockCount++;
      }

      const alertItems = allInventoryItems
        .filter(item => item.stockCount <= globalTh)
        .map(item => ({
          ...item,
          status: item.stockCount <= 0 ? 'out_of_stock' : 'low_stock'
        }))
        .sort((a, b) => a.stockCount - b.stockCount);

      let trendData = [];
      if (range === 'today') {
        const hourMap = new Map();
        for (let h = 8; h <= 20; h++) {
          const displayLabel = h === 12 ? '12 PM' : (h < 12 ? `${h} AM` : `${h - 12} PM`);
          hourMap.set(h, { label: displayLabel, hour: h, revenue: 0, orders: 0 });
        }

        for (const o of currentQualifying) {
          try {
            const dt = new Date(o.createdAt || o.created_at);
            let hour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(dt), 10) % 24;
            // Online orders arrive 24/7: fold off-hours orders into the first/last bucket so the chart
            // always adds up to the "today" KPI instead of silently dropping them.
            hour = Math.min(20, Math.max(8, hour));
            if (hourMap.has(hour)) {
              const b = hourMap.get(hour);
              b.revenue += Number(o.total) || 0;
              b.orders++;
            }
          } catch (_) {}
        }
        trendData = Array.from(hourMap.values()).map(b => ({
          ...b,
          revenue: Math.round(b.revenue * 100) / 100
        }));
      } else {
        const dailyMap = new Map();
        const curDate = new Date(`${start}T00:00:00+08:00`);
        const targetEndDate = new Date(`${end}T00:00:00+08:00`);
        let safety = 0;
        while (curDate <= targetEndDate && safety < 366) {
          const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(curDate);
          const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: tz }).format(curDate);
          dailyMap.set(dStr, { date: dStr, label, revenue: 0, orders: 0 });
          curDate.setDate(curDate.getDate() + 1);
          safety++;
        }

        for (const o of currentQualifying) {
          try {
            const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(o.createdAt || o.created_at));
            if (dailyMap.has(dStr)) {
              const b = dailyMap.get(dStr);
              b.revenue += Number(o.total) || 0;
              b.orders++;
            }
          } catch (_) {}
        }
        trendData = Array.from(dailyMap.values()).map(b => ({
          ...b,
          revenue: Math.round(b.revenue * 100) / 100
        }));
      }

      const statusCounts = {
        pending: 0,
        confirmed: 0,
        preparing: 0,
        out_for_delivery: 0,
        completed: 0,
        canceled: 0
      };

      // Explicit mapping of every workflow status (substring matching used to file "Out for Delivery"
      // and "Delivery Disputed" under Pending).
      const STATUS_SEGMENT = {
        'Pending Confirmation': 'pending',
        'Confirmed': 'confirmed',
        'Preparing': 'preparing',
        'Rider Assigned': 'out_for_delivery',
        'On the Way': 'out_for_delivery',
        'Out for Delivery': 'out_for_delivery',
        'Ready for Pickup': 'out_for_delivery',
        'Delivered — Awaiting Confirmation': 'out_for_delivery',
        'Delivery Disputed': 'out_for_delivery',
        'Delivered': 'completed',
        'Delivered — Confirmed': 'completed',
        'Picked Up': 'completed',
        'Rejected/Cancelled': 'canceled'
      };
      for (const o of currentPeriodOrders) {
        statusCounts[STATUS_SEGMENT[o.status] || 'pending']++;
      }

      const distributionSegments = [
        { key: 'pending', label: 'Pending', count: statusCounts.pending, color: '#F59E0B' },
        { key: 'confirmed', label: 'Confirmed', count: statusCounts.confirmed, color: '#3B82F6' },
        { key: 'preparing', label: 'Preparing', count: statusCounts.preparing, color: '#8B5CF6' },
        { key: 'out_for_delivery', label: 'Out for Delivery', count: statusCounts.out_for_delivery, color: '#06B6D4' },
        { key: 'completed', label: 'Completed', count: statusCounts.completed, color: '#10B981' },
        { key: 'canceled', label: 'Canceled', count: statusCounts.canceled, color: '#EF4444' }
      ].map(seg => ({
        ...seg,
        percentage: totalOrders > 0 ? Math.round((seg.count / totalOrders) * 1000) / 10 : 0
      }));

      const bqImageMap = new Map();
      for (const b of bouquetsRows) {
        if (b.name) bqImageMap.set(b.name.toLowerCase().trim(), b.image || '');
        if (b.id) bqImageMap.set(b.id, b.image || '');
      }

      // Top bouquets: ready-made bouquets by product, plus custom bouquets counted once per bouquet
      // (single flower stems are not bouquets; custom components are not separate sales).
      const bouquetSalesMap = new Map();
      const addBouquetSale = (key, name, qty, revenue, image) => {
        if (!bouquetSalesMap.has(key)) bouquetSalesMap.set(key, { name, quantity: 0, unitsSold: 0, price: 0, revenue: 0, image: image || '' });
        const rec = bouquetSalesMap.get(key);
        rec.quantity += qty; rec.unitsSold += qty; rec.revenue += revenue;
        rec.price = rec.quantity > 0 ? Math.round((rec.revenue / rec.quantity) * 100) / 100 : 0;
      };
      for (const o of currentQualifying) {
        if (!Array.isArray(o.items)) continue;
        const custom = new Map();
        for (const it of o.items) {
          if (it.type === 'ready_bouquet') {
            const nm = it.name || it.bouquetName || 'Ready-Made Bouquet';
            addBouquetSale('bq:' + (it.itemId || nm.toLowerCase()), nm, Number(it.quantity) || 1, Number(it.lineTotal) || 0,
              bqImageMap.get(it.itemId) || bqImageMap.get(nm.toLowerCase().trim()) || '');
          } else if (isCustomComponent(it)) {
            const k = `${it.bouquetName}_${it.cardMessage || ''}`;
            const g = custom.get(k) || { qty: 1, revenue: 0 };
            g.revenue += Number(it.lineTotal) || 0;
            if (it.type === 'wrapping') g.qty = Math.max(g.qty, Number(it.quantity) || 1);
            custom.set(k, g);
          }
        }
        for (const g of custom.values()) addBouquetSale('custom', 'Custom Bespoke Bouquet', g.qty, g.revenue, '');
      }

      const topBouquets = Array.from(bouquetSalesMap.values())
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
        .slice(0, 5)
        .map(b => ({
          ...b,
          revenue: Math.round(b.revenue * 100) / 100
        }));

      const recentOrders = allOrders.slice(0, 5).map(o => {
        let dateFormatted = o.date || '';
        try {
          const dt = new Date(o.createdAt || o.created_at);
          dateFormatted = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }).format(dt);
        } catch (_) {}

        return {
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: `${o.firstName || ''} ${o.lastName || ''}`.trim() || 'Guest Customer',
          date: dateFormatted,
          total: Number(o.total) || 0,
          status: o.status || 'Pending Confirmation',
          paymentMethod: o.paymentMethod || 'Cash'
        };
      });

      return {
        range,
        start,
        end,
        prevStart,
        prevEnd,
        kpis: {
          salesToday,
          totalRevenue: currentRevenue,
          previousRevenue,
          revenueGrowth,
          totalOrders,
          previousOrders,
          ordersGrowth,
          pendingOrders: pendingOrdersCount,
          activeOrders: activeOrdersCount,
          lowStockItems: lowStockCount,
          outOfStockItems: outOfStockCount,
          threshold: globalTh
        },
        trend: {
          points: trendData,
          labels: trendData.map(t => t.label),
          revenue: trendData.map(t => t.revenue),
          orders: trendData.map(t => t.orders)
        },
        orderDistribution: {
          totalOrders,
          segments: distributionSegments
        },
        topBouquets,
        inventoryOverview: {
          inStock: inStockCount,
          lowStock: lowStockCount,
          outOfStock: outOfStockCount,
          threshold: globalTh,
          totalItems: inStockCount + lowStockCount + outOfStockCount,
          alertItems
        },
        recentOrders
      };
    },

    // ------------------------------------------------------------------ catalog
    getFlowers({ includeArchived = false, itemType = 'all' } = {}) {
      let q = 'SELECT * FROM flowers WHERE 1=1';
      const p = [];
      if (!includeArchived) q += ' AND archived = 0';
      if (itemType && itemType !== 'all') { q += ' AND item_type = ?'; p.push(itemType); }
      q += " ORDER BY CASE item_type WHEN 'flower' THEN 1 WHEN 'filler' THEN 2 WHEN 'foliage' THEN 3 WHEN 'wrapping' THEN 4 WHEN 'ribbon' THEN 5 WHEN 'card' THEN 6 ELSE 7 END, name ASC";
      return db.prepare(q).all(...p).map(flowerRow);
    },
    getFlower(id) { const r = db.prepare('SELECT * FROM flowers WHERE id = ?').get(id); return r ? flowerRow(r) : null; },
    saveFlower(f) {
      const threshold = Number.isInteger(f.lowStockThreshold) ? f.lowStockThreshold : 5;
      const itemType = f.itemType || 'flower';
      const defaultUom = itemType === 'wrapping' ? 'sheets' : (itemType === 'ribbon' ? 'rolls' : (itemType === 'card' ? 'cards' : 'stems'));
      const uom = f.unitOfMeasure || defaultUom;
      const unitCost = (f.unitCost !== undefined && f.unitCost !== null && f.unitCost !== '') ? Number(f.unitCost) : null;
      const style = f.style || '';
      
      const existing = db.prepare('SELECT id, stock_count, image FROM flowers WHERE id = ?').get(f.id);
      // Image: an explicit '' removes it (Admin "Remove image"); a missing value keeps the saved one.
      const image = (f.image === undefined || f.image === null) ? ((existing && existing.image) || '') : String(f.image);
      const stock = (f.stockCount !== undefined && f.stockCount !== null)
        ? Math.max(0, parseInt(f.stockCount, 10) || 0)
        : (existing ? existing.stock_count : 0);

      let avail = f.availability || 'available';
      // 0 stock never reads "available"/"limited"; restocking FROM 0 clears the automatic "sold out",
      // while an explicit admin "Sold Out" on an item that still has stock is kept.
      const wasEmpty = !existing || Number(existing.stock_count) <= 0;
      if (stock === 0 && (avail === 'available' || avail === 'limited')) avail = 'sold_out';
      else if (stock > 0 && avail === 'sold_out' && wasEmpty) avail = 'available';

      db.prepare(`INSERT INTO flowers (id,name,botanical_name,category,price,availability,stock_count,description,image,color,item_type,style,archived,unit_cost,low_stock_threshold,unit_of_measure,updated_at,supplier_id,source,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, botanical_name=excluded.botanical_name, category=excluded.category,
          price=excluded.price, availability=excluded.availability,
          stock_count=excluded.stock_count,
          description=excluded.description,
          image=excluded.image,
          color=excluded.color,
          item_type=COALESCE(excluded.item_type, flowers.item_type),
          style=COALESCE(excluded.style, flowers.style),
          archived=0,
          unit_cost=COALESCE(excluded.unit_cost, flowers.unit_cost),
          low_stock_threshold=COALESCE(excluded.low_stock_threshold, flowers.low_stock_threshold),
          unit_of_measure=COALESCE(excluded.unit_of_measure, flowers.unit_of_measure),
          supplier_id=COALESCE(excluded.supplier_id, flowers.supplier_id),
          source=COALESCE(excluded.source, flowers.source),
          updated_at=excluded.updated_at`)
        .run(f.id, f.name, f.botanicalName || '', f.category || '', f.price, avail, stock,
          f.description || '', image, f.color || '#f43f5e', itemType, style, unitCost, threshold, uom, now(),
          f.supplierId || null, (f.source && !f.source.includes('Unverified') ? f.source : null), now());

      // Record stock adjustment in inventory audit trail when stock quantity changes
      if (existing && existing.stock_count !== stock) {
        const delta = stock - existing.stock_count;
        const txType = delta > 0 ? 'restock' : 'adjustment';
        const reason = f.adjustmentReason || (delta > 0 ? 'Restock via Store Management' : 'Stock adjustment via Store Management');
        try {
          db.prepare(`INSERT INTO stock_transactions
            (flower_id, transaction_type, quantity_change, previous_stock, new_stock, unit_cost, reason, supplier_id, order_number, admin_username, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
            .run(f.id, txType, delta, existing.stock_count, stock, unitCost || null, reason, f.supplierId || null, null, f.adminUsername || 'admin', now());
        } catch (err) {
          console.error('Failed to log stock transaction on saveFlower:', err);
        }
      } else if (!existing && stock > 0) {
        try {
          db.prepare(`INSERT INTO stock_transactions
            (flower_id, transaction_type, quantity_change, previous_stock, new_stock, unit_cost, reason, supplier_id, order_number, admin_username, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
            .run(f.id, 'restock', stock, 0, stock, unitCost || null, 'Initial stock entry via Store Management', f.supplierId || null, null, f.adminUsername || 'admin', now());
        } catch (err) {
          console.error('Failed to log initial stock transaction:', err);
        }
      }
      const saved = api.getFlower(f.id);
      try {
        eventHub.emit('catalog:updated', { entity: 'flower', id: f.id });
        eventHub.emit('inventory:updated', { reason: 'Flower catalog updated' });
      } catch (_) {}
      return saved;
    },
    // Archive (soft delete): hidden from the shop but kept so past orders and reports stay intact.
    archiveFlower(id) {
      const res = db.prepare('UPDATE flowers SET archived = 1, updated_at = ? WHERE id = ? AND archived = 0').run(now(), id).changes > 0;
      if (res) {
        try {
          eventHub.emit('catalog:updated', { entity: 'flower', id, action: 'deleted' });
          eventHub.emit('inventory:updated', { reason: 'Flower catalog updated' });
        } catch (_) {}
      }
      return res;
    },
    deleteFlower(id, permanent = false) {
      let res = false;
      if (permanent) {
        const blocked = permanentDeleteBlocker(id);
        if (blocked) return blocked;
        res = db.prepare('DELETE FROM flowers WHERE id = ?').run(id).changes > 0;
      } else {
        res = db.prepare('UPDATE flowers SET archived = 1, updated_at = ? WHERE id = ? AND archived = 0').run(now(), id).changes > 0;
      }
      if (res) {
        try {
          eventHub.emit('catalog:updated', { entity: 'flower', id, action: 'deleted' });
          eventHub.emit('inventory:updated', { reason: 'Flower deleted from catalog' });
        } catch (_) {}
      }
      return res;
    },
    restoreFlower(id) {
      const res = db.prepare('UPDATE flowers SET archived = 0, updated_at = ? WHERE id = ? AND archived = 1').run(now(), id).changes > 0;
      if (res) {
        try {
          eventHub.emit('catalog:updated', { entity: 'flower', id });
          eventHub.emit('inventory:updated', { reason: 'Flower restored' });
        } catch (_) {}
      }
      return res;
    },
    getBouquetRecipe(id) {
      const b = api.getBouquet(id, { raw: true });
      if (b && b.specs && Array.isArray(b.specs.mainFlowers) && b.specs.mainFlowers.length) {
        return b.specs.mainFlowers;
      }
      const seed = (defaultCatalog.featuredBouquets || []).find(x => x.id === id);
      if (seed && seed.specs && Array.isArray(seed.specs.mainFlowers)) {
        return seed.specs.mainFlowers;
      }
      return [];
    },
    getBouquets({ includeArchived = false, raw = false } = {}) {
      const q = 'SELECT * FROM bouquets' + (includeArchived ? '' : ' WHERE archived = 0') + ' ORDER BY name ASC';
      const rows = db.prepare(q).all();
      let salesMap = {};
      try {
        const salesRows = db.prepare(`
          SELECT oi.item_id, SUM(oi.quantity) as total_sold
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.status NOT IN ('Rejected/Cancelled')
          GROUP BY oi.item_id
        `).all();
        for (const sr of salesRows) {
          salesMap[sr.item_id] = sr.total_sold || 0;
        }
      } catch (_) {}

      return rows.map(r => bouquetRow(r, salesMap[r.id] || 0));
    },
    getBouquet(id, { raw = false } = {}) {
      const r = db.prepare('SELECT * FROM bouquets WHERE id = ?').get(id);
      if (!r) return null;
      let salesCount = 0;
      try {
        const sr = db.prepare(`
          SELECT SUM(oi.quantity) as total_sold
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.item_id = ? AND o.status NOT IN ('Rejected/Cancelled')
        `).get(id);
        if (sr && sr.total_sold) salesCount = sr.total_sold;
      } catch (_) {}
      return bouquetRow(r, salesCount);
    },
    saveBouquet(b) {
      const specsJson = b.specs ? (typeof b.specs === 'string' ? b.specs : JSON.stringify(b.specs)) : (b.specs_json || null);
      const existing = db.prepare('SELECT stock_count, image FROM bouquets WHERE id = ?').get(b.id);
      // Image: an explicit '' removes it (Admin "Remove image"); a missing value keeps the saved one.
      const image = (b.image === undefined || b.image === null) ? ((existing && existing.image) || '') : String(b.image);
      const stock = (b.stockCount !== undefined && b.stockCount !== null && b.stockCount !== '')
        ? Math.max(0, Number(b.stockCount))
        : (existing && existing.stock_count !== undefined && existing.stock_count !== null ? existing.stock_count : 10);
      let avail = b.availability || 'available';
      // Same rule as flowers: 0 stock can never read "available"; restocking FROM 0 clears the automatic
      // "sold out", while an admin's explicit "Sold Out" on an item that still has stock is respected.
      const wasEmpty = !existing || Number(existing.stock_count) <= 0;
      if (stock <= 0 && (avail === 'available' || avail === 'limited')) avail = 'sold_out';
      else if (stock > 0 && avail === 'sold_out' && wasEmpty) avail = 'available';

      db.prepare(`INSERT INTO bouquets (id,name,category,occasion,price,description,image,formula,availability,stock_count,specs_json,archived,updated_at,source,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, occasion=excluded.occasion,
          price=excluded.price, description=excluded.description,
          image=excluded.image,
          formula=excluded.formula,
          availability=excluded.availability,
          stock_count=excluded.stock_count,
          specs_json=COALESCE(excluded.specs_json, bouquets.specs_json),
          source=COALESCE(excluded.source, bouquets.source),
          archived=0, updated_at=excluded.updated_at`)
        .run(b.id, b.name, b.category || '', b.occasion || '', b.price, b.description || '', image, b.formula || '',
          avail, stock, specsJson, now(), (b.source && !b.source.includes('Unverified') ? b.source : null), now());

      if (existing && existing.stock_count !== stock) {
        const delta = stock - existing.stock_count;
        const txType = delta > 0 ? 'restock' : 'adjustment';
        const reason = b.adjustmentReason || (delta > 0 ? 'Bouquet restock via Store Management' : 'Bouquet stock adjustment via Store Management');
        try {
          db.prepare(`INSERT INTO stock_transactions
            (flower_id, transaction_type, quantity_change, previous_stock, new_stock, unit_cost, reason, supplier_id, order_number, admin_username, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
            .run(b.id, txType, delta, existing.stock_count, stock, null, reason, null, null, b.adminUsername || 'admin', now());
        } catch (_) {}
      }
      const saved = api.getBouquet(b.id, { raw: true });
      try {
        eventHub.emit('catalog:updated', { entity: 'bouquet', id: b.id });
        eventHub.emit('inventory:updated', { reason: 'Bouquet catalog updated' });
      } catch (_) {}
      return saved;
    },
    archiveBouquet(id) {
      const res = db.prepare('UPDATE bouquets SET archived = 1, updated_at = ? WHERE id = ? AND archived = 0').run(now(), id).changes > 0;
      if (res) {
        try {
          eventHub.emit('catalog:updated', { entity: 'bouquet', id, action: 'deleted' });
        } catch (_) {}
      }
      return res;
    },
    deleteBouquet(id, permanent = false) {
      let res = false;
      if (permanent) {
        const blocked = permanentDeleteBlocker(id);
        if (blocked) return blocked;
        res = db.prepare('DELETE FROM bouquets WHERE id = ?').run(id).changes > 0;
      } else {
        res = db.prepare('UPDATE bouquets SET archived = 1, updated_at = ? WHERE id = ? AND archived = 0').run(now(), id).changes > 0;
      }
      if (res) {
        try {
          eventHub.emit('catalog:updated', { entity: 'bouquet', id, action: 'deleted' });
        } catch (_) {}
      }
      return res;
    },
    restoreBouquet(id) {
      const res = db.prepare('UPDATE bouquets SET archived = 0, updated_at = ? WHERE id = ? AND archived = 1').run(now(), id).changes > 0;
      if (res) {
        try {
          eventHub.emit('catalog:updated', { entity: 'bouquet', id });
        } catch (_) {}
      }
      return res;
    },

    // ------------------------------------------------------------------ inventory & stock transactions
    adjustStock({ flowerId, type, quantity, reason, supplierId, unitCost, notes, adminUsername }) {
      return tx(() => {
        const f = db.prepare('SELECT * FROM flowers WHERE id = ?').get(flowerId);
        if (!f) return { ok: false, error: 'Flower not found.' };
        const prev = f.stock_count;
        let delta = 0;
        let next = prev;

        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty < 0) return { ok: false, error: 'Quantity must be a non-negative whole number.' };

        if (type === 'restock' || type === 'return') {
          if (qty <= 0) return { ok: false, error: 'Restock quantity must be greater than 0.' };
          delta = qty;
          next = prev + delta;
        } else if (type === 'deduct' || type === 'damage') {
          if (qty <= 0) return { ok: false, error: 'Deduction quantity must be greater than 0.' };
          if (prev < qty) return { ok: false, error: `Cannot deduct ${qty} stems. Current available stock is only ${prev}.` };
          delta = -qty;
          next = prev - qty;
        } else if (type === 'correction' || type === 'audit') {
          delta = qty - prev;
          next = qty;
        } else {
          return { ok: false, error: 'Invalid adjustment type.' };
        }

        const threshold = getGlobalLowStockThreshold();
        let avail = f.availability;
        if (avail === 'unavailable') avail = 'unavailable'; // a stock count never overrides "hidden from shop"
        else if (next <= 0) avail = 'sold_out';
        else if (next <= threshold) avail = 'limited';
        else avail = 'available';

        let cost = f.unit_cost;
        if (unitCost !== undefined && unitCost !== null && unitCost !== '') {
          const numCost = Number(unitCost);
          if (Number.isFinite(numCost) && numCost >= 0) cost = Math.round(numCost * 100) / 100;
        }

        db.prepare('UPDATE flowers SET stock_count = ?, availability = ?, unit_cost = ?, updated_at = ? WHERE id = ?')
          .run(next, avail, cost, now(), flowerId);

        const insTx = db.prepare(`INSERT INTO stock_transactions
          (flower_id, transaction_type, quantity_change, previous_stock, new_stock, unit_cost, reason, supplier_id, order_number, admin_username, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
        
        const noteWithReason = notes ? (reason ? `${reason} — ${notes}` : notes) : (reason || 'Manual Adjustment');
        insTx.run(flowerId, type, delta, prev, next, cost, noteWithReason, supplierId || null, null, adminUsername || 'admin', now());

        const flower = api.getFlower(flowerId);
        try {
          eventHub.emit('inventory:updated', { flowerId, type, delta, nextStock: next });
          eventHub.emit('catalog:updated', { entity: 'flower', id: flowerId });
        } catch (_) {}
        return { ok: true, flower, stockCount: next, previousStock: prev, newStock: next, delta };
      });
    },

    listStockTransactions({ flowerId, type, category, search, startDate, endDate, limit = 500 } = {}) {
      const tz = 'Asia/Manila';
      let q = `SELECT t.*, 
                      COALESCE(f.name, b.name, t.flower_id) AS flower_name,
                      COALESCE(f.category, b.category, 'Ready-Made Bouquets') AS category,
                      COALESCE(f.unit_of_measure, CASE WHEN b.id IS NOT NULL THEN 'bouquets' ELSE 'units' END) AS unit_of_measure,
                      s.name AS supplier_name
               FROM stock_transactions t
               LEFT JOIN flowers f ON f.id = t.flower_id
               LEFT JOIN bouquets b ON b.id = t.flower_id
               LEFT JOIN suppliers s ON s.id = t.supplier_id
               WHERE 1=1`;
      const p = [];
      if (flowerId) { q += ' AND t.flower_id = ?'; p.push(flowerId); }
      if (type && type !== 'all') { q += ' AND t.transaction_type = ?'; p.push(type); }
      if (category && category !== 'all') {
        q += " AND (COALESCE(f.category, b.category, 'Ready-Made Bouquets') = ?)";
        p.push(category);
      }
      if (search) {
        q += ' AND (COALESCE(f.name, b.name, t.flower_id) LIKE ? OR t.reason LIKE ? OR t.order_number LIKE ?)';
        const s = `%${search}%`; p.push(s, s, s);
      }
      q += ' ORDER BY t.id DESC';
      if (!startDate && !endDate) {
        q += ' LIMIT ?';
        p.push(limit);
      }
      let rows = db.prepare(q).all(...p);
      if (startDate || endDate) {
        rows = rows.filter(t => {
          try {
            const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(t.created_at));
            if (startDate && dStr < startDate) return false;
            if (endDate && dStr > endDate) return false;
            return true;
          } catch (_) { return false; }
        });
        if (limit) rows = rows.slice(0, limit);
      }
      return rows.map(r => ({
        id: r.id,
        flowerId: r.flower_id,
        flowerName: r.flower_name || r.flower_id,
        category: r.category || 'General',
        unitOfMeasure: r.unit_of_measure || 'units',
        type: r.transaction_type,
        quantityChange: r.quantity_change,
        previousStock: r.previous_stock,
        newStock: r.new_stock,
        unitCost: r.unit_cost,
        reason: r.reason,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name || null,
        orderNumber: r.order_number,
        adminUsername: r.admin_username,
        createdAt: r.created_at
      }));
    },

    getInventorySummary() {
      const flowers = db.prepare("SELECT * FROM flowers WHERE archived = 0 ORDER BY name ASC").all();
      let totalStems = 0;
      let totalValuation = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      let unvaluedCount = 0;

      const threshold = getGlobalLowStockThreshold();
      for (const f of flowers) {
        const stock = f.stock_count || 0;
        totalStems += stock;
        if (stock <= 0) outOfStockCount++;
        else if (stock <= threshold) lowStockCount++;

        if (f.unit_cost !== null && f.unit_cost !== undefined && f.unit_cost > 0) {
          totalValuation += stock * f.unit_cost;
        } else {
          unvaluedCount++;
        }
      }

      // Calculate recorded stock movements today in shop's configured timezone (Asia/Manila)
      const tz = 'Asia/Manila';
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
      const allTrans = db.prepare("SELECT created_at FROM stock_transactions").all();
      let movementsToday = 0;
      for (const t of allTrans) {
        try {
          const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(t.created_at));
          if (dStr === todayStr) movementsToday++;
        } catch (_) {}
      }

      return {
        totalStems,
        totalValuation: Math.round(totalValuation * 100) / 100,
        valuationStatus: unvaluedCount === 0 ? 'complete' : `partial (${unvaluedCount} items unpriced)`,
        lowStockCount,
        outOfStockCount,
        totalFlowers: flowers.length,
        trackedItems: flowers.length,
        movementsToday,
        flowers: flowers.map(f => ({
          ...flowerRow(f),
          valuation: f.unit_cost ? Math.round((f.stock_count || 0) * f.unit_cost * 100) / 100 : 0
        }))
      };
    },

    // ------------------------------------------------------------------ suppliers
    getSuppliers({ includeInactive = true } = {}) {
      const q = 'SELECT * FROM suppliers' + (includeInactive ? '' : ' WHERE active = 1') + ' ORDER BY name ASC';
      return db.prepare(q).all().map(s => {
        let categories = [];
        try {
          if (s.categories_json) categories = JSON.parse(s.categories_json);
        } catch (_) {}
        return {
          id: s.id,
          name: s.name,
          contactPerson: s.contact_person || '',
          phone: s.phone || '',
          email: s.email || '',
          address: s.address || '',
          origin: s.origin || '',
          categories: Array.isArray(categories) ? categories : [],
          notes: s.notes || '',
          active: Boolean(s.active),
          createdAt: s.created_at,
          updatedAt: s.updated_at
        };
      });
    },
    getSupplier(id) {
      const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
      if (!s) return null;
      let categories = [];
      try {
        if (s.categories_json) categories = JSON.parse(s.categories_json);
      } catch (_) {}
      return {
        id: s.id,
        name: s.name,
        contactPerson: s.contact_person || '',
        phone: s.phone || '',
        email: s.email || '',
        address: s.address || '',
        origin: s.origin || '',
        categories: Array.isArray(categories) ? categories : [],
        notes: s.notes || '',
        active: Boolean(s.active),
        createdAt: s.created_at,
        updatedAt: s.updated_at
      };
    },
    saveSupplier(s) {
      const id = s.id || ('sup_' + crypto.randomBytes(6).toString('hex'));
      const categoriesJson = Array.isArray(s.categories)
        ? JSON.stringify(s.categories)
        : (typeof s.categories === 'string' && s.categories ? JSON.stringify([s.categories]) : (s.categoriesJson || '[]'));
      const origin = s.origin || null;

      db.prepare(`INSERT INTO suppliers (id, name, contact_person, phone, email, address, origin, categories_json, notes, active, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,1,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, contact_person=excluded.contact_person,
          phone=excluded.phone, email=excluded.email, address=excluded.address,
          origin=COALESCE(excluded.origin, suppliers.origin),
          categories_json=COALESCE(excluded.categories_json, suppliers.categories_json),
          notes=excluded.notes,
          active=COALESCE(?, suppliers.active), updated_at=excluded.updated_at`)
        .run(id, s.name, s.contactPerson || '', s.phone || '', s.email || '', s.address || '', origin, categoriesJson, s.notes || '', now(), now(), s.active !== undefined ? (s.active ? 1 : 0) : null);
      return api.getSupplier(id);
    },
    toggleSupplierActive(id, active) {
      db.prepare('UPDATE suppliers SET active = ?, updated_at = ? WHERE id = ?').run(active ? 1 : 0, now(), id);
      return api.getSupplier(id);
    },

    // ------------------------------------------------------------------ categories
    getCategories({ includeInactive = true } = {}) {
      const q = 'SELECT * FROM categories' + (includeInactive ? '' : ' WHERE active = 1') + ' ORDER BY name ASC';
      const rows = db.prepare(q).all();
      return rows.map(c => {
        const flowerCount = db.prepare('SELECT COUNT(*) c FROM flowers WHERE category = ? AND archived = 0').get(c.name).c;
        const bouquetCount = db.prepare('SELECT COUNT(*) c FROM bouquets WHERE category = ? AND archived = 0').get(c.name).c;
        return {
          id: c.id,
          name: c.name,
          type: c.type || 'both',
          description: c.description || '',
          active: Boolean(c.active),
          flowerCount,
          bouquetCount,
          productCount: flowerCount + bouquetCount,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        };
      });
    },
    getCategory(id) {
      const c = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
      if (!c) return null;
      const flowerCount = db.prepare('SELECT COUNT(*) c FROM flowers WHERE category = ? AND archived = 0').get(c.name).c;
      const bouquetCount = db.prepare('SELECT COUNT(*) c FROM bouquets WHERE category = ? AND archived = 0').get(c.name).c;
      return {
        id: c.id,
        name: c.name,
        type: c.type || 'both',
        description: c.description || '',
        active: Boolean(c.active),
        flowerCount,
        bouquetCount,
        productCount: flowerCount + bouquetCount,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      };
    },
    // The six core categories are system identifiers: the admin console, builder, suppliers and reports
    // map products by these exact names, so they cannot be renamed, retyped or deactivated.
    CORE_CATEGORY_IDS,
    saveCategory(c) {
      const id = c.id || ('cat_' + crypto.randomBytes(6).toString('hex'));
      const existing = c.id ? db.prepare('SELECT * FROM categories WHERE id = ?').get(c.id) : null;
      if (existing && CORE_CATEGORY_IDS.includes(existing.id)) {
        if (String(c.name).trim().toLowerCase() !== String(existing.name).toLowerCase()) {
          return { ok: false, error: `"${existing.name}" is a core category and cannot be renamed. You can still edit its description.` };
        }
        db.prepare('UPDATE categories SET description = ?, updated_at = ? WHERE id = ?').run(c.description || '', now(), id);
        return api.getCategory(id);
      }
      return tx(() => {
        db.prepare(`INSERT INTO categories (id, name, type, description, active, created_at, updated_at)
          VALUES (?,?,?,?,1,?,?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, description=excluded.description, updated_at=excluded.updated_at`)
          .run(id, c.name, c.type || 'both', c.description || '', now(), now());
        // Products and suppliers reference categories by name: carry a rename over so nothing is orphaned.
        if (existing && existing.name !== c.name) {
          db.prepare('UPDATE flowers SET category = ?, updated_at = ? WHERE category = ?').run(c.name, now(), existing.name);
          db.prepare('UPDATE bouquets SET category = ?, updated_at = ? WHERE category = ?').run(c.name, now(), existing.name);
          for (const s of db.prepare('SELECT id, categories_json FROM suppliers').all()) {
            const cats = safeParse(s.categories_json, []);
            if (Array.isArray(cats) && cats.includes(existing.name)) {
              db.prepare('UPDATE suppliers SET categories_json = ?, updated_at = ? WHERE id = ?')
                .run(JSON.stringify(cats.map(x => x === existing.name ? c.name : x)), now(), s.id);
            }
          }
          try { eventHub.emit('catalog:updated', { entity: 'category', id }); } catch (_) {}
        }
        return api.getCategory(id);
      });
    },
    deactivateCategory(id) {
      const cat = api.getCategory(id);
      if (!cat) return { ok: false, error: 'Category not found.' };
      if (cat.productCount > 0) {
        return { ok: false, error: `Cannot deactivate category "${cat.name}" because it is currently assigned to ${cat.productCount} active product(s). Please reassign products first.` };
      }
      if (CORE_CATEGORY_IDS.includes(id)) return { ok: false, error: `"${cat.name}" is a core category and cannot be deactivated.` };
      db.prepare('UPDATE categories SET active = 0, updated_at = ? WHERE id = ?').run(now(), id);
      return { ok: true, category: api.getCategory(id) };
    },

    // ------------------------------------------------------------------ shop settings
    getGlobalLowStockThreshold,
    getSetting(key) {
      const row = db.prepare('SELECT value_json FROM shop_settings WHERE key = ?').get(key);
      return row ? safeParse(row.value_json, null) : null;
    },
    getSettings() {
      const rows = db.prepare('SELECT key, value_json FROM shop_settings').all();
      const out = {};
      for (const r of rows) {
        out[r.key] = safeParse(r.value_json, {});
      }
      if (!out.inventory || typeof out.inventory.lowStockThreshold !== 'number') {
        out.inventory = { lowStockThreshold: getGlobalLowStockThreshold() };
      }
      return out;
    },
    saveSettings(patch) {
      const updated = tx(() => {
        const ins = db.prepare(`INSERT INTO shop_settings (key, value_json, updated_at) VALUES (?,?,?)
          ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`);
        const existing = api.getSettings();
        for (const [k, v] of Object.entries(patch || {})) {
          let merged = v;
          if (v && typeof v === 'object' && !Array.isArray(v) && existing[k] && typeof existing[k] === 'object' && !Array.isArray(existing[k])) {
            merged = { ...existing[k], ...v };
          }
          ins.run(k, JSON.stringify(merged), now());
        }
        return api.getSettings();
      });
      eventHub.emit('settings:updated', { settings: updated, patch });
      eventHub.emit('inventory:updated', { reason: 'settings_updated' });
      return updated;
    },

    // ------------------------------------------------------------------ admin accounts & sessions
    adminCount() { return db.prepare('SELECT COUNT(*) c FROM admin_users').get().c; },
    createAdmin(username, password, displayName = 'Admin Staff') {
      db.prepare('INSERT INTO admin_users (username, password_hash, display_name, role, created_at, updated_at) VALUES (?,?,?,?,?,?)')
        .run(username, hashPassword(password), displayName, 'Administrator', now(), now());
    },
    verifyAdmin(username, password) {
      if (!username || !password) return null;
      const cleanUser = String(username).trim().toLowerCase();
      // Support common admin username aliases
      const targetUser = (cleanUser === 'admin@umairaflorist.com' || cleanUser === 'admin@umaira.com' || cleanUser === 'admin staff' || cleanUser === 'administrator' || cleanUser === 'umaira')
        ? 'admin'
        : cleanUser;

      let row = db.prepare('SELECT * FROM admin_users WHERE LOWER(username) = LOWER(?)').get(targetUser);
      if (!row && targetUser === 'admin') {
        row = db.prepare('SELECT * FROM admin_users LIMIT 1').get();
      }

      const pw = String(password).trim();
      const validPw = row && verifyPassword(pw, row.password_hash);

      return row && validPw ? row.username : null;
    },
    getAdmin(username) {
      if (!username) return null;
      const row = db.prepare('SELECT username, display_name, avatar_url, role, created_at, updated_at FROM admin_users WHERE LOWER(username) = LOWER(?)').get(username);
      if (!row) return null;
      return {
        username: row.username,
        displayName: row.display_name || row.username,
        avatarUrl: row.avatar_url || '',
        role: row.role || 'Administrator',
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at
      };
    },
    updateAdminProfile(username, { displayName, avatarUrl }) {
      if (!username) return null;
      const current = api.getAdmin(username);
      if (!current) return null;
      const newName = displayName !== undefined ? String(displayName).trim().slice(0, 100) : current.displayName;
      const newAvatar = avatarUrl !== undefined ? String(avatarUrl).trim() : current.avatarUrl;
      const ts = now();
      db.prepare('UPDATE admin_users SET display_name = ?, avatar_url = ?, updated_at = ? WHERE LOWER(username) = LOWER(?)')
        .run(newName || current.username, newAvatar, ts, username);
      return api.getAdmin(username);
    },
    changeAdminPassword(username, currentPassword, newPassword) {
      if (!username) return { ok: false, error: 'Admin account not specified.' };
      const row = db.prepare('SELECT * FROM admin_users WHERE LOWER(username) = LOWER(?)').get(username);
      if (!row) return { ok: false, error: 'Admin account not found.' };
      const ok = verifyPassword(currentPassword, row.password_hash);
      if (!ok) return { ok: false, error: 'Current password is incorrect.' };
      if (!newPassword || newPassword.length < 8) return { ok: false, error: 'New password must be at least 8 characters.' };
      if (newPassword.length > 200) return { ok: false, error: 'Password is too long.' };
      const ts = now();
      db.prepare('UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE LOWER(username) = LOWER(?)')
        .run(hashPassword(newPassword), ts, username);
      return { ok: true };
    },
    createSession(username) {
      const token = 'adm_' + crypto.randomBytes(32).toString('hex');
      const t = Date.now();
      db.prepare('INSERT INTO admin_sessions (token_hash,username,created_at,expires_at) VALUES (?,?,?,?)')
        .run(sha256(token), username, new Date(t).toISOString(), new Date(t + 8 * 3600e3).toISOString());
      return token;
    },
    validateSession(token) {
      if (!token) return false;
      const row = db.prepare('SELECT * FROM admin_sessions WHERE token_hash = ?').get(sha256(token));
      if (!row) return false;
      if (new Date(row.expires_at) < new Date()) { db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(row.token_hash); return false; }
      return { username: row.username };
    },
    destroySession(token) { if (token) db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha256(token)); return true; },

    // ------------------------------------------------------------------ customers
    findUserByEmail(email) { return email ? db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase()) : null; },
    findUserById(id) { return id ? publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) : null; },
    createUser({ name, email, password, phone, googleId = null, verified = 0 }) {
      const id = 'usr_' + crypto.randomBytes(8).toString('hex');
      const isVerified = (verified || googleId) ? 1 : 0;
      db.prepare('INSERT INTO users (id,email,name,password_hash,phone,google_id,role,verified,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(id, email.trim().toLowerCase(), name.trim(), password ? hashPassword(password) : null, phone ? phone.trim() : null, googleId, 'customer', isVerified, now(), now());
      return api.findUserById(id);
    },
    savePendingRegistration({ name, email, phone, password, existingPasswordHash, otp, salt, expiresAt }) {
      const cleanEmail = email.trim().toLowerCase();
      const pwdHash = existingPasswordHash || (password ? hashPassword(password) : null);
      const otpHash = sha256(cleanEmail + ':' + otp + ':' + salt);
      db.prepare(`
        INSERT INTO pending_registrations 
          (email, name, phone, password_hash, otp_hash, otp_salt, attempts, max_attempts, resend_count, last_sent_at, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, 5, 0, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          name = excluded.name,
          phone = excluded.phone,
          password_hash = COALESCE(excluded.password_hash, pending_registrations.password_hash),
          otp_hash = excluded.otp_hash,
          otp_salt = excluded.otp_salt,
          attempts = 0,
          resend_count = pending_registrations.resend_count + 1,
          last_sent_at = excluded.last_sent_at,
          expires_at = excluded.expires_at;
      `).run(cleanEmail, name.trim(), (phone || '').trim(), pwdHash, otpHash, salt, now(), expiresAt, now());
      return true;
    },
    getPendingRegistration(email) {
      return email ? db.prepare('SELECT * FROM pending_registrations WHERE email = ?').get(String(email).trim().toLowerCase()) : null;
    },
    updatePendingOTP(email, { otp, salt, expiresAt }) {
      const cleanEmail = String(email).trim().toLowerCase();
      const otpHash = sha256(cleanEmail + ':' + otp + ':' + salt);
      db.prepare(`
        UPDATE pending_registrations 
        SET otp_hash = ?, otp_salt = ?, attempts = 0, resend_count = resend_count + 1, last_sent_at = ?, expires_at = ?
        WHERE email = ?
      `).run(otpHash, salt, now(), expiresAt, cleanEmail);
    },
    recordPendingAttempt(email) {
      const cleanEmail = String(email).trim().toLowerCase();
      db.prepare('UPDATE pending_registrations SET attempts = attempts + 1 WHERE email = ?').run(cleanEmail);
      const row = db.prepare('SELECT attempts, max_attempts FROM pending_registrations WHERE email = ?').get(cleanEmail);
      return row ? { attempts: row.attempts, max_attempts: row.max_attempts } : null;
    },
    deletePendingRegistration(email) {
      if (email) db.prepare('DELETE FROM pending_registrations WHERE email = ?').run(String(email).trim().toLowerCase());
    },
    verifyAndActivateUser(email, otp) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const pending = api.getPendingRegistration(cleanEmail);
      if (!pending) {
        return { ok: false, status: 400, error: 'Registration session not found or already verified. Please register again.' };
      }
      if (new Date(pending.expires_at) < new Date()) {
        api.deletePendingRegistration(cleanEmail);
        return { ok: false, status: 400, error: 'Verification code has expired. Please request a new code.' };
      }
      if (pending.attempts >= pending.max_attempts) {
        api.deletePendingRegistration(cleanEmail);
        return { ok: false, status: 429, error: 'Too many incorrect attempts. Registration cancelled. Please register again.' };
      }

      const expectedHash = sha256(cleanEmail + ':' + String(otp).trim() + ':' + pending.otp_salt);
      if (expectedHash !== pending.otp_hash) {
        api.recordPendingAttempt(cleanEmail);
        const remaining = pending.max_attempts - pending.attempts - 1;
        if (remaining <= 0) {
          api.deletePendingRegistration(cleanEmail);
          return { ok: false, status: 429, error: 'Too many incorrect attempts. Registration cancelled. Please register again.' };
        }
        return { ok: false, status: 400, error: `Incorrect verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` };
      }

      let user = api.findUserByEmail(cleanEmail);
      if (user) {
        const finalPwdHash = pending.password_hash || user.password_hash;
        const finalPhone = (pending.phone && pending.phone.trim()) || user.phone;
        const finalName = (pending.name && pending.name.trim()) || user.name;
        db.prepare('UPDATE users SET verified = 1, name = ?, phone = ?, password_hash = ?, updated_at = ? WHERE id = ?')
          .run(finalName, finalPhone, finalPwdHash, now(), user.id);
      } else {
        const id = 'usr_' + crypto.randomBytes(8).toString('hex');
        db.prepare('INSERT INTO users (id,email,name,password_hash,phone,google_id,role,verified,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)')
          .run(id, cleanEmail, pending.name, pending.password_hash, pending.phone, null, 'customer', now(), now());
        user = { id };
      }

      api.deletePendingRegistration(cleanEmail);
      return { ok: true, user: api.findUserById(user.id) };
    },
    validateCustomerPassword(email, password) {
      const u = api.findUserByEmail(email);
      const ok = verifyPassword(password, u && u.password_hash ? u.password_hash : hashPassword('x'));
      if (!u || !u.password_hash || !ok) return null;
      if (!u.password_hash.startsWith('scrypt$')) { // upgrade legacy hash
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), u.id);
      }
      return api.findUserById(u.id);
    },
    setPassword(userId, password) { db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(password), now(), userId); },
    // Google sign-in: only called with an identity the server has verified with Google.
    upsertGoogleCustomer({ email, name, googleId }) {
      const u = api.findUserByEmail(email);
      if (u) {
        if (u.google_id && googleId && u.google_id !== googleId) return null; // email belongs to a different Google identity
        db.prepare('UPDATE users SET google_id = COALESCE(google_id, ?), verified = 1, updated_at = ? WHERE id = ?').run(googleId, now(), u.id);
        return api.findUserById(u.id);
      }
      return api.createUser({ name: name || email.split('@')[0], email, password: null, googleId, verified: 1 });
    },
    updateProfile(userId, { name, phone, address }) {
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!u) return null;
      db.prepare('UPDATE users SET name = ?, phone = ?, address_json = ?, updated_at = ? WHERE id = ?')
        .run(name !== undefined ? name : u.name, phone !== undefined ? phone : u.phone,
          address !== undefined ? JSON.stringify(address) : u.address_json, now(), userId);
      return api.findUserById(userId);
    },
    listCustomers() {
      const done = DONE_STATUSES.map(() => '?').join(',');
      return db.prepare(`SELECT u.id,u.email,u.name,u.phone,u.created_at, (u.google_id IS NOT NULL) google,
          (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) orderCount,
          (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = u.id AND o.status IN (${done})) spent
        FROM users u ORDER BY u.created_at DESC`).all(...DONE_STATUSES)
        .map(r => ({ id: r.id, email: r.email, name: r.name, phone: r.phone || '', createdAt: r.created_at, google: !!r.google, orderCount: r.orderCount, totalSpent: r.spent }));
    },

    createCustomerSession(userId) {
      const token = 'cst_' + crypto.randomBytes(32).toString('hex');
      const t = Date.now();
      db.prepare('INSERT INTO customer_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)')
        .run(sha256(token), userId, new Date(t).toISOString(), new Date(t + 30 * 864e5).toISOString());
      return token;
    },
    validateCustomerSession(token) {
      if (!token) return null;
      const row = db.prepare('SELECT * FROM customer_sessions WHERE token_hash = ?').get(sha256(token));
      if (!row) return null;
      if (new Date(row.expires_at) < new Date()) { db.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').run(row.token_hash); return null; }
      return api.findUserById(row.user_id);
    },
    destroyCustomerSession(token) { if (token) db.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').run(sha256(token)); return true; },
    destroyAllCustomerSessions(userId) { db.prepare('DELETE FROM customer_sessions WHERE user_id = ?').run(userId); },

    // Permanently anonymise a customer account. Personal data (name, email, phone, address, credentials,
    // google_id) is overwritten with placeholder values so the row cannot be used to sign in. Orders and
    // order_events are kept for business records but no longer carry identifiable information.
    anonymizeCustomer(userId) {
      return tx(() => {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) return { ok: false, error: 'Account not found.' };
        if (user.role !== 'customer') return { ok: false, error: 'Only customer accounts can be deleted through this endpoint.' };
        const ghost = 'deleted_' + userId + '@deleted.invalid';
        db.prepare('UPDATE users SET email=?, name=?, password_hash=NULL, google_id=NULL, phone=NULL, address_json=NULL, verified=0, updated_at=? WHERE id=?')
          .run(ghost, '[Deleted Account]', now(), userId);
        db.prepare('DELETE FROM customer_sessions WHERE user_id=?').run(userId);
        db.prepare('DELETE FROM carts WHERE user_id=?').run(userId);
        try { db.prepare('DELETE FROM notifications WHERE user_id=?').run(userId); } catch (_) {}
        try { db.prepare('DELETE FROM pending_registrations WHERE email=?').run(user.email); } catch (_) {}
        try { db.prepare('DELETE FROM password_resets WHERE user_id=?').run(userId); } catch (_) {}
        return { ok: true };
      });
    },

    // ------------------------------------------------------------------ password reset
    createPasswordReset(userId) {
      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId);
      db.prepare('INSERT INTO password_resets (token_hash,user_id,expires_at) VALUES (?,?,?)')
        .run(sha256(token), userId, new Date(Date.now() + 3600e3).toISOString());
      return token;
    },
    consumePasswordReset(token, newPassword) {
      return tx(() => {
        const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(sha256(token || ''));
        if (!row || row.used_at || new Date(row.expires_at) < new Date()) return false;
        db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').run(now(), row.token_hash);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(newPassword), now(), row.user_id);
        db.prepare('DELETE FROM customer_sessions WHERE user_id = ?').run(row.user_id); // sign out everywhere
        return true;
      });
    },

    // ------------------------------------------------------------------ cart (per customer, server side)
    getCart(userId) {
      const r = db.prepare('SELECT data_json FROM carts WHERE user_id = ?').get(userId);
      const v = r ? safeParse(r.data_json, []) : [];
      return Array.isArray(v) ? v : [];
    },
    saveCart(userId, items) {
      db.prepare(`INSERT INTO carts (user_id,data_json,updated_at) VALUES (?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at`)
        .run(userId, JSON.stringify(items), now());
    },

    // ------------------------------------------------------------------ notifications
    createNotification({ recipientType, userId = null, orderNumber = null, title, message, type = 'info', link = null, data = null }) {
      const ins = db.prepare(`INSERT INTO notifications (recipient_type, user_id, order_number, title, message, type, link, is_read, created_at, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`);
      const res = ins.run(recipientType, userId || null, orderNumber || null, title, message, type, link || null, now(), data ? JSON.stringify(data) : null);
      const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(res.lastInsertRowid);
      const out = {
        id: notif.id,
        recipientType: notif.recipient_type,
        userId: notif.user_id,
        orderNumber: notif.order_number,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        link: notif.link,
        isRead: notif.is_read === 1,
        createdAt: notif.created_at,
        data: notif.data_json ? safeParse(notif.data_json, null) : null
      };
      try {
        eventHub.emit('notification:created', out);
      } catch (_) {}
      return out;
    },

    listNotificationsForCustomer(userId = null, orderNumber = null, limit = 50) {
      // A customer only ever sees notifications addressed to their own account. The order number can
      // narrow the list but never widen it (it used to OR-match, exposing other customers' notices).
      if (!userId) return [];
      let q = `SELECT * FROM notifications WHERE recipient_type = 'customer' AND user_id = ?`;
      const p = [userId];
      if (orderNumber) {
        q += ` AND order_number = ?`;
        p.push(normalizeOrderNum(orderNumber));
      }
      q += ` ORDER BY id DESC LIMIT ?`;
      p.push(limit);
      return db.prepare(q).all(...p).map(r => ({
        id: r.id,
        recipientType: r.recipient_type,
        userId: r.user_id,
        orderNumber: r.order_number,
        title: r.title,
        message: r.message,
        type: r.type,
        link: r.link,
        isRead: r.is_read === 1,
        createdAt: r.created_at
      }));
    },

    listNotificationsForAdmin(limit = 50) {
      return db.prepare(`SELECT * FROM notifications WHERE recipient_type = 'admin' ORDER BY id DESC LIMIT ?`).all(limit).map(r => ({
        id: r.id,
        recipientType: r.recipient_type,
        userId: r.user_id,
        orderNumber: r.order_number,
        title: r.title,
        message: r.message,
        type: r.type,
        link: r.link,
        isRead: r.is_read === 1,
        createdAt: r.created_at,
        data: r.data_json ? safeParse(r.data_json, null) : null
      }));
    },

    markNotificationRead(id, { recipientType = 'admin', userId = null } = {}) {
      if (recipientType === 'customer') {
        db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_type = 'customer' AND user_id = ?`).run(id, userId);
      } else {
        db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_type = 'admin'`).run(id);
      }
      return { ok: true };
    },

    markAllNotificationsRead(recipientType, userId = null) {
      if (recipientType === 'customer' && userId) {
        db.prepare(`UPDATE notifications SET is_read = 1 WHERE recipient_type = 'customer' AND user_id = ?`).run(userId);
      } else {
        db.prepare(`UPDATE notifications SET is_read = 1 WHERE recipient_type = ?`).run(recipientType);
      }
      return { ok: true };
    },

    unreadNotificationCount(recipientType, userId = null) {
      if (recipientType === 'customer' && userId) {
        return db.prepare(`SELECT COUNT(*) c FROM notifications WHERE recipient_type = 'customer' AND user_id = ? AND is_read = 0`).get(userId).c;
      }
      return db.prepare(`SELECT COUNT(*) c FROM notifications WHERE recipient_type = ? AND is_read = 0`).get(recipientType).c;
    },

    purgeExpired() {
      const t = now();
      db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(t);
      db.prepare('DELETE FROM customer_sessions WHERE expires_at < ?').run(t);
      db.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(t);
    }
  };
  payments.install(api, { db, tx, now, byNumber, eventHub, safeParse });
  api.receiptDir = path.join(DATA_DIR, 'payment-receipts'); // private: never served as a static file
  api.db = db;
  api.purgeExpired();
  return api;
}

function seedPhase2Catalog(db, nowFn) {
  const now = typeof nowFn === 'function' ? nowFn() : new Date().toISOString();
  const { PHASE2_CATEGORIES, PHASE2_FLOWERS, PHASE2_MATERIALS, PHASE2_BOUQUETS } = require('./phase2_catalog');

  // 1. Ensure the core categories exist. Insert-only: never rename or re-describe a row the admin owns.
  const insCat = db.prepare(`INSERT INTO categories (id,name,type,description,active,created_at,updated_at)
    VALUES (?,?,?,?,1,?,?)
    ON CONFLICT(id) DO NOTHING`);

  for (const cat of PHASE2_CATEGORIES) {
    try { insCat.run(cat.id, cat.name, cat.type, cat.description, now, now); } catch (_) {}
  }

  // The starter catalog is seeded ONCE. After that the database belongs to the admin: restarting the
  // server must never overwrite edited prices/names/descriptions or resurrect deleted products.
  const seededRow = db.prepare("SELECT value_json FROM shop_settings WHERE key = 'phase2_catalog'").get();
  let alreadySeeded = false;
  try { alreadySeeded = !!(seededRow && JSON.parse(seededRow.value_json).initialized); } catch (_) {}
  if (alreadySeeded) return;

  // 2. First-run seeding of flowers & materials (aligns any older starter rows with this catalog;
  //    preserves stock_count, uploaded images and supplier links). Runs only before initialization.
  const insFlower = db.prepare(`INSERT INTO flowers (id,name,botanical_name,category,price,availability,stock_count,description,image,color,item_type,style,archived,unit_cost,low_stock_threshold,unit_of_measure,updated_at,supplier_id,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, botanical_name=excluded.botanical_name, category=excluded.category,
      price=excluded.price, description=excluded.description,
      image=CASE WHEN excluded.image != '' THEN excluded.image ELSE flowers.image END,
      color=excluded.color, item_type=COALESCE(excluded.item_type, flowers.item_type),
      style=COALESCE(excluded.style, flowers.style),
      unit_cost=excluded.unit_cost, low_stock_threshold=excluded.low_stock_threshold,
      unit_of_measure=excluded.unit_of_measure,
      supplier_id=COALESCE(flowers.supplier_id, excluded.supplier_id),
      source=COALESCE(flowers.source, excluded.source),
      updated_at=excluded.updated_at`);

  const allInventoryItems = [...PHASE2_FLOWERS, ...PHASE2_MATERIALS];
  for (const item of allInventoryItems) {
    const existing = db.prepare('SELECT stock_count, availability, image, source, supplier_id FROM flowers WHERE id = ?').get(item.id);
    const stock = existing ? existing.stock_count : (item.stockCount || 0);
    const avail = existing ? existing.availability : (item.availability || 'sold_out');
    const img = existing && existing.image ? existing.image : (item.image || '');
    const supId = existing && existing.supplier_id ? existing.supplier_id : (item.supplierId || null);
    const src = (existing && existing.source && !existing.source.includes('Unverified')) ? existing.source : ((item.source && !item.source.includes('Unverified')) ? item.source : null);

    try {
      insFlower.run(
        item.id, item.name, item.botanicalName || '', item.category, item.price,
        avail, stock, item.description || '', img, item.color || '#f43f5e',
        item.itemType, item.style || '', item.unitCost || 20, item.lowStockThreshold || 5,
        item.unitOfMeasure, now, supId, src
      );
    } catch (_) {}
  }

  // 3. Ensure 32 Bouquets exist if not already in catalog (never overwrite admin edits on restart)
  const insBouquet = db.prepare(`INSERT INTO bouquets (id,name,category,occasion,price,description,image,formula,availability,specs_json,archived,updated_at,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?)
    ON CONFLICT(id) DO NOTHING`);

  for (const b of PHASE2_BOUQUETS) {
    const existing = db.prepare('SELECT image, availability, source FROM bouquets WHERE id = ?').get(b.id);
    const img = existing && existing.image ? existing.image : (b.image || '');
    const avail = existing ? existing.availability : (b.availability || 'sold_out');
    const src = (existing && existing.source && !existing.source.includes('Unverified')) ? existing.source : ((b.source && !b.source.includes('Unverified')) ? b.source : null);
    const specsJson = b.specs ? JSON.stringify(b.specs) : null;

    try {
      insBouquet.run(
        b.id, b.name, b.category, b.occasion, b.price, b.description || '',
        img, b.formula || '', avail, specsJson, now, src
      );
    } catch (_) {}
  }

  try {
    db.prepare(`INSERT OR IGNORE INTO shop_settings (key, value_json, updated_at) VALUES ('phase2_catalog', ?, ?)`)
      .run(JSON.stringify({ initialized: true, bouquets: PHASE2_BOUQUETS.length, initialized_at: now }), now);
  } catch (_) {}
}

module.exports = open();
module.exports.open = open;
module.exports.initDb = (db) => open(db);
module.exports.seedPhase2Catalog = seedPhase2Catalog;
module.exports.seedPhilippineStarterCatalog = seedPhase2Catalog;
module.exports.hashPassword = hashPassword;
module.exports.verifyPassword = verifyPassword;
