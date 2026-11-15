// Comprehensive test suite for Umaira Florist Customer Registration, OTP Verification, and Login Security
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const iso = require('./helpers/isolated-db');

let base;
let pass = 0, fail = 0;
const failures = [];

async function call(method, p, body, token, hdr = {}) {
  const r = await fetch(base + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...hdr
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data;
  const t = await r.text();
  try { data = JSON.parse(t); } catch (e) { data = t; }
  return { status: r.status, data, headers: r.headers };
}

function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ok   ' + name);
  } else {
    fail++;
    failures.push(name);
    console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''));
  }
}

async function run() {
  const s = await iso.startServer();
  base = s.base;
  const store = require('../server/store');

  console.log('\n============================================================');
  console.log('UMAIRA FLORIST AUTHENTICATION & OTP SECURITY TEST SUITE');
  console.log('============================================================');

  // =========================================================================
  // 1. REGISTRATION VALIDATION TESTS
  // =========================================================================
  console.log('\n[1] Registration Field Validation');

  // Missing Full Name
  let r = await call('POST', '/api/auth/register', {
    phone: '09171234567',
    email: 'user1@example.ph',
    password: 'Password123'
  });
  check('Missing Full Name is rejected (400)', r.status === 400 && r.data.field === 'name', r.data);

  // Missing Mobile Number
  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    email: 'user1@example.ph',
    password: 'Password123'
  });
  check('Missing Mobile Number is rejected (400)', r.status === 400 && r.data.field === 'phone', r.data);

  // Missing Email Address
  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    phone: '09171234567',
    password: 'Password123'
  });
  check('Missing Email Address is rejected (400)', r.status === 400 && r.data.field === 'email', r.data);

  // Missing Password
  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    phone: '09171234567',
    email: 'user1@example.ph'
  });
  check('Missing Password is rejected (400)', r.status === 400 && r.data.field === 'password', r.data);

  // Inputs containing only spaces
  r = await call('POST', '/api/auth/register', {
    name: '   ',
    phone: '09171234567',
    email: 'user1@example.ph',
    password: 'Password123'
  });
  check('Name with only spaces rejected (400)', r.status === 400 && r.data.field === 'name', r.data);

  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    phone: '    ',
    email: 'user1@example.ph',
    password: 'Password123'
  });
  check('Phone with only spaces rejected (400)', r.status === 400 && r.data.field === 'phone', r.data);

  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    phone: '09171234567',
    email: '   ',
    password: 'Password123'
  });
  check('Email with only spaces rejected (400)', r.status === 400 && r.data.field === 'email', r.data);

  // Invalid email format
  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    phone: '09171234567',
    email: 'not-an-email',
    password: 'Password123'
  });
  check('Invalid email format rejected (400)', r.status === 400 && r.data.field === 'email', r.data);

  // Invalid Philippine mobile number
  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    phone: '12345',
    email: 'user1@example.ph',
    password: 'Password123'
  });
  check('Short/invalid phone number rejected (400)', r.status === 400 && r.data.field === 'phone', r.data);

  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    phone: '08123456789', // Not a PH 09xx prefix
    email: 'user1@example.ph',
    password: 'Password123'
  });
  check('Non-Philippine prefix mobile rejected (400)', r.status === 400 && r.data.field === 'phone', r.data);

  // Password shorter than 8 characters
  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    phone: '09171234567',
    email: 'user1@example.ph',
    password: '1234567'
  });
  check('Password shorter than 8 chars rejected (400)', r.status === 400 && r.data.field === 'password', r.data);

  // Valid registration proceeds to OTP
  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    phone: '+63 917 123 4567',
    email: 'maria@example.ph',
    password: 'Password123'
  });
  check('Valid 4 fields return 200 with requiresVerification: true', r.status === 200 && r.data.requiresVerification === true, r.data);
  const otp1 = r.data.testOtp;
  check('6-digit OTP generated', /^\d{6}$/.test(otp1), otp1);

  // User account is NOT created before OTP verification
  const preCheckUser = store.findUserByEmail('maria@example.ph');
  check('User record is not active before OTP verification', !preCheckUser || preCheckUser.verified === 0);

  // =========================================================================
  // 2. EMAIL VERIFICATION & OTP SECURITY TESTS
  // =========================================================================
  console.log('\n[2] Email Verification & OTP Safeguards');

  // Incorrect OTP
  r = await call('POST', '/api/auth/verify-otp', {
    email: 'maria@example.ph',
    otp: '000000'
  });
  check('Incorrect OTP rejected (400)', r.status === 400 && r.data.error.includes('Incorrect verification code'), r.data);

  // Malformed OTP format (not 6 digits)
  r = await call('POST', '/api/auth/verify-otp', {
    email: 'maria@example.ph',
    otp: 'abc'
  });
  check('Non-digit OTP rejected (400)', r.status === 400);

  // Test Attempt Limit (Max 5 attempts)
  for (let i = 0; i < 4; i++) {
    r = await call('POST', '/api/auth/verify-otp', { email: 'maria@example.ph', otp: '111111' });
  }
  check('Exceeding 5 attempts restricts registration session (429)', r.status === 429 && r.data.error.includes('Too many incorrect attempts'), r.data);

  // Pending session should be invalidated after max attempts
  const pendingAfterLockout = store.getPendingRegistration('maria@example.ph');
  check('Pending registration purged upon exceeding attempts', pendingAfterLockout === null || pendingAfterLockout === undefined);

  // Re-register to test Resend OTP cooldown and expiration
  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    phone: '09171234567',
    email: 'maria@example.ph',
    password: 'Password123'
  });
  check('Can re-register after invalidation', r.status === 200 && r.data.requiresVerification);
  const otp2 = r.data.testOtp;

  // Immediate Resend OTP hit with 60-second cooldown
  r = await call('POST', '/api/auth/resend-otp', { email: 'maria@example.ph' });
  check('Immediate resend triggers 60s cooldown (429)', r.status === 429 && r.data.cooldownSeconds > 0, r.data);

  // Simulate OTP Expiration by manually modifying expires_at in DB
  const pending = store.getPendingRegistration('maria@example.ph');
  check('Pending registration exists in database', !!pending);
  check('OTP stored as salted hash, never plaintext in DB', pending.otp_hash && !pending.otp_hash.includes(otp2));

  // Expire the OTP in DB
  const past = new Date(Date.now() - 10000).toISOString();
  store.db.prepare('UPDATE pending_registrations SET expires_at = ? WHERE email = ?').run(past, 'maria@example.ph');

  r = await call('POST', '/api/auth/verify-otp', { email: 'maria@example.ph', otp: otp2 });
  check('Expired OTP is rejected (400)', r.status === 400 && r.data.error.includes('expired'), r.data);

  // Re-register to test Successful Verification
  r = await call('POST', '/api/auth/register', {
    name: 'Maria Clara',
    phone: '09171234567',
    email: 'maria@example.ph',
    password: 'Password123'
  });
  const otp3 = r.data.testOtp;

  // Verify with correct OTP
  r = await call('POST', '/api/auth/verify-otp', { email: 'maria@example.ph', otp: otp3 });
  check('Verification with correct OTP succeeds (201)', r.status === 201 && r.data.ok === true && r.data.token, r.data);
  check('User is now verified in DB', r.data.user && r.data.user.verified === true);
  const mariaToken = r.data.token;
  const mariaId = r.data.user.id;

  // Reused OTP must fail
  r = await call('POST', '/api/auth/verify-otp', { email: 'maria@example.ph', otp: otp3 });
  check('Reusing already-verified OTP fails (400)', r.status === 400, r.data);

  // Duplicate registration for already-verified email must fail
  r = await call('POST', '/api/auth/register', {
    name: 'Maria Duplicate',
    phone: '09181112233',
    email: 'MARIA@EXAMPLE.PH',
    password: 'AnotherPassword123'
  });
  check('Duplicate registration for verified account blocked (409)', r.status === 409, r.data);

  // =========================================================================
  // 3. LOGIN SECURITY & RESTRICTION TESTS
  // =========================================================================
  console.log('\n[3] Login Security & Restrictions');

  // Correct credentials for verified account
  r = await call('POST', '/api/auth/login', { email: 'maria@example.ph', password: 'Password123' });
  check('Login succeeds for verified account (200)', r.status === 200 && r.data.user.id === mariaId, r.data);

  // Incorrect password
  r = await call('POST', '/api/auth/login', { email: 'maria@example.ph', password: 'WrongPassword' });
  check('Incorrect password rejected (401)', r.status === 401 && r.data.error === 'Invalid email or password.', r.data);

  // Nonexistent email
  r = await call('POST', '/api/auth/login', { email: 'nonexistent@example.ph', password: 'Password123' });
  check('Nonexistent email rejected (401)', r.status === 401 && r.data.error === 'Invalid email or password.', r.data);

  // Unverified account login restriction
  // Create an unverified user in DB
  const unverifiedId = 'usr_' + crypto.randomBytes(8).toString('hex');
  store.db.prepare('INSERT INTO users (id, email, name, password_hash, phone, role, verified, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(unverifiedId, 'unverified@example.ph', 'Unverified User', store.hashPassword('Secret1234'), '09170000000', 'customer', 0, new Date().toISOString(), new Date().toISOString());

  r = await call('POST', '/api/auth/login', { email: 'unverified@example.ph', password: 'Secret1234' });
  check('Unverified account is blocked from login (403)', r.status === 403 && r.data.unverified === true, r.data);

  // Resend OTP for existing unverified account and verify it
  r = await call('POST', '/api/auth/resend-otp', { email: 'unverified@example.ph' });
  check('Can resend OTP for existing unverified account', r.status === 200 && r.data.testOtp, r.data);
  const unverifiedOtp = r.data.testOtp;

  r = await call('POST', '/api/auth/verify-otp', { email: 'unverified@example.ph', otp: unverifiedOtp });
  check('Verifying OTP activates the existing account', r.status === 201 && r.data.user.verified === true);

  // Now login succeeds
  r = await call('POST', '/api/auth/login', { email: 'unverified@example.ph', password: 'Secret1234' });
  check('Now login succeeds after verification (200)', r.status === 200 && r.data.user.id === unverifiedId);

  // =========================================================================
  // 4. GOOGLE SIGN-IN INTEGRATION & SECURITY
  // =========================================================================
  console.log('\n[4] Google Sign-In Functionality & Trust Flow');

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-kid-auth', alg: 'RS256', use: 'sig' };
  const app = require('../server.js');
  app.googleKeyFetcher = async () => [jwk];

  function mintJwt(payload) {
    const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = b({ alg: 'RS256', kid: 'test-kid-auth', typ: 'JWT' }), body = b(payload);
    return `${head}.${body}.${crypto.sign('RSA-SHA256', Buffer.from(head + '.' + body), privateKey).toString('base64url')}`;
  }

  // Google Sign-In with verified Google identity automatically sets verified = 1
  const googleToken = mintJwt({
    iss: 'https://accounts.google.com',
    aud: process.env.GOOGLE_CLIENT_ID,
    sub: 'google-sub-999',
    email: 'googleuser@example.com',
    email_verified: true,
    name: 'Google Customer',
    exp: Math.floor(Date.now() / 1000) + 600
  });

  r = await call('POST', '/api/auth/google', { credential: googleToken });
  check('Google Sign-In succeeds (200)', r.status === 200 && r.data.user.verified === true, r.data);

  // Unverified Google email rejected
  const unverifiedGoogleToken = mintJwt({
    iss: 'https://accounts.google.com',
    aud: process.env.GOOGLE_CLIENT_ID,
    sub: 'google-sub-bad',
    email: 'unverifiedgoogle@example.com',
    email_verified: false,
    name: 'Fake Customer',
    exp: Math.floor(Date.now() / 1000) + 600
  });
  r = await call('POST', '/api/auth/google', { credential: unverifiedGoogleToken });
  check('Unverified Google email rejected (401)', r.status === 401);

  // =========================================================================
  // 4b. GOOGLE LOGIN EMAIL NOTIFICATION
  // =========================================================================
  console.log('\n[4b] Google Login Email Notification');

  // Intercept mailer to capture outgoing notification calls without real delivery
  const mailer = require('../server/mailer');
  const loginNotifications = [];
  const origSend = mailer.sendGoogleLoginNotification.bind(mailer);
  mailer.sendGoogleLoginNotification = async function (opts) {
    loginNotifications.push(opts);
    // In test mode mailer.send already short-circuits — this just records the call
    return origSend(opts);
  };

  // Successful Google sign-in should trigger exactly one notification
  const notifToken = mintJwt({
    iss: 'https://accounts.google.com',
    aud: process.env.GOOGLE_CLIENT_ID,
    sub: 'google-sub-notif',
    email: 'notifuser@example.com',
    email_verified: true,
    name: 'Notif Customer',
    exp: Math.floor(Date.now() / 1000) + 600
  });
  loginNotifications.length = 0; // reset collector
  r = await call('POST', '/api/auth/google', { credential: notifToken });
  check('Successful Google sign-in returns 200', r.status === 200);
  // Give the fire-and-forget one tick to run
  await new Promise(resolve => setImmediate(resolve));
  check('Exactly one login notification sent on successful Google sign-in', loginNotifications.length === 1);
  check('Notification sent to the authenticated account email', loginNotifications[0] && loginNotifications[0].to === 'notifuser@example.com');
  check('Notification carries correct customer name', loginNotifications[0] && loginNotifications[0].name === 'Notif Customer');

  // Failed Google sign-in must NOT send a notification
  loginNotifications.length = 0;
  r = await call('POST', '/api/auth/google', { credential: 'bad.token.value' });
  check('Invalid Google token returns 401', r.status === 401);
  await new Promise(resolve => setImmediate(resolve));
  check('No notification sent for failed Google sign-in', loginNotifications.length === 0);

  // Unverified email attempt must NOT send a notification
  loginNotifications.length = 0;
  r = await call('POST', '/api/auth/google', { credential: unverifiedGoogleToken });
  await new Promise(resolve => setImmediate(resolve));
  check('No notification sent for unverified Google email', loginNotifications.length === 0);

  // Restore original function
  mailer.sendGoogleLoginNotification = origSend;

  // =========================================================================
  // 5. ACCOUNT DELETION (ANONYMIZATION)
  // =========================================================================
  console.log('\n[5] Customer Account Deletion');

  // Set up a fresh account to delete (created directly via store to bypass HTTP rate limiting)
  const delUser = store.createUser({ name: 'Del User', email: 'deltest@umaira.local', password: 'DelPass99', phone: '09171112222', verified: 1 });
  const delToken = store.createCustomerSession(delUser.id);
  const delId = delUser.id;
  check('Delete test account created and has id', Boolean(delId));

  // Unauthenticated request must fail
  r = await call('DELETE', '/api/auth/me', { password: 'DelPass99' });
  check('Unauthenticated DELETE /api/auth/me returns 401', r.status === 401);

  // Wrong password must fail without deleting
  r = await call('DELETE', '/api/auth/me', { password: 'WrongPassword!' }, delToken);
  check('Wrong password returns 401 and does not delete', r.status === 401);
  r = await call('POST', '/api/auth/login', { email: 'deltest@umaira.local', password: 'DelPass99' });
  check('Account still intact after wrong password attempt', r.status === 200);

  // Correct password deletes account
  r = await call('DELETE', '/api/auth/me', { password: 'DelPass99' }, delToken);
  check('Correct password returns 200 ok', r.status === 200 && r.data.ok === true);

  // Session is now invalid
  r = await call('GET', '/api/auth/me', null, delToken);
  check('Old token is rejected after deletion (401)', r.status === 401);

  // Cannot log in with deleted account
  r = await call('POST', '/api/auth/login', { email: 'deltest@umaira.local', password: 'DelPass99' });
  check('Login with deleted email is rejected', r.status === 401 || r.status === 400);

  // Inspect the anonymised row directly
  const ghostUser = store.db.prepare('SELECT * FROM users WHERE id = ?').get(delId);
  check('Ghost user row exists in DB', Boolean(ghostUser));
  check('Ghost email is anonymised', ghostUser && ghostUser.email === 'deleted_' + delId + '@deleted.invalid');
  check('Ghost name is [Deleted Account]', ghostUser && ghostUser.name === '[Deleted Account]');
  check('Ghost password_hash is NULL', ghostUser && ghostUser.password_hash === null);
  check('Ghost google_id is NULL', ghostUser && ghostUser.google_id === null);
  check('Ghost verified is 0', ghostUser && ghostUser.verified === 0);

  // Google-only account deletion: re-confirm with email
  const googleGhostToken = mintJwt({
    iss: 'https://accounts.google.com',
    aud: process.env.GOOGLE_CLIENT_ID,
    sub: 'google-sub-del',
    email: 'gdel@example.com',
    email_verified: true,
    name: 'Google Delete',
    exp: Math.floor(Date.now() / 1000) + 600
  });
  r = await call('POST', '/api/auth/google', { credential: googleGhostToken });
  check('Google-only account created for deletion test', r.status === 200 || r.status === 201);
  const gDelToken = r.data.token;

  // Wrong email confirmation
  r = await call('DELETE', '/api/auth/me', { confirmEmail: 'wrong@example.com' }, gDelToken);
  check('Wrong email confirmation for Google account returns 400', r.status === 400);

  // Correct email confirmation
  r = await call('DELETE', '/api/auth/me', { confirmEmail: 'gdel@example.com' }, gDelToken);
  check('Correct email confirmation deletes Google-only account (200)', r.status === 200 && r.data.ok === true);

  // anonymizeCustomer returns ok:false for a nonexistent user
  const adminResult = store.anonymizeCustomer('nonexistent-id-xyz');
  check('anonymizeCustomer returns ok:false for nonexistent user', adminResult.ok === false);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n============================================================');
  console.log(`AUTH SECURITY TEST RESULTS: ${pass} passed, ${fail} failed`);
  console.log('============================================================\n');

  iso.stopServer();

  if (fail > 0) {
    console.error('FAILURES:');
    failures.forEach(f => console.error(' - ' + f));
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Unexpected test error:', err);
  process.exit(1);
});

