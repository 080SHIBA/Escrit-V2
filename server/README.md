# Escrit — server

The API behind Escrit, a multi-category marketplace for products,
courses, and services. Buyers pay once through the configured processor; Paystack is the default and each listing
in the cart gets its own escrow order. Sellers handle shipping or service
appointments, buyers confirm completion, and the platform handles disputes.
Node, Express and MongoDB, deployed on Render.

The web client is in the companion `client` repository.

## How money moves

1. A seller verifies a Nigerian bank account. The selected provider resolves the
   account number to its registered holder — that name, never the raw
   number, is what buyers see.
2. Publishing a listing automatically creates an external share link.
   Marketplace purchases use the buyer's cart instead.
3. Checkout creates one provider charge for the basket and a separate
   **Transaction** (escrow record) for each listing in the basket.
4. Provider webhooks are authenticated with the configured secret. The API
   verifies the provider transaction ID, status, currency, and total
   before moving every order to **held**.
5. Sellers mark delivery or service completion. Buyers can confirm early,
   raise a dispute to freeze the funds, or let the agreed review window
   expire for automatic payout. Seller-created payment links can choose
   24 hours, 3 days (the default), or 7 days. Admin dispute resolutions
   record a written reason.

Payouts and refunds use the selected provider. Seller payouts use the saved verified
bank details, minus the configurable platform commission. Buyer-facing listing
prices include the provider-quoted processing fee, which is not itemized at checkout.

Recipient onboarding uses the validated `returnTo` path submitted during
registration or sign-in and stores its link and transaction IDs on the user.
`GET /api/escrow-links/:id/preview` returns only recipient-safe transaction
details and a server-derived link state. Checkout requires explicit acceptance
of the stored terms snapshot; onboarding itself never accepts terms or starts
payment.

## Live vs. test payments

Every provider ships two full key pairs (`..._TEST` and `..._LIVE` in
`.env.example`). Which pair is actually used is a runtime setting — the
**owner** flips it from `/admin/settings` in the app, no redeploy
needed. The platform always starts in `test` mode on a fresh deploy, and the
UI requires an explicit confirmation before switching to `live`, since that's
the one change that moves real money. Checkout, webhooks, bank verification,
and payouts all read whichever pair is currently active.

## Running locally

```bash
npm install
cp .env.example .env      
npm run dev
```

## Environment variables

See `.env.example` for the full list and what each one does. At minimum
you need `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`PAYSTACK_SECRET_KEY`, and `PAYSTACK_WEBHOOK_SECRET`. Set `OWNER_EMAILS` to bootstrap the
platform owner account. `ADMIN_EMAILS` remains available for migration-compatible
admin access. Cloudinary, Google Sign-In, and Brevo email are optional integrations.

## Media uploads (Cloudinary)

The server never touches image bytes. `POST /api/links/upload-signature`
returns a short-lived signed request that lets the browser upload photos,
dispute evidence, and short course videos directly to Cloudinary. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`
and `CLOUDINARY_API_SECRET` to enable it; without them, sellers can still
paste an image link.

## Webhooks

Point the Paystack webhook at `POST /api/webhooks/paystack` and set
`PAYSTACK_WEBHOOK_SECRET`. The endpoint verifies the HMAC signature and
re-verifies payment details before holding funds. If the owner selects
Flutterwave in platform settings, configure `/api/webhooks/flutterwave` and
`FLW_SECRET_HASH` instead.

## Production deployment

Deploy the `server` directory as a Render web service with build command
`npm ci`, start command `npm start`, and health check path `/api/health`. Set
`CLIENT_ORIGIN` to the exact Vercel origin(s), including any deliberate preview
origin. Configure `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, MongoDB, JWT secrets,
`OWNER_EMAILS`, plus Brevo sender/API credentials to send new-account verification
links. Set `GOOGLE_CLIENT_ID` on the API and `VITE_GOOGLE_CLIENT_ID` on the client
to enable Google sign-in. Configure the optional Cloudinary variables in Render.

Deploy the `client` directory to Vercel with `npm run build` and output directory
`dist`. Set `VITE_API_URL` to the public Render URL with no trailing slash and
`VITE_GOOGLE_CLIENT_ID` when Google sign-in is enabled. Configure the payment
webhook only after the Render URL is live, then verify `/api/health`, login,
checkout initialization, webhook delivery, and Socket.IO from the deployed
Vercel origin.

## Realtime service chat

Socket.IO shares the Express HTTP server and authenticates each connection with
the short-lived access token. Configure `CLIENT_ORIGIN` for every deployed client
origin; service offer messages are persisted in MongoDB and sockets deliver live
updates, presence, typing, and read state.

## Shopify seller channel

Sellers can connect their own Shopify store from Profile settings. The integration
uses Shopify OAuth and requests only `read_products` and `read_orders`. Configure
the following server-only environment variables:

- `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` from the Shopify Dev Dashboard.
- `SHOPIFY_REDIRECT_URI`, exactly `https://<your-api-host>/api/shopify/callback`;
  add this same value to the app's allowed redirect URLs.
- `SHOPIFY_TOKEN_ENCRYPTION_KEY`, a private 32-byte key encoded as 64 hex
  characters. Generate one with
  `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
  and store it only in the server's secret environment.
- `SHOPIFY_API_VERSION`, optional; defaults to `2026-10`.

The app must request `read_products` and `read_orders` in its API access
configuration. Shopify must be able to reach the HTTPS callback URL. Sellers
enter their `<store>.myshopify.com` domain and approve the requested scopes on
Shopify before the connection is saved. OAuth state is single-use and expires
after ten minutes; callbacks have their HMAC and timestamp verified. Access and
refresh tokens are AES-256-GCM encrypted in MongoDB. If the encryption key is
lost or changed, connected stores must be disconnected and authorized again.

Product import is paginated and idempotent. Each Shopify variant becomes an
inactive, unverified Escrit product draft. Sellers review the imported title,
description, category, image, Escrit price, and stock, then submit each draft
through Escrit's normal listing moderation. Importing does not publish products
or make Shopify product changes. Recent Shopify orders are a separate, read-only
view; they are not Escrit `Transaction` records, checkout sessions, payments, or
escrow orders. No Shopify order is created from an Escrit purchase.

To disconnect, sellers can remove the locally stored encrypted tokens in Profile
settings and revoke Escrit's access from Shopify's app settings. Existing drafts
and submitted Escrit listings are preserved.

## Admin review

Admins review KYC, approve listings, resolve disputes, and inspect post-delivery
complaints. Accounts listed in `OWNER_EMAILS` can grant or revoke persisted admin
roles and update the platform commission percentage.

## Fulfillment

The auto-release countdown starts when the seller marks delivery or service
completion, not when payment is made. Seller-created payment links offer
24-hour, 3-day, and 7-day review windows, with 3 days as the default. A buyer
confirmation releases funds sooner; a dispute freezes the transaction until an
admin resolution. The server checks due orders once per minute and retries
failed payouts while the escrow remains held.
