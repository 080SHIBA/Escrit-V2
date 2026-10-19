# Escrit

A Nigerian marketplace for products, courses and services where every purchase is protected by escrow.
- 

## What it does
Buyers browse, favourite, add to cart, make offers and check out once. Escrit charges through Paystack, holds the money in an escrow order per listing, and releases it to the seller's verified bank account only after the buyer confirms (or an admin resolves a dispute). See `server/README.md` for the money flow.

## Repo layout
- `client/` React + Vite + Tailwind web app (deploy to Vercel)
- `server/` Express + MongoDB API, Socket.IO, payment adapters (deploy to Render)

## Run locally
```bash
cd server && npm install && cp .env.example .env  
npm run dev
cd ../client && npm install && cp .env.example .env
npm run dev
```

## Payments: test vs live
Both Paystack and Flutterwave read separate `_TEST` and `_LIVE` keys from the server env. The platform **owner** switches modes in Admin > Platform settings; a fresh deploy always starts in test mode. Use a Paystack test card in test mode.

## Escrow model
Funds are collected through the payment processor and held by the platform until release. This is a platform-managed escrow flow; it is not a licensed trust account. A regulated escrow partner is the intended production path.
