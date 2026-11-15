/**
 * UMAIRA FLORIST - Shop information and ordering rules.
 * Shared by the website (checkout form) and the server (order validation),
 * so both apply exactly the same rules.
 */
const SHOP_RULES = (function () {
  const info = {
    name: 'Umaira Florist Atelier',
    address: '128 Rosa Street, BGC, Taguig City, Metro Manila',
    hoursText: 'Monday – Sunday: 8:00 AM – 8:00 PM',
    openMinutes: 8 * 60,
    closeMinutes: 20 * 60,
    phone: '+63 917 892 4310',
    email: 'concierge@umairaflorist.com',
    description: 'Bespoke florist atelier crafting luxury arrangements and curated botanical gifts.',
    tagline: 'Flowers Made With Love.',
    operatingDays: 'Monday – Sunday',
    openingTime: '08:00',
    closingTime: '20:00',
    acceptingOrders: true
  };

  function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 8 * 60;
    const parts = String(timeStr).split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
  }

  function formatTimeStr(timeStr) {
    if (!timeStr) return '8:00 AM';
    const m = parseTimeToMinutes(timeStr);
    return fmtTime(m);
  }

  function updateShopInfo(data) {
    if (!data || typeof data !== 'object') return;
    if (data.store) {
      if (data.store.name) info.name = data.store.name;
      if (data.store.address) info.address = data.store.address;
      if (data.store.phone) info.phone = data.store.phone;
      if (data.store.email) info.email = data.store.email;
      if (data.store.description) info.description = data.store.description;
      if (data.store.tagline) info.tagline = data.store.tagline;
    }
    if (data.pickup && data.pickup.address) {
      info.pickupAddress = data.pickup.address;
    }
    if (data.pickup && typeof data.pickup.instructions === 'string') info.pickupInstructions = data.pickup.instructions;
    if (data.pickup && data.pickup.leadTimeHours !== undefined && data.pickup.leadTimeHours !== null && data.pickup.leadTimeHours !== '') {
      const h = Number(data.pickup.leadTimeHours);
      if (Number.isFinite(h) && h >= 0 && h <= 48) PICKUP_LEAD_MINUTES = Math.round(h * 60);
    }
    if (data.hours) {
      const open = data.hours.openingTime || '08:00';
      const close = data.hours.closingTime || '20:00';
      const days = data.hours.operatingDays || 'Monday – Sunday';
      info.openingTime = open;
      info.closingTime = close;
      info.operatingDays = days;
      info.openMinutes = parseTimeToMinutes(open);
      info.closeMinutes = parseTimeToMinutes(close);
      info.hoursText = `${days}: ${formatTimeStr(open)} – ${formatTimeStr(close)}`;
      if (data.hours.acceptingOrders !== undefined) {
        info.acceptingOrders = Boolean(data.hours.acceptingOrders);
      }
    }
  }

  function getManilaDayOfWeek(dateStr) {
    if (!dateStr) return 'Monday';
    const parts = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  }

  function isOperatingDay(dayName, operatingDaysStr) {
    const str = String(operatingDaysStr || 'Monday – Sunday').trim().toLowerCase();
    if (!str || str.includes('daily') || str.includes('everyday') || str.includes('every day') || str.includes('all days') || str.includes('mon – sun') || str.includes('monday – sunday') || str.includes('mon - sun') || str.includes('monday - sunday')) {
      return true;
    }
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const curName = String(dayName).toLowerCase();
    // Ranges like "Monday – Saturday", "Mon-Fri", "Tuesday to Sunday" (separator is a dash or the word "to").
    const rangeMatch = str.match(/\b([a-z]+)\s*(?:–|—|-|\bto\b)\s*([a-z]+)\b/i);
    if (rangeMatch) {
      const sName = rangeMatch[1].toLowerCase();
      const eName = rangeMatch[2].toLowerCase();
      const sIdx = days.findIndex(d => d.toLowerCase().startsWith(sName.slice(0, 3)));
      const eIdx = days.findIndex(d => d.toLowerCase().startsWith(eName.slice(0, 3)));
      const cIdx = days.findIndex(d => d.toLowerCase() === curName || d.toLowerCase().startsWith(curName.slice(0, 3)));
      if (sIdx !== -1 && eIdx !== -1 && cIdx !== -1) {
        if (sIdx <= eIdx) return cIdx >= sIdx && cIdx <= eIdx;
        return cIdx >= sIdx || cIdx <= eIdx;
      }
    }
    return str.includes(curName) || str.includes(curName.slice(0, 3));
  }

  function isShopOpen(customHours) {
    const h = customHours || (info.hours || {
      openingTime: info.openingTime || '08:00',
      closingTime: info.closingTime || '20:00',
      operatingDays: info.operatingDays || 'Monday – Sunday',
      acceptingOrders: info.acceptingOrders !== false
    });
    const now = manilaNow();
    const dayName = getManilaDayOfWeek(now.date);
    const dayOpen = isOperatingDay(dayName, h.operatingDays || 'Monday – Sunday');
    const openM = parseTimeToMinutes(h.openingTime || '08:00');
    const closeM = parseTimeToMinutes(h.closingTime || '20:00');
    return dayOpen && now.minutes >= openM && now.minutes < closeM;
  }

  function getNextOpeningText(customHours) {
    const h = customHours || (info.hours || {
      openingTime: info.openingTime || '08:00',
      closingTime: info.closingTime || '20:00',
      operatingDays: info.operatingDays || 'Monday – Sunday',
      acceptingOrders: info.acceptingOrders !== false
    });
    const now = manilaNow();
    const openM = parseTimeToMinutes(h.openingTime || '08:00');
    const timeFormatted = fmtTime(openM);
    const todayName = getManilaDayOfWeek(now.date);
    const todayIsOpen = isOperatingDay(todayName, h.operatingDays || 'Monday – Sunday');

    // Case 1: Today is an operating day and opening time hasn't occurred yet
    if (todayIsOpen && now.minutes < openM) {
      return `Today at ${timeFormatted}`;
    }

    // Case 2: Check upcoming days (tomorrow, +2, +3...)
    for (let i = 1; i <= 7; i++) {
      const nextDate = addDays(now.date, i);
      const nextDayName = getManilaDayOfWeek(nextDate);
      if (isOperatingDay(nextDayName, h.operatingDays || 'Monday – Sunday')) {
        if (i === 1) return `Tomorrow at ${timeFormatted}`;
        return `${nextDayName} at ${timeFormatted}`;
      }
    }
    return `Tomorrow at ${timeFormatted}`;
  }

  function isAcceptingOrders(customHours) {
    if (customHours && customHours.acceptingOrders !== undefined) {
      return Boolean(customHours.acceptingOrders);
    }
    return info.acceptingOrders !== false;
  }

  const deliverySlots = [
    'Morning (9:00 AM – 12:00 PM)',
    'Afternoon (1:00 PM – 4:00 PM)',
    'Evening (5:00 PM – 7:00 PM)'
  ];

  // Delivery charge: flat fee, waived at or above the free-delivery minimum. Pickup is always free.
  let DELIVERY_FEE = 150;
  let FREE_DELIVERY_MIN = 2500;

  function getDeliveryFeeSetting() { return DELIVERY_FEE; }
  function getFreeDeliveryMin() { return FREE_DELIVERY_MIN; }

  function setDeliverySettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    const fee = settings.fee !== undefined ? Number(settings.fee) : (settings.defaultFee !== undefined ? Number(settings.defaultFee) : NaN);
    const threshold = settings.freeThreshold !== undefined ? Number(settings.freeThreshold) : (settings.freeDeliveryThreshold !== undefined ? Number(settings.freeDeliveryThreshold) : NaN);
    if (!isNaN(fee) && fee >= 0) DELIVERY_FEE = fee;
    if (!isNaN(threshold) && threshold >= 0) FREE_DELIVERY_MIN = threshold;
  }

  function deliveryFee(subtotal, fulfillment, customThreshold, customFee) {
    if (fulfillment === 'pickup' || !(subtotal > 0)) return 0;
    const threshold = (typeof customThreshold === 'number' && !isNaN(customThreshold)) ? customThreshold : FREE_DELIVERY_MIN;
    const fee = (typeof customFee === 'number' && !isNaN(customFee)) ? customFee : DELIVERY_FEE;
    return subtotal >= threshold ? 0 : fee;
  }

  // Preparation time for same-day pickups. Admin → Shop Settings → Store Pickup ("Preparation time"); default 2 hours.
  let PICKUP_LEAD_MINUTES = 120;
  // Payment methods offered for NEW orders. 'Bank Transfer' (BDO) is retired: it is still recognised so that
  // historical BDO orders and their payment records display and can be finished, but it cannot be chosen.
  const paymentMethods = ['GCash', 'Cash on Pickup', 'Cash on Delivery'];
  const LEGACY_PAYMENT_METHODS = ['Bank Transfer'];

  // ---- Order status groups (one definition for the server, the admin console and the reports) ----
  // "Done" = fulfilment finished. Revenue additionally requires the payment to be Paid.
  const ACTIVE_ORDER_STATUSES = ['Confirmed', 'Preparing', 'Rider Assigned', 'On the Way', 'Out for Delivery', 'Delivery Attempt Failed',
    'Ready for Pickup', 'Awaiting Customer Confirmation', 'Pickup Disputed', 'Delivered — Awaiting Confirmation', 'Delivery Disputed'];
  const DONE_ORDER_STATUSES = ['Delivered — Confirmed', 'Delivered', 'Picked Up'];
  // Confirmation deadlines: if the customer neither confirms nor reports an issue, they are reminded once and
  // the order is then confirmed automatically (recorded as "Automatic"; the payment status is never touched).
  const CONFIRMATION_DEADLINES = {
    pickup: { remindAfterHours: 6, autoConfirmAfterHours: 24 },
    delivery: { remindAfterHours: 24, autoConfirmAfterHours: 48 }
  };

  // ---- Payment status (kept separate from the fulfillment status) ----
  // GCash:            Unpaid -> Pending Verification (proof uploaded) -> Paid (admin verified) | Rejected (new proof allowed)
  // Cash on Pickup:   Unpaid -> Paid (cash counted at the shop, confirmed by an authorised person)
  // Cash on Delivery: Unpaid -> Paid (cash collected by the courier, remitted to the shop and confirmed)
  const PAYMENT_STATUSES = ['Unpaid', 'Pending Verification', 'Paid', 'Rejected'];
  const ONLINE_PAYMENT_METHODS = ['GCash', 'Bank Transfer'];
  // Order steps that need the payment first. Nothing here ever marks an order Paid.
  //  • GCash (and legacy BDO): verified advance payment before the order is Confirmed or Preparing.
  //  • Cash on Pickup: prepared while Unpaid, but never released (Picked Up) before the cash is confirmed.
  //  • Cash on Delivery: never blocked; it stays Unpaid after delivery until remitted cash is confirmed.
  function paymentBlocksStatus(method, paymentStatus, newStatus) {
    if (normalizePaymentStatus(paymentStatus) === 'Paid') return null;
    const st = normalizePaymentStatus(paymentStatus);
    const m = String(method || '');
    if (ONLINE_PAYMENT_METHODS.includes(m) && (newStatus === 'Confirmed' || newStatus === 'Preparing')) {
      const label = paymentMethodLabel(m);
      const why = st === 'Pending Verification' ? 'the payment proof is waiting for verification'
        : st === 'Rejected' ? 'the last payment proof was rejected' : 'no verified payment yet';
      return `${label} orders are paid in advance: ${why}. Verify the payment (mark it Paid) before ${newStatus === 'Confirmed' ? 'confirming' : 'preparing'} the order.`;
    }
    // Release = the shop's pickup handover ("Awaiting Customer Confirmation"); 'Picked Up' kept for older orders.
    if (m === 'Cash on Pickup' && (newStatus === 'Awaiting Customer Confirmation' || newStatus === 'Picked Up')) {
      return 'Collect the cash first: use "Confirm Cash Received" before releasing a Cash on Pickup order.';
    }
    return null;
  }
  function paymentKind(method) { return ONLINE_PAYMENT_METHODS.includes(String(method || '')) ? 'online' : 'cash'; }
  // Orders saved before payment verification existed used other words; they are read, never rewritten.
  function normalizePaymentStatus(s) {
    const v = String(s || '').trim();
    if (PAYMENT_STATUSES.includes(v)) return v;
    if (/^paid$/i.test(v)) return 'Paid';
    return 'Unpaid'; // 'Awaiting payment', 'Pay on receipt', 'Pending', '' — nothing was ever verified
  }
  function paymentMethodLabel(m) { return m === 'Bank Transfer' ? 'BDO Bank Transfer' : String(m || ''); }
  // Transaction references are compared without spaces, dashes or letter case ("1234 5678" == "12345678").
  function paymentReferenceKey(ref) { return String(ref || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  const OFFICIAL_OCCASIONS = [
    'Birthday',
    'Anniversary',
    "Valentine's Day",
    "Mother's Day",
    'Graduation',
    'Congratulations',
    'Sympathy',
    'Thank You'
  ];

  const otherCities = [
    'quezon city', 'makati', 'taguig', 'pasay', 'pasig', 'mandaluyong', 'caloocan',
    'marikina', 'paranaque', 'parañaque', 'las pinas', 'las piñas', 'muntinlupa',
    'valenzuela', 'malabon', 'navotas', 'pateros', 'antipolo', 'cavite', 'laguna', 'bulacan'
  ];

  /**
   * Manila delivery coverage: district -> barangay number ranges.
   * NOTE: Districts I-IV follow the standard numbering (1-146, 147-267, 268-394, 395-636).
   * The Districts V and VI ranges are approximate; verify them against the official
   * City of Manila barangay list and edit `ranges` below if needed.
   */
  const MANILA_DISTRICTS = [
    { id: '1', name: 'District I', areas: 'Tondo', ranges: [[1, 146]] },
    { id: '2', name: 'District II', areas: 'Tondo / Gagalangin', ranges: [[147, 267]] },
    { id: '3', name: 'District III', areas: 'Binondo, Quiapo, San Nicolas, Santa Cruz', ranges: [[268, 394]] },
    { id: '4', name: 'District IV', areas: 'Sampaloc', ranges: [[395, 636]] },
    { id: '5', name: 'District V', areas: 'Ermita, Intramuros, Malate, Paco, Port Area, San Andres', ranges: [[649, 820]] },
    { id: '6', name: 'District VI', areas: 'Paco, Pandacan, San Miguel, Santa Ana, Santa Mesa', ranges: [[637, 648], [821, 905]] }
  ];

  function normalizeDistrictId(districtVal) {
    if (!districtVal) return '';
    const s = String(districtVal).trim();
    const map = {
      '1': '1', 'i': '1', 'district 1': '1', 'district i': '1',
      '2': '2', 'ii': '2', 'district 2': '2', 'district ii': '2',
      '3': '3', 'iii': '3', 'district 3': '3', 'district iii': '3',
      '4': '4', 'iv': '4', 'district 4': '4', 'district iv': '4',
      '5': '5', 'v': '5', 'district 5': '5', 'district v': '5',
      '6': '6', 'vi': '6', 'district 6': '6', 'district vi': '6'
    };
    const lower = s.toLowerCase();
    if (map[lower]) return map[lower];
    const match = s.match(/district\s+([1-6]|i{1,3}|iv|v|vi)\b/i);
    if (match) return map[match[0].toLowerCase()] || s;
    return s;
  }

  function normalizeSlot(s) {
    return String(s || '').replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function barangaysForDistrict(districtId) {
    const norm = normalizeDistrictId(districtId);
    const d = MANILA_DISTRICTS.find(x => x.id === norm || x.name.toLowerCase() === String(districtId).toLowerCase().trim());
    if (!d) return [];
    const out = [];
    d.ranges.forEach(([a, b]) => {
      for (let n = a; n <= b; n++) {
        out.push('Barangay ' + n);
        if (n === 659) out.push('Barangay 659-A');
      }
    });
    return out;
  }

  function fmtTime(mins) {
    const h24 = Math.floor(mins / 60), m = mins % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + (h24 < 12 ? 'AM' : 'PM');
  }

  // Pickup times every 30 minutes, from opening until 30 minutes before closing.
  function pickupSlots() {
    const out = [];
    for (let m = info.openMinutes; m <= info.closeMinutes - 30; m += 30) out.push({ label: fmtTime(m), minutes: m });
    return out;
  }

  function isManila(city) {
    const c = String(city || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
    return c === 'manila' || c === 'manila city' || c === 'city of manila';
  }

  function otherCityMentioned(text) {
    const t = String(text || '').toLowerCase();
    return otherCities.find(c => t.includes(c)) || null;
  }

  // Current date/time in the Philippines, regardless of the visitor's or server's time zone.
  function manilaNow() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const g = (t) => parts.find(p => p.type === t).value;
    return { date: g('year') + '-' + g('month') + '-' + g('day'), minutes: parseInt(g('hour'), 10) * 60 + parseInt(g('minute'), 10) };
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function isValidDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }

  // Is the shop open on this calendar date (per the saved Operating Days)?
  function isOpenOn(dateStr) {
    return isOperatingDay(getManilaDayOfWeek(dateStr), info.operatingDays || 'Monday – Sunday');
  }

  function earliestDate(fulfillment) {
    const now = manilaNow();
    if (fulfillment === 'pickup') {
      // Pickup needs the shop to be open: today if a slot is still reachable, otherwise the next operating day.
      const anyToday = isOpenOn(now.date) && pickupSlots().some(s => s.minutes >= now.minutes + PICKUP_LEAD_MINUTES);
      if (anyToday) return now.date;
      for (let i = 1; i <= 7; i++) { const d = addDays(now.date, i); if (isOpenOn(d)) return d; }
      return addDays(now.date, 1);
    }
    // Delivery: from tomorrow, on the next day the shop is open (no deliveries on closed days).
    for (let i = 1; i <= 7; i++) { const d = addDays(now.date, i); if (isOpenOn(d)) return d; }
    return addDays(now.date, 1);
  }

  // Pickup times still available on a date (none on closed days; accounts for preparation time today).
  function availablePickupSlots(dateStr) {
    if (dateStr && isValidDate(dateStr) && !isOpenOn(dateStr)) return [];
    const now = manilaNow();
    return pickupSlots().filter(s => dateStr !== now.date || s.minutes >= now.minutes + PICKUP_LEAD_MINUTES);
  }

  /** Returns an object of { field: message }. Empty object = valid. */
  function validateOrderInput(v) {
    const e = {};
    const s = (x) => String(x == null ? '' : x).trim();
    const fulfillment = v.fulfillment === 'pickup' ? 'pickup' : (v.fulfillment === 'delivery' ? 'delivery' : null);

    if (!fulfillment) e.fulfillment = 'Please choose Delivery or Store Pickup.';
    if (!s(v.firstName)) e.firstName = 'First name is required.';
    if (!s(v.lastName)) e.lastName = 'Last name is required.';

    const digits = s(v.phone).replace(/\D/g, '');
    if (!/^\+?[\d\s\-()]{7,20}$/.test(s(v.phone)) || digits.length < 7 || digits.length > 13) e.phone = 'Enter a valid contact number.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s(v.email))) e.email = 'Enter a valid email address.';

    if (fulfillment === 'delivery') {
      if (!s(v.address)) e.address = 'Street / building / house or unit no. is required.';
      const normDist = normalizeDistrictId(s(v.district));
      if (!MANILA_DISTRICTS.some(d => d.id === normDist || d.name.toLowerCase() === s(v.district).toLowerCase())) {
        e.district = 'Please select a district.';
      }
      if (!s(v.barangay)) {
        e.barangay = 'Please select a barangay.';
      } else if (!e.district && !barangaysForDistrict(normDist || v.district).includes(s(v.barangay))) {
        e.barangay = 'Select a barangay from the chosen district.';
      }
      if (!isManila(v.city)) e.city = 'Delivery is available within Manila only.';
      if (!e.address && otherCityMentioned(v.address)) e.address = 'This address appears to be outside Manila. Delivery is available within Manila only.';
    }

    if (!isValidDate(s(v.date))) {
      e.date = 'Choose a valid date.';
    } else if (fulfillment) {
      if (!isOpenOn(s(v.date))) {
        e.date = fulfillment === 'pickup'
          ? 'The shop is closed on that day. Please choose another pickup date.'
          : 'The shop is closed on that day, so there are no deliveries. Please choose another delivery date.';
      } else if (s(v.date) < earliestDate(fulfillment)) {
        e.date = fulfillment === 'pickup' ? 'Choose today or a later date.' : 'Delivery starts from tomorrow.';
      }
    }

    if (fulfillment === 'delivery') {
      const matchSlot = deliverySlots.some(slot => normalizeSlot(slot) === normalizeSlot(v.time));
      if (!matchSlot) e.time = 'Choose a delivery time.';
    } else if (fulfillment === 'pickup') {
      const slots = isValidDate(s(v.date)) ? availablePickupSlots(s(v.date)) : pickupSlots();
      if (!slots.some(x => normalizeSlot(x.label) === normalizeSlot(v.time))) e.time = 'Choose an available pickup time.';
    }

    if (LEGACY_PAYMENT_METHODS.includes(s(v.paymentMethod))) e.paymentMethod = 'BDO Bank Transfer is no longer available. Please choose GCash, Cash on Pickup or Cash on Delivery.';
    else if (!paymentMethods.includes(s(v.paymentMethod))) e.paymentMethod = 'Choose a payment method.';
    else if (fulfillment === 'pickup' && s(v.paymentMethod) === 'Cash on Delivery') e.paymentMethod = 'Cash on Delivery is not available for pickup.';
    else if (fulfillment === 'delivery' && s(v.paymentMethod) === 'Cash on Pickup') e.paymentMethod = 'Cash on Pickup is only available for store pickup.';

    if (s(v.giftMessage).length > 250) e.giftMessage = 'Gift message can be up to 250 characters.';
    return e;
  }

  return {
    info,
    updateShopInfo,
    isShopOpen,
    getNextOpeningText,
    isAcceptingOrders,
    parseTimeToMinutes,
    formatTimeStr,
    isOperatingDay,
    getManilaDayOfWeek,
    get DELIVERY_FEE() { return DELIVERY_FEE; },
    get FREE_DELIVERY_MIN() { return FREE_DELIVERY_MIN; },
    getDeliveryFeeSetting,
    getFreeDeliveryMin,
    setDeliverySettings,
    deliveryFee,
    deliverySlots,
    paymentMethods,
    ACTIVE_ORDER_STATUSES,
    DONE_ORDER_STATUSES,
    CONFIRMATION_DEADLINES,
    PAYMENT_STATUSES,
    ONLINE_PAYMENT_METHODS,
    LEGACY_PAYMENT_METHODS,
    paymentBlocksStatus,
    paymentKind,
    normalizePaymentStatus,
    paymentMethodLabel,
    paymentReferenceKey,
    get PICKUP_LEAD_MINUTES() { return PICKUP_LEAD_MINUTES; }, // live value (Shop Settings can change it)
    MANILA_DISTRICTS,
    normalizeDistrictId,
    normalizeSlot,
    barangaysForDistrict,
    pickupSlots,
    availablePickupSlots,
    isOpenOn,
    addDays,
    earliestDate,
    manilaNow,
    isManila,
    otherCityMentioned,
    validateOrderInput,
    OFFICIAL_OCCASIONS
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SHOP_RULES;
if (typeof window !== 'undefined') window.SHOP_RULES = SHOP_RULES;
