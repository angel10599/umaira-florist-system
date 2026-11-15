# Umaira Florist — Audit Follow-up (2026-11-07, after server restart)

Nothing in the live database has been changed during this follow-up. All live checks were read-only (database opened
read-only; HTTP requests that only read or that the server must refuse). Tests that write data ran against a **copy**
of today's database on a separate port.

---

## 1. Verification on the restarted live server

| Check | Result |
|---|---|
| Restart did **not** revert admin edits (fix #1) | Passed — after the 11:58 restart, every catalog row, bouquet, category, supplier and setting is identical to the pre-audit snapshot (60/60, 33/33, 6/6, 3/3, 8/8). The startup seed did not run. |
| Public catalog | Passed — 42 active items, 11 bouquets, no test or archived items shown; bouquets carry real stock (fix #10) |
| Anonymous delivery confirmation (fix #3) / upload (fix #6) / notifications (fix #5) | Passed — all refused with 401 |
| Admin settings / admin orders without login | Passed — 401 |
| Public event stream (fix #4) | Passed — sends no order numbers |
| Fixed checkout code is what the site serves (fix #2) | Passed |
| Full integration suite on a copy of today's data | **59 / 59** passed |
| Headless browser: customer flow (Buy Now, selected items, confirmation page, fees) | **14 / 14** passed |
| Headless browser: builder ₱765 = cart = checkout = order, admin order detail, Save All Settings ₱0 | **15 / 15** passed |
| `tests/api.test.js` / `tests/shop_settings_sync.test.js` | **142 / 142**, **24 / 24** |
| Live database after all of the above | Unchanged (0 orders, 16 users, last stock row 181, 7 admin sessions, no new uploads) |

Note: the live system has **0 orders** — it already had 0 before the audit (pre-audit snapshot), so nothing was lost.
Order flows are verified on copies; the first real order will be the first live one.

---

## 2. Test data proposed for deletion

**How it got there:** 12 test files/scripts in this project open the live database (`data/umaira.db`) or call the live
server on port 3000 instead of using a temporary database (see §4, item 1). They ran on 2 Nov, 3 Nov and today.

### A. Test products — 6 (all archived, hidden from the shop, no orders reference them)

| ID | Name | Created | Created by | Why it is test data |
|---|---|---|---|---|
| `fl-test-temporary-flower` | Test Temporary Flower (₱99) | 3 Nov | `tests/unified_products.test.js` | Fixture name in that test file |
| `fl-test-temporary-flower-2` | Test Temporary Flower (₱99) | 3 Nov | same | same |
| `fl-test-temporary-flower-3` | Test Temporary Flower (₱99) | today 11:29 | same (my run, see original report §5) | same |
| `fl-test-temporary-flower-4` | Test Temporary Flower (₱99) | today 11:29 | same | same |
| `rbn-test-metallic-gold-cord-ribbon` | Test Metallic Gold Cord Ribbon | 3 Nov | `tests/product_kpis.test.js` | Fixture name in that test file |
| `bq-test-sunset-radiance-bouquet` | Test Sunset Radiance Bouquet | 3 Nov | `tests/product_kpis.test.js` | Fixture name in that test file |

### B. Stock-log rows of those test products — 7
IDs **129, 130, 131, 142, 143, 180, 181** ("Initial stock entry" / "Restock" on the products above).
They must be removed before the products (the database links log rows to products).

### C. Test stock movements on real items — 10 rows, net effect 0

| IDs | Item | Movement | Reason text |
|---|---|---|---|
| 122, 123 | Baby's Breath | +15, −15 | "Testing inventory KPI…", "Test Reversal…" |
| 124, 125 | Chrysanthemum | −100, +100 | "Testing zero stock transition", "Stock Correction — Restoring original stock" (written by the same test 10 ms later) |
| 127, 128 | Chrysanthemum | +10, −10 | "…Verification test", "Test Cleanup" |
| 176, 177, 178, 179 | Chrysanthemum | +10, −10, +10, −10 | same (today 11:29) |

Every pair cancels out, so **current stock (100 each) does not change** if they are removed. They currently appear in
Reports → Stock Movements and the item's Stock History, and inflate restock/deduction totals.

### D. Test customer accounts — 15 (all `@example.com`, no orders)

| Name shown | Count | Email pattern | Created | Created by |
|---|---|---|---|---|
| Maria Santos | 8 | `persistent_test_<timestamp>@example.com` | 2 Nov | `scripts/test-cart-checkout-flow.js` |
| Elena Ramos | 3 | `shopee_cart_<timestamp>@example.com` | 2 Nov | `scripts/test-shopee-cart.js` |
| Test Buyer | 2 | `testbuyer_<timestamp>@example.com` | 3 Nov | earlier test script (no longer in project) |
| Ana Cruz | 2 | `testbuyer_<timestamp>@example.com` | 3 Nov | same |

`example.com` is a reserved domain that cannot receive mail. Deleting the accounts also removes their 15 sign-in
sessions (still valid until 2–3 Dec) and 11 saved carts.

### E. Notifications — 8 (IDs 37–44)
All refer to orders that do not exist: `TEST-1793674357910` and `TEST-1793775560862` placed by "Test User"
(`tests/orders_realtime.test.js`), and `#FLR-20261103-1305` placed by the test account "Ana Cruz" (that account's ID no longer
exists). They show in the admin notification bell.

### F. Admin sessions — 6
Created today 11:29:32–11:29:34 by the test run. They expire automatically at 7:29 PM today; deleting them is optional.

### Protected — will not be touched
* Your customer account (Google sign-in, gmail.com) with its session and cart.
* Admin account `admin`, and the admin session created **12:01 today** (your login after the restart).
* 42 active inventory items, 11 active bouquets.
* 15 archived real materials (5 foliage, 6 wrapping, 4 supplies) and 21 archived real bouquets — archived before the audit,
  part of your catalog history.
* 3 suppliers, 6 categories, 8 settings, all uploaded images.
* 43 real stock-log rows (116–121 opening stock; 132–171 restocks except 142/143).

### How the deletion would be done (after your approval)
Fresh backup → one transaction deleting exactly the IDs above → re-check counts and the protected list → report back.
No restart needed.

---

## 3. Bouquet recipes that reference archived materials (original report §4)

**Correction:** 8 of 11 active bouquets are affected, not 7. Recipes are descriptive only — ready-made bouquets use their
own stock, so none of this affects stock, prices or orders.

**Important finding:** every one of the 8 product photos visibly shows green foliage. Replacing the eucalyptus/ruscus
with a flowering filler would make the recipe text *less* accurate to the photo. There is currently **no active foliage
item at all** in inventory (all 5 are archived), so a like-for-like replacement from current stock is not possible.

### Option A — keep the foliage (recommended)
Un-archive only **Eucalyptus** (`fol-eucalyptus`, ₱60) and **Ruscus** (`fol-ruscus`, ₱55). No recipe changes.
* Recipes, photos and inventory become consistent.
* Both have 0 stock, so they reappear in Store Management and in the builder's "Fillers & Foliage" step as **Sold out**
  until you restock them. Prices stay as they are.

### Option B — replace with current inventory (if you no longer use foliage)

| Bouquet | Archived item(s) in recipe | Photo shows | Suggested replacement | Fit |
|---|---|---|---|---|
| Blushing Romance | 3× Eucalyptus | pink roses, lisianthus, baby's breath | **3× Waxflower** (pink) | Matches pink palette; recipe already has Baby's Breath |
| Botanical Serenity | 6× Eucalyptus, 4× Ruscus (Eucalyptus is its main ingredient) | white lilies and roses framed by eucalyptus | **6× Queen Anne's Lace + 4× Baby's Breath**; main flower → Roses | Keeps the all-white sympathy look, but "Botanical" and the photo no longer fit — Option A preferred |
| Cloud Nine | 3× Eucalyptus | lavender hydrangea, pink peony | **3× Statice** (lavender) | Echoes the hydrangea colour |
| Crimson Devotion | 4× Ruscus | red & white roses, lots of baby's breath | **Baby's Breath 2 → 6** | Photo already shows plenty of baby's breath |
| Evergreen Elegance | 6× Ruscus, 4× Eucalyptus (Ruscus is its main ingredient) | pink roses, pink tulips, white lisianthus, leaves | **No good substitute** | Greenery is the product's identity — keep foliage (Option A) |
| Golden Hour | 3× Ruscus | sunflowers, orange gerbera, white mums | **3× Solidago** (golden yellow) | Matches name and colours |
| Golden Petals | 3× Eucalyptus | pink gerbera, pink & white mums | **3× Waxflower** (matches photo) or **3× Solidago** (matches name) | Your choice |
| Lily Elegance | 4× Eucalyptus | pink stargazers, white roses, baby's breath | **4× Baby's Breath** | Already visible in the photo |

Every suggested filler is active with 100 in stock. Impact of Option B: recipe text and ingredient list change on
product pages; the Collections "flower type" filter loses Eucalyptus and Ruscus; Botanical Serenity's and Evergreen
Elegance's main flower changes. Prices and stock unchanged.

### Option C — leave as is
No functional effect; only the admin recipe view references inactive items.

### Related recipe findings
* **Evergreen Elegance — recipe does not match its photo** (new): the recipe lists 2× Phalaenopsis Orchid and 6× White
  Rose; the photo shows pink roses, pink tulips and white lisianthus, no orchid. Either correct the recipe to match the
  photo or replace the photo.
* **Material names differ from inventory names in all 11 recipes** (IDs are already correct; text only):

  | Recipe says | Inventory name | Used in |
  |---|---|---|
  | Korean Matte Wrap | Korean Matte Wrapping Paper | Blushing Romance, Cloud of Love, Crimson Devotion, Evergreen Elegance, Tulip Serenade |
  | Luxury Frosted Film | Frosted Translucent Wrapping | Botanical Serenity, Cloud Nine, Lily Elegance |
  | Natural Kraft Paper | Kraft Paper | Daisy Delight, Golden Hour, Golden Petals |
  | French Chiffon Ribbon | Sheer Chiffon Ribbon | Cloud of Love |

  Recommendation: update the recipe text to the inventory names. Display-only change.
* **Cloud Nine has no occasion** → it never appears under an occasion filter. Suggested: **Birthday, Anniversary**.

---

## 4. Remaining issues

| # | Issue | Affected | Recommended solution | Impact of fixing |
|---|---|---|---|---|
| 1 | **Tests and scripts write to the live database** — root cause of all test data above | `tests/`: inventory_kpis, materials_management, orders_realtime, philippines_catalog, product_inventory_separation, product_kpis, reports, unified_products · `scripts/`: test-cart-checkout-flow, test-phase2-collections, test-phase3-builder, test-shopee-cart | Make each use a temporary database the way `tests/api.test.js` does; add a guard so test runs cannot open `data/umaira.db` | None on the shop. **Until fixed, do not run these files.** |
| 2 | Admin login attempt limit skipped for local requests | Every admin login if deployed behind a proxy | Skip the limit only when running tests | None locally |
| 3 | Evergreen Elegance recipe ≠ photo | 1 bouquet | Correct recipe or photo | Product page text/photo |
| 4 | Cloud Nine has no occasion | 1 bouquet | Add Birthday, Anniversary | Appears in those filters |
| 5 | Items without a supplier | Lisianthus, 6 wrappings, 6 ribbons, 6 cards | Assign suppliers, if you track them | Supplier reports become complete |
| 6 | Bouquet sources empty | 11 bouquets | Fill in sources to re-enable the Flower Source filter | Filter reappears |
| 7 | Delivery can be booked on non-operating days | Delivery orders | Business decision (pickup is already enforced) | — |
| 8 | Pickup preparation time fixed at 2 hours | Pickup slots | Add the setting to Shop Settings, if wanted | — |
| 9 | "Newest first" sort has no real date | Collections | Needs a new date column (schema change — approval) | — |
| 10 | Removing a product image in Admin keeps the old image | Product edit | Confirm the desired behaviour | — |
| 11 | Pre-existing failing tests (old page markup) | 14 test files | Update tests to current markup | Tests only |
| 12 | Email delivery and Google sign-in not tested live | — | Test once with real settings | — |

---

## 5. Decisions needed

1. **Cleanup** (§2) — approve all of A–F, or name the groups to keep. (Recommended: A–E; F optional.)
2. **Recipes** (§3) — Option A (recommended), B, or C; and for B, Waxflower or Solidago for Golden Petals.
3. Align recipe material names with inventory names? (Recommended: yes.)
4. Evergreen Elegance — fix the recipe or the photo?
5. Cloud Nine occasion — Birthday, Anniversary?
6. Make the 12 tests/scripts use a temporary database? (Recommended: yes — prevents this from happening again.)
7. Admin login limit — apply to local requests outside tests? (Recommended: yes.)

---

## 6. Implemented (2026-11-07, approved)

**Backup before any data change:** `backups/before-cleanup-20261107-123207.db` — integrity check OK, identical to the live
database in all 15 tables at the time it was taken.

### Data changes on the live database (one transaction, every precondition checked first)
| Change | Records |
|---|---|
| Deleted test products (A) | 5 inventory items + 1 bouquet, all "Test …", archived, never ordered |
| Deleted their stock-log rows (B) | 7 (129, 130, 131, 142, 143, 180, 181) |
| Deleted test stock movements (C) | 10 (122–125, 127–128, 176–179); net 0, so no stock changed |
| Deleted test customer accounts (D) | 15 `@example.com` accounts + their 15 sessions and 11 carts (no orders) |
| Deleted notifications (E) | 8 (37–44), all for orders that do not exist |
| Kept (F) | 7 admin sessions (6 test ones expire 7:29 PM today; yours from 12:01) |
| Option A | Eucalyptus and Ruscus un-archived; stock stays 0, so they show as **Sold out** |
| Recipe material names | 11 bouquets now use the inventory names (Korean Matte Wrapping Paper, Frosted Translucent Wrapping, Kraft Paper, Sheer Chiffon Ribbon). Ids, quantities, flowers, prices unchanged |
| Cloud Nine | Occasions: Birthday, Anniversary |
| Evergreen Elegance | **Not changed.** Name, description and original catalog all confirm the recipe (ruscus, eucalyptus, orchids, white roses); the **photo** is what is wrong. Needs a correct photo from you. |

Verified after the change: integrity OK, no broken references; all 11 recipes reference active items with matching names;
item stock total 4,148 and bouquet stock total 1,310 — identical to the backup; your account, session and cart kept.

### Code changes
| Area | Change | Files |
|---|---|---|
| Test isolation | New helper gives every test its own temporary database and uploads folder and its own server on a free port; all 13 test files that used the live database or port 3000 now use it | `tests/helpers/isolated-db.js` (new); 8 files in `tests/`, 5 in `scripts/` |
| Safety net | The data layer refuses to open `data/umaira.db` when run from a test | `server/store.js` |
| Test uploads | Uploads go to `UMAIRA_UPLOAD_DIR` when set (tests only); the shop is unchanged | `server.js`, `tests/api.test.js`, `tests/image_management.test.js` |
| Admin sign-in limit | 8 failed attempts per address per 15 min, now **including local addresses** (behind a proxy everything looks local). Only failures count; a correct sign-in clears them; existing sessions keep working | `server.js`, checks added to `tests/api.test.js` |
| Category message | Deleting a core category that has products again says "assigned to N products" first (my earlier change had hidden this) | `server/store.js` |
| Test fixes | `unified_products` cleanup deletes the item's stock-log row first (this is why test items were left in the live DB); `inventory_kpis` no longer crashes Node at exit | 2 test files |

**The running server must be restarted** for the code changes (sign-in limit, safety net) to take effect. The data changes are already live.

---

## 7. Round 3 — remaining issues and test modernisation (2026-11-07)

No customer records, prices, stock quantities or orders were changed. Backup taken before the next restart (which adds a
column): `backups/before-created-at-migration-20261107-162936.db` (integrity OK, identical to live).

### Fixes
| Area | Fix | Files |
|---|---|---|
| Admin lockout behind a proxy | New `TRUST_PROXY` setting (number of proxies, usually 1). The real visitor address is read from the entry the proxy itself appends to X-Forwarded-For (cannot be forged by the visitor); without the setting the header is ignored and a one-time warning is logged. Each visitor now has their own 8-failures / 15-min lockout. | `server.js`, `.env.example` |
| Delivery scheduling | Deliveries follow Operating Days like pickups (earliest = next open day; closed days refused with a clear message; checkout shows "no deliveries" on closed dates). No effect today — the shop is open Monday – Sunday. | `js/shop-rules.js`, `js/app.js` |
| Pickup preparation time | Editable in Admin → Shop Settings ("Same-Day Pickup Preparation Time", 0–48 h, default 2), validated on the server, used by checkout and the server. | `admin.html`, `js/admin.js`, `server.js`, `js/shop-rules.js` |
| Product sorting | Real creation dates: additive `created_at` column on products and bouquets (filled from the 2 Nov catalog-import date / first stock movement for existing items; real time for new ones). "Newest First" (shop) and "Recently Added" (admin, which previously did nothing) now work. | `server/store.js`, `js/state.js`, `js/site-update.js`, `js/admin.js` |
| Image handling | "Remove image" in Admin now really clears the photo (an omitted image still keeps it). | `server/store.js` |
| Database integrity | Permanently deleting a product that has stock movements or order lines returns a clear 409 ("archive it instead") instead of a server error; history is kept. Fresh installs file builder materials under the real core categories. | `server/store.js`, `server.js` |
| Test safety net | Also blocks any `test-*.js` / `*.test.js` file anywhere from opening the live database; `test-http.js` and `test-suite.js` now use the isolated database. | `server/store.js`, root test files |
| Mobile accessibility | Header menu, cart and search buttons are 40×40 px on phones (were 32–37 px) and do not shrink; guest "Sign In" is 40 px tall; menu button announces the drawer it controls (`aria-controls`). | `index.html`, `js/app.js` |

Verified already correct (no change): footer, home and About contact details come from Shop Settings (checked in the
browser against the saved values); the bouquet pop-up shows live stock; occasions all come from the official list.

### Tests (all on isolated temporary databases)
* **34 of 35 test files pass — 887 counted checks, 0 failures.** The live database and uploads folder were identical
  before and after every run.
* **Not run:** `tests/e2e.test.js` — needs Playwright (`npm install` then `npx playwright install chromium`).
* Outdated tests were updated to the current approved behaviour (Store Management screen, 5-step builder, own-stock
  bouquets, no arrangement fee, global low-stock threshold, sign-in required to order, verified Google sign-in, current
  catalog IDs and dates). Pure colour/brand assertions from earlier themes were retired and are listed below for visual review.
* Verification on a copy of today's data with the new code: 19/19 new-fix checks, 59/59 integration, 14/14 + 15/15 + 6/6 browser checks.

### Needs manual verification
1. Restart the live server, then spot-check the shop and admin (the running process still has the previous code).
2. Real email delivery (`MAIL_WEBHOOK_URL`) and sign-in with a real Google account.
3. If deploying behind a proxy: set `TRUST_PROXY=1` and confirm a few wrong admin passwords lock only that visitor.
4. Visual look of the admin and storefront (colour checks were retired while the styling is being refined).
5. Generated PDF reports — open one and check layout.
6. The Playwright end-to-end suite, and a quick check on a real phone.

### Evergreen Elegance — photo requirements
Keep the verified recipe: **6× Ruscus, 4× Eucalyptus, 2× Phalaenopsis Orchid, 6× White Rose, Korean Matte Wrapping
Paper (blush pink), Satin Ribbon**. A suitable photo:
* shows those flowers — white roses, 2 phalaenopsis orchid stems (in the colour you actually use), plenty of glossy ruscus and silver-green eucalyptus
  (greenery is the bouquet's identity); **no** pink roses, tulips or lisianthus (the current photo shows those);
* matches the other 10 bouquet photos: **portrait 3:4, 1086 × 1448 px** (at least 900 × 1200), PNG or JPG, under 5 MB,
  same soft blush background and front-on studio angle, bouquet centred with space around it (the shop crops to 4:5 and
  square), wrapped in blush-pink matte paper with a satin ribbon;
* is a real photo of your arrangement (or one you are licensed to use).
Upload it in Admin → Store → Evergreen Elegance → Upload Image.

## 8. Round 4 — payment processing, verification and notifications (2026-11-07)

Backup before any change: `backups/before-payments-20261107-172437.db`. Migration is additive only (new tables
`payment_submissions`, `payment_events`, `email_log`; new nullable columns `orders.paid_at/paid_by/paid_amount`,
`notifications.data_json`). Existing rows are untouched; old payment words ("Awaiting payment", "Pay on receipt")
are read as **Unpaid** and never rewritten.

Rules now enforced by the server:
* Every order starts **Unpaid**. Only an administrator can mark it **Paid**: GCash / BDO by approving submitted proof
  after ticking "the money actually arrived"; cash (Cash on Pickup / Cash on Delivery) with "Confirm Cash Received".
  Picked Up / Delivered / proof-of-delivery photos no longer mark cash orders Paid (they used to).
* GCash / BDO orders cannot move from Confirmed to Preparing until the payment is Paid.
* Proof needs a transaction reference (once per payment, across all orders; spaces/dashes/case ignored), the amount
  sent and a receipt image (PNG/JPG/WebP, magic-byte checked, ≤ 5 MB). Receipts are private: stored in
  `data/payment-receipts/`, served only to the owning customer or an admin, never cached.
* Amount mismatch and re-used receipt images are flagged; approving a flagged proof needs an acknowledgement + note.
  Rejection needs a reason (sent to the customer); the customer can then submit new proof with a new reference.
* Only admin roles `Administrator` / `Owner` may change payment records (others can view). Payment history is
  append-only (database triggers refuse UPDATE/DELETE) and records who, when, what and the amount.
* Customer emails (order received with method-specific instructions, proof received, approved, rejected + reason,
  preparing, ready for pickup, out for delivery, completed, cancelled) are queued per order with a de-duplication key,
  sent outside the order transaction, and failures are logged with an admin alert and a Retry button.
  GCash / BDO details appear only when entered in Shop Settings → Payment Accounts (nothing is pre-filled).

Tests: `tests/payments.test.js` (94 checks). Updated for the new rule (GCash verified before Preparing):
`tests/phase3.test.js`, `test-http.js`, `test-suite.js`, `tests/ui.test.js` (+ admin payment UI checks).

## 9. Round 5 — final payment methods, GCash QR, in-app notifications only (2026-11-07)

Supersedes the email and BDO parts of section 8.

* **Methods for new orders:** GCash, Cash on Pickup (pickup orders) and Cash on Delivery (delivery orders).
  BDO Bank Transfer and QR Ph are refused by the server and no longer shown. Historical BDO orders and their
  payment records are untouched and can still be finished (proof → verification).
* **GCash** is an advance payment. The order is confirmed and prepared only after an administrator verifies the
  payment and marks it Paid. GCash needs the shop's official QR code (Shop Settings → Payment Accounts: upload,
  preview, replace, remove). Without it GCash cannot be chosen at checkout and proofs are refused.
* **Cash on Pickup:** confirmed and prepared while Unpaid; it cannot be released (Picked Up) until
  "Confirm Cash Received", which is available once the order is confirmed.
* **Cash on Delivery:** confirmed, prepared, dispatched and delivered while Unpaid. Proof of delivery can record
  "courier collected the cash" (payment stays Unpaid). "Confirm Cash Received" is available only after delivery,
  and requires confirming that the courier remitted the cash.
* Shared rule `SHOP_RULES.paymentBlocksStatus` (js/shop-rules.js) is used by the server and the admin console.
* **Roles:** GCash verification — Administrator / Owner. Cash confirmation — Administrator / Owner / Manager / Cashier.
* **Email removed** from all order and payment workflows (`server/emails.js` and `server/email-dispatch.js`
  deleted, no email triggers, no email UI). Updates are in-app notifications only. `MAIL_WEBHOOK_URL` is optional and
  used only for password-reset links. The empty `email_log` table created last round is left in place (no
  destructive schema change) and is unused.
* **No database migration this round.** The test databases (and only they) get a placeholder GCash QR setting so
  order-flow tests can use GCash.

### 9a. Official GCash QR code linked (2026-11-07 23:18)
* The shop's QR image `/assets/uploads/fb5eeb3c4fcc89b02149.jpg` (uploaded 23:13) had never been saved to Shop
  Settings, so customers would not have seen it. It is now linked as the active GCash QR (no new image was uploaded,
  generated or replaced; account name/number left empty because the image only shows them masked).
  Backup first: `backups/before-gcash-qr-link-20261107-231826.db`.
* Safeguards: saving the GCash name/number keeps the configured QR unless a new one is explicitly chosen or removed;
  a QR path must point to an existing uploaded file; removing the QR never deletes the image file; only Administrator /
  Owner accounts can change payment settings (enforced by the server, 403 otherwise).
* The QR is shown at its natural shape and a scannable size on Checkout and Order Details, with "Download QR Code".

## 10. Two-way store pickup confirmation (2026-11-08)

* Pickup flow: … → Ready for Pickup → **Confirm Pickup** (shop, records admin + time) → **Awaiting Customer
  Confirmation** → customer **Confirm Received** (records time) → **Picked Up**. Or the customer reports an issue →
  **Pickup Disputed** → the shop resolves it by handing over again (Ready for Pickup, both confirm again) or cancelling.
* The admin can never set Awaiting Customer Confirmation / Picked Up / Pickup Disputed through the status endpoint and
  cannot answer for the customer (the customer endpoint needs the customer's own session); the customer cannot do the
  handover (admin-only endpoint). Duplicate confirmations are refused (409 ALREADY_CONFIRMED).
* Cash on Pickup must be Paid before the handover (Confirm Pickup).
* Records: `orders.pickup_handover_by/at`, `customer_confirmed_at`, and the new append-only `order_events` table
  (handover, receipt, issue reported, issue resolved). Additive migration only.
* In-app notifications only: customer asked to confirm; admin told when the customer confirms or reports an issue.
* Delivery orders unchanged. Tests: `tests/pickup.test.js` (34 checks); payments/phase3 tests updated.

## 11. Confirmation deadlines, delivery locks, failed delivery, stock on cancel, revenue (2026-11-08, approved)

* **Deadlines** (`js/shop-rules.js` `CONFIRMATION_DEADLINES`): pickup — reminder after 6 h, automatic confirmation after
  24 h; delivery — reminder after 24 h, automatic confirmation after 48 h. Counted from the server's own time when the
  order started waiting (`orders.awaiting_confirmation_since`), never from a time typed by staff. The server checks at
  start-up (catches up after downtime) and every 5 minutes. Automatic confirmations are recorded as "Automatic"
  (`customer_confirmation_status = 'auto'`, history actor `system`), notify customer and admin in-app, never change the
  payment status, and never touch disputed orders.
* **Delivery locks**: the status endpoint refuses "Delivered" (photo-less, older orders only), "Delivered — Awaiting
  Confirmation" (use Upload POD), "Delivered — Confirmed" / "Delivery Disputed" (customer only) and "Delivery Attempt
  Failed" (needs a reason). Proof of delivery is accepted only for delivery orders in Rider Assigned / On the Way /
  Out for Delivery.
* **Delivery Attempt Failed**: `POST /api/admin/orders/:n/delivery-failed {reason}` from On the Way / Out for Delivery;
  the customer sees the reason; then "Re-attempt Delivery" (→ Out for Delivery) or cancel.
* **Dispute outcome** "Delivered — Confirmed" is labelled "Delivered — Resolved by Shop"; "Out for Delivery" (redeliver)
  was added as an outcome.
* **History**: delivery steps (photo, confirm, issue, resolution, failed attempt, re-attempt, auto-confirm, reminder)
  and cancellations are now logged in `order_events` like pickups.
* **Stock on cancel**: returned automatically only when cancelled at Pending Confirmation / Confirmed; afterwards only
  when the admin ticks "Return the flowers to stock". Cancelling an already-cancelled order is refused.
* **Revenue**: dashboard `totalRevenue` and reports `realizedRevenue` = completed AND Paid; new
  `completedUnpaidAmount` / `completedUnpaidOrders`. The Reports card is now "Revenue (Paid & Completed)" with
  "completed but unpaid" and net sales underneath; exports and PDF list all three.
* **Admin console**: one shared status definition (`ACTIVE_ORDER_STATUSES`, `DONE_ORDER_STATUSES`) — fixes
  "Delivered — Confirmed" missing from Completed, the in-progress count and the customer's Total Spent.
* Migration: additive columns `awaiting_confirmation_since`, `confirm_reminder_sent_at`, `delivery_failed_reason`.
* Tests: new `tests/order_confirmation.test.js` (57 checks); api/payments/phase3 tests updated to the photo-based
  delivery flow and the new revenue rule.

## 12. Phase 1 — UI/UX cleanup and design consistency (2026-11-08)

Frontend only (HTML, CSS, client JS). No backend, API, database, pricing, stock, order, checkout or payment logic
changed. A copy of every frontend file from before this pass is in `backups/ui-before-phase1-20261108-015444/`.

* **Admin design system** (`admin.html` style block): one KPI card component (`.kpi-card`: title + icon top-right,
  value, one-line description, equal heights; icon tones neutral/sage/amber/sky/rose), one table style
  (`.admin-data-table`), plain status text (`.status-text--success|warning|danger|info|neutral|muted`), uniform filter
  toolbars (`.admin-toolbar`), `.filters-clear-hidden`, one Lucide stroke weight (1.8) for console icons.
* **KPI cards**: Dashboard, Orders, Store, Suppliers and Reports all use `kpiCardHTML()` / the same markup; every card
  has a description (Store cards had none); pills and "View" chips removed from the Dashboard cards (cards stay
  clickable, now keyboard-accessible too). Reports revenue label shortened to "Revenue" (full meaning in its tooltip)
  so it no longer truncates; "units" moved from the Products Sold value into its description.
* **Tables**: payment status, stock, availability, supplier status, sign-in method, category and movement type are
  plain coloured text — no pills/badges/chips in admin tables. Header alignment follows the column.
* **Search & filters**: placeholders "Search orders…", "Search items…", "Search suppliers…", "Search customers…",
  "Search movements…"; storefront "Search bouquets…", "Search flowers…". Store "Advanced Filters" button and panel
  removed — its Occasion filter is now in the normal filter row. Clear Filters is shown only while a filter is
  applied (Orders, Store, Suppliers, Stock history, Reports stock movements, Customers) and is labelled the same
  everywhere; filter labels are screen-reader labels instead of uppercase captions.
* **Refresh buttons removed**: Dashboard "Refresh Overview", Reports refresh icon, customer "My Orders" and order
  tracking Refresh. These pages already update from the live event stream; the dashboard's live hook
  (`loadDashboardStats`) was called but never defined, so it is now defined (reloads the dashboard when it is open).
* **Buttons/header**: page action buttons (Add Item, Add New Supplier, Export Report, Categories) share one size and
  style; decorative "Live Audit Data" chip removed; phone header uses the sage sidebar colours.
* **Icons**: emoji/symbol icons in admin badges and payment modals replaced by words or Lucide icons.
* **Storefront cards**: bouquet cards keep the same text rhythm in every card (occasion row always reserved, flower
  list one line, description two lines), so titles, prices and buttons align across a row.

**Not changed (documented, needs a decision):**
* Admin (Cinzel + Plus Jakarta Sans) and storefront (Cormorant Garamond + Manrope) keep their own font pairs — a brand
  decision, not a consistency fix.
* Status pills remain in places that are not tables (order detail header, customer order cards) and the Reports
  date-range buttons remain a pill-shaped segmented control.
* The KPI "reference screenshots" mentioned in the brief were not received; the Orders KPI card was used as the
  reference. Send them if a different look is wanted.
* Placeholder product photography ("Photography in Preparation") is content, not UI.

## 13. Homepage scrolling performance and scroll animations (2026-11-08)

Causes found (measured by scrolling the home page frame by frame with each effect switched off in turn):
* `body[data-view="home"]` used `background-attachment: fixed` for its mesh gradients → full-viewport repaint on every
  scroll frame. The same gradients now sit on a fixed `body::before` layer (composited, no repaint). Look unchanged.
* `js/fx.js` measured each parallax element's position right after writing the previous one's transform (forced
  layout per element per frame). The frame loop now reads every measurement first, then writes, and skips style
  writes whose value did not change; the hero stops updating once it has scrolled away.
* `js/petals.js` rebuilt gradients and paths for every petal on every frame on a full-screen canvas; petals are now
  painted once into cached sprites and stamped each frame (same shapes and colours), canvas density capped at 1.5x,
  and mobile address-bar resizes during scrolling no longer reallocate the canvas or reset the petals.
* Every `[data-reveal]` element kept a permanent `will-change` (one GPU layer per card for the life of the page).

Also fixed: a start-up race in `petals.js` (the router started the engine before its canvas existed, the loop threw
on a null context and the petals stayed invisible).

Scroll animations: cards and sections below the fold now fade in and rise 18px as they enter the viewport
(620–720ms ease-out, cascading 60ms apart, max 300ms). Content already on screen is never hidden; anything the
motion engine has not processed stays visible; reduced-motion users get no animation; GPU hints are released after
each entrance. Files: `styles.css`, `js/fx.js`, `js/petals.js`.
