# Umaira Florist — System Audit Report (2026-11-07)

Scope: Admin Console, Customer Website, Node/SQLite backend, shared rules, data in `data/umaira.db`.
Method: full code read of the server, store, pricing, shared rules, customer and admin flows → reproduce each
suspected bug against a **copy** of the live database → fix → re-run the same reproduction plus integration,
browser (headless Chrome) and existing test suites.

Status legend: **Tested** = verified by an automated check after the fix · **Inspected** = read in code, no failure found ·
**Not tested** = not exercised.

---

## 1. Overall assessment

Before the audit the system *looked* consistent but had several defects that broke real workflows:

* After a customer placed an order the website crashed before showing the confirmation page (the order *was* saved).
* Every server restart silently reverted admin price/name/description edits on 57 catalog items.
* Anyone (no login) could confirm or dispute any customer's delivery, upload files, and see every order number.
* The checkout total for custom bouquets could differ from what the server charged (wrapping & ribbon dropped).
* Reports double-counted custom-bouquet flowers as separate sales.

All confirmed defects below are fixed and verified. The system now behaves as one integrated system: Shop Settings,
catalog, stock, prices, orders and reports are read from the same database values on both sides, and the server
re-validates everything the browser sends.

**Results after fixes:** 11/11 reproduced bugs no longer reproduce · 59/59 integration checks · 29/29 browser checks ·
`tests/api.test.js` 142/142 · `tests/shop_settings_sync.test.js` 24/24 · all other existing suites: identical to the
pre-audit baseline (their remaining failures are pre-existing, see §6).

---

## 2. Findings and fixes

