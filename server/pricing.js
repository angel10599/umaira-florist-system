// Prices every cart line on the server from the database, so a tampered browser request can
// never change what a customer is charged. Also reports how many stems of each flower the
// order consumes so stock can be checked and decremented atomically.
const rules = require('../js/shop-rules.js');

// Every flower and builder material (fillers, foliage, wrapping, ribbons, cards) is admin-managed in the
// database. Nothing is priced from the static js/data.js file: an id that is not in the database is refused.
const MAX_FILLER_QTY = 10; // matches the builder's per-filler stepper limit

// Stock as exposed by store.getFlower()/getBouquet() rows.
const stockOf = (row) => (row && row.stockCount !== undefined && row.stockCount !== null) ? Number(row.stockCount)
  : (row && row.stock_count !== undefined && row.stock_count !== null ? Number(row.stock_count) : undefined);
const notSellable = (row) => !row || row.archived || row.availability === 'unavailable' || row.availability === 'sold_out' ||
  (stockOf(row) !== undefined && stockOf(row) <= 0);

async function priceCartItems(cart, store) {
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 50) return { error: 'Your cart is empty or invalid.' };
  const rows = [];
  const stockNeeds = {};
  let subtotal = 0;
  const money = (n) => Math.round(n * 100) / 100;

  for (const raw of cart) {
    if (!raw || typeof raw !== 'object') return { error: 'Your cart is empty or invalid.' };
    const qty = Number(raw.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) return { error: 'Invalid item quantity.' };
    const card = String(raw.message || '').slice(0, 250);

    if (raw.isCustom) {
      const s = (raw.specs && typeof raw.specs === 'object') ? raw.specs : {};
      const bouquetName = String(raw.name || 'Custom Bouquet').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) || 'Custom Bouquet';
      const cardMsg = String(s.cardMessage || s.message || raw.message || '').slice(0, 250);
      const add = (type, item, perBouquetQty, displayName) => {
        const q = perBouquetQty * qty;
        const line = money(item.price * q);
        subtotal += line;
        rows.push({ bouquetName, type, itemId: item.id, name: displayName || item.name, quantity: q, unitPrice: item.price, lineTotal: line, cardMessage: cardMsg });
        stockNeeds[item.id] = (stockNeeds[item.id] || 0) + q;
      };
      // Resolve a builder component from the database and check it is the right kind of item.
      const resolve = async (id, allowedTypes, label) => {
        const item = id ? await store.getFlower(String(id)) : null;
        if (!item || !allowedTypes.includes(item.itemType || 'flower')) return { error: `A selected ${label} is no longer available.` };
        if (notSellable(item)) return { error: `${item.name} is currently unavailable for purchase.` };
        return { item };
      };
      const idOf = (x) => (x && typeof x === 'object') ? x.id : x;
      const colorOf = (x) => (x && typeof x === 'object' && x.color) ? String(x.color).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40) : '';

      // 1. Main flowers (stem limits come from Shop Settings)
      let stems = 0;
      const seen = new Set();
      for (const f of (Array.isArray(s.mainFlowers) ? s.mainFlowers : [])) {
        const fq = Number(f && f.quantity);
        if (!Number.isInteger(fq) || fq < 1 || fq > 200) return { error: 'Invalid flower quantity in custom bouquet.' };
        const r = await resolve(idOf(f), ['flower'], 'flower');
        if (r.error) return { error: r.error === 'A selected flower is no longer available.' ? 'A selected flower is not available.' : r.error };
        if (seen.has(r.item.id)) return { error: 'Duplicate flower in custom bouquet.' };
        seen.add(r.item.id);
        stems += fq;
        add('flower', r.item, fq);
      }

      const bSettings = (store.getSetting ? await store.getSetting('custom_builder') : null) || {};
      const minStems = bSettings.minStems !== undefined ? Number(bSettings.minStems) : 1;
      const maxStems = bSettings.maxStems !== undefined ? Number(bSettings.maxStems) : 50;
      if (stems < Math.max(1, minStems)) return { error: minStems <= 1 ? 'A custom bouquet needs at least one flower.' : `A custom bouquet needs at least ${minStems} flower stems.` };
      if (stems > maxStems) return { error: `A custom bouquet cannot exceed ${maxStems} flower stems.` };

      // 2. Fillers & foliage (0 to 3 types, whole quantities 1..10 each)
      const fillerList = (Array.isArray(s.fillers) && s.fillers.length)
        ? s.fillers
        : [s.filler, s.greenery].filter(Boolean).map(id => ({ id, quantity: 1 }));
      if (fillerList.length > 3) return { error: 'You may select up to 3 filler & greenery types.' };
      const seenFill = new Set();
      for (const fi of fillerList) {
        const fqty = (fi && typeof fi === 'object' && fi.quantity !== undefined) ? Number(fi.quantity) : 1;
        if (!Number.isInteger(fqty) || fqty < 1 || fqty > MAX_FILLER_QTY) return { error: `Filler quantities must be whole numbers from 1 to ${MAX_FILLER_QTY}.` };
        const r = await resolve(idOf(fi), ['filler', 'foliage'], 'filler or greenery');
        if (r.error) return { error: r.error };
        if (seenFill.has(r.item.id)) return { error: 'Duplicate filler in custom bouquet.' };
        seenFill.add(r.item.id);
        add('filler', r.item, fqty);
      }

      // 3. Wrapping (1 to 3 types, optional colour)
      const wrapList = (Array.isArray(s.wrappings) && s.wrappings.length) ? s.wrappings : (s.wrapping ? [s.wrapping] : []);
      if (wrapList.length === 0) return { error: 'Please select at least 1 wrapping option.' };
      if (wrapList.length > 3) return { error: 'You may select up to 3 wrapping types.' };
      const seenWrap = new Set();
      for (const w of wrapList) {
        const r = await resolve(idOf(w), ['wrapping'], 'wrapping');
        if (r.error) return { error: r.error };
        if (seenWrap.has(r.item.id)) return { error: 'Duplicate wrapping in custom bouquet.' };
        seenWrap.add(r.item.id);
        const c = colorOf(w);
        add('wrapping', r.item, 1, c ? `${r.item.name} (${c})` : r.item.name);
      }

      // 4. Ribbons (0 to 2 types, optional colour)
      const ribbonList = (Array.isArray(s.ribbons) && s.ribbons.length) ? s.ribbons : (s.ribbon ? [s.ribbon] : []);
      if (ribbonList.length > 2) return { error: 'You may select up to 2 ribbon types.' };
      const seenRib = new Set();
      for (const rb of ribbonList) {
        const r = await resolve(idOf(rb), ['ribbon'], 'ribbon');
        if (r.error) return { error: r.error };
        if (seenRib.has(r.item.id)) return { error: 'Duplicate ribbon in custom bouquet.' };
        seenRib.add(r.item.id);
        const c = colorOf(rb);
        add('ribbon', r.item, 1, c ? `${r.item.name} (${c})` : r.item.name);
      }

      // 5. Greeting card (0 or 1)
      if (s.cardDesign && s.cardDesign !== 'crd-none') {
        const r = await resolve(s.cardDesign, ['card'], 'greeting card');
        if (r.error) return { error: r.error };
        add('card', r.item, 1);
      }
    } else {
      const bq = await store.getBouquet(raw.id);
      if (bq) {
        // Ready-made bouquets carry their own stock; their recipe ingredients are NOT deducted.
        if (notSellable(bq)) return { error: `${bq.name} is currently unavailable.` };
        if (stockOf(bq) !== undefined && stockOf(bq) < qty) return { error: `Only ${stockOf(bq)} bouquet(s) of ${bq.name} left in stock.` };
        stockNeeds[bq.id] = (stockNeeds[bq.id] || 0) + qty;
        const line = money(bq.price * qty);
        subtotal += line;
        rows.push({ bouquetName: bq.name, type: 'ready_bouquet', itemId: bq.id, name: bq.name, quantity: qty, unitPrice: bq.price, lineTotal: line, cardMessage: card });
        continue;
      }
      const fl = await store.getFlower(raw.id);
      if (!fl || fl.archived) return { error: 'An item in your cart is no longer available.' };
      if (notSellable(fl)) return { error: `${fl.name} is currently unavailable for purchase.` };
      if (stockOf(fl) !== undefined && stockOf(fl) < qty) return { error: `Only ${stockOf(fl)} ${fl.unitOfMeasure || 'stem(s)'} of ${fl.name} left in stock.` };
      const line = money(fl.price * qty);
      subtotal += line;
      rows.push({ bouquetName: fl.name, type: 'flower', itemId: fl.id, name: fl.name, quantity: qty, unitPrice: fl.price, lineTotal: line, cardMessage: card });
      stockNeeds[fl.id] = (stockNeeds[fl.id] || 0) + qty;
    }
  }
  return { rows, subtotal: money(subtotal), stockNeeds };
}

