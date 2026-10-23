const fulfilmentNames = {
  delivery: 'Delivery',
  pickup: 'Pickup',
  'delivery-or-pickup': 'Delivery or pickup',
  'digital-download': 'Digital download',
};

function Detail({ label, value }) {
  return <div><dt className="text-xs font-medium text-ink/55">{label}</dt><dd className="mt-1 text-sm">{value || 'Not specified'}</dd></div>;
}

export default function DetailsTable({ listing }) {
  let rows = [];
  if (listing.type === 'product') {
    rows = [
      ['Category', listing.category],
      ['Condition', listing.condition],
      ['Availability', `${Math.max(0, Number(listing.stock) || 0)} in stock`],
      ['Fulfilment', fulfilmentNames[listing.fulfillmentMethod] || listing.deliveryOptions?.map((option) => option.method === 'pickup' ? 'Pickup' : 'Delivery').join(' or ')],
      ['Area', listing.area || listing.location],
    ];
  } else if (listing.type === 'course') {
    rows = [
      ['Format', listing.format || listing.deliveryFormat],
      ['Level', listing.level],
      ['Duration', listing.duration],
      ['Access', listing.accessMethod],
    ];
  } else {
    rows = [
      ['Delivery time', listing.deliveryTime || listing.estimatedTime],
      ['Coordination', listing.coordination || listing.deliveryMode],
      ['Scheduling', listing.scheduling || 'Timing agreed in Escrit chat'],
      ['Location', listing.location],
    ];
  }

  return (
    <section id="details" className="scroll-mt-28 border-t border-line pt-7" aria-labelledby="details-heading">
      <h2 id="details-heading" className="font-display text-xl">Details</h2>
      <dl className="mt-4 grid gap-x-6 gap-y-5 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5">
        {rows.map(([label, value]) => <Detail key={label} label={label} value={value} />)}
      </dl>
      {listing.type === 'course' && listing.curriculum?.length > 0 && (
        <details className="mt-4 rounded-xl border border-line p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Curriculum</summary>
          <ol className="mt-3 space-y-3">
            {listing.curriculum.map((module, index) => (
              <li key={`${module.title}-${index}`} className="border-l-2 border-line pl-3">
                <p className="text-sm font-medium">{module.title || `Module ${index + 1}`}</p>
                {module.description && <p className="mt-1 text-sm leading-5 text-ink/65">{module.description}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
      {listing.type === 'service' && listing.howItWorks?.length > 0 && (
        <div className="mt-5">
          <h3 className="font-semibold">How it works</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink/70">
            {listing.howItWorks.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
          </ol>
        </div>
      )}
    </section>
  );
}