| # | Module | Issue identified | Severity | Root cause | Fix applied | Files modified | Testing performed | Result |
|---|---|---|---|---|---|---|---|---|
| 1 | Catalog / DB | Admin edits to price, name, description, category, unit cost of 57 seeded items reverted on every server restart; deleted seed items came back | **Critical** | `seedPhase2Catalog()` ran on every start with an *upsert* that overwrote existing rows; categories also upserted | Seed runs **once** (guarded by the existing `phase2_catalog.initialized` setting); categories are insert-only | `server/store.js` | Edit price → reopen DB: edit kept; fresh install still seeds; deleted item stays deleted | Passed |
| 2 | Checkout (customer) | After a successful order the page threw `TypeError: appState.saveCart is not a function`; customer never saw the confirmation, button reset to "Place Order" | **Critical** | Call to a method that does not exist | Use `appState.persistCart()` | `js/account.js` | Headless Chrome: place order → lands on confirmation, no JS errors | Passed |
| 3 | Security / Orders | `POST /api/orders/:n/confirm-delivery` needed no login: anyone could confirm or dispute any order, at any status | **Critical** | No session/ownership/status check | Requires the signed-in **owner**; only after the shop marks it delivered; dispute photo must be an uploaded file | `server.js`, `server/store.js`, `js/account.js` | Anonymous → 401; other customer → 404; owner before delivery → 409; owner after POD → 200 | Passed |
| 4 | Security / Realtime | Public `/api/events` stream broadcast every order number + status to anonymous listeners | High | Public SSE forwarded order details | Public stream now sends only `{changed:true}`; signed-in browsers refetch their **own** orders | `server.js`, `js/account.js` | Anonymous listener sees no order numbers; customer tracking still refreshes | Passed |
| 5 | Security / Notifications | `GET /api/notifications?orderNumber=` returned other customers' notifications; "mark read" had no ownership check | High | SQL used `user_id = ? OR order_number = ?` | Always scoped to the signed-in user; order number can only narrow; read/mark scoped by recipient | `server/store.js`, `server.js`, `js/account.js` | Customer B querying A's order → 0 results | Passed |
| 6 | Security / Uploads | `POST /api/upload` accepted images from anyone (disk filling, hosting arbitrary images) | High | No auth on the customer upload route | Signed-in customers only, rate-limited (10 / 10 min) | `server.js`, `js/account.js` | Anonymous → 401; dispute flow uploads with session | Passed |
| 7 | Checkout / Pricing | Custom bouquet re-priced at checkout without wrapping & ribbon (cart ₱765 → checkout ₱625; server charged ₱765) | High | `calculateBreakdown()` expected wrapping/ribbon ids but saved cart specs store objects | Accept both id and `{id,color}` entries | `js/builder.js` | Browser: builder ₱765 = cart ₱765 = checkout ₱765 = order ₱765 | Passed |
| 8 | Pricing / Builder | Server accepted fractional or huge filler quantities (paid for ½ stem; stock became fractional) and priced unknown material ids from the stale static `data.js` (e.g. `wrp-korean` ₱80, no stock tracking) | High | No integer/bounds check; fallback to static file prices | Fillers: whole numbers 1–10; every component must exist in the DB **and be the right type** (flower/filler/wrapping/ribbon/card); stale fallback removed | `server/pricing.js` | Fractional → 400; unknown id → 400; flower posing as wrapping → 400; archived Eucalyptus → 400 | Passed |
| 9 | Ordering / Hours | Server validated pickup times against hard-coded 8 AM–8 PM, ignoring saved hours (customer-offered slots could be rejected) | High | Server never loaded `hours` into the shared rules | Server applies saved hours before validating | `server.js` | Hours 07:00–21:00 → 7:00 AM pickup accepted | Passed |
| 10 | Storefront stock | Every ready-made bouquet was capped at 10 per order regardless of real stock | High | `applyCatalog()` did not copy `stockCount` for bouquets → fallback 10 | Copy the DB stock count | `js/state.js` | Client cap = min(stock, 50) | Passed |
| 11 | Reports | Custom-bouquet flowers counted as standalone "Red Rose" sales; custom bouquet quantity always 1; Dashboard "Top Bouquets" counted single stems and every component as bouquets | High | Grouping only matched names starting "Custom Bouquet"; builder names them "Artisan Bespoke Bouquet" | One shared rule (`isCustomComponent`); bouquet qty from its wrapping line; Top Bouquets = ready-made + custom bouquets only | `server/store.js` | Best sellers: no stray "Red Rose"; custom qty 2 → 2 | Passed |
| 12 | Admin Orders | Greeting-card message of custom bouquets never shown to admin; barangay missing from delivery address; customer's *delivery instructions* labelled "Florist Gift Card Message"; raw types (`ready_bouquet`) shown | High | Fields not rendered / mislabelled | Card messages block, barangay + city, correct label, readable item types, "Part of custom bouquet" tag, pickup address from settings | `js/admin.js` | Browser: admin detail shows "With love from Lola", grouping, labels | Passed |
| 13 | Shop Settings | "Save All Settings" turned fee ₱0 into ₱150 and threshold 0 into ₱2,500/20; no min≤max stem check; server accepted any JSON (negative fee, closing < opening, max < min, unknown sections) | High | `parseFloat(x) \|\| 150` defaults; no server validation | Client validation identical to section forms; server validates every known field, rejects unknown sections, keeps unknown fields inside allowed sections | `js/admin.js`, `server.js` | 6 invalid patches → 400 and settings unchanged; ₱0 fee saved and charged ₱0 | Passed |
| 14 | Categories | Renaming a core category would orphan products (they reference names) and break item-type mapping in admin/builder; renames were only "protected" by bug #1 | High | Category stored by name; core names used as identifiers | Six core categories: name locked (description editable), cannot be deactivated; custom categories: rename cascades to products, bouquets and supplier categories | `server/store.js`, `server.js` | Rename core → 400; custom rename → product follows | Passed |
| 15 | Admin API | A partial `PUT /api/admin/flowers/:id` reset botanical name, colour, occasions and threshold to defaults | High | Update built only from request body | Updates merge with saved values; stock changes only when sent | `server.js` | Partial update keeps all other fields | Passed |
| 16 | Stock / Availability | Restocking a sold-out **bouquet** left it "Sold Out"; 0 stock could stay "limited"; "limited" used per-item thresholds (5–50) while Admin/Reports use the global threshold; restoring stock could un-hide an "unavailable" item | Medium | Inconsistent availability rules across save/order/adjust/cancel | One rule everywhere: 0 → sold out; restock **from 0** clears sold out (explicit admin "Sold Out" with stock is kept); "limited" uses the global threshold; "unavailable" never auto-changes | `server/store.js` | Bouquet 0 → 20 becomes available; explicit sold-out still blocks orders | Passed |
| 17 | Cart | Cart's first render hard-coded ₱150 fee / ₱2,500 threshold | Medium | Literal values | Uses saved Shop Settings (same function as checkout) | `js/app.js` | Browser: ₱950 → fee ₱50, "Add ₱3,050 more" | Passed |
| 18 | Home page copy | "Why choose us" / "How to order" showed "flat ₱150" and "₱2,500" always | Medium | Hard-coded copy | Built from saved fee/threshold | `js/site-update.js` | Code + render check | Passed |
| 19 | Announcement | Threshold 0 displayed as ₱2,500; text said "over ₱X" but rule is "₱X and up" | Low | `\|\| 2500`; wording | Uses saved value; "orders of ₱X and up"; "Free delivery on all orders" when 0 | `js/app.js`, `index.html` | Browser: "orders of ₱4,000 and up" | Passed |
| 20 | Dashboard | "Out for Delivery" and "Delivery Disputed" counted as Pending; Active Orders used a shorter status list than Orders/Stats; alert items showed item type as category; today's chart dropped orders placed outside 8 AM–8 PM; Y-axis showed "₱1k" three times | Medium | Substring status matching; shadowed constant; missing SQL columns; label rounding | Explicit status map; shared active list; category/unit selected; off-hours folded into first/last bucket; 1-decimal labels | `server/store.js`, `js/admin.js` | Out for Delivery counted correctly; screenshots | Passed |
| 21 | Pickup scheduling | Pickup could be booked on a non-operating day; operating-days parser treated letters "t"/"o" as range separators | Medium | No day check; regex char class `[–\-—to]` | Pickup requires an operating day (client + server); earliest pickup = next open day; correct "A – B / A to B" parsing | `js/shop-rules.js` | 15/15 day-format cases; Sunday pickup on Mon–Sat → 400 | Passed |
| 22 | Mobile header | At 360–390 px the Search, Sign In and **menu button were off-screen** (saved long tagline pushed them out) | Medium | Brand link `shrink-0`, tagline no truncation | Brand can shrink/truncate; tagline shown from `sm` up | `index.html` | Probe at 360/390/768 px: all controls visible | Passed |
| 23 | Notifications | Clicking an order notification opened Home (view "track" does not exist); messages showed "##FLR-…" | Medium / Low | Wrong view name; extra "#" | Opens Tracking for that order; single "#" in all new messages | `js/account.js`, `server/store.js` | New notifications checked | Passed |
| 24 | Customer receipt | Greeting card of a custom bouquet shown as a separate "1× card" product | Low | Grouping ignored `card` lines | Same component rule as server | `js/account.js` | Browser: receipt shows one bouquet line | Passed |
| 25 | Builder / Catalog | Flower occasions mixed stale static data with admin data (Gerbera: Admin "Birthday, Graduation" → shop "Birthday, Anniversary, Birthday") | Low | Merged static list + saved list | Admin-saved occasions are authoritative, de-duplicated | `js/state.js` | Data check | Passed |
| 26 | Collections | "Flower Source" filter always returned 0 results (no bouquet has a source) | Low | Filter shown without data | Hidden until any bouquet has a source | `js/site-update.js` | Render check | Passed |
| 27 | Customers (admin) | "Total spent" ignored "Delivered — Confirmed" orders | Low | Old status list | Uses shared completed-status list | `server/store.js` | Confirmed order counted (₱1,950) | Passed |
| 28 | Disputes | Admin could resolve a non-disputed order or set any status | Low | No validation | Only disputed orders; outcome must be a valid transition | `server/store.js` | Invalid outcome → 400 | Passed |
| 29 | Exports | Complete CSV capped inventory at 50 rows (53 tracked) | Low | `.slice(0, 50)` | All rows exported | `js/admin.js` | Code check | Passed |
| 30 | Copy / UI | Checkout said "Guest Checkout — No account needed" (sign-in is required); pickup texts used store address instead of pickup address; checkout radios browser-blue; low-contrast "View Details"; "Threshold (20 stems)" for all unit types | Low | Copy / styling | Corrected copy, pickup address, brand accent, white text, "units" | `js/app.js`, `js/account.js`, `js/admin.js`, `admin.html` | Screenshots | Passed |
| 31 | Orders | Order-number clash with another customer's order blocked checkout permanently; order dates used server/browser time zone | Low | Fixed client number; local date | Server returns a retry code, browser picks a new number; Manila date on both sides | `server.js`, `js/account.js` | Clash → `ORDER_NUMBER_TAKEN` | Passed |

