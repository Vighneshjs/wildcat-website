# Wildcat gaming bookings

The GitHub Pages site uses the Worker URL in `gaming-book/config.mjs`. The Worker
stores customer reservations, owner sessions, and settings in D1. The initial
schedule is 10:00–19:30 IST, one station, with online checkout disabled until
the owner confirms the station count and package prices. The last owner start for a
30-minute session is 19:00. Sessions use 30-minute increments, last 30 minutes
to three hours, and can be booked through 14 days ahead. Online packages are one, two, or three hours at ₹200, ₹350, and ₹500 by default. A customer checkout
holds one station for up to ten minutes and never past its start time.

## Deploy to Cloudflare Workers Free

Run these commands from this directory using Wrangler and the shop's
Cloudflare account.

```powershell
npx wrangler login
npx wrangler d1 create wildcat-booking
Copy-Item wrangler.example.toml wrangler.toml
```

Replace the placeholder in the local config with the returned D1 database ID.
Apply the schema, deploy the Worker, and configure secrets through Wrangler's
interactive prompts. Use a randomly generated, high-entropy owner token.

```powershell
npx wrangler d1 execute wildcat-booking --remote --file schema.sql
npx wrangler deploy
npx wrangler secret put OWNER_TOKEN
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
```

Configure Razorpay auto-capture and subscribe the Worker URL plus `/webhook`
to `payment.captured` using the configured webhook secret. Use Razorpay Test
Mode first on a preview site and isolated D1 database. Set the Worker
`SITE_ORIGIN` variable to that site's HTTPS origin for testing. It defaults to
`https://wildcatdesk.shop` for production. Set the corresponding Worker URL
in `gaming-book/config.mjs` before publishing the frontend. Store credentials
in Worker secrets and keep test credentials out of the production booking flow.

At `/gaming-book/owner/`, enter the owner token, set the actual station count
and package prices, and enable online bookings after a successful test. Check concurrent
overlapping holds, owner edits, payment confirmation, and payment after expiry.
An expired hold with a captured payment appears in the owner schedule for
manual review and refund through Razorpay. Paid cancellations and refunds are
handled by the owner, and the owner page only supports cancelling unpaid sessions.

Use the cloud owner schedule to add, move, or extend shop reservations before
starting or extending the timer in Wildcat Desk. The timer and existing local
SQLite sessions do not publish occupancy to D1, so a local-only action is
invisible to customers. The owner and booking pages refresh every five seconds
while visible. Every reservation is checked against D1 at submission time.

Run the local database regression check with `node --test worker.test.mjs` using
Node 24 or later.

For databases created before package pricing, apply package-prices.sql once before deploying the updated Worker. Fresh databases already have the columns.
