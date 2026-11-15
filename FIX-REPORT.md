# Umaira Florist - Audit & Fix Report

## 1. Issues found, root causes, fixes
| # | Issue (severity) | Root cause | Fix (files) |
|---|---|---|---|
| 1 | Admin edits never reached customers (Critical) | Storefront read static `js/data.js`; `/api/catalog` was never called | Live catalog loaded and merged on start and on navigation; cart re-priced (`state.js`, `account.js`) |
| 2 | Anyone could log in as any user via Google (Critical) | Server decoded the Google JWT without verifying it and accepted a bare `email` field | RS256 signature/aud/iss/exp/email_verified verification (`server/google.js`, `server.js`) |
| 3 | Public endpoint could replace the Google client ID (High) | `POST /api/auth/config` unauthenticated | Removed; ID now comes from `GOOGLE_CLIENT_ID` |
| 4 | Default admin password `umaira2026` in code (Critical) | Hardcoded credential, shared token check | Hashed `admin_users`, no default, rate limit (`store.js`, `server.js`) |
| 5 | Fake order success page when the API failed (Critical) | Client invented an order number on any error | Removed; real error shown, nothing stored (`account.js`) |
| 6 | Orders not tied to customers; history in localStorage shared by all users; seeded fake orders (Critical) | `user_id` never written; demo data in `state.js` | Orders carry `user_id`; `/api/my/orders`; fake data removed |
| 7 | Anyone with an order number could read it, including address and phone (High) | Public `GET /api/orders/:n` | Owner or admin only |
| 8 | No stock check or decrement; `stockCount 0` displayed as 50 (High) | Not implemented; `\|\| 50` fallback | Atomic transaction, restore on cancel, sold-out logic |
| 9 | Prices came from a static file; admin price changes ignored at checkout (High) | `pricing.js` read `data.js` | Priced from DB |
| 10 | Stored XSS in admin panel (Critical) | No HTML escaping anywhere | `esc()` / `escapeHtml()` everywhere user text is rendered; toasts use textContent |
| 11 | Catalog overwritten on every restart (High) | `INSERT OR REPLACE` seeding | Seed only when empty |
| 12 | Cart +/- did not redraw (Medium) | `cart_change` computed HTML but never inserted it | Re-render (`app.js`) |
| 13 | Last cart change lost on reload (Medium) | 350 ms debounce, server copy overwrote local | Dirty flag + flush on page hide (`state.js`) |
| 14 | Guests could not browse products or open details (High, spec) | Collections and detail modals gated | Public browsing; sign-in only for actions |
| 15 | Missing: profile editing, order history, password reset (spec) | Not implemented | New account, reset, forgot views and APIs |
| 16 | Home page crashed with an empty catalog (Medium) | Marquee assumed products | Guarded; error banner with Retry |
| 17 | Offline "login" accepted any account; passwords stored in localStorage (High) | Local fallback auth | Removed; server-only auth |
| 18 | Weak password hashing (1000 PBKDF2 rounds), tokens stored raw (Medium) | Legacy design | scrypt (old hashes upgrade on login), hashed session tokens |
| 19 | Path/URL robustness: malformed URL crashed the server; CORS `*` (Medium) | Unhandled `decodeURIComponent`; open CORS | Handled; same-origin only; security headers |
| 20 | Fabricated star ratings displayed (Medium) | Static sample data | Rating hidden on cards |
| 21 | Mobile header overflow when signed in (Low) | Extra nav items | Hidden below `sm` |
| 22 | Admin: invalid ids on create, "Delete" was permanent, revenue counted pending orders (Medium) | Client-generated ids; hard delete; naive SUM | Server ids, archive, revenue = Delivered/Picked Up only |

## 2. Files
New: `server/google.js`, `server/mailer.js`, `db/schema.sql`, `js/account.js`, `tests/api.test.js`, `tests/e2e.test.js`, `package.json`, `.env.example`, this report.
Rewritten: `server.js`, `server/store.js`, `server/pricing.js`, `js/state.js`, `view-orders.js`, `README.md`.
Modified: `js/app.js`, `js/site-update.js`, `js/builder.js`, `js/admin.js`, `js/shop-rules.js`, `index.html`, `admin.html`.
Removed: `build-index.js` (pre-rendered stale prices), old test files, bundled database.

## 3. Tested (and passing)
- `npm test`: 131 API checks (auth, Google forgery cases, roles, pricing, stock, privacy, admin, rate limiting, robustness).
- `npm run test:e2e`: 77 real-browser checks (scenarios 1-20 of the brief except real Google/email, below).
- Migration of an older database copy (70 orders preserved).
- Layout: no horizontal overflow at 375 / 768 / 1280 px on 9 pages and admin.

## 4. Not tested / could not be completed
- Real Google sign-in (needs your Client ID; server-side verification tested with generated keys; the Google button was not exercised).
- Real email delivery of reset links (no provider available; links print to the log by default).
- Payment processing (none exists).
- Firefox / Safari; full visual review of every screen at every width; external Unsplash images (blocked in my environment).
- Load / concurrency beyond the transactional stock checks.

## 5. Remaining limitations
See README "Known limits". Also: marketing labels (Best Seller, sales counts) are still static content; business rules (fee, free-delivery threshold, restock on cancel) were kept as configured or as the logical inverse of existing behaviour, with no new policies added.
