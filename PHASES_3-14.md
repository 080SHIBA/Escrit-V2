# Phases 3-14: what changed and what to do after pasting

## After pasting this over your project
1. `cd server && npm install` (new: @simplewebauthn/server, mammoth)
2. `cd client && npm install` (new: @simplewebauthn/browser)
3. Add to server/.env: `USSD_SHORTCODE` and `USSD_SHARED_SECRET` (see .env.example). WebAuthn needs `CLIENT_URL` to be the exact site address (https in production; localhost works in dev).
4. Existing orders get tracking/delivery codes only when created after this change. Old orders simply show no tracking panel.

## Phases
- 3 Marketplace: 2/3/4/5/6 responsive columns, compact cards, 60 per page, infinite scroll (client/src/hooks/useInfiniteScroll.js).
- 4 Bugs: one shared checkout identity rule (server/src/services/buyerIdentity.js) so approved-KYC users pass; "delivery-or-pickup" no longer breaks add-to-cart; favourites sign-in prompt, persistent error toasts, no false failure when only the notification fails.
- 5 Autosave: client/src/hooks/useFormDraft.js + server /api/drafts. Used by KYC, profile and course builder. Add it to any form with `useFormDraft('unique-key', defaults)`.
- 6/7 Face check: tall oval, automatic start, prompted blink/mouth/head turn, no photo (FaceLivenessCheck.jsx, lib/livenessEngine.js, server/src/services/livenessSession.js). Camera errors are classified; only a real block mentions settings. ID uploads use an in-page modal with in-page camera (DocumentCaptureModal.jsx).
- 8 Listing types: shared/listingTypePolicy.js; courses never use escrow and are bought with Enroll (instant checkout routes /checkout/instant/*); only products use the cart.
- 9 Tracking: per-order tracking code, seller-posted timeline and arrival estimate.
- 10-12 Delivery signing: receipt link /receipt/:token, signing by face, device biometrics (WebAuthn) or USSD PIN, all through server/src/services/deliverySigning.js.
- 13/14 Courses: authoring at /courses/:id/author, learning at /learn/:id.

## Decisions you should know about
- The release job still runs (log message corrected). It is the safety net for buyers who never sign; signing releases immediately.
- Signing releases funds BEFORE the seller hands over goods, as you specified. A buyer who signs and is then not given the goods has lost the escrow protection. If you want a safer variant, release after the seller confirms handover.
- Face liveness runs in the browser. The server issues random prompts, signs sessions, enforces one use and plausible timings, but a determined attacker could still forge a report. Use a vendor liveness service for high-value fraud.
- USSD PINs cross the mobile network unencrypted (same as USSD banking). Protected by phone-number match, a PIN set on the web, and a 5-try lockout.
