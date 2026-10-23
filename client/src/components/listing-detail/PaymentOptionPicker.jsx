export default function PaymentOptionPicker({ options, value, onChange }) {
  const choices = [
    ['escrow', 'Use Escrit escrow'],
    ['direct', 'Pay without escrow'],
  ].filter(([key]) => options?.[key]);

  if (!choices.length) return <p role="alert" className="rounded-lg border border-dispute/40 p-3 text-sm">Payment is unavailable for this listing right now.</p>;
  if (choices.length === 1) {
    return (
      <div className="rounded-xl border border-line bg-paper-2 p-3 text-sm">
        <p className="font-semibold">{choices[0][0] === 'escrow' ? 'Escrow payment only' : 'Pay without escrow'}</p>
        <p className="mt-1 leading-5 text-ink/65">{choices[0][2]}</p>
      </div>
    );
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Payment option</legend>
      <div role="radiogroup" aria-label="Payment option" className="grid gap-2">
        {choices.map(([key, title, description]) => (
          <label key={key} className={`flex min-h-11 cursor-pointer gap-3 rounded-xl border p-3 ${value === key ? 'border-accent bg-accent/5' : 'border-line'}`}>
            <input type="radio" name="payment-option" value={key} checked={value === key} onChange={() => onChange(key)} className="mt-1 h-4 w-4 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" />
            <span>
              <span className="block text-sm font-semibold">{title}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