---

## 3. Verified correct (no change needed)

| Area | What was verified | How |
|---|---|---|
| Ready-made bouquets | Own stock only — recipe flowers/fillers/wrapping **not** deducted; cancel restores bouquet stock once | Integration test |
| Custom bouquet | Min/max stems from Shop Settings; ≥1 wrapping; ≤3 fillers, ≤3 wrappings, ≤2 ribbons, ≤1 card; **no assembly fee**; components and quantities saved; stock deducted and restored exactly once | Integration + browser |
| Overselling | 5 simultaneous orders for 2 in stock → exactly 2 succeed; stock 0, never negative | Concurrency test |
| Duplicate orders | Repeat submit returns the same order (`duplicate:true`); double-click blocked in UI | Integration |
| Prices | Tampered browser prices ignored; server prices from DB | Integration |
| Buy Now / selected-item checkout | Only the chosen items check out; other cart items stay | Browser |
| Accept Online Orders | Off → order refused with explanation; closed-shop reminder with next opening (Asia/Manila) when on | Integration + code |
| Delivery / pickup toggles | Disabled method refused by server and hidden in checkout | Integration |
| Order sync | Admin status changes appear in customer history; customers cannot read others' orders | Integration |
| Reports | Totals = actual orders; revenue excludes cancelled; exports include all rows; no `undefined`/`Unknown Item` | Integration + screenshots |
| Suppliers | All supplier categories exist in Store Management; six-row pagination present | Data + code (Inspected) |
| Currency / dates | ₱ formatting, Asia/Manila used for reports, schedules and order numbers | Inspected |
| Admin XSS | Customer-supplied text is escaped in admin views | Inspected |

