export default function TermsSection({ listing }) {
  const fulfilment = listing.type === 'product'
    ? listing.fulfillmentMethod?.replaceAll('-', ' ') || 'Cost and timing arranged with the seller'
    : listing.type === 'course'
      ? listing.accessMethod || 'Course access details shown with the listing'
      : 'Timing agreed in Escrit chat; scheduling comes later';
  return (
    <section id="terms" className="scroll-mt-28 border-t border-line pt-7" aria-labelledby="terms-heading">
      <h2 id="terms-heading" className="font-display text-xl">Payment, delivery and completion</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <dt className="font-semibold">Payment</dt>
          <dd className="mt-2 text-sm leading-6 text-ink/70">The available payment choices are shown in the buy box. Escrow is optional only when this listing offers both payment methods.</dd>
        </div>
        <div className="rounded-xl border border-line p-4">
          <dt className="font-semibold">{listing.type === 'product' ? 'Fulfilment' : listing.type === 'course' ? 'Access' : 'Scheduling'}</dt>
          <dd className="mt-2 text-sm leading-6 text-ink/70">{fulfilment}</dd>
        </div>
        <div className="rounded-xl border border-line p-4">
          <dt className="font-semibold">Completion</dt>
          <dd className="mt-2 text-sm leading-6 text-ink/70">For escrow orders, the buyer confirms completion. If there is no response, the Escrit default window applies.</dd>
        </div>
        <div className="rounded-xl border border-line p-4">
          <dt className="font-semibold">Problems and order terms</dt>
          <dd className="mt-2 text-sm leading-6 text-ink/70">You can dispute an escrow order before release. Without escrow, Escrit cannot hold or recover the money; you can report a problem. Listing terms are saved with the order.</dd>
        </div>
      </dl>
    </section>
  );
}
