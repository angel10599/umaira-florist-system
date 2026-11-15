// Umaira Florist — UI behaviour tests (header, account menu, confirmation dialogs) in a real headless Chrome.
// Boots the real server on a throwaway database and drives the pages over the Chrome DevTools Protocol.
// Needs Node 22+ (global WebSocket/fetch), Chrome or Edge, and internet access (the pages load Tailwind from its CDN).
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');

// "test" in the folder name makes the server load the test fixtures (fl-rose-red etc.) this suite uses.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'umaira-ui-test-'));
process.env.UMAIRA_UPLOAD_DIR = path.join(tmp, 'uploads'); // test uploads never land in assets/uploads
process.env.UMAIRA_DATA_DIR = tmp;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'Ui-Test-Admin-1';
process.env.ORDER_RATE_LIMIT = '1000';
process.env.UMAIRA_TEST = '1';
const app = require('../server.js');

const BROWSERS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'];
const browserPath = BROWSERS.find(p => fs.existsSync(p));
if (!browserPath) { console.log('SKIP: no Chrome or Edge found'); process.exit(0); }

let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let base, cdp, chrome;
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && this.pending.has(d.id)) { this.pending.get(d.id)(d); this.pending.delete(d.id); } }; }
  send(method, params = {}) { const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, (d) => d.error ? rej(new Error(method + ': ' + d.error.message)) : res(d.result)); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
async function ev(expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('page error: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + '\n' + expr.slice(0, 200));
  return r.result.value;
}
async function waitFor(expr, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return true; } catch (e) {} await sleep(100); } return false; }
async function press(key, shift) {
  const code = { Escape: 27, ArrowDown: 40, ArrowUp: 38, Tab: 9, Home: 36, End: 35 }[key];
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, modifiers: shift ? 8 : 0 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
}
async function mouseClick(selector) { // a real pointer click (event.detail = 1), unlike element.click()
  const p = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  if (!p) throw new Error('no element ' + selector);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
}
async function api(method, p, body, token) {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = {}; try { data = await r.json(); } catch (e) {} return { status: r.status, data };
}
const dialogTitle = () => ev(`(document.querySelector('[role$="dialog"] h2')||{}).textContent||null`);
const dialogOpen = () => ev(`!!document.querySelector('[role$="dialog"]')`);
const clickDlg = (which) => ev(`document.querySelector('[data-ui-${which}]').click()`);
async function openPage(url) { await cdp.send('Page.navigate', { url }); await waitFor(`document.readyState==='complete'`); }
async function viewport(w, h, mobile) { await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile }); }

