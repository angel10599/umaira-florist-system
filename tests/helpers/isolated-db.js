// Gives a test its own throw-away database and uploads folder, so it can never change the shop's
// real records (data/umaira.db) or add files to assets/uploads.
//
// Require this FIRST — before server.js or server/store.js:
//   const iso = require('./helpers/isolated-db');        // from tests/
//   const iso = require('../tests/helpers/isolated-db'); // from scripts/
//   const { base } = await iso.startServer();            // own server on a free port (never :3000)
const os = require('os');
const fs = require('fs');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umaira-test-'));
const uploadDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

process.env.UMAIRA_DATA_DIR = dataDir;
process.env.UMAIRA_UPLOAD_DIR = uploadDir;
process.env.UMAIRA_TEST = '1';
// Never reach the live Turso database from a test, whatever .env contains (empty values are not overridden by .env).
process.env.TURSO_DATABASE_URL = '';
process.env.TURSO_AUTH_TOKEN = '';
// A fresh database gets an 'admin' account with this password. Values set here are never
// overridden by .env (server.js loads .env without replacing existing variables).
if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = 'Test-Admin-Pass-1';
process.env.MAIL_WEBHOOK_URL = ''; // tests never send real email

let started = null;
async function startServer() {
  if (!started) {
    const server = await require('../../server.js').start(0);
    const port = server.address().port;
    started = { server, port, base: `http://127.0.0.1:${port}` };
  }
  return started;
}

function stopServer() {
  if (!started) return;
  try { started.server.closeAllConnections(); } catch (_) {}
  started.server.close();
}

process.on('exit', () => {
  // Close the temporary database first (Windows cannot delete an open file), then remove it.
  const storeModule = require.cache[require.resolve('../../server/store.js')];
  try { if (storeModule && storeModule.exports.db) storeModule.exports.db.close(); } catch (_) {}
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) {}
});

module.exports = {
  dataDir,
  uploadDir,
  dbPath: path.join(dataDir, 'umaira.db'),
  adminPassword: process.env.ADMIN_PASSWORD,
  startServer,
  stopServer,
};
