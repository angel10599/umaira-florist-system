// Umaira Florist — Phase 4 Clean & Premium Customer UI/UX Verification
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'umaira-p4-test-'));
process.env.UMAIRA_DATA_DIR = tmp;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'VerifyPassword123!';
process.env.ORDER_RATE_LIMIT = '1000';
const app = require('../server.js');
const rules = require('../js/shop-rules.js');

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];
const browserPath = BROWSERS.find(p => fs.existsSync(p));
if (!browserPath) {
  console.log('SKIP: no Chrome/Edge found');
  process.exit(0);
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) {
    pass++;
    console.log('  ok   ' + name);
  } else {
    fail++;
    console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''));
  }
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let base, cdp, chrome;
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) {
        this.pending.get(d.id)(d);
        this.pending.delete(d.id);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, (d) => d.error ? rej(new Error(method + ': ' + d.error.message)) : res(d.result));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}
async function ev(expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('page error: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + '\n' + expr.slice(0, 200));
  return r.result.value;
}
async function waitFor(expr, ms = 8000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    try {
      if (await ev(expr)) return true;
    } catch (e) {}
    await sleep(100);
  }
  return false;
}
async function openPage(url) {
  await cdp.send('Page.navigate', { url });
  await waitFor(`document.readyState==='complete'`);
}