(async () => {
  const server = await app.start(0);
  base = 'http://127.0.0.1:' + server.address().port;
  chrome = spawn(browserPath, ['--headless=new', '--remote-debugging-port=9333', '--no-first-run', '--disable-gpu', '--user-data-dir=' + path.join(tmp, 'profile'), 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 50 && !targets; i++) { try { targets = await (await fetch('http://127.0.0.1:9333/json/list')).json(); } catch (e) { await sleep(200); } }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  cdp = new CDP(ws);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await viewport(1280, 800);

  const regRes = await api('POST', '/api/auth/register', { name: 'Beatriz Reyes', email: 'beatriz@example.com', password: 'Password123!', phone: '09171112233' });
  const verRes = regRes.data?.testOtp
    ? await api('POST', '/api/auth/verify-otp', { email: 'beatriz@example.com', otp: regRes.data.testOtp })
    : { data: {} };
  const token = verRes.data?.token, user = verRes.data?.user;

  // ===================================================================== customer: header
  console.log('\n[1] Guest header');
  await openPage(base + '/');
  await waitFor(`window.appRouter && appState.catalogReady`);
  check('guest sees Sign In', await ev(`/Sign In/.test(document.getElementById('nav-auth-container').innerText)`));
  check('guest header has no Track Order / Sign Out / Cart', await ev(`!/Track Order|Sign Out/.test(document.querySelector('header').innerText) && document.getElementById('nav-cart-btn').offsetParent === null`));
  check('guest header shows Home, Collections, Build Your Bouquet and the About menu', await ev(`['Home','Collections','Build Your Bouquet'].every(t=>document.querySelector('header').innerText.includes(t)) && !!document.getElementById('about-dropdown-btn')`));
  check('About Us / Florist Guide are inside About (menu closed)', await ev(`document.getElementById('about-dropdown-menu').hidden && !/Florist Guide|About Us/.test(document.getElementById('desktop-nav-links').innerText)`));
  await mouseClick('#about-dropdown-btn');
  check('About opens with two items (About Us, Florist Guide)', await ev(`!document.getElementById('about-dropdown-menu').hidden && document.querySelectorAll('#about-dropdown-menu [role=menuitem]').length === 2 && document.getElementById('about-dropdown-btn').getAttribute('aria-expanded')==='true'`));
  await mouseClick('#about-dropdown-menu a[href="#care"]');
  check('choosing an About item navigates and closes the menu', await waitFor(`appRouter.currentView==='care'`) && await ev(`document.getElementById('about-dropdown-menu').hidden`));

  console.log('\n[2] Signed-in header and account dropdown (desktop)');
  await ev(`(async()=>{ await appState.setCurrentUser(${JSON.stringify(user)}, ${JSON.stringify(token)}); appRouter.updateNavBar(); })()`);
  check('account button has accessible name with customer name', await ev(`document.getElementById('account-menu-btn').getAttribute('aria-label').includes('Beatriz')`));
  check('header no longer shows Sign Out or Track Order links', await ev(`!/Sign Out|Track Order/.test(document.querySelector('header').innerText)`));
  await ev(`appState.addToCart({id:'fl-rose-red', name:'Ecuadorian Crimson Rose', price:120, quantity:2, isCustom:false})`);
  check('cart shows an accurate count', await ev(`document.getElementById('nav-cart-count').innerText==='2' && document.getElementById('nav-cart-btn').getAttribute('aria-label')==='Cart, 2 items'`));
  await mouseClick('#account-menu-btn');
  check('account menu opens with the four actions', await ev(`[...document.querySelectorAll('#account-menu [role=menuitem]')].map(e=>e.textContent.trim()).join('|')`) === 'My Profile|My Orders|Track Order|Sign Out');
  await mouseClick('h1, main, body');
  check('clicking outside closes the menu', await ev(`document.getElementById('account-menu').hidden`));
  await ev(`document.getElementById('account-menu-btn').focus()`);
  await press('ArrowDown');
  check('ArrowDown opens the menu and focuses the first item', await ev(`!document.getElementById('account-menu').hidden && document.activeElement.textContent.trim()==='My Profile'`));
  await press('ArrowDown'); await press('End');
  check('End moves to the last item', await ev(`document.activeElement.textContent.trim()==='Sign Out'`));
  await press('Home'); await press('ArrowUp');
  check('ArrowUp from the first item wraps to the last', await ev(`document.activeElement.textContent.trim()==='Sign Out'`));
  await press('Escape');
  check('Escape closes the menu and returns focus to the button', await ev(`document.getElementById('account-menu').hidden && document.activeElement.id==='account-menu-btn'`));
  await ev(`document.getElementById('account-menu-btn').click()`);
  await ev(`[...document.querySelectorAll('#account-menu [role=menuitem]')].find(e=>e.textContent.trim()==='My Orders').click()`);
  check('My Orders opens the account page and closes the menu', await waitFor(`appRouter.currentView==='account'`) && await ev(`document.getElementById('account-menu').hidden`));
  await ev(`document.getElementById('account-menu-btn').click()`);
  await ev(`[...document.querySelectorAll('#account-menu [role=menuitem]')].find(e=>e.textContent.trim()==='Track Order').click()`);
  check('Track Order opens the tracking page', await waitFor(`appRouter.currentView==='tracking'`));
  await ev(`appRouter.navigate('account')`); await waitFor(`!!document.getElementById('acct-profile-form')`);
  check('account page no longer repeats Sign Out / Track Order buttons', await ev(`!/Sign Out|Track Order/.test(document.getElementById('main-content').innerText)`));

  console.log('\n[3] Sign-out confirmation');
  await ev(`document.getElementById('account-menu-btn').click()`);
  await ev(`[...document.querySelectorAll('#account-menu [role=menuitem]')].find(e=>e.textContent.trim()==='Sign Out').click()`);
  check('Sign Out opens a confirmation instead of signing out', await dialogTitle() === 'Sign out of Umaira Florist?' && await ev(`appState.isAuthenticated()`));
  check('dialog has Cancel and a clearly labelled Sign out button', await ev(`document.querySelector('[data-ui-cancel]').textContent==='Cancel' && document.querySelector('[data-ui-ok]').textContent==='Sign out'`));
  check('dialog is modal and labelled', await ev(`(()=>{const d=document.querySelector('[role$="dialog"]');return d.getAttribute('aria-modal')==='true' && !!document.getElementById(d.getAttribute('aria-labelledby')) && !!document.getElementById(d.getAttribute('aria-describedby'))})()`));
  for (let i = 0; i < 6; i++) await press('Tab', i % 2 === 1);
  check('Tab/Shift+Tab keep focus trapped inside the dialog', await ev(`document.querySelector('[role$="dialog"]').contains(document.activeElement)`));
  await press('Escape');
  check('Escape cancels: no sign-out, session still valid on the server', !(await dialogOpen()) && await ev(`appState.isAuthenticated()`) && (await api('GET', '/api/auth/me', null, token)).status === 200);
  check('focus returns to the account button', await ev(`document.activeElement.id==='account-menu-btn'`));
  await ev(`document.getElementById('account-menu-btn').click()`);
  await ev(`[...document.querySelectorAll('#account-menu [role=menuitem]')].find(e=>e.textContent.trim()==='Sign Out').click()`);
  await clickDlg('cancel');
  check('Cancel button also keeps the session', await ev(`appState.isAuthenticated()`));
  await ev(`document.getElementById('account-menu-btn').click()`);
  await ev(`[...document.querySelectorAll('#account-menu [role=menuitem]')].find(e=>e.textContent.trim()==='Sign Out').click()`);
  await clickDlg('ok');
  check('confirming signs out', await waitFor(`!appState.isAuthenticated()`) && await ev(`/Sign In/.test(document.getElementById('nav-auth-container').innerText)`));
  await sleep(300);
  check('server session is revoked after sign-out', (await api('GET', '/api/auth/me', null, token)).status === 401);

  // ===================================================================== customer: profile, order, cart undo
  console.log('\n[4] Profile save confirmation');
  const login = await api('POST', '/api/auth/login', { email: 'beatriz@example.com', password: 'Password123!' });
  const token2 = login.data.token;
  await openPage(base + '/'); await waitFor(`window.appRouter && appState.catalogReady`);
  await ev(`(async()=>{ await appState.setCurrentUser(${JSON.stringify(login.data.user)}, ${JSON.stringify(token2)}); appRouter.navigate('account'); })()`);
  await waitFor(`!!document.getElementById('acct-profile-form')`);
  await ev(`document.getElementById('acct-profile-form').requestSubmit()`);
  check('saving without changes asks nothing and changes nothing', !(await dialogOpen()));
  await ev(`document.getElementById('acct-name').value='Beatriz R. Santos'`);
  await ev(`document.getElementById('acct-profile-form').requestSubmit()`);
  check('changed profile opens a confirmation listing the change', await dialogTitle() === 'Save these profile changes?' && await ev(`document.querySelector('[role$="dialog"] dl').innerText.includes('Beatriz R. Santos')`));
  await clickDlg('cancel');
  check('Cancel makes no backend change', (await api('GET', '/api/auth/me', null, token2)).data.user.name === 'Beatriz Reyes');
  await ev(`document.getElementById('acct-profile-form').requestSubmit()`);
  await ev(`(()=>{const b=document.querySelector('[data-ui-ok]'); b.click(); b.click(); b.click();})()`);
  check('confirm saves the profile', await waitFor(`!document.querySelector('[role$="dialog"]')`) && (await api('GET', '/api/auth/me', null, token2)).data.user.name === 'Beatriz R. Santos');

  console.log('\n[5] Checkout confirmation');
  // Approved flow: only items selected in the cart proceed to checkout (select it, then Checkout).
  await ev(`appState.cart=[]; appState.addToCart({id:'fl-rose-red', name:'Ecuadorian Crimson Rose', price:120, quantity:3, isCustom:false}); appRouter.selectedCartItemIds = new Set(appState.cart.map(c => c.cartItemId)); appRouter.proceedToCheckoutSelected()`);
  await waitFor(`!!document.getElementById('checkout-form')`);
  await ev(`(()=>{
    const setv=(id,v)=>{const e=document.getElementById(id); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));};
    setv('chk-phone','09171234567'); setv('chk-address','12 Rizal Avenue, Unit 4'); setv('chk-district','3'); appRouter.onDistrictChange('3'); setv('chk-barangay','Barangay 300');
    setv('chk-date', SHOP_RULES.earliestDate('delivery'));
    const t=document.getElementById('chk-time'); t.value=[...t.options].find(o=>o.value).value;
    document.querySelector('input[name=paymentMethod][value="Cash on Delivery"]').checked=true;
  })()`);
  const countOrders = async () => (await api('GET', '/api/my/orders', null, token2)).data.orders.length;
  const before = await countOrders();
  await ev(`document.getElementById('checkout-form').requestSubmit()`);
  check('Place Order opens a confirmation', await waitFor(`!!document.querySelector('[role$="dialog"]')`) && await dialogTitle() === 'Place this order?');
  const dl = await ev(`document.querySelector('[role$="dialog"] dl').innerText`);
  check('dialog shows fulfillment, schedule, payment and the final total (3 x 120 + 150 delivery = 510)', /Manila delivery/.test(dl) && /Cash on Delivery/.test(dl) && /510/.test(dl) && /Rizal/.test(dl), dl);
  await clickDlg('cancel');
  check('cancelling creates no order', (await countOrders()) === before && await ev(`appState.cart.length===1`));
  await ev(`document.getElementById('checkout-form').requestSubmit()`);
  await waitFor(`!!document.querySelector('[role$="dialog"]')`);
  await ev(`window.__posts=0; const f=window.fetch; window.fetch=function(u,o){ if(String(u).includes('/api/orders') && o && o.method==='POST') window.__posts++; return f.apply(this,arguments); }`);
  await ev(`(()=>{const b=document.querySelector('[data-ui-ok]'); b.click(); b.click(); b.click();})()`);
  check('triple-clicking confirm sends exactly one request', await waitFor(`appRouter.currentView==='confirmation'`) && await ev(`window.__posts`) === 1);
  check('exactly one order was created, with the confirmed total', (await countOrders()) === before + 1 && (await api('GET', '/api/my/orders', null, token2)).data.orders[0].total === 510);

  console.log('\n[6] Cart removal is undoable');
  await ev(`appState.cart=[]; appState.addToCart({id:'fl-rose-red', name:'Ecuadorian Crimson Rose', price:120, quantity:2, isCustom:false}); appRouter.navigate('cart')`);
  await waitFor(`appState.cart.length===1`);
  await ev(`appRouter.removeCartItem(appState.cart[0].cartItemId)`);
  check('removing shows an Undo snackbar and empties the cart', await ev(`!!document.getElementById('ui-snack') && appState.cart.length===0`));
  await ev(`document.querySelector('#ui-snack button').click()`);
  check('Undo restores the item and count', await ev(`appState.cart.length===1 && appState.cart[0].quantity===2 && document.getElementById('nav-cart-count').innerText==='2'`));

  // ===================================================================== mobile
  console.log('\n[7] Mobile header (390 px)');
  await viewport(390, 844, true);
  await openPage(base + '/'); await waitFor(`window.appRouter && appState.catalogReady`);
  await ev(`(async()=>{ await appState.setCurrentUser(${JSON.stringify(login.data.user)}, ${JSON.stringify(token2)}); appState.cart=[]; appState.addToCart({id:'fl-rose-red', name:'Rose', price:120, quantity:1, isCustom:false}); appRouter.updateNavBar(); })()`);
  check('no horizontal overflow', await ev(`document.documentElement.scrollWidth <= window.innerWidth`));
  check('account, cart and menu buttons are visible and at least 40px', await ev(`['account-menu-btn','nav-cart-btn'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.width>=40&&r.height>=40}) && document.querySelector('[aria-controls=mobile-nav-drawer]').getBoundingClientRect().width>=40`));
  check('desktop nav and Sign Out link are not in the header', await ev(`document.getElementById('desktop-nav-links').offsetParent===null && !/Sign Out|Track Order/.test(document.querySelector('header').innerText)`));
  await mouseClick('#account-menu-btn');
  check('account menu opens fully inside the viewport', await ev(`(()=>{const r=document.getElementById('account-menu').getBoundingClientRect();return !document.getElementById('account-menu').hidden && r.left>=0 && r.right<=window.innerWidth})()`));
  await mouseClick('[aria-controls=mobile-nav-drawer]');
  check('menu button opens a drawer with site links only (account menu closed)', await ev(`document.getElementById('account-menu').hidden && ['Home','Collections','Build Your Bouquet','Florist Guide','About Us'].every(t=>document.getElementById('mobile-nav-drawer').innerText.includes(t)) && !/Sign Out|Track/.test(document.getElementById('mobile-nav-drawer').innerText)`));
  await mouseClick('#account-menu-btn'); await ev(`[...document.querySelectorAll('#account-menu [role=menuitem]')].find(e=>e.textContent.trim()==='Sign Out').click()`);
  check('confirmation dialog fits a phone screen', await ev(`(()=>{const r=document.querySelector('[role$="dialog"]').getBoundingClientRect();return r.left>=0&&r.right<=window.innerWidth&&r.bottom<=window.innerHeight})()`));
  await clickDlg('cancel');

  console.log('\n[8] Reduced motion');
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await mouseClick('#account-menu-btn');
  check('menu has no animation when reduced motion is requested', await ev(`getComputedStyle(document.getElementById('account-menu')).animationName==='none'`));
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await press('Escape');
  check('menu animates normally otherwise', await (async () => { await mouseClick('#account-menu-btn'); return ev(`getComputedStyle(document.getElementById('account-menu')).animationName==='ui-pop'`); })());

  // ===================================================================== admin
  console.log('\n[9] Admin confirmations');
  await viewport(1280, 900);
  const adm = (await api('POST', '/api/admin/login', { username: 'admin', password: process.env.ADMIN_PASSWORD })).data.token;
  const mk = async (qty = 1, paymentMethod = 'GCash') => (await api('POST', '/api/orders', {
    fulfillment: 'delivery', firstName: 'Beatriz', lastName: 'Reyes', phone: '09171234567', email: 'beatriz@example.com', address: '45 Ayala Avenue', district: '3', barangay: 'Barangay 300',
    city: 'Manila', notes: '', date: require('../js/shop-rules.js').earliestDate('delivery'), time: require('../js/shop-rules.js').deliverySlots[0], paymentMethod, giftMessage: '',
    items: [{ id: 'fl-tulip-pink', quantity: qty }] }, token2)).data.orderNumber;
  const statusOf = async (n) => (await api('GET', '/api/admin/orders/' + encodeURIComponent(n), null, adm)).data.order.status;
  const stockOf = async (id) => (await api('GET', '/api/admin/flowers', null, adm)).data.flowers.find(f => f.id === id);
  const o1 = await mk(2, 'Cash on Delivery'), o2 = await mk(1); // o1: confirm/cancel dialogs (COD can be confirmed unpaid); o2: GCash
  await openPage(base + '/admin');
  await ev(`sessionStorage.setItem('umaira_admin_token', ${JSON.stringify(adm)}); sessionStorage.setItem('umaira_admin_user','admin')`);
  await openPage(base + '/admin'); await waitFor(`window.adminApp && adminApp.orders.length>=2`);
  // The dashboard metrics render after their data loads, so wait for them.
  check('dashboard shows four metrics', await waitFor(`document.getElementById('admin-stats-grid').children.length===4`));

  await ev(`adminApp.openOrderDetail(${JSON.stringify(o1)})`);
  check('pending order offers one Confirm and one Cancel action', await ev(`(()=>{const t=document.getElementById('admin-order-modal-content').innerText; return /Confirm Order/.test(t) && (t.match(/Cancel order/g)||[]).length===1 && !/Current Status/.test(t)})()`));
  await ev(`[...document.querySelectorAll('#admin-order-modal-content button')].find(b=>/Confirm Order/.test(b.textContent)).click()`);
  check('Confirm opens "Confirm this order?"', await dialogTitle() === 'Confirm this order?');
  await clickDlg('cancel');
  check('Cancel changes nothing', await statusOf(o1) === 'Pending Confirmation');
  await ev(`[...document.querySelectorAll('#admin-order-modal-content button')].find(b=>/Confirm Order/.test(b.textContent)).click()`);
  await ev(`window.__posts=0; const f=window.fetch; window.fetch=function(u,o){ if(o && o.method==='POST') window.__posts++; return f.apply(this,arguments); }`);
  await ev(`(()=>{const b=document.querySelector('[data-ui-ok]'); b.click(); b.click(); b.click();})()`);
  check('confirmed once: one request, status is Confirmed', await waitFor(`!document.querySelector('[role$="dialog"]')`) && await ev(`window.__posts`) === 1 && await statusOf(o1) === 'Confirmed');

  const stockBefore = (await stockOf('fl-tulip-pink')).stockCount;
  await ev(`adminApp.openOrderDetail(${JSON.stringify(o1)})`);
  await ev(`[...document.querySelectorAll('#admin-order-modal-content button')].find(b=>/Cancel order/.test(b.textContent)).click()`);
  check('Cancel order is a destructive dialog that explains stock and permanence', await dialogTitle() === 'Cancel this order?' && await ev(`(()=>{const d=document.querySelector('[role$="dialog"]');return d.getAttribute('role')==='alertdialog' && /stock/.test(d.innerText) && /cannot be undone/.test(d.innerText) && d.querySelector('[data-ui-ok]').className.includes('bg-red-700')})()`));
  await ev(`document.querySelector('[data-ui-ok]').click()`);
  check('a reason is required and nothing is sent without it', await ev(`!document.querySelector('[role$="alert"]').classList.contains('hidden')`) && await statusOf(o1) === 'Confirmed');
  await clickDlg('cancel');
  check('Keep order leaves the order untouched', await statusOf(o1) === 'Confirmed');
  await ev(`adminApp.openOrderDetail(${JSON.stringify(o1)})`);
  await ev(`[...document.querySelectorAll('#admin-order-modal-content button')].find(b=>/Cancel order/.test(b.textContent)).click()`);
  await ev(`document.querySelector('[role$="dialog"] textarea').value='Out of stock for that date'`);
  await ev(`document.querySelector('[data-ui-ok]').click()`);
  check('cancelling with a reason cancels the order and returns stock', await waitFor(`!document.querySelector('[role$="dialog"]')`) && await statusOf(o1) === 'Rejected/Cancelled' && (await stockOf('fl-tulip-pink')).stockCount === stockBefore + 2);

  // GCash payment verification in the admin console (GCash is paid in advance: verified before confirmation).
  console.log('\n[9b] Payment verification');
  await ev(`adminApp.loadOrders()`); await sleep(400);
  await ev(`adminApp.openOrderDetail(${JSON.stringify(o2)})`);
  check('order details show the payment panel and block confirmation until the GCash payment is verified', await waitFor(`(()=>{const p=document.getElementById('admin-order-payment-panel'); const b=[...document.querySelectorAll('#admin-order-modal-content button')].find(b=>/Confirm Order/.test(b.textContent)); return !!p && /Unpaid/.test(p.innerText) && /GCash/.test(p.innerText) && !!b && b.disabled})()`));
  const receipt = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const o2total = (await api('GET', '/api/admin/orders/' + encodeURIComponent(o2), null, adm)).data.order.total;
  const proof = await api('POST', '/api/orders/' + encodeURIComponent(o2) + '/payments', { reference: 'UI-TEST-0001', amount: o2total, receiptDataUrl: receipt }, token2);
  check('customer submitted payment proof', proof.status === 201, proof.data);
  await ev(`adminApp.loadOrders()`); await sleep(300);
  await ev(`adminApp.openPaymentReview(${JSON.stringify(o2)}, ${proof.data.submission && proof.data.submission.id})`);
  check('Review Payment shows the receipt image, customer, amounts and reference', await waitFor(`(()=>{const m=document.getElementById('admin-payment-modal'); const img=m && m.querySelector('img[data-receipt-id]'); return m && !m.classList.contains('hidden') && img && /^blob:/.test(img.src) && img.naturalWidth===1 && /Beatriz Reyes/.test(m.innerText) && /UI-TEST-0001/.test(m.innerText) && /matches/.test(m.innerText)})()`));
  await ev(`document.getElementById('pay-approve-btn').click()`); await sleep(400);
  check('approving without confirming the money arrived is refused', await ev(`!document.getElementById('pay-review-error').classList.contains('hidden')`) && (await api('GET', '/api/admin/orders/' + encodeURIComponent(o2), null, adm)).data.order.paymentStatus === 'Pending Verification');
  await ev(`document.getElementById('pay-confirm-received').checked=true; document.getElementById('pay-approve-btn').click()`);
  check('approving after confirming marks the order Paid', await waitFor(`document.getElementById('admin-payment-modal').classList.contains('hidden')`) && (await api('GET', '/api/admin/orders/' + encodeURIComponent(o2), null, adm)).data.order.paymentStatus === 'Paid');
  check('payment alert in the bell shows the details with a Review Payment button', await (async () => { await ev(`adminApp.loadAdminNotifications().then(()=>{adminApp.closeNotificationsPopover(); adminApp.toggleNotificationsPopover();})`); return waitFor(`(()=>{const d=document.getElementById('topbar-notifications-dropdown'); return d && /UI-TEST-0001/.test(d.innerText) && /Review Payment/.test(d.innerText)})()`); })());
  await ev(`adminApp.closeNotificationsPopover()`);
  await api('POST', '/api/admin/orders/' + encodeURIComponent(o2) + '/confirm', {}, adm);
  for (const s of ['Preparing', 'Rider Assigned', 'On the Way']) await api('POST', '/api/admin/orders/' + encodeURIComponent(o2) + '/status', { status: s }, adm);
  await ev(`adminApp.loadOrders()`); await sleep(500);
  await ev(`adminApp.openOrderDetail(${JSON.stringify(o2)})`);
  // Approved delivery flow: an order On the Way is completed with Proof of Delivery (photo), then the
  // customer confirms receipt. The action opens the POD dialog for this order.
  await ev(`[...document.querySelectorAll('#admin-order-modal-content button')].find(b=>/Upload POD/.test(b.textContent)).click()`);
  check('"Upload POD & Mark Delivered" opens the Proof of Delivery dialog for this order',
    await ev(`!document.getElementById('admin-pod-modal').classList.contains('hidden') && document.getElementById('pod-modal-order-number').value === ${JSON.stringify(o2)}`));
  await ev(`adminApp.closePodModal()`);
  check('closing it leaves the order On the Way', await statusOf(o2) === 'On the Way');
  const podPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const podUp = await api('POST', '/api/admin/upload', { name: 'pod.png', dataUrl: podPng }, adm);
  await api('POST', '/api/admin/orders/' + encodeURIComponent(o2) + '/pod', { photoUrl: podUp.data.url }, adm);
  check('submitting proof of delivery marks it delivered, awaiting customer confirmation', await statusOf(o2) === 'Delivered — Awaiting Confirmation');

  console.log('\n[10] Admin products');
  await ev(`adminApp.switchTab('flowers')`); await waitFor(`adminApp.flowers.length>0`);
  const rose = await stockOf('fl-rose-red');
  await ev(`adminApp.editFlower('fl-rose-red')`);
  await ev(`document.getElementById('flower-field-price').value=${rose.price + 25}`);
  await ev(`document.getElementById('admin-flower-modal').querySelector('form').requestSubmit()`);
  check('changing a price asks to confirm and shows old -> new', await dialogTitle() === 'Save changes to ' + rose.name + '?' && await ev(`document.querySelector('[role$="dialog"] dl').innerText.includes('${rose.price + 25}')`));
  await clickDlg('cancel');
  check('Cancel leaves the price unchanged', (await stockOf('fl-rose-red')).price === rose.price);
  await ev(`document.getElementById('admin-flower-modal').querySelector('form').requestSubmit()`);
  await clickDlg('ok');
  check('confirm applies the new price', await waitFor(`!document.querySelector('[role$="dialog"]')`) && (await stockOf('fl-rose-red')).price === rose.price + 25);

  await ev(`void adminApp.quickUpdateStock('fl-rose-red', ${rose.stockCount})`);
  check('stock update uses a number dialog', await ev(`!!document.querySelector('[role$="dialog"] input[type=number]')`));
  await ev(`document.querySelector('[role$="dialog"] input').value='-4'`); await ev(`document.querySelector('[data-ui-ok]').click()`);
  check('invalid stock is rejected without a request', !(await ev(`document.querySelector('[role$="alert"]').classList.contains('hidden')`)) && (await stockOf('fl-rose-red')).stockCount === rose.stockCount);
  await ev(`document.querySelector('[role$="dialog"] input').value='40'`); await ev(`document.querySelector('[data-ui-ok]').click()`);
  check('valid stock is applied', await waitFor(`!document.querySelector('[role$="dialog"]')`) && (await stockOf('fl-rose-red')).stockCount === 40);

  await ev(`void adminApp.deleteFlower('fl-rose-red')`);
  check('Archive is a destructive confirmation naming the product', await dialogTitle() === 'Archive this flower?' && await ev(`document.querySelector('[data-ui-ok]').className.includes('bg-red-700') && document.querySelector('[role$="dialog"]').innerText.includes(${JSON.stringify(rose.name)})`));
  await clickDlg('cancel');
  check('Cancel keeps the product on the storefront', (await api('GET', '/api/catalog')).data.flowers.some(f => f.id === 'fl-rose-red'));
  await ev(`void adminApp.deleteFlower('fl-rose-red')`); await clickDlg('ok');
  check('confirm archives it', await waitFor(`!document.querySelector('[role$="dialog"]')`) && !(await api('GET', '/api/catalog')).data.flowers.some(f => f.id === 'fl-rose-red'));

  console.log('\n[11] Admin sign-out');
  await ev(`void adminApp.handleLogout()`);
  check('sign-out asks first', await dialogTitle() === 'Sign out of the admin console?');
  await clickDlg('cancel');
  check('Cancel keeps the admin signed in', (await api('GET', '/api/admin/stats', null, adm)).status === 200);
  await ev(`void adminApp.handleLogout()`); await clickDlg('ok');
  check('confirm signs out and revokes the session', await waitFor(`!document.getElementById('admin-login-screen').classList.contains('hidden')`) && (await api('GET', '/api/admin/stats', null, adm)).status === 401);

  console.log(`\nUI RESULT: ${pass} passed, ${fail} failed\n`);
  cleanup(fail ? 1 : 0);
})().catch((e) => { console.error('UI test crashed:', e); cleanup(1); });

function cleanup(code) {
  try { chrome && chrome.kill(); } catch (e) {}
  setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} process.exit(code); }, 500);
}
