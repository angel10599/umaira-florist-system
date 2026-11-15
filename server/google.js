// Verifies a Google Sign-In ID token (RS256 JWT) against Google's public signing keys.
// Nothing is trusted from the token until the signature, issuer, audience and expiry all check out.
const crypto = require('crypto');
const https = require('https');

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let cache = { keys: null, until: 0 };

function fetchJwks() {
  return new Promise((resolve, reject) => {
    https.get(JWKS_URL, { timeout: 5000 }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const m = /max-age=(\d+)/.exec(res.headers['cache-control'] || '');
          resolve({ keys: JSON.parse(b).keys, ttl: m ? Number(m[1]) * 1000 : 3600e3 });
        } catch (e) { reject(e); }
      });
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')); });
  });
}

async function getKeys(fetchKeys) {
  if (fetchKeys) return fetchKeys();
  if (cache.keys && Date.now() < cache.until) return cache.keys;
  const { keys, ttl } = await fetchJwks();
  cache = { keys, until: Date.now() + ttl };
  return keys;
}

const b64 = (s) => Buffer.from(s, 'base64url');

async function verifyIdToken(idToken, { clientId, fetchKeys } = {}) {
  if (!clientId) throw new Error('Google sign-in is not configured on this server.');
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed Google credential.');
  const header = JSON.parse(b64(parts[0]).toString('utf8'));
  const payload = JSON.parse(b64(parts[1]).toString('utf8'));
  if (header.alg !== 'RS256') throw new Error('Unsupported token algorithm.');

  const jwk = (await getKeys(fetchKeys)).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown signing key.');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]),
    crypto.createPublicKey({ key: jwk, format: 'jwk' }), b64(parts[2]));
  if (!ok) throw new Error('Bad token signature.');

  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) throw new Error('Wrong token issuer.');
  if (payload.aud !== clientId) throw new Error('Token was issued for a different app.');
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error('Token has expired.');
  if (!payload.sub || !payload.email) throw new Error('Token has no account identity.');
  if (payload.email_verified !== true && payload.email_verified !== 'true') throw new Error('Google email is not verified.');
  return { googleId: payload.sub, email: String(payload.email).toLowerCase(), name: payload.name || payload.given_name || '' };
}

module.exports = { verifyIdToken };
