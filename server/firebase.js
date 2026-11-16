const path = require('path');

let firebaseDb = null;
let firebaseAuth = null;

function loadServiceAccount() {
  const root = path.join(__dirname, '..');
  const candidates = [
    path.join(root, 'serviceAccountKey.json'),
    path.join(root, 'config', 'firebase-service-account.json'),
  ];
  for (const p of candidates) {
    try { return require(p); } catch (_) {}
  }
  throw new Error(
    'Firebase service account key not found. ' +
    'Download it from Firebase Console → Project Settings → Service Accounts → ' +
    '"Generate new private key" and save it as serviceAccountKey.json in the project root.'
  );
}

try {
  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getAuth } = require('firebase-admin/auth');
  const serviceAccount = loadServiceAccount();
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  firebaseDb = getFirestore();
  firebaseDb.settings({ ignoreUndefinedProperties: true });
  firebaseAuth = getAuth();
} catch (e) {
  console.warn('[firebase] Init skipped:', e.message);
}

module.exports = {
  db: firebaseDb,
  auth: firebaseAuth,
};