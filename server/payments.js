// Payment verification and the payment audit trail. Notifications are in-app only (no email).
//
// Rules (Umaira Florist):
//  • An order is NEVER marked Paid because it was placed, a screenshot was uploaded, or it reached Confirmed /
//    Preparing / Ready for Pickup / Out for Delivery / Delivered / Picked Up. Only an authorised person marks it
//    Paid, after the money has genuinely been received:
//      GCash            — approve the submitted proof after checking the shop's GCash account;
//      Cash on Pickup   — "Confirm Cash Received" when the customer pays at the shop (order already confirmed);
//      Cash on Delivery — "Confirm Cash Received" after delivery, once the courier has remitted the cash.
//  • GCash proof = transaction reference + amount sent + receipt image. A reference can only ever be used once
//    (across all orders; spaces, dashes and letter case ignored). Amount mismatches and re-used receipt images are
//    flagged and need an explicit, noted review before approval. GCash proof is refused until the shop's GCash
//    QR code is configured in Shop Settings → Payment Accounts.
//  • Every submission, decision, courier collection and cash confirmation is written to payment_events, which is
//    append-only (database triggers refuse UPDATE and DELETE). Submissions are never deleted.
//  • Historical BDO Bank Transfer orders keep working (their proofs can still be reviewed), but BDO cannot be chosen.
const rules = require('../js/shop-rules.js');