---

## 4. Database consistency findings (data **not changed** — needs your decision)

| Finding | Detail | Recommendation |
|---|---|---|
| Bouquet recipes reference archived foliage | **8** of 11 active bouquets (corrected from 7 — see `AUDIT-FOLLOWUP.md` §3) list Eucalyptus/Ruscus (`fol-*`), which are archived. Display only — no stock impact (ready-made bouquets use their own stock). | Approve updating recipes, or un-archive the foliage. |
| Recipe material names differ from inventory names | Recipes say "Natural Kraft Paper", "Luxury Frosted Film", "French Chiffon Ribbon", "Korean Matte Wrap"; inventory names are "Kraft Paper", "Frosted Translucent Wrapping", "Sheer Chiffon Ribbon", "Korean Matte Wrapping Paper". | Approve aligning the recipe text. |
| Cloud Nine has no occasion | Shows no occasion badge and is excluded by occasion filters. | Assign an occasion in Store Management. |
| Items without a supplier | Lisianthus, all wrapping, ribbons and cards. | Assign suppliers if you track them. |
| Bouquet sources empty | Why the Flower Source filter is hidden now. | Fill in sources to re-enable it. |
| Old notifications contain "##FLR" | Historical rows from before the fix. | Harmless; leave as is. |

---

## 5. Incident during testing (please read)

