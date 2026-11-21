# Umaira Florist

Online flower shop for the City of Manila: a public storefront, customer accounts with cart, custom bouquet builder, checkout and order tracking, and an admin console for orders, payments, products, stock, suppliers, reports and shop settings.

> **Current limitation: email delivery.** Production email is sent through Resend's **testing sender**, which only delivers to the email address that owns the Resend account. Other customers do **not** receive verification codes, order emails or password-reset links yet. See [Email: current status and how to enable delivery](#email-current-status-and-how-to-enable-delivery).

**Contents**
- [For customers](#for-customers)
- [Email: current status and how to enable delivery](#email-current-status-and-how-to-enable-delivery)
- [Recent changes (November 2026)](#recent-changes-november-2026)
- [For developers](#for-developers)
- [Known limitations](#known-limitations)

---

## For customers

### Browsing and accounts
- Anyone can browse the collections and product details.
- An account is needed to add items to the cart, save a custom bouquet, check out, and track orders.
- **Creating an account** asks for your full name, a Philippine mobile number (for example `0917 123 4567` or `+63 917 123 4567`), your email address and a password of at least 8 characters. A 6-digit verification code is then emailed to you. It expires after 5 minutes, and you can ask for a new one after 60 seconds.
  - *Right now most email addresses cannot receive this code* (see the notice above). If you see "We could not send the verification email right now", your details are not the problem. Use **Continue with Google** instead.
- **Google sign-in** works without a verification code.
- **Forgot password** sends a reset link that is valid for 1 hour (subject to the same email limitation).
- **Deleting your account** (from your account page) needs your password, or for Google accounts, your email address typed exactly. Your login, saved address, cart and notifications are removed. Orders you already placed stay in the shop's records.

### Delivery and pickup
- **Delivery** is available within the **City of Manila only** (Districts I–VI). You choose your district and barangay at checkout.
  - Deliveries start from the next day the shop is open, in one of three time windows: Morning (9:00 AM – 12:00 PM), Afternoon (1:00 PM – 4:00 PM) or Evening (5:00 PM – 7:00 PM).
  - The delivery fee is a flat fee that is waived when your order reaches a minimum amount. The shop sets both amounts (defaults: ₱150, free from ₱2,500); checkout always shows the exact fee.
- **Store pickup** is free. Pickup times run every 30 minutes during opening hours, with the last slot 30 minutes before closing. Same-day pickup needs preparation time (2 hours by default).
- No deliveries or pickups are scheduled on days the shop is closed.
- Gift messages can be up to 250 characters.
- In the **custom bouquet builder** you pick your stems within the shop's minimum and maximum (default 1–50). There is no arrangement fee.

### Payment methods
| Method | How it works |
|---|---|
| **GCash** (pay in advance) | Offered only when the shop has set up its official GCash QR code, account name and number. Otherwise it is shown as **"GCash unavailable"** and cannot be selected. Send the exact amount, then upload your receipt screenshot with the GCash reference number. Your payment shows *Pending Verification* until the shop checks its GCash account. It then becomes *Paid*, or *Rejected* (you can submit a new proof). The order is confirmed only after the payment is verified. Each reference number can be used only once. |
| **Cash on Pickup** | Pay at the shop counter. The order is handed over once the cash is received. |
| **Cash on Delivery** | Pay the rider in cash. The payment is marked *Paid* once the shop receives the cash from the courier. |

BDO Bank Transfer is no longer offered. Older orders paid that way still display normally.

### Order progress
- **Delivery:** Pending Confirmation → Confirmed → Preparing → (Rider Assigned) → On the Way / Out for Delivery → Delivered — Awaiting Confirmation (with a delivery photo) → **you confirm** → Delivered — Confirmed. If something is wrong, report an issue instead (Delivery Disputed). A failed delivery attempt is shown as Delivery Attempt Failed.
- **Pickup:** Pending Confirmation → Confirmed → Preparing → Ready for Pickup → the shop hands the order over (Awaiting Customer Confirmation) → **you confirm** → Picked Up, or report an issue (Pickup Disputed).
- Please confirm receipt, or report an issue, from your order page.
- The shop may decline or cancel an order (Rejected/Cancelled).
- Order and payment updates appear in your in-app notifications. Order emails are also sent (see the email limitation).

---

## Email: current status and how to enable delivery

### Current status (as of 21 November 2026)
- Production sends email through **Resend** using its testing sender `onboarding@resend.dev` (the default `MAIL_FROM`).
- In this mode Resend only delivers to the **email address of the Resend account owner**. For every other address Resend answers `403 — "You can only send testing emails to your own email address … please verify a domain"`. The production logs show this for every failed sign-up.
- The website's email validation is **not** the cause; valid addresses are accepted.

**Effect until production email is configured:**

| Email | Who receives it today |
|---|---|
| Registration verification code | Only the Resend account owner. Everyone else gets "We could not send the verification email right now…" and cannot finish email sign-up (Google sign-in still works). |
| Order placed / order status updates | Only the Resend account owner |
| Password reset link | Only the Resend account owner |
| Google sign-in notice | Only the Resend account owner |

Payment verification updates (approved, rejected, cash received) are **in-app notifications only**; they are never emailed.

### Emails the system sends (when delivery works)
- 6-digit verification code at registration, and when a new code is requested
- Order placed email
- Status emails when the shop moves an order to: Confirmed, Preparing, Ready for Pickup, Rider Assigned, On the Way, Out for Delivery, pickup handover (Awaiting Customer Confirmation), Delivered — Awaiting Confirmation, and Rejected/Cancelled
- Password reset link (plain text)
- Google sign-in notification

All of these are awaited before the server responds, so Vercel does not cut them off. A failed send never fails the order or sign-in. It is logged, and for verification codes the customer sees an honest error.

### How the mailer chooses a provider
`server/mailer.js` uses the **first configured** provider:
1. **SMTP**: when `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` are all set
2. **Resend**: when `RESEND_API_KEY` is set
3. **Webhook relay**: when `MAIL_WEBHOOK_URL` is set

With none configured, sending fails (code `EMAIL_NOT_CONFIGURED`), and email/password registration cannot complete.

### Enabling delivery to all customers (choose one)

**Option A: Gmail SMTP (no domain needed).** SMTP support is new in this release. It has been tested against a local SMTP server but not yet against Gmail in production.
1. On the Gmail account that should send the emails, turn on **2-Step Verification**.
2. Create an **App Password** at <https://myaccount.google.com/apppasswords> and copy the 16-character code (without spaces).
3. In Vercel → Project → Settings → Environment Variables (Production), set:

   | Variable | Value |
   |---|---|
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | the Gmail address |
   | `SMTP_PASS` | the 16-character App Password |
   | `SMTP_FROM` (optional) | `Umaira Florist <the Gmail address>` |
4. Redeploy. When SMTP is set it takes priority over Resend.

Gmail applies daily sending limits, which suit a small shop.

**Option B: Resend with a verified domain** (requires owning a domain)
1. Add and verify the domain at <https://resend.com/domains> (add the DNS records Resend shows).
2. Set `MAIL_FROM` to an address on that domain, for example `Umaira Florist <orders@your-domain>`, and keep `RESEND_API_KEY`.
3. Redeploy.

### Checking that it works
- Register with an email address that is **not** the Resend account owner's and confirm the code arrives (check spam too).
- Vercel → Logs: a failed send is logged as `[mail:otp] registration failed (<code>)`. When the cause is configuration, it is followed by an `ACTION NEEDED:` line that says what to change. Codes: `EMAIL_PROVIDER_RESTRICTED` (Resend testing sender), `EMAIL_AUTH_FAILED` (wrong SMTP login), `EMAIL_NOT_CONFIGURED`, `EMAIL_SEND_FAILED`.
- Treat email as available to customers **only after** this check passes.

---

## Recent changes (November 2026)

### Fixes for problems introduced by the Turso migration (commit `b40083c`)
- **Admin settings and saved customer addresses appeared empty.** The JSON-parsing helper `safeParse` in `server/store.js` had been made `async`. Every caller that did not `await` it stored an unresolved Promise, which reaches the browser as `{}`. As a result:
  - every Shop Settings form showed blanks or defaults;
  - forms looked "cleared" after saving;
  - saved customer addresses came back empty.
  
  `safeParse` is synchronous again. The data in the database was never lost.
- **GCash settings persistence and QR code preservation.** Because the server could not read the current settings, saving only the GCash name or number erased the stored QR code. Edits now keep the existing QR unless it is replaced or removed on purpose. The QR image URL limit was also raised from 120 to 500 characters, so long Cloudinary URLs are not cut off.
- **Invalid order-status transitions were accepted.** `validateTransition` had become `async`, so its check never blocked anything. Jumps such as *Pending Confirmation → Picked Up* are rejected again.
- **Stock restoration crashed when orders were rejected or cancelled.** The restock loop iterated over an unawaited Promise. Rejecting or cancelling an order now returns its items to stock.
- **Reports grouped ordinary items as "Custom Bespoke Bouquet".** `isCustomComponent` had become `async`, so it was always truthy and even ready-made bouquets landed in that group. Reports now list ready-made bouquets and individually purchased items under their own names again.
- **Emails could be dropped by Vercel.** The order-placed, password-reset and Google sign-in emails were sent after the HTTP response, and a serverless function may stop once the response is sent. They now complete before the response, like the order-status emails.
- Two database transactions that were not awaited (saving settings, the confirmation-deadline job) are now awaited.

### GCash payment configuration
- GCash is fully managed in **Admin → Shop Settings → Payment Accounts**. Nothing is hardcoded: an old migration that pre-filled a GCash name and number was removed.
- GCash is **available only when the QR code, account name and GCash number are all saved**. Otherwise customers see "GCash unavailable", and the server refuses GCash orders.
- After saving, the admin badge shows **GCash active** or **GCash not set up**. The confirmation message lists exactly which item is missing.
- On the checkout page, the payment choices refresh when GCash availability changes, without clearing anything else the customer typed. Checkout re-checks availability when it opens and when the customer returns to the tab.

### Email
- SMTP sending was added (via `nodemailer`). It works without a domain, for example with a Gmail App Password. Before this, SMTP was mentioned in the code but not implemented.
- The registration error no longer tells customers to check an email address that is actually valid. Provider errors are classified, and the server log gives an actionable hint.

### Safety and privacy
- The public live-update stream (`/api/events`) now only signals that settings changed. Browsers then re-fetch the public catalog, so the full settings are never broadcast.
- Tests that use `tests/helpers/isolated-db.js` can no longer reach the live Turso database, and Firestore sync is switched off in test mode.
- New regression test: `tests/gcash_settings.test.js`.

---

## For developers

### Tech stack
- **Server:** Node.js **22.5+**, a single `http` server in `server.js` (no framework). Business logic lives in `server/store.js` (data layer), `server/payments.js`, `server/pricing.js` and `server/mailer.js`.
- **Frontend:** plain HTML/JS. Storefront: `index.html` plus `js/app.js`, `js/state.js`, `js/account.js`, `js/payments.js`, `js/builder.js`. Admin: `admin.html` plus `js/admin.js`, `js/admin-payments.js`, `js/admin-pickup.js`. Shared ordering rules (used by both browser and server): `js/shop-rules.js`.
- **Database:** Turso / LibSQL through `@libsql/client` (`server/db.js`). When `TURSO_DATABASE_URL` is set it is used; otherwise a local SQLite file `data/umaira.db` is used. Schema: `db/schema.sql`, plus additive migrations in `server/store.js`.
- **Images:** Cloudinary (`server/cloudinary.js`, `server/upload.js`).
- **Email:** `server/mailer.js` (SMTP, Resend or webhook; see above).
- **Google sign-in:** ID tokens are verified on the server (`server/google.js`).
- **Firestore backup:** one-way copy of users, products, orders and settings (`server/firestore-sync.js`). Active only when a service-account file (`serviceAccountKey.json` or `config/firebase-service-account.json`) is present. These files are git-ignored, so deployments built from GitHub do not have them. The SQL database is always the source of truth.
- **Dependencies:** `@libsql/client`, `cloudinary`, `dotenv`, `firebase-admin`, `nodemailer`; `playwright` (dev, browser tests).

### Run locally
```bash
npm install
# create a .env file with the variables you need (see Configuration); there is no .env.example
node server.js
```
- Shop: http://localhost:3000/  Admin: http://localhost:3000/admin
- On the first start an admin account is created (`ADMIN_USERNAME`, default `admin`). If `ADMIN_PASSWORD` is not set, a random password is printed once in the console.
- **Warning:** if your `.env` contains `TURSO_DATABASE_URL`, the local server reads and writes the **live production database**. Leave the Turso variables out of a local `.env` to work on the local file `data/umaira.db` instead.

### Configuration (environment variables)
Never commit `.env` (it is git-ignored).

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Cloud database (required on Vercel). Without them a local file in `UMAIRA_DATA_DIR` (default `data/`) is used. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Admin account created on first start. **If `ADMIN_PASSWORD` is set, the admin password is reset to it on every server start (on Vercel, every cold start)**, so a password changed in the console is overwritten. Remove the variable after setup if console changes should stick. Minimum 8 characters. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Admin image uploads (products, GCash QR code) always go to Cloudinary. Customer payment receipts go to Cloudinary when `CLOUDINARY_CLOUD_NAME` is set, otherwise to local disk. |
| `GOOGLE_CLIENT_ID` | Enables Google sign-in (see below). |
| `PUBLIC_URL` | Base address used in password-reset links (falls back to the request's host). |
| `SMTP_HOST`, `SMTP_PORT` (default `465`), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_REQUIRE_TLS` | SMTP email (first choice when set). |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend email. `MAIL_FROM` defaults to `Umaira Florist Atelier <onboarding@resend.dev>`, the testing sender. |
| `MAIL_WEBHOOK_URL`, `MAIL_WEBHOOK_TOKEN` | Optional webhook relay for email. |
| `PORT` | Port for `node server.js` (default 3000). |
| `TRUST_PROXY` | Number of reverse proxies in front of the app, so rate limits see real client addresses. Set to `1` automatically on Vercel. |
| `ORDER_RATE_LIMIT` (default 20), `PAYMENT_PROOF_RATE_LIMIT` (default 6 per 10 minutes) | Abuse limits per customer. |
| `DEADLINE_CHECK_MS` | How often the confirmation-deadline job runs (default 5 minutes; long-running server only). |
| `UMAIRA_DATA_DIR`, `UMAIRA_UPLOAD_DIR`, `UMAIRA_TEST` | Local data/upload folders; test mode (set by the test helper). |

### Google sign-in setup (owner, one time)
1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → **Web application**.
2. Add your site URL (and `http://localhost:3000` for testing) to **Authorized JavaScript origins**.
3. Set `GOOGLE_CLIENT_ID` and restart or redeploy. The Google buttons then appear on the Sign In / Sign Up page.

### Deploying on Vercel (current setup)
- `vercel.json` builds `server.js` with `@vercel/node` (max duration 30 s) and routes every request to it. Static files (`*.html`, `styles.css`, `js/`, `image/`, `assets/`) are bundled with the function.
- Set the environment variables above in Vercel (at least Turso, Cloudinary, the admin account, `GOOGLE_CLIENT_ID`, `PUBLIC_URL` and an email provider), then redeploy.
- Vercel has no persistent disk, so the database must be Turso and uploads must go to Cloudinary.
- Serverless caveats are listed under [Known limitations](#known-limitations).

### Self-hosting alternative
Run `node server.js` on any host with Node 22.5+ (VPS, Render, Railway, Fly.io…):
- Serve it over **HTTPS** (Caddy, nginx or the host's TLS) and set `PUBLIC_URL` to the https address.
- Without Turso or Cloudinary, keep `data/` and `assets/uploads/` on a **persistent volume** and back up `data/umaira.db` regularly.
- Set `TRUST_PROXY` when running behind a proxy.
- In this mode the confirmation-deadline job runs every 5 minutes. It sends one reminder, then auto-confirms: pickups after 24 h (reminder at 6 h) and deliveries after 48 h (reminder at 24 h). The payment status is never changed.

### Admin console
- Sections: **Dashboard, Orders, Store Management, Suppliers, Reports, Shop Settings**.
- **Payment Accounts** (Shop Settings): upload, replace or remove the GCash QR code (PNG, JPG or WebP, up to 5 MB) and enter the account name and number, then click **Save Payment Accounts**. Name and number must be entered together. GCash becomes available to customers only when all three are saved.
- **Who can do what:** GCash verification (approve/reject proofs) and Payment Accounts changes need the *Administrator* or *Owner* role. Confirming cash received is allowed for *Administrator, Owner, Manager* and *Cashier*.
- **Order rules enforced by the server:**
  - GCash orders must be *Paid* before Confirmed or Preparing.
  - Cash on Pickup must be confirmed with **Confirm Cash Received** before the handover.
  - A delivery is marked delivered only by uploading a proof-of-delivery photo.
  - A pickup handover uses **Confirm Pickup**.
  - *Picked Up*, *Delivered — Confirmed* and the disputed statuses are the customer's own answer.
  - Invalid status jumps are rejected.
- Archiving a product hides it from the shop but keeps old orders intact. Rejecting or cancelling an order returns its items to stock.
- `node view-orders.js` (the old command-line order viewer) is **currently broken**: it still uses the pre-migration synchronous store API. Use the admin console.

### Tests
**Only run tests that require `tests/helpers/isolated-db.js`.** That helper gives each run a throw-away database and upload folder, blanks the Turso variables, and switches Firestore sync off.

Several older test files (`api`, `e2e`, `ui`, `shop_settings_sync`, `phase2`, `phase3`, `phase4_verify`, `admin_pagination`, `admin_redesign`, `image_management`) set up their own temporary folder but **do not** blank `TURSO_DATABASE_URL`. If your `.env` contains Turso credentials they would write to the **live database**. This includes `npm test` (`tests/api.test.js`) and `npm run test:e2e`. Do not run them until they are moved to the helper.

```bash
node tests/gcash_settings.test.js     # example: run one suite
npx playwright install chromium        # needed only for browser tests
```

Results of the helper-based suites on 21 November 2026:

| Status | Suites |
|---|---|
| Passing | `gcash_settings` (17), `reports` (35), `inventory_kpis` (15), `product_inventory_separation` (15) |
| Some failures, already failing before the latest fixes | `materials_management` (2), `philippines_catalog` (9), `product_kpis` (3), `unified_products` (1) |
| Crash: test code still calls the store synchronously, as before the Turso migration | `payments`, `pickup`, `order_confirmation`, `auth-security` |
| Prints no results | `orders_realtime` |

Updating the older tests to the async store API is still to be done.

---

## Known limitations
- **Email delivery** is limited to the Resend account owner until SMTP or a verified Resend domain is configured ([details](#email-current-status-and-how-to-enable-delivery)).
- **No payment gateway.** GCash payments are checked manually by the shop against its own GCash account. Cash payments are recorded by staff.
- **Serverless (Vercel) caveats:**
  - **The confirmation-deadline job (reminders and automatic confirmation) does not run on Vercel.** It is started only by `node server.js`, and there is no Vercel cron for it. On Vercel, orders wait in *Awaiting Customer Confirmation* / *Delivered — Awaiting Confirmation* until the customer answers.
  - Live updates (`/api/events`) and rate limits are kept in each server instance's memory, so they do not reach across instances. The storefront compensates by re-checking the catalog when checkout opens and when the tab is revisited, and the server always enforces the current settings.
  - On the Hobby plan, Vercel keeps runtime logs for only about an hour.
- Payment receipts stored on Cloudinary use unguessable URLs but are not access-controlled.
- The barangay ranges for Manila Districts V and VI in `js/shop-rules.js` are approximate; check them against the official City of Manila list.
- Product photos that point to external URLs depend on those sites staying online.
- Sign-in tokens are kept in browser storage, and there is no Content-Security-Policy header yet.
