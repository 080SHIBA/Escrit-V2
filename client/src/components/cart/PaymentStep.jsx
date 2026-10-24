export default function PaymentStep() {
  return (
    <section className="mx-auto max-w-xl py-10 text-center" aria-labelledby="payment-heading" aria-live="polite">
      <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none" aria-hidden="true" />
      <h2 id="payment-heading" className="font-display text-2xl">Confirming your payment.</h2>
      <p className="mt-3 text-sm text-ink/65">Do not close or refresh.</p>
      <p className="mt-4 text-xs leading-5 text-ink/50">We only mark orders paid after the payment provider confirms the transaction.</p>
    </section>
  );
}