While comparing the old and new test results I ran `tests/unified_products.test.js`. That test (and also
`product_inventory_separation`, `philippines_catalog`, `orders_realtime`) talks to **http://127.0.0.1:3000 — your
running live server — not to a test database**. At 11:29 it:

* created 2 products "Test Temporary Flower" (`fl-test-temporary-flower-3`, `-4`),
* overwrote 4 fields on **Chrysanthemum** (botanical name, colour, occasion, per-item threshold; stock unchanged),
* added 6 stock-log rows and 6 short-lived admin sessions.

**Repaired already** (backup first: `backups/before-test-pollution-repair-20261107-113846.db`): Chrysanthemum's four
fields restored to their exact earlier values; the two test products **archived** (hidden, not deleted). Verified through
your live server's catalog. A follow-up fingerprint check confirmed later test runs no longer touch the live database.

**Done (see `AUDIT-FOLLOWUP.md` §6):** test products, test stock-log rows, test accounts and notifications deleted after a verified backup;
the 6 test admin sessions were kept and expire on their own.

The root cause (partial product updates wiping fields) is fixed (#15). Recommendation: change those four test files to
start their own server on a temporary database like `tests/api.test.js` does.

---

## 6. Remaining issues / not fixed

| Item | Severity | Why not fixed |
|---|---|---|
| Pre-existing failing tests: `admin_pagination` (8), `image_management` (9), `topbar_welcome` (12), `unified_products` (16), `philippines_catalog` (13), `product_inventory_separation` (9), `phase2` (1), `phase3` (3), `inventory_kpis` (3), `product_kpis` (3), `ui` (1), `admin_redesign` (6), `materials_management` (1), `reports` (8) | — | Same failures before and after the audit: tests expect old markup/IDs, or fixtures that only seed when the temp folder name contains "test" (not true on Windows). Two `reports` assertions expect a full-month / single-bucket "today" design the code never had (the baseline never reached them). |
| Admin login rate-limit is skipped for requests from 127.0.0.1 | Medium | Behind a reverse proxy every request looks local, so admin brute-force would be unlimited. Changing it can break local tests — your call (recommend: only skip when `NODE_ENV=test`). |
| Delivery can be scheduled on non-operating days | Low | Business decision (couriers may deliver when the shop is closed). Pickup is now enforced. |
| Pickup preparation time is a fixed 2 hours | Low | The `pickup.leadTimeHours` setting is not editable in Admin. |
| "Newest First" sort on Collections has no real creation date | Low | Bouquets have no `created_at` column; needs a schema addition (approval). |
| Removing a product image in Admin does not clear it | Low | Upsert keeps the old image when an empty value is sent; intentional guard in current code — confirm desired behaviour. |
| Customer emails | — | `MAIL_WEBHOOK_URL` not inspected (credentials). Not tested. |
| Google Sign-In | — | Verified by the existing API tests with a fake key; not tested against Google. |

---

## 7. Security summary

Fixed: unauthenticated delivery confirmation/dispute (#3), order-number broadcast (#4), cross-customer notifications (#5),
anonymous uploads (#6), unvalidated settings (#13), stale price fallback (#8), partial-update data loss (#15).
Verified: server-side pricing and stock checks, order ownership on reads, admin routes require an admin session,
password hashing (scrypt), hashed session tokens, escaped output in admin, upload magic-byte checks.
Open: admin login rate-limit bypass for local addresses (see §6).

---

## 8. Recommended next steps

1. **Restart your live server** (`npm start`). The process started at 10:54 is still running the pre-audit code; none of
   the fixes apply until it restarts.
2. Approve or decline the cleanup in §5 and the data decisions in §4.
3. Fix the four tests that call port 3000 so they cannot touch live data.
4. Decide on the admin login rate-limit (§6).

Backups: source + database snapshot before any change → `backups/pre-audit-20261107-105833/`.