const deliveryFee = async (subtotal, fulfillment, store) => {
  let threshold = 2500;
  let fee = 150;
  let currentStore = store;
  if (!currentStore) {
    try { currentStore = require('./store'); } catch (_) {}
  }
  if (currentStore && typeof currentStore.getSetting === 'function') {
    const d = await currentStore.getSetting('delivery');
    if (d) {
      if (typeof d.freeThreshold === 'number') threshold = d.freeThreshold;
      else if (typeof d.freeDeliveryThreshold === 'number') threshold = d.freeDeliveryThreshold;
      else if (d.freeThreshold !== undefined && !isNaN(Number(d.freeThreshold))) threshold = Number(d.freeThreshold);
      else if (d.freeDeliveryThreshold !== undefined && !isNaN(Number(d.freeDeliveryThreshold))) threshold = Number(d.freeDeliveryThreshold);

      if (typeof d.fee === 'number') fee = d.fee;
      else if (typeof d.defaultFee === 'number') fee = d.defaultFee;
      else if (d.fee !== undefined && !isNaN(Number(d.fee))) fee = Number(d.fee);
      else if (d.defaultFee !== undefined && !isNaN(Number(d.defaultFee))) fee = Number(d.defaultFee);
    }
  }
  return rules.deliveryFee(subtotal, fulfillment, threshold, fee);
};

module.exports = { priceCartItems, deliveryFee };
