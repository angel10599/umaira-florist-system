# Umaira Florist

Online flower shop: public storefront for guests, accounts / cart / checkout / order tracking for customers, and an admin console. No npm dependencies are needed to run it (Node's built-in SQLite is used).

## Requirements
- **Node.js 22.5 or newer** (`node -v`)

## Run locally
```bash
cp .env.example .env          # optional; or export the variables yourself
ADMIN_PASSWORD='a-long-unique-password' node server.js
```
- Shop: http://localhost:3000/  Admin: http://localhost:3000/admin
- On the **first start** the admin account is created (`ADMIN_USERNAME`, default `admin`). If `ADMIN_PASSWORD` is not set, a random one is printed once in the console. There is no built-in default password.
- The database (`data/umaira.db`) and the starting catalog are created automatically. Existing databases from earlier versions are upgraded in place without losing orders or products.

## Configuration (environment variables)
See `.env.example`. Summary:

| Variable | Purpose |
|---|---|
| `PORT` | Port to listen on (default 3000) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | First-start admin account |
| `GOOGLE_CLIENT_ID` | Enables Google sign-in. Customers never configure anything. |
| `PUBLIC_URL` | Used in password-reset links |
| `MAIL_WEBHOOK_URL` / `MAIL_WEBHOOK_TOKEN` | Sends reset emails through your email provider. Without it, links print to the server log. |
| `UMAIRA_DATA_DIR` | Folder for the database |

### Google sign-in setup (owner, one time)
1. Google Cloud Console -> APIs & Services -> Credentials -> *Create OAuth client ID* -> **Web application**.
2. Add your site URL (e.g. `https://your-domain`, and `http://localhost:3000` for testing) to **Authorized JavaScript origins**.
3. Set `GOOGLE_CLIENT_ID` to the generated ID and restart. The Google buttons then appear on the Sign In / Sign Up page.

## Database
Schema: `db/schema.sql` (applied automatically, additive migrations in `server/store.js`). Products, stock, customers, carts, orders and sessions are all stored here. **Back up the `data/` folder.**

## Tests
```bash
npm test                      # API / security / business-logic tests (no extra install)
npm i && npx playwright install chromium
npm run test:e2e              # real-browser end-to-end tests
```
Both use a throwaway database, never your real one.

## Deploying
1. Use any host that runs Node 22.5+ (VPS, Render, Railway, Fly.io...). Run `node server.js` with the environment variables above.
2. **Use HTTPS** (a reverse proxy such as Caddy or nginx, or the host's built-in TLS). Set `PUBLIC_URL` to the https address.
3. Keep `data/` and `assets/uploads/` on a **persistent disk/volume**; otherwise orders and uploaded photos disappear on redeploy.
4. Back up `data/umaira.db` regularly.
5. If you run behind a proxy, note the built-in rate limiter sees the proxy's address; keep traffic modest or add proxy-level rate limiting.

## Daily use
- Admin console: manage orders (status changes show up in the customer's account), products, stock, photos, and view customers.
- Archiving a product hides it from the shop but keeps old orders intact.
- Cancelling or rejecting an order returns its flower stems to stock.
- Command-line alternative: `node view-orders.js`.

## Known limits
- Payment methods (GCash, bank transfer) are recorded as labels only; **no payment is processed or verified**. Cash orders are marked Paid when delivered / picked up.
- Ready-made bouquets have availability only (not stem-level stock). Fillers, wrapping and ribbons are priced from `js/data.js`, not the admin.
- Product photos shown from external URLs depend on those sites staying online.
- Sign-in tokens are kept in browser storage; there is no Content-Security-Policy yet.
