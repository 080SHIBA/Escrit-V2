import { useState } from 'react';
import { FileText, Upload } from 'lucide-react';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/zip']);

function moneyDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

export default function DeliveryCard({
  role,
  order,
  busy,
  onDeliver,
  onComplete,
  onDispute,
  onOpenDelivery,
}) {
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const isSeller = role === 'seller';
  const canSubmit = isSeller && order?.status === 'in_progress' && order?.paymentStatus === 'paid';
  const isDelivered = order?.status === 'delivered';

  function chooseFiles(event) {
    const selected = [...(event.target.files || [])];
    const invalid = selected.find((file) => !allowedTypes.has(file.type) || file.size > MAX_FILE_BYTES);
    if (invalid) {
      setError(!allowedTypes.has(invalid.type)
        ? 'Attach a PDF, JPG, PNG, WebP, text file or ZIP archive.'
        : 'Each attachment must be 10 MB or smaller.');
      event.target.value = '';
      return;
    }
    setError('');
    setFiles((current) => [...current, ...selected].slice(0, 5));
    event.target.value = '';
  }

  return (
    <section className="rounded-xl border border-line bg-paper p-4" aria-labelledby="delivery-heading">
      <h3 id="delivery-heading" className="font-semibold">
        {canSubmit ? 'Share delivery' : isDelivered ? 'Delivery submitted' : order?.status === 'completed' ? 'Completed' : 'Work in progress'}
      </h3>
      {canSubmit && (
        <form
          className="mt-3 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            try {
              const delivered = await onDeliver({ files, note });
              if (!delivered) return;
              setFiles([]);
              setNote('');
            } catch (submitError) {
              setError(submitError.message || 'Delivery could not be shared. Try again.');
            }
          }}
        >
          <label className="block text-sm text-ink/65">
            Delivery note
            <textarea value={note} maxLength={1000} rows={3} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-line bg-input px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" placeholder="Tell the buyer what you’ve completed." />
          </label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line px-3 text-sm font-medium hover:border-accent focus-within:outline focus-within:outline-2 focus-within:outline-focus">
            <Upload size={17} aria-hidden="true" />
            <span>Attach files · PDF, image, text or ZIP, up to 10 MB each</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.zip,application/pdf,image/jpeg,image/png,image/webp,text/plain,application/zip" multiple onChange={chooseFiles} className="sr-only" />
          </label>
          {files.length > 0 && (
            <ul className="space-y-1 text-sm text-ink/65">
              {files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center gap-2"><FileText size={15} aria-hidden="true" /><span className="truncate">{file.name}</span></li>)}
            </ul>
          )}
          {error && <p role="alert" className="text-sm text-dispute">{error}</p>}
          <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{busy ? 'Sharing delivery…' : 'Submit delivery'}</button>
        </form>
      )}
      {!canSubmit && !isDelivered && order?.status !== 'completed' && (
        <p className="mt-2 text-sm leading-6 text-ink/60">{isSeller ? 'Waiting for the buyer to confirm payment.' : 'The provider is working on your service.'}</p>
      )}
      {isDelivered && (
        <>
          <p className="mt-2 text-sm leading-6 text-ink/65">The provider shared this delivery on {moneyDate(order.deliveredAt || order.updatedAt)}.</p>
          {order.deliverables?.length > 0 && (
            <ul className="mt-3 space-y-2">
              {order.deliverables.map((item, index) => (
                <li key={item._id || item.assetId || index}>
                  <button type="button" onClick={() => onOpenDelivery?.({ ...item, assetId: item.assetId || item._id })} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
                    <FileText size={16} aria-hidden="true" />{item.name || item.fileName || `Delivery file ${index + 1}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {order.deliveryNote && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/65">{order.deliveryNote}</p>}
          {role === 'buyer' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={onComplete} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Confirm completion</button>
              {order.paymentMode === 'escrow' &&               <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => onDispute(reason)} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold hover:border-dispute disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Raise a dispute</button>}
            </div>
          )}
          {role === 'seller' && <p className="mt-3 text-sm text-ink/60">Waiting for the buyer to confirm completion.</p>}
          {role === 'buyer' && order.paymentMode === 'direct' && <p className="mt-3 text-sm leading-6 text-ink/60">This was paid without escrow. Escrit cannot hold or recover the money, but you can report a problem.</p>}
          {role === 'buyer' && order.paymentMode === 'escrow' && (
            <label className="mt-4 block text-sm text-ink/65">
              Dispute reason
              <input value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={500} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" placeholder="Tell us what needs review" />
            </label>
          )}
        </>
      )}
      {order?.status === 'completed' && <p className="mt-2 text-sm text-ink/60">This service order is complete.</p>}
    </section>
  );
}