(async () => {
  try {
    const server = await app.start(0);
    base = 'http://127.0.0.1:' + server.address().port;
    chrome = spawn(browserPath, [
      '--headless=new',
      '--remote-debugging-port=9444',
      '--no-first-run',
      '--disable-gpu',
      '--user-data-dir=' + path.join(tmp, 'profile'),
      'about:blank'
    ], { stdio: 'ignore' });

    let targets;
    for (let i = 0; i < 50 && !targets; i++) {
      try {
        targets = await (await fetch('http://127.0.0.1:9444/json/list')).json();
      } catch (e) {
        await sleep(200);
      }
    }
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    cdp = new CDP(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('\n--- UMAIRA FLORIST PHASE 4 VERIFICATION ---');

    await openPage(base + '/');
    await waitFor(`window.appRouter && appState.catalogReady`);

    // [1] Homepage Structure & Consolidation (Guest View)
    console.log('\n[1] Homepage Sections & Restraint');
    await ev(`appRouter.navigate('home')`);
    await waitFor(`!!document.querySelector('[data-hero]')`);

    check('Hero floating sticker pills removed', await ev(`!document.querySelector('.tilt-pop-2') && !document.querySelector('.tilt-pop-3')`));
    check('The Atelier Curation section exists', await ev(`!!document.getElementById('home-featured')`));
    check('Featured section displays up to 6 bouquets', await ev(`document.querySelectorAll('#home-featured article').length <= 6 && document.querySelectorAll('#home-featured article').length > 0`));
    check('Featured section has top-right View All Collections link', await ev(`document.querySelector('#home-featured').innerText.includes('View All Collections →')`));
    const featuredLinks = await ev(`[...document.querySelectorAll('#home-featured button')].filter(b => b.innerText.includes('View All Collections')).length`);
    check('Featured section has exactly 1 View All Collections link (no duplicate bottom button)', featuredLinks === 1, featuredLinks);
    // The separate builder promo section was folded into the hero CTA and the Custom Bouquet Builder feature card.
    check('Home page offers the Bouquet Builder (hero CTA plus navigation)', await ev(`(document.body.textContent.match(/build your bouquet/gi) || []).length >= 2`));
    check('How to Order & Delivery section exists with 4 steps', await ev(`document.querySelectorAll('#home-how-to-order .font-serif.text-base.font-bold').length === 4`));
    check('Visit Our Atelier physical location section exists', await ev(`!!document.getElementById('home-atelier') && document.getElementById('home-atelier').innerText.includes('128 Rosa Street')`));
    check('Eliminated marquee and separate duplicate sections from home', await ev(`!document.querySelector('.su-wave') && !document.getElementById('guest-shop-preview')`));

    // [2] Collections Page Refinement
    console.log('\n[2] Collections Page & Product Modal');
    await ev(`appRouter.navigate('collections')`);
    await waitFor(`!!document.getElementById('su-filter-flower')`);

    check('Redundant category collection pills removed', await ev(`!document.getElementById('su-bouquet-chips')`));

    const bqId = await ev(`(FLOWER_DATA.featuredBouquets.find(b => b.availability !== 'sold_out') || FLOWER_DATA.featuredBouquets[0] || {}).id`);
    check('First bouquet found for modal test', !!bqId);
    await ev(`window.suOpenBouquet('${bqId}')`);
    await waitFor(`!!document.getElementById('su-bq-modal') && document.getElementById('su-bq-modal').classList.contains('is-open')`);

    check('Bouquet modal has live stock badge', await ev(`/in stock|left in stock|sold out|unavailable/i.test(document.getElementById('su-bq-modal').innerText)`));
    check('Bouquet modal has quantity stepper', await ev(`!!document.getElementById('su-bq-qty') && parseInt(document.getElementById('su-bq-qty').value, 10) === 1`));

    await ev(`window.suBqQtyChange(1)`);
    check('Quantity stepper increments correctly', await ev(`parseInt(document.getElementById('su-bq-qty').value, 10) === 2`));
    await ev(`window.suBqQtyChange(-1)`);
    check('Quantity stepper decrements correctly', await ev(`parseInt(document.getElementById('su-bq-qty').value, 10) === 1`));
    await ev(`window.suCloseBouquet()`);
    check('Bouquet modal closes cleanly', await ev(`!document.getElementById('su-bq-modal').classList.contains('is-open')`));

    // Authenticate Customer
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Clara Santos', email: 'clara@example.com', password: 'Password123!', phone: '09179998877' })
    })).json();

    await ev(`(async () => {
      await appState.setCurrentUser(${JSON.stringify(reg.user)}, ${JSON.stringify(reg.token)});
    })()`);

    // [3] Bouquet Builder Stems Filter (Authenticated)
    console.log('\n[3] Bouquet Builder Dynamic Stems');
    await ev(`appRouter.navigate('builder')`);
    await waitFor(`!!document.getElementById('builder-tab-content') && document.querySelectorAll('#builder-tab-content button').length > 0`);

    const builderChips = await ev(`[...document.querySelectorAll('#builder-tab-content button')].map(b => b.textContent.trim())`);
    check('Builder categories have blooms available in inventory', builderChips.length > 0 && builderChips[0] === 'All Blooms', builderChips);

    // [4] Cart View Navigation (Authenticated)
    console.log('\n[4] Cart Navigation Links');
    await ev(`appState.cart = []; appRouter.navigate('cart')`);
    await waitFor(`document.body.innerText.includes('Shopping Cart is Empty')`);

    const cartContinueLink = await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Collections'))?.getAttribute('onclick')`);
    check('Empty cart Explore Collections button navigates to collections', cartContinueLink && cartContinueLink.includes('collections'), cartContinueLink);

    // [5] Account & Inline Order Tracking
    console.log('\n[5] Account & Inline Order Tracking');
    const d = new Date();
    const generatedOrderNumber = '#FLR-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + Math.floor(1000 + Math.random() * 9000);
    const date = rules.earliestDate('delivery');
    const slot = (rules.deliverySlots && rules.deliverySlots.length > 0) ? rules.deliverySlots[0] : '10:00 AM - 1:00 PM';

    // Place an order to populate My Orders
    const orderRes = await (await fetch(base + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify({
        orderNumber: generatedOrderNumber,
        fulfillment: 'delivery',
        firstName: 'Clara',
        lastName: 'Santos',
        phone: '09179998877',
        email: 'clara@example.com',
        address: '50 Rizal Ave',
        district: '3',
        barangay: 'Barangay 300',
        city: 'Manila',
        date: date,
        time: slot,
        paymentMethod: 'GCash',
        items: [{ id: 'fl-rose-red', quantity: 2 }]
      })
    })).json();

    const orderNumber = orderRes.orderNumber;
    check('Test order placed for account verification', !!orderNumber, orderNumber);

    await ev(`appRouter.navigate('account')`);
    await waitFor(`!!document.getElementById('acct-orders') && !document.getElementById('acct-orders').innerText.includes('Loading')`);

    check('Order card has inline tracking toggle button', await ev(`!!document.getElementById('order-track-btn-' + ${JSON.stringify(orderNumber)})`));
    check('Inline tracking panel starts hidden', await ev(`document.getElementById('order-track-' + ${JSON.stringify(orderNumber)}).classList.contains('hidden')`));

    await ev(`window.toggleOrderTracking(${JSON.stringify(orderNumber)})`);
    check('Clicking toggle expands the inline tracking timeline without leaving the page', await ev(`!document.getElementById('order-track-' + ${JSON.stringify(orderNumber)}).classList.contains('hidden') && appRouter.currentView === 'account'`));
    check('Inline tracking shows order number and stage timeline', await ev(`document.getElementById('order-track-' + ${JSON.stringify(orderNumber)}).innerText.includes(${JSON.stringify(orderNumber)}) && document.getElementById('order-track-' + ${JSON.stringify(orderNumber)}).innerText.includes('Pending Confirmation')`));

    await ev(`window.toggleOrderTracking(${JSON.stringify(orderNumber)})`);
    check('Clicking toggle again collapses the panel', await ev(`document.getElementById('order-track-' + ${JSON.stringify(orderNumber)}).classList.contains('hidden')`));

    console.log('\n========================================');
    console.log(`PHASE 4 RESULT: ${pass} passed, ${fail} failed`);
    console.log('========================================\n');

    server.close();
    chrome.kill();
    process.exit(fail === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    if (chrome) chrome.kill();
    process.exit(1);
  }
})();
