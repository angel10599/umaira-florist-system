// Async database client — drop-in replacement for node:sqlite DatabaseSync.
// Uses @libsql/client (Turso) for cloud persistence; falls back to a local SQLite file in dev.
// AsyncLocalStorage propagates the active transaction handle automatically, so code nested inside
// db.transaction() callbacks gets the correct executor without any explicit wiring.
const { createClient } = require('@libsql/client');
const { AsyncLocalStorage } = require('node:async_hooks');
const path = require('path');

const DATA_DIR = process.env.UMAIRA_DATA_DIR || path.join(__dirname, '..', 'data');
const txStorage = new AsyncLocalStorage();
const postCommitStorage = new AsyncLocalStorage();

let _client = null;

function getClient() {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL || `file:${path.join(DATA_DIR, 'umaira.db')}`;
    _client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
      syncInterval: process.env.TURSO_DATABASE_URL ? 60 : undefined,
    });
  }
  return _client;
}

/** Closes the client (used by tests) */
function close() {
  if (_client) { try { _client.close(); } catch (_) {} _client = null; }
}

/** Override for tests */
function _setClient(c) { _client = c; }

function getExecutor() {
  return txStorage.getStore() || getClient();
}

function toPlain(row, cols) {
  if (!row) return null;
  const obj = {};
  for (let i = 0; i < cols.length; i++) {
    const v = row[i];
    // @libsql/client returns SQLite INTEGER values as BigInt; convert to Number for JSON safety.
    obj[cols[i]] = typeof v === 'bigint' ? Number(v) : v;
  }
  return obj;
}

// Drop-in for DatabaseSync.prepare() — returns an object with async get/all/run methods.
// await is placed on the terminal .get/.all/.run call, NOT on prepare() itself.
function prepare(sql) {
  return {
    async get(...args) {
      const a = args.flat().filter(x => x !== undefined);
      const r = await getExecutor().execute({ sql, args: a });
      return r.rows.length > 0 ? toPlain(r.rows[0], r.columns) : null;
    },
    async all(...args) {
      const a = args.flat().filter(x => x !== undefined);
      const r = await getExecutor().execute({ sql, args: a });
      return r.rows.map(row => toPlain(row, r.columns));
    },
    async run(...args) {
      const a = args.flat().filter(x => x !== undefined);
      const r = await getExecutor().execute({ sql, args: a });
      return {
        lastInsertRowid: r.lastInsertRowid ? Number(r.lastInsertRowid) : 0,
        changes: r.rowsAffected || 0,
      };
    },
  };
}

// Split a multi-statement SQL string into individual statements.
// Handles: single-line comments (--), string literals ('…'), and BEGIN…END trigger bodies.
function splitStatements(sql) {
  const stmts = [];
  let cur = '';
  let inString = false;
  let stringChar = '';
  let depth = 0; // tracks BEGIN...END nesting for trigger bodies
  // Strip single-line comments first
  sql = sql.replace(/--[^\n]*/g, '');
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (inString) {
      cur += c;
      if (c === stringChar) {
        // SQLite escapes a quote by doubling it inside a string
        if (sql[i + 1] === stringChar) { cur += sql[++i]; } else { inString = false; }
      }
    } else if (c === "'" || c === '"' || c === '`') {
      inString = true; stringChar = c; cur += c;
    } else if (/^BEGIN\b/i.test(sql.slice(i))) {
      depth++; cur += c;
    } else if (/^END\b/i.test(sql.slice(i)) && depth > 0) {
      depth--; cur += c;
    } else if (c === ';' && depth === 0) {
      const stmt = cur.trim();
      if (stmt) stmts.push(stmt);
      cur = '';
    } else {
      cur += c;
    }
  }
  const remaining = cur.trim();
  if (remaining) stmts.push(remaining);
  return stmts;
}

// Drop-in for DatabaseSync.exec() — handles multi-statement DDL including CREATE TRIGGER.
// Not safe inside a transaction (Turso doesn't support DDL mid-transaction).
async function exec(multiSql) {
  const executor = getExecutor();
  for (const stmt of splitStatements(multiSql)) {
    await executor.execute(stmt);
  }
}

// Queue fn to run after the current transaction commits (or immediately if not in a transaction).
function runAfterTransaction(fn) {
  const hooks = postCommitStorage.getStore();
  if (hooks) {
    hooks.push(fn);
  } else {
    Promise.resolve().then(fn).catch(e => console.error('[post-commit]', e));
  }
}

// Run fn inside a write transaction.
// AsyncLocalStorage propagates txCtx to all nested db.prepare/exec calls automatically.
async function transaction(fn) {
  const postCommitHooks = [];
  const txCtx = await getClient().transaction('write');
  try {
    const result = await txStorage.run(txCtx, () => postCommitStorage.run(postCommitHooks, fn));
    await txCtx.commit();
    for (const hook of postCommitHooks) {
      hook().catch(e => console.error('[post-commit hook]', e));
    }
    return result;
  } catch (e) {
    try { await txCtx.rollback(); } catch (_) {}
    throw e;
  }
}

module.exports = { prepare, exec, transaction, close, _setClient, getClient, runAfterTransaction };
