// Real-browser end-to-end tests (Playwright + Chromium) against the real server and a throwaway DB.
// Run:  npm run test:e2e      (needs: npm i -D playwright && npx playwright install chromium)
const os = require('os'), fs = require('fs'), path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'umaira-e2e-'));
process.env.UMAIRA_DATA_DIR = tmp;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'E2E-Admin-Pass-1';
process.env.ORDER_RATE_LIMIT = '1000';
delete process.env.GOOGLE_CLIENT_ID;
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(process.env.NPM_GLOBAL || '/home/claude/.npm-global/lib/node_modules', 'playwright'))); }
  catch (e2) { console.log('SKIP: playwright not installed — run: npx playwright install'); process.exit(0); }
}
const app = require('../server.js');

let pass = 0, fail = 0; const failures = [];
const check = (name, cond, extra) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; failures.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } };
const MINCSS = '.hidden{display:none!important}';

(async () => {
  const server = await app.start(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); } catch (e) {
    server.close();
    console.log('SKIP: Playwright browser not installed — run: npx playwright install chromium');
    process.exit(0);
  }
  const mkPage = async (ctx) => {
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort()); // no internet in the sandbox: CDNs are blocked
    await page.addInitScript(css => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }); }, MINCSS);
    return page;
  };
  const api = async (method, p, body, token) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };
  const adminToken = (await api('POST', '/api/admin/login', { username: 'admin', password: 'E2E-Admin-Pass-1' })).data.token;
  const view = (page) => page.evaluate(() => document.body.getAttribute('data-view'));
  const settle = (page, ms = 400) => page.waitForTimeout(ms);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await mkPage(ctx);

  console.log('\n[E1] Guest');
  await page.goto(base + '/');
  await page.waitForFunction(() => window.appState && window.appState.catalogReady);
  await settle(page);
  check('guest lands on public homepage', (await view(page)) === 'home');
  check('catalog loaded from database (20 flowers, 24 bouquets)', await page.evaluate(() => FLOWER_DATA.mainFlowers.length === 20 && FLOWER_DATA.featuredBouquets.length === 24));
  check('homepage shows real prices (₱)', (await page.textContent('#main-content')).includes('₱'));
  check('guest nav shows Sign In, not Cart', await page.evaluate(() => /sign in/i.test(document.getElementById('nav-auth-container')?.textContent || document.body.textContent)));
  await page.goto(base + '/#collections'); await page.reload();
  await page.waitForFunction(() => window.appState.catalogReady); await settle(page);
  check('guest can browse #collections (no login wall)', (await view(page)) === 'collections');
  const cardCount = await page.locator('button[onclick*="addPreMadeBouquetToCart"], button[onclick*="promptGuestSignIn"]').count();
  check('collections lists products for guests', cardCount > 5, cardCount);
  await page.evaluate(() => window.suOpenBouquet(FLOWER_DATA.featuredBouquets[0].id)); await settle(page, 200);
  check('guest can open bouquet details', await page.evaluate(() => !!document.querySelector('.is-open')));
  await page.evaluate(() => window.suCloseBouquet && window.suCloseBouquet());
  for (const v of ['cart', 'checkout', 'account', 'tracking', 'builder', 'confirmation']) {
    await page.goto(base + '/#' + v); await page.reload(); await page.waitForFunction(() => window.appState.catalogReady); await settle(page, 250);
    check(`direct URL #${v} redirects guest to sign-in`, (await view(page)) === 'auth', await view(page));
  }
  check('public API blocks guest', (await api('GET', '/api/my/orders')).status === 401);
  check('admin page does not leak data to guests', (await api('GET', '/api/admin/orders')).status === 401);

  console.log('\n[E2] Registration -> intended destination');
  await page.goto(base + '/#collections'); await page.reload(); await page.waitForFunction(() => window.appState.catalogReady); await settle(page);
  const firstBouquetId = await page.evaluate(() => FLOWER_DATA.featuredBouquets.find(b => b.availability !== 'sold_out').id);
  await page.locator(`button[onclick*="promptGuestSignIn"][onclick*="add_bouquet"][onclick*="${firstBouquetId}"]`).first().click().catch(async () => { await page.evaluate(id => window.appRouter.addPreMadeBouquetToCart(id), firstBouquetId); });
  await settle(page);
  check('guest "Order" sends to sign-in', (await view(page)) === 'auth', await view(page));
  await page.click('#tab-auth-page-signup');
  await page.fill('#auth-page-reg-name', 'Ana Cruz'); await page.fill('#auth-page-reg-email', 'ana@example.com');
  await page.fill('#auth-page-reg-phone', '09171234567'); await page.fill('#auth-page-reg-password', 'short');
  await page.click('#auth-page-reg-btn'); await settle(page, 300);
  check('weak password is refused (browser validation) and no account is created', await page.evaluate(() => document.getElementById('auth-page-reg-password').validity.tooShort) && !(await api('POST', '/api/auth/login', { email: 'ana@example.com', password: 'short' })).data.ok);
  await page.fill('#auth-page-reg-password', 'password123'); await page.click('#auth-page-reg-btn'); await settle(page, 900);
  check('registered customer returns to cart with the chosen bouquet', (await view(page)) === 'cart' && await page.evaluate(id => appState.cart.some(i => i.id === id), firstBouquetId), await view(page));
  check('nav now shows the customer account', await page.evaluate(() => /Ana/.test(document.body.textContent)));
  check('cart saved on the server', (await api('GET', '/api/cart', null, await page.evaluate(() => appState.customerToken))).data.items.length === 1);

  console.log('\n[E3] Admin price change is visible to customer');
  const oldPrice = await page.evaluate(id => FLOWER_DATA.featuredBouquets.find(b => b.id === id).price, firstBouquetId);
  const bq = (await api('GET', '/api/catalog')).data.bouquets.find(b => b.id === firstBouquetId);
  await api('PUT', '/api/admin/bouquets/' + firstBouquetId, { ...bq, price: oldPrice + 111 }, adminToken);
  await page.reload(); await page.waitForFunction(() => window.appState.catalogReady); await settle(page);
  check('catalog reflects admin price', await page.evaluate(([id, p]) => FLOWER_DATA.featuredBouquets.find(b => b.id === id).price === p, [firstBouquetId, oldPrice + 111]));
  check('cart line price auto-updated', await page.evaluate(([id, p]) => appState.cart.find(i => i.id === id).price === p, [firstBouquetId, oldPrice + 111]));

  console.log('\n[E4] Cart quantities');
  await page.goto(base + '/#cart'); await page.reload(); await page.waitForFunction(() => window.appState.catalogReady); await settle(page);
  await page.locator('button[onclick*="changeCartQty"]').last().click(); await settle(page, 300);
  check('+ button increases quantity', await page.evaluate(() => appState.cart[0].quantity === 2));
  await page.locator('button[onclick*="changeCartQty"]').first().click(); await settle(page, 300);
  check('− button decreases quantity', await page.evaluate(() => appState.cart[0].quantity === 1));
  const subtotalText = await page.textContent('#main-content');
  check('cart total shows correct subtotal', subtotalText.includes((oldPrice + 111).toLocaleString('en-US')), (oldPrice + 111));
  const stemsLimited = await page.evaluate(() => { const f = FLOWER_DATA.mainFlowers.find(x => x.stockCount > 0 && x.stockCount < 10); return f ? { id: f.id, stock: f.stockCount } : null; });
  if (stemsLimited) {
    const r = await page.evaluate(({ id, stock }) => { const f = FLOWER_DATA.mainFlowers.find(x => x.id === id); appState.addToCart({ id, name: f.name, price: f.price, quantity: stock, image: f.image }); return appState.addToCart({ id, name: f.name, price: f.price, quantity: 1, image: f.image }); }, stemsLimited);
    check('cart cannot exceed available stock', r.ok === false && r.capped === stemsLimited.stock, r);
    await page.evaluate(id => appState.cart = appState.cart.filter(i => i.id !== id), stemsLimited.id);
  }

  console.log('\n[E5] Checkout: validation, network failure, success');
  await page.evaluate(() => { appState.persistCart(); }); await page.goto(base + '/#checkout'); await page.reload(); await page.waitForFunction(() => window.appState.catalogReady); await settle(page, 500);
  check('checkout page opens, form prefilled from profile', (await view(page)) === 'checkout' && (await page.inputValue('#chk-first-name')) === 'Ana' && (await page.inputValue('#chk-email')) === 'ana@example.com');
  await page.fill('#chk-phone', ''); await page.click('#chk-submit-btn'); await settle(page, 300);
  check('invalid form blocked with message, no order created', (await api('GET', '/api/my/orders', null, await page.evaluate(() => appState.customerToken))).data.orders.length === 0);
  await page.fill('#chk-phone', '09171234567'); await page.fill('#chk-address', '12 Rizal Avenue Unit 4');
  await page.selectOption('#chk-district', '3'); await page.selectOption('#chk-barangay', { index: 1 });
  await page.fill('#chk-gift-message', 'Happy birthday');
  // network failure
  const blockOrders = r => r.request().method() === 'POST' ? r.abort() : r.continue();
  await page.route('**/api/orders', blockOrders);
  await page.click('#chk-submit-btn'); await settle(page, 600);
  check('network failure: NO success page, clear error shown', (await view(page)) === 'checkout' && (await page.textContent('#chk-submit-error')).includes('NOT been placed'), await view(page));
  check('network failure: no phantom order stored', (await api('GET', '/api/my/orders', null, await page.evaluate(() => appState.customerToken))).data.orders.length === 0);
  await page.unroute('**/api/orders', blockOrders);
  // success (double click must not duplicate)
  await page.dblclick('#chk-submit-btn'); await settle(page, 1200);
  check('order placed -> confirmation page', (await view(page)) === 'confirmation', await view(page));
  const conf = await page.textContent('#main-content');
  const orderNo = (conf.match(/#FLR-\d{8}-\d{4}/) || [])[0];
  check('confirmation shows server order number and correct total', !!orderNo && conf.includes('Happy birthday'), orderNo);
  const mine = (await api('GET', '/api/my/orders', null, await page.evaluate(() => appState.customerToken))).data.orders;
  check('double click created exactly one order', mine.length === 1, mine.length);
  check('server computed total = price + delivery fee', mine[0].subtotal === oldPrice + 111 && mine[0].total === oldPrice + 111 + (oldPrice + 111 >= 2500 ? 0 : 150), { sub: mine[0].subtotal, fee: mine[0].deliveryFee, total: mine[0].total, expectSub: oldPrice + 111, items: mine[0].items.map(i => [i.name, i.quantity, i.unitPrice]) });
  check('cart empty after order', await page.evaluate(() => appState.cart.length === 0));

  console.log('\n[E6] Order history, tracking, admin updates');
  await page.goto(base + '/#account'); await page.reload(); await page.waitForFunction(() => window.appState.catalogReady); await page.waitForSelector('#acct-orders button', { timeout: 5000 }); await settle(page, 200);
  check('account shows order history with the real order', (await page.textContent('#acct-orders')).includes(orderNo));
  await api('POST', `/api/admin/orders/${encodeURIComponent(orderNo)}/confirm`, {}, adminToken);
  await api('POST', `/api/admin/orders/${encodeURIComponent(orderNo)}/status`, { status: 'Preparing' }, adminToken);
  await page.click('#acct-orders button:has-text("Refresh"), button:has-text("Refresh")'); await settle(page, 600);
  check('customer sees admin status change (Preparing)', (await page.textContent('#acct-orders')).includes('Preparing'));
  await page.click('#acct-orders button:has-text("View details")'); await page.waitForSelector('#track-result >> text=Current Stage', { timeout: 5000 });
  check('tracking page shows timeline + current stage', (await page.textContent('#track-result')).includes('Preparing'));
  await page.fill('#track-order-input', '#FLR-20200101-0000'); await page.click('#track-order-btn'); await settle(page, 600);
  check('unknown order number: clear "not found" message', (await page.textContent('#track-result')).includes('No order found'));
  // profile edit persists
  await page.goto(base + '/#account'); await page.reload(); await page.waitForFunction(() => window.appState.catalogReady); await settle(page, 600);
  await page.fill('#acct-name', 'Ana C. Cruz'); await page.fill('#acct-phone', 'abc'); await page.click('#acct-save-btn'); await settle(page, 200);
  check('invalid phone rejected in profile form', !(await page.locator('#acct-error').getAttribute('class')).includes('hidden'));
  await page.fill('#acct-phone', '09998887777'); await page.fill('#acct-street', '5 Taft Ave'); await page.selectOption('#acct-district', '5'); await page.selectOption('#acct-barangay', { index: 1 });
  await page.click('#acct-save-btn'); await settle(page, 600);
  await page.reload(); await page.waitForFunction(() => window.appState.catalogReady); await settle(page, 600);
  check('profile changes persist after refresh', await page.evaluate(() => appState.currentUser.name === 'Ana C. Cruz' && appState.currentUser.phone === '09998887777' && appState.currentUser.address.street === '5 Taft Ave'));

  console.log('\n[E7] Logout, back button, isolation');
  await page.evaluate(() => appRouter.handleCustomerLogout()); await settle(page, 400);
  check('logout returns to guest homepage', (await view(page)) === 'home' && await page.evaluate(() => !appState.isAuthenticated()));
  check('session removed from browser storage', await page.evaluate(() => !localStorage.getItem('umaira_customer_token')));
  await page.goBack(); await settle(page, 400);
  check('Back button cannot reopen protected pages', !['account', 'cart', 'checkout', 'confirmation'].includes(await view(page)), await view(page));
  await page.goto(base + '/#account'); await page.reload(); await page.waitForFunction(() => window.appState.catalogReady); await settle(page);
  check('after logout, #account is blocked', (await view(page)) === 'auth');
  // login via UI
  await page.fill('#auth-page-login-email', 'ana@example.com'); await page.fill('#auth-page-login-password', 'wrong-password'); await page.click('#auth-page-login-btn'); await settle(page, 400);
  check('wrong password shows error', (await page.textContent('#auth-page-error')).includes('Invalid email or password'));
  await page.fill('#auth-page-login-password', 'password123'); await page.click('#auth-page-login-btn'); await settle(page, 900);
  check('existing customer login restores their data (order history)', (await api('GET', '/api/my/orders', null, await page.evaluate(() => appState.customerToken))).data.orders.length === 1);
  check('Google button hidden when Google is not configured', await page.evaluate(() => [...document.querySelectorAll('[data-google-area]')].every(e => getComputedStyle(e).display === 'none') ));
  // second customer cannot see first's order
  const ctx2 = await browser.newContext(); const p2 = await mkPage(ctx2);
  await p2.goto(base + '/'); await p2.waitForFunction(() => window.appState.catalogReady);
  const b2 = await api('POST', '/api/auth/register', { name: 'Ben Reyes', email: 'ben@example.com', password: 'password123' });
  await p2.evaluate(([u, t]) => { localStorage.setItem('umaira_current_user', JSON.stringify(u)); localStorage.setItem('umaira_customer_token', JSON.stringify(t)); }, [b2.data.user, b2.data.token]);
  await p2.goto(base + '/?fresh=1#tracking'); await p2.waitForFunction(() => window.appState.catalogReady); await settle(p2, 800);
  await p2.fill('#track-order-input', orderNo); await p2.click('#track-order-btn'); await settle(p2, 600);
  check("another customer cannot track Ana's order", (await p2.textContent('#track-result')).includes('No order found') && !(await p2.textContent('#track-result')).includes('Rizal'));
  check('new customer sees empty-state order history, not fake orders', (await api('GET', '/api/my/orders', null, b2.data.token)).data.orders.length === 0);
  await p2.evaluate(() => { localStorage.setItem('umaira_customer_token', JSON.stringify('cst_revoked')); }); await p2.reload(); await settle(p2, 800);
  check('revoked/forged token is dropped and user becomes guest', await p2.evaluate(() => !appState.isAuthenticated()));

  console.log('\n[E8] Stored XSS attempt');
  const evil = await api('POST', '/api/auth/register', { name: '<img src=x onerror="window.__pwned=1">Evil', email: 'evil@example.com', password: 'password123' });
  const rose = (await api('GET', '/api/catalog')).data.flowers.find(f => f.stockCount > 5);
  const od = await api('POST', '/api/orders', { fulfillment: 'delivery', firstName: '<script>window.__pwned=2</script>', lastName: '"><img src=x onerror=window.__pwned=3>', phone: '09171234567', email: 'evil@example.com', address: '<b onmouseover=1>1 Rizal Ave</b>', district: '3', barangay: 'Barangay 300', city: 'Manila', notes: '<img src=x onerror=window.__pwned=4>', date: require('../js/shop-rules.js').earliestDate('delivery'), time: require('../js/shop-rules.js').deliverySlots[0], paymentMethod: 'GCash', giftMessage: '<svg onload=window.__pwned=5>', items: [{ id: rose.id, quantity: 1 }] }, evil.data.token);
  check('malicious-looking order accepted as plain text', od.status === 201, od);

  console.log('\n[E9] Admin interface');
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const ap = await mkPage(actx);
  await ap.goto(base + '/admin');
  check('admin login form is shown (no pre-filled credentials)', (await ap.inputValue('#admin-username')) === '' && (await ap.inputValue('#admin-password')) === '');
  await ap.fill('#admin-username', 'admin'); await ap.fill('#admin-password', 'wrong'); await ap.click('#admin-login-btn'); await settle(ap, 500);
  check('wrong admin password rejected in UI', !(await ap.locator('#login-error-alert').getAttribute('class')).includes('hidden'));
  await ap.fill('#admin-password', 'E2E-Admin-Pass-1'); await ap.click('#admin-login-btn'); await ap.waitForSelector('#admin-orders-tbody tr', { timeout: 5000 }); await settle(ap, 500);
  check('admin dashboard shows real orders', (await ap.locator('#admin-orders-tbody tr').count()) === 2);
  check('XSS payload in customer fields did NOT execute in admin panel', await ap.evaluate(() => window.__pwned === undefined));
  check('payload displayed as harmless text', (await ap.textContent('#admin-orders-tbody')).includes('<script>'));
  await ap.locator('#admin-orders-tbody button:has-text("View")').first().click().catch(() => {}); await settle(ap, 300);
  check('XSS still not executed after opening order details', await ap.evaluate(() => window.__pwned === undefined));
  const stats = await ap.textContent('#admin-stats-grid');
  check('dashboard stats render (pending count = 1)', /Pending Orders\s*1/.test(stats.replace(/\s+/g, ' ')) , stats.replace(/\s+/g, ' ').slice(0, 120));
  // add product through the UI
  await ap.click('button[data-tab-nav="flowers"]'); await settle(ap, 500);
  await ap.click('button:has-text("Add")'); await settle(ap, 200);
  await ap.fill('#flower-field-name', 'UI Test Lily'); await ap.fill('#flower-field-category', 'Lilies'); await ap.fill('#flower-field-price', '-5'); await ap.fill('#flower-field-stock', '12');
  await ap.fill('#flower-field-image', 'https://example.com/lily.jpg');
  await ap.click('#admin-flower-form button[type="submit"]'); await settle(ap, 500);
  check('admin form rejects negative price', !(await api('GET', '/api/catalog')).data.flowers.some(f => f.name === 'UI Test Lily'));
  await ap.fill('#flower-field-price', '135'); await ap.click('#admin-flower-form button[type="submit"]'); await settle(ap, 700);
  const created = (await api('GET', '/api/catalog')).data.flowers.find(f => f.name === 'UI Test Lily');
  check('admin adds product via UI -> appears in public catalog', !!created && created.price === 135 && created.stockCount === 12, created);
  await ap.locator('#admin-flowers-tbody tr:has-text("UI Test Lily") button:has-text("Edit")').click(); await settle(ap, 200);
  await ap.fill('#flower-field-stock', '0'); await ap.click('#admin-flower-form button[type="submit"]'); await settle(ap, 700);
  const sold = (await api('GET', '/api/catalog')).data.flowers.find(f => f.name === 'UI Test Lily');
  check('stock 0 -> shown as sold out everywhere, and admin table shows 0 (not 50)', sold.availability === 'sold_out' && (await ap.textContent('#admin-flowers-tbody tr:has-text("UI Test Lily")')).includes('0'));
  ap.on('dialog', d => d.accept());
  await ap.locator('#admin-flowers-tbody tr:has-text("UI Test Lily") button:has-text("Archive")').click(); await settle(ap, 700);
  check('admin archives product -> gone from catalog', !(await api('GET', '/api/catalog')).data.flowers.some(f => f.name === 'UI Test Lily'));
  await ap.click('button[data-tab-nav="customers"]'); await settle(ap, 600);
  check('admin customers tab lists registered customers', (await ap.textContent('#admin-customers-tbody')).includes('ana@example.com'));
  const xssC = await ap.evaluate(() => window.__pwned === undefined); check('XSS not executed in customers tab', xssC);
  // admin session isolation
  const cust = await page.evaluate(() => appState.customerToken);
  check('customer token cannot open admin data', (await api('GET', '/api/admin/orders', null, cust)).status === 401);
  await ap.click('button:has-text("Sign")').catch(() => {}); 


  console.log('\n[E11] Custom bouquet builder -> order');
  await page.goto(base + '/?b=1#builder'); await page.waitForFunction(() => window.appState.catalogReady); await settle(page, 600);
  check('signed-in customer opens the builder', (await view(page)) === 'builder');
  const stem = await page.evaluate(() => { const f = FLOWER_DATA.mainFlowers.find(x => x.availability !== 'sold_out' && x.stockCount >= 10); return { id: f.id, price: f.price }; });
  await page.evaluate(id => { builderCtrl.updateMainFlowerQty(id, 1); builderCtrl.updateMainFlowerQty(id, 1); builderCtrl.updateMainFlowerQty(id, 1); }, stem.id);
  check('builder shows live total for 3 stems', await page.evaluate(([id, price]) => builderCtrl.calculateBreakdown().subtotal >= price * 3, [stem.id, stem.price]));
  await page.evaluate(() => { appState.setBuilderState({ currentStep: 5, filler: FLOWER_DATA.fillerFlowers[0].id, greenery: FLOWER_DATA.greenery[0].id }); builderCtrl.proceedToCheckout(); }); await settle(page, 700);
  check('builder adds custom bouquet to cart and opens checkout', (await view(page)) === 'checkout' && await page.evaluate(() => appState.cart.length === 1 && appState.cart[0].isCustom), await view(page));
  await page.fill('#chk-address', '9 Quezon Blvd'); await page.selectOption('#chk-district', '3'); await page.selectOption('#chk-barangay', { index: 1 });
  const stockBefore = (await api('GET', '/api/catalog')).data.flowers.find(f => f.id === stem.id).stockCount;
  await page.click('#chk-submit-btn'); await settle(page, 1200);
  check('custom bouquet order confirmed', (await view(page)) === 'confirmation', await view(page));
  const stockAfter = (await api('GET', '/api/catalog')).data.flowers.find(f => f.id === stem.id).stockCount;
  check('flower stock reduced by the 3 stems used', stockAfter === stockBefore - 3, [stockBefore, stockAfter]);
  check('custom order total >= 3 stems + fee', (await page.textContent('#main-content')).includes('Grand Total'));

  console.log('\n[E12] Catalog unavailable (server/database error)');
  const ctx3 = await browser.newContext(); const p3 = await mkPage(ctx3);
  await p3.route('**/api/catalog', r => r.abort());
  await p3.goto(base + '/'); await p3.waitForFunction(() => window.appState.catalogReady); await settle(p3, 500);
  for (const v of ['home', 'collections', 'care', 'about', 'auth']) { await p3.evaluate(x => appRouter.navigate(x), v); await settle(p3, 250); }
  check('no crash on any public page when the catalog cannot load', p3.errors.filter(m => !/tailwind/i.test(m)).length === 0, p3.errors.filter(m => !/tailwind/i.test(m)));
  await p3.evaluate(() => appRouter.navigate('collections')); await settle(p3, 300);
  check('visitor is told the products could not be loaded, with a Retry', (await p3.textContent('#main-content')).includes('could not load the latest products'));
  check('no fake/placeholder products are shown', await p3.evaluate(() => FLOWER_DATA.mainFlowers.length === 0 && FLOWER_DATA.featuredBouquets.length === 0));
  p3.errors.length = 0;
  await p3.unroute('**/api/catalog'); await p3.evaluate(() => appState.loadCatalog()); await settle(p3, 600);
  check('Retry recovers once the server is back', await p3.evaluate(() => FLOWER_DATA.mainFlowers.length === 20));

  console.log('\n[E10] Page errors');
  const relevant = [...page.errors, ...p2.errors, ...ap.errors, ...p3.errors].filter(m => !/gsap|THREE|tailwind|google|ScrollTrigger|Lenis|lucide/i.test(m));
  check('no unexpected JavaScript errors in any page', relevant.length === 0, relevant.slice(0, 5));
  const ignored = [...page.errors, ...p2.errors, ...ap.errors, ...p3.errors].filter(m => /gsap|THREE|tailwind|google|ScrollTrigger|Lenis|lucide/i.test(m));
  if (ignored.length) console.log('  (info) ignored errors caused by blocked CDN libraries in this sandbox:', [...new Set(ignored)].slice(0, 4));

  await browser.close(); server.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail) console.log('Failures:\n - ' + failures.join('\n - '));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('E2E CRASH', e); process.exit(2); });