const REF_RE = /^[A-Za-z0-9][A-Za-z0-9 .\/#-]{3,39}$/;
const COP_CONFIRMABLE = ['Confirmed', 'Preparing', 'Ready for Pickup', 'Picked Up']; // 'Picked Up' = older orders released unpaid
const COD_DELIVERED = ['Delivered — Awaiting Confirmation', 'Delivered', 'Delivered — Confirmed'];
const peso = (n) => '₱' + (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const manilaDateTime = (iso) => {
  const d = new Date(iso || Date.now());
  try { return d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch (_) { return d.toISOString(); }
};

async function install(api, { db, tx, now, byNumber, eventHub, safeParse }) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS payment_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      order_number TEXT NOT NULL,
      user_id TEXT,
      method TEXT NOT NULL,
      amount_due REAL NOT NULL,
      amount_submitted REAL NOT NULL,
      reference TEXT NOT NULL,
      reference_key TEXT NOT NULL UNIQUE,
      receipt_file TEXT NOT NULL,
      receipt_mime TEXT NOT NULL,
      receipt_sha256 TEXT NOT NULL,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      submitted_at TEXT NOT NULL,
      reviewed_by TEXT,
      reviewed_at TEXT,
      review_note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_paysub_order ON payment_submissions(order_number);
    CREATE INDEX IF NOT EXISTS idx_paysub_status ON payment_submissions(status);
    CREATE INDEX IF NOT EXISTS idx_paysub_hash ON payment_submissions(receipt_sha256);

    CREATE TABLE IF NOT EXISTS payment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      submission_id INTEGER,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('customer','admin','system')),
      actor TEXT,
      amount REAL,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_payevt_order ON payment_events(order_number);
    CREATE TRIGGER IF NOT EXISTS payment_events_no_update BEFORE UPDATE ON payment_events
      BEGIN SELECT RAISE(ABORT, 'payment history is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS payment_events_no_delete BEFORE DELETE ON payment_events
      BEGIN SELECT RAISE(ABORT, 'payment history is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS payment_submissions_no_delete BEFORE DELETE ON payment_submissions
      BEGIN SELECT RAISE(ABORT, 'payment submissions are kept permanently'); END;
  `);

  const subView = (r) => r && ({
    id: r.id, orderNumber: r.order_number, userId: r.user_id, method: r.method,
    methodLabel: rules.paymentMethodLabel(r.method),
    amountDue: r.amount_due, amountSubmitted: r.amount_submitted, reference: r.reference,
    receiptUrl: `/api/admin/payments/${r.id}/receipt`, receiptMime: r.receipt_mime,
    warnings: safeParse(r.warnings_json, []), status: r.status, submittedAt: r.submitted_at,
    reviewedBy: r.reviewed_by || null, reviewedAt: r.reviewed_at || null, reviewNote: r.review_note || null
  });
  // What a customer may see about their own submission (no other orders' details, no internal warnings).
  const customerSubView = (r) => r && ({
    id: r.id, method: r.method, methodLabel: rules.paymentMethodLabel(r.method), amountSubmitted: r.amount_submitted,
    reference: r.reference, status: r.status, submittedAt: r.submitted_at, reviewedAt: r.reviewed_at || null,
    rejectionReason: r.status === 'rejected' ? (r.review_note || null) : null,
    receiptUrl: `/api/orders/${encodeURIComponent(r.order_number)}/payments/${r.id}/receipt`
  });
  const eventView = (r) => ({
    id: r.id, orderNumber: r.order_number, submissionId: r.submission_id, action: r.action,
    fromStatus: r.from_status, toStatus: r.to_status, actorType: r.actor_type, actor: r.actor,
    amount: r.amount, note: r.note, createdAt: r.created_at
  });

  async function logEvent({ orderNumber, submissionId = null, action, from = null, to = null, actorType, actor = null, amount = null, note = null }) {
    await db.prepare(`INSERT INTO payment_events (order_number, submission_id, action, from_status, to_status, actor_type, actor, amount, note, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(orderNumber, submissionId, action, from, to, actorType, actor, amount, note, now());
  }
  const customerName = (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim();
  const notifyCustomer = async (row, title, message, type) => {
    try {
      await api.createNotification({ recipientType: 'customer', userId: row.user_id, orderNumber: row.order_number, title, message, type, link: `/index.html#track=${row.order_number}` });
    } catch (_) {}
  };
  const signal = async (row) => {
    try {
      const order = await api.get(row.order_number);
      eventHub.emit('order:status', { orderNumber: row.order_number, status: order.status, previousStatus: order.status, order, payment: true });
    } catch (_) {}
  };
  const codCollected = async (orderNumber) => !!(await db.prepare("SELECT 1 FROM payment_events WHERE order_number = ? AND action = 'cash_collected_by_courier' LIMIT 1").get(orderNumber));
  // GCash is considered configured only when the admin has set all three: QR code image, account name, and mobile number.
  const gcashReady = async () => { const p = (await api.getSetting('payment')) || {}; return !!(p.gcash && p.gcash.qrImage && p.gcash.accountName && p.gcash.number); };

  Object.assign(api, {
    gcashConfigured: gcashReady,

    // Courier collected the cash from the customer. Payment stays Unpaid: the shop has not received it yet.
    // Called inside an existing transaction (proof of delivery) or by confirmCashPayment.
    async recordCodCollection(row, actor, amount, note) {
      if (await codCollected(row.order_number)) return false;
      const cur = rules.normalizePaymentStatus(row.payment_status);
      await logEvent({ orderNumber: row.order_number, action: 'cash_collected_by_courier', from: cur, to: cur, actorType: 'admin', actor, amount, note: note || 'Courier collected the cash on delivery' });
      return true;
    },

    // ---------------------------------------------------------------- customer: submit GCash payment proof
    async submitPayment({ orderNumber, userId, amount, reference, receipt }) {
      return tx(async () => {
        const row = await byNumber(orderNumber);
        // Same answer as "not found" for someone else's order, so order numbers cannot be probed.
        if (!row || !userId || row.user_id !== userId) return { ok: false, status: 404, error: 'Order not found.' };
        const n = row.order_number;
        if (rules.paymentKind(row.payment_method) !== 'online') {
          return { ok: false, status: 409, error: `This order is paid in cash (${row.payment_method}). No payment proof is needed — the shop records your payment when the cash is received.` };
        }
        if (row.payment_method === 'GCash' && !(await gcashReady())) {
          return { ok: false, status: 409, code: 'GCASH_NOT_CONFIGURED', error: 'GCash payment is not available yet because the shop has not set up its GCash QR code. Please contact the shop.' };
        }
        if (row.status === 'Rejected/Cancelled') return { ok: false, status: 409, error: 'This order was cancelled, so payment proof can no longer be submitted. Please contact the shop.' };
        const cur = rules.normalizePaymentStatus(row.payment_status);
        if (cur === 'Paid') return { ok: false, status: 409, error: 'This order is already marked as paid.' };
        if (cur === 'Pending Verification') return { ok: false, status: 409, error: 'Your payment proof is already being reviewed. Please wait for the shop to verify it.' };

        const ref = String(reference || '').trim();
        const key = rules.paymentReferenceKey(ref);
        if (!REF_RE.test(ref) || key.length < 6) return { ok: false, status: 400, field: 'reference', error: 'Enter the transaction reference number shown on your receipt (at least 6 letters or digits).' };
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0 || amt > 1000000) return { ok: false, status: 400, field: 'amount', error: 'Enter the amount you sent, in pesos.' };
        const amountSubmitted = Math.round(amt * 100) / 100;

        const dup = await db.prepare('SELECT order_number, status FROM payment_submissions WHERE reference_key = ?').get(key);
        if (dup) {
          return dup.order_number === n
            ? { ok: false, status: 409, field: 'reference', error: 'This reference number was already submitted for this order. If you made a new payment, enter the new transaction reference number.' }
            : { ok: false, status: 409, field: 'reference', code: 'DUPLICATE_REFERENCE', error: 'This transaction reference number has already been used for another order. Each payment can only be used once. Please check the number, or contact the shop.' };
        }

        const warnings = [];
        if (Math.abs(amountSubmitted - row.total) > 0.009) {
          warnings.push({ code: 'amount_mismatch', message: `Customer entered ${peso(amountSubmitted)} but the order total is ${peso(row.total)} (${amountSubmitted > row.total ? 'over' : 'short'} by ${peso(Math.abs(amountSubmitted - row.total))}).` });
        }
        const sameImage = await db.prepare('SELECT order_number, reference FROM payment_submissions WHERE receipt_sha256 = ? ORDER BY id').all(receipt.sha256);
        if (sameImage.length) {
          const where = [...new Set(sameImage.map(s => s.order_number))].join(', ');
          warnings.push({ code: 'duplicate_receipt', message: `The same receipt image was already submitted before (order ${where}, reference ${sameImage.map(s => s.reference).join(', ')}).` });
        }

        const ts = now();
        const ins = await db.prepare(`INSERT INTO payment_submissions (order_id, order_number, user_id, method, amount_due, amount_submitted, reference, reference_key,
          receipt_file, receipt_mime, receipt_sha256, warnings_json, status, submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)`)
          .run(row.id, n, row.user_id, row.payment_method, row.total, amountSubmitted, ref, key, receipt.file, receipt.mime, receipt.sha256, JSON.stringify(warnings), ts);
        const subId = Number(ins.lastInsertRowid);
        await db.prepare("UPDATE orders SET payment_status = 'Pending Verification', updated_at = ? WHERE id = ?").run(ts, row.id);
        await logEvent({ orderNumber: n, submissionId: subId, action: 'proof_submitted', from: cur, to: 'Pending Verification', actorType: 'customer', actor: row.user_id, amount: amountSubmitted, note: `Reference ${ref}` + (warnings.length ? ` — flagged: ${warnings.map(w => w.code).join(', ')}` : '') });

        const label = rules.paymentMethodLabel(row.payment_method);
        const details = {
          submissionId: subId, customerName: customerName(row), orderNumber: n, method: label,
          amountDue: row.total, amountSubmitted, reference: ref, submittedAt: ts, warnings
        };
        await api.createNotification({
          recipientType: 'admin', userId: row.user_id, orderNumber: n,
          title: warnings.length ? '⚠️ Payment Proof Needs Careful Review' : 'Payment Proof Submitted',
          message: `${customerName(row)} • Order ${n} • ${label} • Amount due ${peso(row.total)} • Submitted ${peso(amountSubmitted)} • Ref ${ref} • ${manilaDateTime(ts)}` +
            (warnings.length ? ` • ${warnings.map(w => w.message).join(' ')}` : ''),
          type: 'payment_submitted', link: '/admin.html#orders', data: details
        });
        await notifyCustomer(row, 'Payment Proof Received', `We received your ${label} payment proof for ${n} (ref ${ref}). Status: Pending Verification.`, 'payment_submitted');
        try { eventHub.emit('payment:submitted', details); } catch (_) {}
        await signal(row);
        return { ok: true, submission: customerSubView(await db.prepare('SELECT * FROM payment_submissions WHERE id = ?').get(subId)), order: await api.get(n) };
      });
    },

    // ---------------------------------------------------------------- admin: approve / reject proof
    async reviewPayment({ orderNumber, submissionId, decision, adminUsername, note, confirmReceived, acknowledgeWarnings }) {
      return tx(async () => {
        const row = await byNumber(orderNumber);
        if (!row) return { ok: false, status: 404, error: 'Order not found.' };
        const n = row.order_number;
        const sub = await db.prepare('SELECT * FROM payment_submissions WHERE id = ? AND order_number = ?').get(Number(submissionId), n);
        if (!sub) return { ok: false, status: 404, error: 'Payment submission not found for this order.' };
        if (sub.status !== 'pending') return { ok: false, status: 409, error: `This submission was already ${sub.status} by ${sub.reviewed_by || 'an administrator'}.` };
        const cur = rules.normalizePaymentStatus(row.payment_status);
        const text = String(note || '').trim().slice(0, 300);
        const ts = now();
        const label = rules.paymentMethodLabel(sub.method);

        if (decision === 'approve') {
          if (confirmReceived !== true) {
            return { ok: false, status: 400, code: 'CONFIRM_RECEIVED', error: `Check the ${label} account first. Approve only after confirming that ${peso(sub.amount_submitted)} with reference ${sub.reference} actually arrived.` };
          }
          const warnings = safeParse(sub.warnings_json, []);
          if (warnings.length && (acknowledgeWarnings !== true || text.length < 5)) {
            return { ok: false, status: 409, code: 'REVIEW_REQUIRED', warnings, error: 'This submission has warnings (' + warnings.map(w => w.code.replace('_', ' ')).join(', ') + '). Confirm you reviewed them and write a short note explaining why it is correct.' };
          }
          if (cur === 'Paid') return { ok: false, status: 409, error: 'This order is already marked as paid.' };
          await db.prepare("UPDATE payment_submissions SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?").run(adminUsername, ts, text || null, sub.id);
          await db.prepare("UPDATE orders SET payment_status = 'Paid', paid_at = ?, paid_by = ?, paid_amount = ?, updated_at = ? WHERE id = ?").run(ts, adminUsername, sub.amount_submitted, ts, row.id);
          await logEvent({ orderNumber: n, submissionId: sub.id, action: 'payment_approved', from: cur, to: 'Paid', actorType: 'admin', actor: adminUsername, amount: sub.amount_submitted, note: `Money confirmed received in ${label} account. Ref ${sub.reference}` + (text ? ` — ${text}` : '') });
          await notifyCustomer(row, 'Payment Verified', `Your ${label} payment for ${n} (ref ${sub.reference}) has been verified. Thank you! The shop will now confirm and prepare your order.`, 'payment_approved');
          await signal(row);
          return { ok: true, order: await api.get(n), submission: subView(await db.prepare('SELECT * FROM payment_submissions WHERE id = ?').get(sub.id)) };
        }

        if (decision === 'reject') {
          if (text.length < 5) return { ok: false, status: 400, code: 'REASON_REQUIRED', error: 'Enter the reason for rejecting this payment proof. The customer will see it.' };
          await db.prepare("UPDATE payment_submissions SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?").run(adminUsername, ts, text, sub.id);
          await db.prepare("UPDATE orders SET payment_status = 'Rejected', updated_at = ? WHERE id = ?").run(ts, row.id);
          await logEvent({ orderNumber: n, submissionId: sub.id, action: 'payment_rejected', from: cur, to: 'Rejected', actorType: 'admin', actor: adminUsername, amount: sub.amount_submitted, note: text });
          await notifyCustomer(row, 'Payment Not Verified', `We could not verify your payment proof for ${n}. Reason: ${text}. Please submit new proof with the correct reference number.`, 'payment_rejected');
          await signal(row);
          return { ok: true, order: await api.get(n), submission: subView(await db.prepare('SELECT * FROM payment_submissions WHERE id = ?').get(sub.id)) };
        }
        return { ok: false, status: 400, error: 'Unknown decision.' };
      });
    },

    // ---------------------------------------------------------------- admin: cash actually received by the shop
    async confirmCashPayment({ orderNumber, adminUsername, amountReceived, note, confirmReceived, collectedByCourier, remittedToShop }) {
      return tx(async () => {
        const row = await byNumber(orderNumber);
        if (!row) return { ok: false, status: 404, error: 'Order not found.' };
        const n = row.order_number;
        const method = row.payment_method;
        if (rules.paymentKind(method) !== 'cash') {
          return { ok: false, status: 409, error: `${rules.paymentMethodLabel(method)} orders are marked paid by verifying the customer's payment proof, not by recording cash.` };
        }
        if (row.status === 'Rejected/Cancelled') return { ok: false, status: 409, error: 'This order is cancelled.' };
        const cur = rules.normalizePaymentStatus(row.payment_status);
        if (cur === 'Paid') return { ok: false, status: 409, code: 'ALREADY_PAID', error: `Cash for this order was already confirmed${row.paid_by ? ' by ' + row.paid_by : ''}.` };
        if (method === 'Cash on Pickup' && !COP_CONFIRMABLE.includes(row.status)) {
          return { ok: false, status: 409, code: 'NOT_READY', error: 'Confirm the order first. Cash on Pickup is paid at the shop when the customer collects the order.' };
        }
        if (method === 'Cash on Delivery') {
          if (!COD_DELIVERED.includes(row.status)) {
            return { ok: false, status: 409, code: 'NOT_DELIVERED', error: 'Cash on Delivery is confirmed only after the order is delivered and the courier has remitted the cash to the shop.' };
          }
          if (!(await codCollected(n)) && collectedByCourier !== true) {
            return { ok: false, status: 400, code: 'COLLECTION_REQUIRED', error: 'Record that the courier collected the cash from the customer.' };
          }
          if (remittedToShop !== true) {
            return { ok: false, status: 400, code: 'REMITTANCE_REQUIRED', error: 'Confirm that the courier remitted the collected cash to the shop before marking this order paid.' };
          }
        }
        if (confirmReceived !== true) return { ok: false, status: 400, code: 'CONFIRM_RECEIVED', error: 'Confirm that the shop has actually received and counted the cash before marking this order as paid.' };
        const amt = Number(amountReceived);
        if (!Number.isFinite(amt) || amt <= 0 || amt > 1000000) return { ok: false, status: 400, error: 'Enter the cash amount received.' };
        const received = Math.round(amt * 100) / 100;
        const text = String(note || '').trim().slice(0, 300);
        if (Math.abs(received - row.total) > 0.009 && text.length < 5) {
          return { ok: false, status: 409, code: 'REVIEW_REQUIRED', error: `The amount received (${peso(received)}) does not match the order total (${peso(row.total)}). Add a note explaining the difference.` };
        }
        if (method === 'Cash on Delivery') await api.recordCodCollection(row, adminUsername, received, 'Courier collected the cash (recorded at remittance)');
        const ts = now();
        await db.prepare("UPDATE orders SET payment_status = 'Paid', paid_at = ?, paid_by = ?, paid_amount = ?, updated_at = ? WHERE id = ?").run(ts, adminUsername, received, ts, row.id);
        await logEvent({ orderNumber: n, action: 'cash_received', from: cur, to: 'Paid', actorType: 'admin', actor: adminUsername, amount: received,
          note: (method === 'Cash on Delivery' ? 'Cash on Delivery: courier remitted the cash; counted and received by the shop' : 'Cash on Pickup: cash counted and received at the shop') + (text ? ` — ${text}` : '') });
        await notifyCustomer(row, 'Payment Received', `We received your cash payment of ${peso(received)} for ${n}. Thank you!`, 'payment_approved');
        await signal(row);
        return { ok: true, order: await api.get(n) };
      });
    },

    // ---------------------------------------------------------------- reads
    async getPaymentSubmission(id) { return (await db.prepare('SELECT * FROM payment_submissions WHERE id = ?').get(Number(id))) || null; },
    async listPaymentSubmissions({ status = 'pending', limit = 200 } = {}) {
      const rows = status === 'all'
        ? await db.prepare('SELECT * FROM payment_submissions ORDER BY id DESC LIMIT ?').all(limit)
        : await db.prepare('SELECT * FROM payment_submissions WHERE status = ? ORDER BY id ASC LIMIT ?').all(status, limit);
      return Promise.all(rows.map(async r => {
        const o = (await db.prepare('SELECT first_name, last_name, email, phone, total, status, payment_status FROM orders WHERE id = ?').get(r.order_id)) || {};
        return { ...subView(r), customerName: `${o.first_name || ''} ${o.last_name || ''}`.trim(), customerEmail: o.email, customerPhone: o.phone, orderStatus: o.status, orderTotal: o.total };
      }));
    },
    async getOrderPayments(orderNumber) {
      const row = await byNumber(orderNumber);
      if (!row) return null;
      const n = row.order_number;
      return {
        submissions: (await db.prepare('SELECT * FROM payment_submissions WHERE order_number = ? ORDER BY id DESC').all(n)).map(subView),
        events: (await db.prepare('SELECT * FROM payment_events WHERE order_number = ? ORDER BY id DESC').all(n)).map(eventView),
        codCashCollected: await codCollected(n)
      };
    },
    async getCustomerPayments(orderNumber, userId) {
      const row = await byNumber(orderNumber);
      if (!row || !userId || row.user_id !== userId) return null;
      return (await db.prepare('SELECT * FROM payment_submissions WHERE order_number = ? ORDER BY id DESC').all(row.order_number)).map(customerSubView);
    },
    async paymentQueueCount() { return (await db.prepare("SELECT COUNT(*) c FROM payment_submissions WHERE status = 'pending'").get()).c; }
  });
}

module.exports = { install };
