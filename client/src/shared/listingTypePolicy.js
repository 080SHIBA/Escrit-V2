// WHAT: the business rules that differ between the three listing types, in one place.
// WHY one shared file (copied to client/src/shared and server/src/shared): the server must
// ENFORCE these rules (a buyer can call the API directly) and the client must DISPLAY them
// (button labels, which fields to ask for). Keeping both copies identical prevents a page
// that promises one thing while the server does another. Edit both copies together.
//
// Fields:
//   cta            label of the primary buy action on cards and the detail page
//   usesCart       true only for products: they are bought in a group and checked out together
//   escrow         'seller-choice' (provider decides), 'never', or 'seller-choice' for products
//   checkout       which details the checkout step must collect
//   tracking       whether a tracked delivery (per-order tracking code + receipt link) applies
export const LISTING_TYPE_POLICY = Object.freeze({
  product: Object.freeze({
    label: 'Product',
    cta: 'Add to cart',
    usesCart: true,
    escrow: 'seller-choice',
    checkout: Object.freeze(['fulfilment', 'deliveryAddress', 'quantity']),
    tracking: true,
  }),
  course: Object.freeze({
    label: 'Course',
    cta: 'Enroll',
    usesCart: false,
    // WHY never: a course is delivered the instant it is paid for (access is granted), so there
    // is nothing to hold in escrow and nothing for a buyer to "confirm received".
    escrow: 'never',
    checkout: Object.freeze(['accessEmail', 'terms']),
    tracking: false,
  }),
  service: Object.freeze({
    label: 'Service',
    cta: 'Book now',
    usesCart: false,
    // WHY seller-choice: some services (a one-hour consultation) do not need protection while
    // larger jobs do, so the provider decides when they create the listing.
    escrow: 'seller-choice',
    checkout: Object.freeze(['schedule', 'requirements', 'terms']),
    tracking: false,
  }),
});

export function policyFor(type) {
  return LISTING_TYPE_POLICY[type] || LISTING_TYPE_POLICY.product;
}

// WHAT: the button label for a listing. Services vary by how they are sold.
export function ctaFor(type, serviceModel = '') {
  if (type === 'service') return serviceModel === 'custom_quote' ? 'Request a quote' : serviceModel === 'appointment' ? 'Book now' : 'Order service';
  return policyFor(type).cta;
}

// WHAT: force a type's payment rules onto an options object { escrow, direct }.
// WHY: whatever the seller or the database holds, a course can never be escrowed.
export function applyTypePaymentRules(type, options) {
  if (policyFor(type).escrow === 'never') return { escrow: false, direct: true };
  return options;
}
