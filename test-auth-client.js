const fs = require('fs');
const path = require('path');

global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.window.location = {
  port: '5500',
  hostname: '127.0.0.1',
  protocol: 'http:',
  hash: '#auth'
};

const storage = {};
global.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};
global.window.localStorage = global.localStorage;

global.document = {
  readyState: 'complete',
  visibilityState: 'visible',
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => null,
  body: { setAttribute: () => {}, style: {} },
  head: { appendChild: () => {} },
  createElement: () => ({ style: {}, classList: { add: () => {} } })
};

// Mock fetch to simulate real backend responses on port 3000
window.fetch = async (url, opts = {}) => {
  const parsedUrl = new URL(url, 'http://127.0.0.1:3000');
  const pathname = parsedUrl.pathname;
  const body = opts.body ? JSON.parse(opts.body) : {};

  if (pathname === '/api/auth/register') {
    if (body.email === 'duplicate@example.ph') {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: 'An account with this email address already exists. Please log in.' })
      };
    }
    return {
      ok: true,
      status: 201,
      json: async () => ({
        user: { id: 'cst_' + Date.now(), name: body.name, email: body.email, role: 'customer' },
        token: 'cst_tok_' + Date.now()
      })
    };
  }

  if (pathname === '/api/auth/login') {
    if (body.email === 'test@example.ph' && body.password === 'secret123') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          user: { id: 'cst_123', name: 'Test User', email: body.email, role: 'customer' },
          token: 'cst_tok_123'
        })
      };
    }
    return {
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid email or password.' })
    };
  }

  return { ok: true, status: 200, json: async () => ({}) };
};

// Load dependencies
function loadScript(filePath) {
  const code = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  window.eval(code);
}

loadScript('js/data.js');
loadScript('js/state.js');

console.log('Testing Client Auth & Registration...');

async function run() {
  const state = window.appState;

  // 1. Validation tests
  const emptyName = await state.register({ fullName: ' ', email: 'valid@example.com', password: 'password123' });
  if (emptyName.ok || !emptyName.error.includes('full name')) {
    throw new Error('Validation failed on empty name: ' + JSON.stringify(emptyName));
  }
  console.log('OK: Full name validation verified');

  const invalidEmail = await state.register({ fullName: 'John Doe', email: 'notanemail', password: 'password123' });
  if (invalidEmail.ok || !invalidEmail.error.includes('valid email')) {
    throw new Error('Validation failed on invalid email: ' + JSON.stringify(invalidEmail));
  }
  console.log('OK: Email format validation verified');

  const shortPass = await state.register({ fullName: 'John Doe', email: 'john@example.com', password: '123' });
  if (shortPass.ok || !shortPass.error.includes('8 characters')) {
    throw new Error('Validation failed on short password: ' + JSON.stringify(shortPass));
  }
  console.log('OK: Short password validation verified');

  // 2. Duplicate registration test
  const dupReg = await state.register({ fullName: 'Duplicate User', email: 'duplicate@example.ph', password: 'password123' });
  if (dupReg.ok || !dupReg.error.includes('already exists')) {
    throw new Error('Duplicate email not caught: ' + JSON.stringify(dupReg));
  }
  console.log('OK: Duplicate email registration blocked with clear message:', dupReg.error);

  // 3. Successful registration test
  const successReg = await state.register({ fullName: 'Clarissa Reyes', email: 'clarissa@example.ph', password: 'password123', phone: '09171234567' });
  if (!successReg.ok || !successReg.user || successReg.user.name !== 'Clarissa Reyes') {
    throw new Error('Valid registration failed: ' + JSON.stringify(successReg));
  }
  if (!state.isAuthenticated() || state.getCurrentUser().email !== 'clarissa@example.ph') {
    throw new Error('User not logged in after registration');
  }
  console.log('OK: New customer registered and authenticated successfully:', successReg.user.name);

  // 4. Login test with invalid credentials
  const badLogin = await state.login('clarissa@example.ph', 'wrongpassword');
  if (badLogin.ok) {
    throw new Error('Bad password login should have failed');
  }
  console.log('OK: Bad credentials rejected with clear message:', badLogin.error);

  // 5. Login test with valid credentials
  const goodLogin = await state.login('test@example.ph', 'secret123');
  if (!goodLogin.ok || goodLogin.user.email !== 'test@example.ph') {
    throw new Error('Valid login failed: ' + JSON.stringify(goodLogin));
  }
  console.log('OK: Existing customer login verified successfully');

  console.log('\nALL CLIENT AUTH & REGISTRATION TESTS PASSED 100%!');
}

run().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
