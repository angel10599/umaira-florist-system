// Fire-and-forget Firestore sync. SQLite is the primary read/write store; Firestore is the cloud
// backup. Every sync function returns a Promise and must be called with .catch() — a Firestore
// failure must never block or crash the main request.
const { db } = require('./firebase');

// Test runs use a throw-away database and must never write to the live Firestore backup.
function enabled() { return !!db && process.env.UMAIRA_TEST !== '1'; }

async function syncUser(user) {
  if (!enabled() || !user || !user.id) return;
  const doc = {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone || null,
    googleId: user.google_id || null,
    role: user.role,
    verified: !!user.verified,
    createdAt: user.created_at,
    updatedAt: user.updated_at || null,
  };
  await db.collection('users').doc(user.id).set(doc, { merge: true });
}

async function syncFlower(flower) {
  if (!enabled() || !flower || !flower.id) return;
  await db.collection('flowers').doc(flower.id).set(flower, { merge: true });
}

async function syncBouquet(bouquet) {
  if (!enabled() || !bouquet || !bouquet.id) return;
  await db.collection('bouquets').doc(bouquet.id).set(bouquet, { merge: true });
}

async function syncOrder(order) {
  if (!enabled() || !order || !order.orderNumber) return;
  await db.collection('orders').doc(order.orderNumber).set(order, { merge: true });
}

async function syncSetting(key, value) {
  if (!enabled() || !key) return;
  await db.collection('settings').doc(key).set({ key, value, updatedAt: new Date().toISOString() });
}

module.exports = { syncUser, syncFlower, syncBouquet, syncOrder, syncSetting, enabled };
