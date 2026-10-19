# Escrit — client

Escrit is a marketplace for products, courses, and services with
Flutterwave/Paystack checkout and delivery-confirmed escrow. Sellers manage shipping
or service appointments; buyers confirm completion or raise a dispute before
funds are released. This is the buyer- and seller-facing web app: React,
Vite and Tailwind, deployed on Vercel.

The API is in the companion `server` repository.

## What's here

- **Marketplace** — browse products, courses, and services; search, filter,
  save listings, add to cart, and view seller storefronts.
- **Buyer account** — manage cart, saved listings, and orders; checkout
  requires sign-in.
- **Seller account hub** — review listings and order metrics, manage KYC and
  payouts, create listings, and spend promotion credits.
- **Deal tools** — verified-buyer reviews, product price offers, and service
  proposal chat with a single seller counter-offer.
- **External payment page** (`/r/:linkId`) — a seller's shareable listing
  page for promotion outside the marketplace.
- **Escrow recipient onboarding** (`/onboarding`) — after sign-in or sign-up
  from a shareable link, Escrit restores the server-held return target, shows a
  recipient-safe preview and sends the buyer back to the same transaction.
- **Admin console** — review KYC and listings, resolve evidence-backed disputes,
  audit delivery complaints, and manage commission settings.

## Running locally

```bash
npm install
cp .env.example .env      # see comments inside for what each value does
npm run dev
```

The dev server proxies `/api` requests to a local instance of the
`server` repo (see `vite.config.js`), so `VITE_API_URL` can stay empty
in development.

To preview the orders page without starting the API, set
`VITE_ORDERS_MOCK=true` in `.env` and open `/account/orders`. The local-only
preview uses sample buyer/seller orders and simulated actions; it is disabled
in production builds.

To preview post-sign-up onboarding without the API, set `VITE_AUTH_MOCKS=true`.
Onboarding uses a local mock by default in development; its saved choices and
the demo session survive reloads in browser storage. Set
`VITE_ONBOARDING_MOCK=false` to exercise the authenticated onboarding API.
Recipient preview mocks include valid, expired, cancelled, already-accepted and
invalid links; the demo preview IDs are listed in `client/src/lib/onboardingMocks.js`.

## Environment variables

See `.env.example`. In short:

| Variable                | Required        | Purpose                                   |
| ------------------------------------------------------------------------------------ |
| `VITE_API_URL`          | Production only | Full URL of the deployed API (client and server live on different domains). |
| `VITE_GOOGLE_CLIENT_ID` | No              | Enables the "Continue with Google" button.            |
| `VITE_AUTH_MOCKS`       | No              | Set to `true` only to preview the auth pages without the API. Real auth is the default. |
| `VITE_ORDERS_MOCK`      | No              | Set to `true` in development to preview sample orders and actions without API login. |
| `VITE_ONBOARDING_MOCK`  | No              | Defaults to `true` in development; set to `false` to use `/api/me/onboarding`. |

## Photo uploads

Photos, optional course lesson videos, profile images, and dispute evidence upload
directly from the browser to Cloudinary using a short-lived signature issued by
the API (`POST /api/links/upload-signature`).
The Cloudinary API secret never reaches the client. Sellers can also
paste a direct image link instead of uploading.

## Building for production

```bash
npm run build
```

Outputs a static bundle in `dist/`, ready for Vercel or any static host.
