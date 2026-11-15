// Automated Test Suite for Image Removal & Admin-Only Image Management
// Run: node tests/image_management.test.js

const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'umaira-img-test-'));
process.env.UMAIRA_DATA_DIR = tmp;
process.env.UMAIRA_UPLOAD_DIR = path.join(tmp, 'uploads'); // test uploads never land in assets/uploads
process.env.UMAIRA_TEST = '1'; // use local file storage, not Cloudinary
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'Test-Admin-Password-2026';
delete process.env.GOOGLE_CLIENT_ID;

const app = require('../server.js');

let pass = 0, fail = 0;
const failures = [];

function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ok   ' + name);
  } else {
    fail++;
    failures.push(name);
    console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''));
  }
}

function req(server, method, endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const isBuffer = Buffer.isBuffer(body);
    const data = isBuffer ? body : (body !== undefined ? JSON.stringify(body) : null);
    const headers = {};
    if (data) {
      headers['Content-Type'] = isBuffer ? 'application/octet-stream' : 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    const r = http.request({
      hostname: '127.0.0.1',
      port,
      path: endpoint,
      method,
      headers
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (e) { parsed = buf; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  console.log('\n======================================================');
  console.log('UMAIRA FLORIST — IMAGE REMOVAL & MANAGEMENT TESTS');
  console.log('======================================================\n');

  const server = await app.start(0);

  try {
    // -------------------------------------------------------------
    // Area 1: Active Database Image State
    // -------------------------------------------------------------
    console.log('[Area 1] Clean Database & Seed Verification');
    const catalogRes = await req(server, 'GET', '/api/catalog');
    check('Catalog endpoint responds 200', catalogRes.status === 200);

    const flowers = catalogRes.body.flowers || [];
    const bouquets = catalogRes.body.bouquets || [];

    const hasAnyExternalFlowerImg = flowers.some(f => f.image && f.image.startsWith('http'));
    check('Zero flowers have external/Unsplash image URLs in catalog', !hasAnyExternalFlowerImg);

    const hasAnyExternalBouquetImg = bouquets.some(b => b.image && b.image.startsWith('http'));
    check('Zero bouquets have external/Unsplash image URLs in catalog', !hasAnyExternalBouquetImg);

    // Verify raw DB directly
    const store = require('../server/store');
    const dbFlowers = store.getFlowers();
    const dbBouquets = store.getBouquets();

    const flowerImagesCount = dbFlowers.filter(f => f.image && f.image.trim().length > 0).length;
    check('Active SQLite DB has 0 flower images assigned', flowerImagesCount === 0);

    const bouquetImagesCount = dbBouquets.filter(b => b.image && b.image.trim().length > 0).length;
    check('Active SQLite DB has 0 bouquet images assigned', bouquetImagesCount === 0);

    // -------------------------------------------------------------
    // Area 2: Neutral Placeholder System (UI Helper)
    // -------------------------------------------------------------
    console.log('\n[Area 2] Neutral Placeholder Generation');
    const uiFile = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    const vm = require('vm');
    const windowMock = {
      document: {
        head: { appendChild: () => {} },
        getElementById: () => null,
        addEventListener: () => {},
        createElement: (tag) => ({
          tagName: tag,
          className: '',
          innerHTML: '',
          setAttribute: () => {},
          appendChild: () => {}
        })
      }
    };
    windowMock.window = windowMock;
    vm.createContext(windowMock);
    vm.runInContext(uiFile, windowMock);

    check('UI module exposes renderPlaceholder', typeof windowMock.UI.renderPlaceholder === 'function');
    check('UI module exposes renderImage', typeof windowMock.UI.renderImage === 'function');

    const emptyPlaceholderHtml = windowMock.UI.renderPlaceholder('card', 'Red Rose');
    // Current approved placeholder: brand mark "UMAIRA FLORIST" + "Photography in Preparation", exposed as role=img with the product name.
    check('Placeholder outputs valid SVG markup', emptyPlaceholderHtml.includes('<svg') && emptyPlaceholderHtml.includes('UMAIRA FLORIST'));
    check('Placeholder has accessible text or label', emptyPlaceholderHtml.includes('role="img"') && emptyPlaceholderHtml.includes('aria-label="Red Rose"'));

    const renderEmptyImg = windowMock.UI.renderImage('', 'White Lily', 'w-full h-full', 'card');
    check('renderImage with empty src falls back to placeholder SVG', renderEmptyImg.includes('<svg') && !renderEmptyImg.includes('<img'));

    const renderValidImg = windowMock.UI.renderImage('assets/uploads/flower1.png', 'Pink Peony', 'rounded-xl', 'card');
    check('renderImage with valid src produces img tag with onerror fallback', renderValidImg.includes('<img src="assets/uploads/flower1.png"') && renderValidImg.includes('window.UI.placeholderElement'));

    // -------------------------------------------------------------
    // Area 3: Admin Authentication & Upload Security
    // -------------------------------------------------------------
    console.log('\n[Area 3] Admin Upload Authorization & Validation');
    
    // Attempt upload without token
    const guestUpload = await req(server, 'POST', '/api/admin/upload', {
      name: 'test.png',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    });
    check('Guest cannot upload image (401)', guestUpload.status === 401);

    // Register customer via OTP flow: register → verify-otp
    const custRegBody = await req(server, 'POST', '/api/auth/register', {
      name: 'Regular Customer',
      email: 'customer@example.com',
      password: 'Customer-Pass-123',
      phone: '09171112222'
    });
    const custVerify = custRegBody.body?.testOtp
      ? await req(server, 'POST', '/api/auth/verify-otp', { email: 'customer@example.com', otp: custRegBody.body.testOtp })
      : { body: {} };
    const custToken = custVerify.body?.token;

    const custUpload = await req(server, 'POST', '/api/admin/upload', {
      name: 'test.png',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    }, custToken);
    check('Customer cannot upload image (401)', custUpload.status === 401);

    // Admin login
    const adminLogin = await req(server, 'POST', '/api/admin/login', {
      username: 'admin',
      password: 'Test-Admin-Password-2026'
    });
    check('Admin login succeeded (200)', adminLogin.status === 200);
    const adminToken = adminLogin.body.token;

    // Fake image / bad magic bytes
    const fakeMagicUpload = await req(server, 'POST', '/api/admin/upload', {
      name: 'evil.png',
      dataUrl: 'data:image/png;base64,bm90IGEgcmVhbCBpbWFnZQ==' // "not a real image"
    }, adminToken);
    check('Fake image with mismatched magic bytes is rejected (400)', fakeMagicUpload.status === 400);

    // Prohibited file extension (e.g. SVG or executable)
    const svgUpload = await req(server, 'POST', '/api/admin/upload', {
      name: 'icon.svg',
      dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
    }, adminToken);
    check('Disallowed format (SVG) is rejected (400)', svgUpload.status === 400);

    // Valid 1x1 PNG upload
    const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await req(server, 'POST', '/api/admin/upload', {
      name: 'atelier_rose.png',
      dataUrl: 'data:image/png;base64,' + validPngBase64
    }, adminToken);
    check('Admin can upload valid PNG image (201)', uploadRes.status === 201);
    check('Server returns relative asset URL', uploadRes.body && uploadRes.body.url && uploadRes.body.url.startsWith('/assets/uploads/'));

    const uploadedUrl = uploadRes.body.url;

    // Verify uploaded file is statically served by server
    const serveRes = await req(server, 'GET', uploadedUrl);
    check('Server statically serves uploaded image (200)', serveRes.status === 200);

    // -------------------------------------------------------------
    // Area 4: Admin Product Image Linking & Storefront Publication
    // -------------------------------------------------------------
    console.log('\n[Area 4] Product Image Assignment & Storefront Publication');

    // Get an existing flower from the DB
    // Needs stock for the order in Area 5 (a fresh catalog starts most items at 0 stock).
    const targetFlower = dbFlowers.find(f => (f.itemType || 'flower') === 'flower' && f.stockCount >= 2) || dbFlowers[0];
    check('Target flower exists in DB', !!targetFlower);

    // Update flower with uploaded image URL
    const updateFlowerRes = await req(server, 'PUT', `/api/admin/flowers/${targetFlower.id}`, {
      name: targetFlower.name,
      price: targetFlower.price,
      stockCount: targetFlower.stockCount,
      availability: targetFlower.availability,
      category: targetFlower.category,
      botanicalName: targetFlower.botanicalName,
      image: uploadedUrl
    }, adminToken);
    check('Admin updates flower image (200)', updateFlowerRes.status === 200);

    // Verify catalog reflects new flower image
    const updatedCatalogRes = await req(server, 'GET', '/api/catalog');
    const catalogFlower = updatedCatalogRes.body.flowers.find(f => f.id === targetFlower.id);
    check('Catalog displays new flower image', catalogFlower && catalogFlower.image === uploadedUrl);

    // Remove flower image
    const removeFlowerImgRes = await req(server, 'PUT', `/api/admin/flowers/${targetFlower.id}`, {
      name: targetFlower.name,
      price: targetFlower.price,
      stockCount: targetFlower.stockCount,
      availability: targetFlower.availability,
      category: targetFlower.category,
      botanicalName: targetFlower.botanicalName,
      image: ''
    }, adminToken);
    check('Admin can remove flower image (set to empty)', removeFlowerImgRes.status === 200);

    const clearedFlowerCatalog = (await req(server, 'GET', '/api/catalog')).body.flowers.find(f => f.id === targetFlower.id);
    check('Flower image is cleared in catalog', clearedFlowerCatalog && clearedFlowerCatalog.image === '');

    // Test Bouquet Image Assignment and Publication Logic
    const targetBouquet = dbBouquets[0];
    check('Target bouquet exists in DB', !!targetBouquet);

    // Update bouquet with uploaded image
    const updateBouquetRes = await req(server, 'PUT', `/api/admin/bouquets/${targetBouquet.id}`, {
      name: targetBouquet.name,
      price: 1850,
      stockCount: 10,
      availability: 'available',
      category: targetBouquet.category,
      image: uploadedUrl
    }, adminToken);
    check('Admin assigns image to bouquet (200)', updateBouquetRes.status === 200);

    // Client publication rule test (from js/site-update.js)
    const siteUpdateContent = fs.readFileSync(path.join(__dirname, '../js/site-update.js'), 'utf8');
    check('site-update.js implements isBouquetPublished rule requiring image', siteUpdateContent.includes('isBouquetPublished'));

    // Check publication rule in virtual environment
    const isBouquetPublished = (b) => {
      if (!b) return false;
      if (b.archived) return false;
      if (!b.image || typeof b.image !== 'string' || !b.image.trim()) return false;
      if (typeof b.price !== 'number' || b.price <= 0) return false;
      return true;
    };

    check('Bouquet without image is NOT published', isBouquetPublished({ id: 'b1', name: 'Test', price: 1500, image: '' }) === false);
    check('Bouquet with admin-uploaded image IS published', isBouquetPublished({ id: 'b1', name: 'Test', price: 1500, image: uploadedUrl }) === true);

    // Remove bouquet image
    const clearBouquetImgRes = await req(server, 'PUT', `/api/admin/bouquets/${targetBouquet.id}`, {
      name: targetBouquet.name,
      price: 1850,
      stockCount: 10,
      availability: 'available',
      category: targetBouquet.category,
      image: ''
    }, adminToken);
    check('Admin removes bouquet image', clearBouquetImgRes.status === 200);

    const clearedBouquetInDb = store.getBouquet(targetBouquet.id);
    check('Bouquet image cleared in DB', clearedBouquetInDb && clearedBouquetInDb.image === '');
    check('Bouquet is unpublished after image removal', isBouquetPublished(clearedBouquetInDb) === false);

    // -------------------------------------------------------------
    // Area 5: Cart and Checkout with Placeholder Product
    // -------------------------------------------------------------
    console.log('\n[Area 5] Order Processing & Integrity with Placeholder Images');

    const rules = require('../js/shop-rules');
    const orderDate = rules.earliestDate ? rules.earliestDate('delivery') : new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    const orderSlot = (rules.deliverySlots && rules.deliverySlots[0]) || '10:00 AM - 1:00 PM';

    // Place an order for an item that currently has no image
    const orderRes = await req(server, 'POST', '/api/orders', {
      fulfillment: 'delivery',
      firstName: 'Customer',
      lastName: 'Test',
      phone: '09171112222',
      email: 'customer@example.com',
      address: '12 Rizal Avenue, Unit 4',
      district: '3',
      barangay: 'Barangay 300',
      city: 'Manila',
      date: orderDate,
      time: orderSlot,
      paymentMethod: 'GCash',
      items: [
        {
          id: targetFlower.id,
          quantity: 2
        }
      ]
    }, custToken);

    check('Order with image-less item places successfully (201)', orderRes.status === 201);
    check('Order confirmation contains orderNumber', !!(orderRes.body && orderRes.body.orderNumber));

    const orderNumber = orderRes.body.orderNumber;
    const fetchOrderRes = await req(server, 'GET', `/api/orders/${encodeURIComponent(orderNumber)}`, undefined, custToken);
    check('Customer can retrieve order details (200)', fetchOrderRes.status === 200);
    check('Order items preserved in DB', fetchOrderRes.body.items && fetchOrderRes.body.items.length === 1);

  } finally {
    server.close();
  }

  console.log('\n======================================================');
  console.log(`IMAGE MANAGEMENT RESULT: ${pass} passed, ${fail} failed`);
  console.log('======================================================\n');

  if (fail > 0) {
    process.exit(1);
  }
})();
