-- Umaira Florist database schema (SQLite). Applied automatically by server/store.js on start-up.
-- All statements are idempotent (IF NOT EXISTS). Column additions for older databases are handled
-- by the migration list in server/store.js.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT,
  phone TEXT,
  google_id TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer')),
  verified INTEGER NOT NULL DEFAULT 0,
  address_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

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
CREATE INDEX IF NOT EXISTS idx_pending_reg_email ON pending_registrations(email);

CREATE TABLE IF NOT EXISTS admin_users (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'Administrator',
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Session tokens are stored as SHA-256 hashes, never in clear text.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS carts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS flowers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  botanical_name TEXT,
  category TEXT,
  price REAL NOT NULL CHECK (price >= 0),
  availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available','limited','sold_out','unavailable')),
  stock_count INTEGER NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  description TEXT,
  image TEXT,
  color TEXT,
  item_type TEXT NOT NULL DEFAULT 'flower',
  style TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS bouquets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  occasion TEXT,
  price REAL NOT NULL CHECK (price >= 0),
  description TEXT,
  image TEXT,
  formula TEXT,
  availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available','limited','sold_out','unavailable')),
  stock_count INTEGER NOT NULL DEFAULT 10 CHECK (stock_count >= 0),
  archived INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  fulfillment_type TEXT NOT NULL,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  phone TEXT NOT NULL, email TEXT NOT NULL,
  address TEXT, district TEXT, barangay TEXT, city TEXT, notes TEXT,
  schedule_date TEXT NOT NULL, schedule_time TEXT NOT NULL,
  payment_method TEXT NOT NULL, payment_status TEXT NOT NULL,
  gift_message TEXT,
  grab_tracking_url TEXT,
  reject_reason TEXT,
  stock_restored INTEGER NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL, delivery_fee REAL NOT NULL, total REAL NOT NULL,
  pod_photo_url TEXT,
  pod_delivered_at TEXT,
  pod_admin TEXT,
  pod_notes TEXT,
  customer_confirmation_status TEXT DEFAULT 'pending',
  customer_confirmed_at TEXT,
  customer_dispute_reason TEXT,
  customer_dispute_photo_url TEXT,
  dispute_resolved_at TEXT,
  dispute_resolution_notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  bouquet_name TEXT, item_type TEXT NOT NULL, item_id TEXT, name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL, line_total REAL NOT NULL, card_message TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  origin TEXT,
  categories_json TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL COLLATE NOCASE,
  type TEXT NOT NULL DEFAULT 'both',
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flower_id TEXT NOT NULL REFERENCES flowers(id),
  transaction_type TEXT NOT NULL,
  quantity_change INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  unit_cost REAL,
  reason TEXT,
  supplier_id TEXT REFERENCES suppliers(id),
  order_number TEXT,
  admin_username TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shop_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_trans_flower ON stock_transactions(flower_id);
CREATE INDEX IF NOT EXISTS idx_stock_trans_created ON stock_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_order ON notifications(order_number);
