import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { friendlyListingError, formatNaira, LISTING_CATEGORIES, listingStrength, nextStrengthTip, validateListing } from '../../lib/listingState.js';
import { useCreateListing } from '../../hooks/useCreateListing.js';
import { useListingDraft } from '../../hooks/useListingDraft.js';
import { usePageTitle } from '../../lib/usePageTitle.js';
import { CheckCircleIcon, ShieldCheckIcon } from '../../components/icons.jsx';

const FIELD_CLASS = 'mt-1 min-h-11 w-full rounded-xl border border-line bg-input px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus';
const CARD_CLASS = 'rounded-2xl border border-line bg-paper p-5 shadow-card sm:p-6 lg:p-8';
const LISTING_TYPES = [
  ['product', 'Product'],
  ['service', 'Service'],
  ['course', 'Course'],
];

export function TypeSwitch({ value, onChange }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">What are you listing?</legend>
      <div role="radiogroup" aria-label="Listing type" className="mt-3 grid grid-cols-3 rounded-xl border border-line bg-paper-2 p-1">
        {LISTING_TYPES.map(([type, label]) => (
          <label key={type} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-semibold transition-colors motion-reduce:transition-none focus-within:outline focus-within:outline-2 focus-within:outline-focus ${value === type ? 'bg-accent text-accent-ink shadow-sm' : 'text-ink/65 hover:text-ink'}`}>
            <input
              type="radio"
              name="listing-type"
              value={type}
              checked={value === type}
              onChange={() => onChange(type)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PhotoUploader({ photos, onAdd, onRemove, onRetry }) {
  const inputId = 'listing-photos';
  return (
    <section className={CARD_CLASS} aria-labelledby="listing-photos-heading">
      <h2 id="listing-photos-heading" className="font-display text-xl lg:text-2xl">2. Photos</h2>
      <p className="mt-1 text-sm text-ink/60">Add up to five clear images. Each image must be 5 MB or smaller.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative min-w-0">
            <div className="aspect-square overflow-hidden rounded-xl border border-line bg-paper-2">
              {photo.previewUrl && <img src={photo.previewUrl} alt={`${index === 0 ? 'Cover photo' : `Listing photo ${index + 1}`} preview`} className="h-full w-full object-cover" />}
              {!photo.previewUrl && <div className="grid h-full place-items-center text-xs text-dispute">Preview unavailable</div>}
            </div>
            {index === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-1 text-[10px] font-semibold text-white">Cover</span>}
            <button type="button" onClick={() => onRemove(photo.id)} aria-label={`Remove photo ${index + 1}`} className="absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-full bg-paper text-sm font-bold text-ink shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">×</button>
            {photo.progress < 100 && !photo.error && (
              <div role="status" aria-live="polite" className="mt-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent transition-[width] motion-reduce:transition-none" style={{ width: `${photo.progress}%` }} /></div>
                <p className="mt-1 text-xs text-ink/55">Uploading {photo.progress}%</p>
              </div>
            )}
            {photo.error && <div className="mt-1 text-xs text-dispute"><p role="alert">{photo.error}</p><button type="button" onClick={() => onRetry(photo.id)} className="mt-1 min-h-11 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Retry upload</button></div>}
          </div>
        ))}
        {photos.length < 5 && (
          <label htmlFor={inputId} className="flex aspect-square min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line-strong bg-paper-2 text-ink/60 transition-colors hover:border-accent hover:text-ink focus-within:outline focus-within:outline-2 focus-within:outline-focus">
            <span aria-hidden="true" className="text-3xl leading-none">+</span>
            <span className="mt-1 text-xs font-semibold">Add photo</span>
          </label>
        )}
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        aria-label="Add listing photos"
        className="sr-only"
        onChange={(event) => {
          onAdd(event.target.files);
          event.target.value = '';
        }}
      />
    </section>
  );
}

function TypeFields({ form, onChange, errors }) {
  if (form.type === 'product') {
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Condition
          <select value={form.condition} onChange={(event) => onChange('condition', event.target.value)} className={FIELD_CLASS}>
            <option value="new">New</option><option value="used">Used</option>
          </select>
        </label>
        <label className="block text-sm font-medium">Fulfilment
          <select value={form.fulfillment} onChange={(event) => onChange('fulfillment', event.target.value)} className={FIELD_CLASS}>
            <option value="delivery">Delivery</option><option value="pickup">Pickup</option><option value="delivery-or-pickup">Delivery or pickup</option><option value="digital-download">Digital download</option>
          </select>
        </label>
        <label className="block text-sm font-medium sm:col-span-2">Quantity
          <input type="number" min="1" step="1" inputMode="numeric" value={form.quantity} onChange={(event) => onChange('quantity', event.target.value.replace(/\D/g, ''))} className={FIELD_CLASS} />
          {errors.quantity && <span className="mt-1 block text-sm text-dispute">{errors.quantity}</span>}
        </label>
      </div>
    );
  }
  if (form.type === 'service') {
    return (
      <label className="mt-4 block text-sm font-medium">Delivery time
        <input value={form.deliveryTime} onChange={(event) => onChange('deliveryTime', event.target.value)} maxLength={120} placeholder="e.g. 3 days" className={FIELD_CLASS} />
        {errors.deliveryTime && <span className="mt-1 block text-sm text-dispute">{errors.deliveryTime}</span>}
      </label>
    );
  }
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">Format
        <select value={form.format} onChange={(event) => onChange('format', event.target.value)} className={FIELD_CLASS}>
          <option value="self-paced-videos">Self-paced videos</option><option value="live-cohort">Live cohort</option><option value="pdf-ebook">PDF or ebook</option>
        </select>
      </label>
      <label className="block text-sm font-medium">Level
        <select value={form.level} onChange={(event) => onChange('level', event.target.value)} className={FIELD_CLASS}>
          <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
        </select>
      </label>
      <label className="block text-sm font-medium sm:col-span-2">Duration or lessons
        <input value={form.duration} onChange={(event) => onChange('duration', event.target.value)} maxLength={120} placeholder="e.g. 8 lessons or 4 weeks" className={FIELD_CLASS} />
        {errors.duration && <span className="mt-1 block text-sm text-dispute">{errors.duration}</span>}
      </label>
    </div>
  );
}

export function ListingForm({ form, onChange, errors }) {
  return (
    <section className={CARD_CLASS} aria-labelledby="listing-basics-heading">
      <h2 id="listing-basics-heading" className="font-display text-xl lg:text-2xl">1. Basics</h2>
      <div className="mt-5 space-y-5">
        <TypeSwitch value={form.type} onChange={(value) => onChange('type', value)} />
        <label className="block text-sm font-medium">Title
          <input value={form.title} maxLength={80} onChange={(event) => onChange('title', event.target.value)} placeholder="What are you selling?" className={FIELD_CLASS} aria-describedby="title-count title-error" />
          <span id="title-count" className="mt-1 block text-right text-xs text-ink/50">{form.title.length}/80</span>
          {errors.title && <span id="title-error" className="mt-1 block text-sm text-dispute">{errors.title}</span>}
        </label>
        <label className="block text-sm font-medium">Category
          <select value={form.category} onChange={(event) => onChange('category', event.target.value)} className={FIELD_CLASS}>
            <option value="">Choose a category</option>
            {LISTING_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          {errors.category && <span className="mt-1 block text-sm text-dispute">{errors.category}</span>}
        </label>
        <label className="block text-sm font-medium">Description
          <textarea rows="5" maxLength={1000} value={form.description} onChange={(event) => onChange('description', event.target.value)} placeholder="Tell buyers what makes this a great choice." className={`${FIELD_CLASS} min-h-32 resize-y`} aria-describedby="description-count" />
          <span id="description-count" className="mt-1 block text-right text-xs text-ink/50">{form.description.length}/1000</span>
          {errors.description && <span className="mt-1 block text-sm text-dispute">{errors.description}</span>}
        </label>
      </div>
    </section>
  );
}

export function PriceDeliveryCard({ form, onChange, errors }) {
  return (
    <section className={CARD_CLASS} aria-labelledby="listing-price-heading">
      <h2 id="listing-price-heading" className="font-display text-xl lg:text-2xl">3. Price and delivery</h2>
      <label className="mt-4 block text-sm font-medium">Price in Naira
        <div className="mt-1 flex min-h-11 overflow-hidden rounded-xl border border-line bg-input focus-within:outline focus-within:outline-2 focus-within:outline-focus">
          <span aria-hidden="true" className="flex items-center border-r border-line px-3 text-ink/60">₦</span>
          <input inputMode="numeric" pattern="[0-9]*" value={form.price} onChange={(event) => onChange('price', event.target.value.replace(/\D/g, ''))} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-ink outline-none" aria-label="Price in Naira" />
        </div>
        {errors.price && <span className="mt-1 block text-sm text-dispute">{errors.price}</span>}
      </label>
      <TypeFields form={form} onChange={onChange} errors={errors} />
      {form.type === 'product' && (
        <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line p-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-focus">
          <input type="checkbox" checked={form.allowOffers} onChange={(event) => onChange('allowOffers', event.target.checked)} className="h-5 w-5 accent-ink" />
          <span>Allow price offers <Link to="/account/price-offers" className="ml-1 font-medium text-accent underline underline-offset-2">View price offers</Link></span>
        </label>
      )}
    </section>
  );
}

export function StrengthMeter({ form, photos }) {
  const score = listingStrength(form, photos);
  return (
    <section aria-label="Listing strength" className="mt-4 rounded-2xl border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Listing strength</h3><span className="font-mono text-sm font-semibold">{score}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Listing strength score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
        <div className="h-full rounded-full bg-released transition-[width] motion-reduce:transition-none" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-3 text-sm text-ink/65" aria-live="polite">{nextStrengthTip(form, photos)}</p>
    </section>
  );
}

export function ListingPreview({ form, photos }) {
  const cover = photos.find((photo) => photo.previewUrl);
  const deliveryLine = form.type === 'product'
    ? `${{ delivery: 'Delivery', pickup: 'Pickup', 'delivery-or-pickup': 'Delivery or pickup', 'digital-download': 'Digital download' }[form.fulfillment] || 'Delivery'} · ${form.condition === 'new' ? 'New' : 'Used'}`
    : form.type === 'service'
      ? `Delivered in ${form.deliveryTime || '…'}`
      : `${{ 'self-paced-videos': 'Self-paced videos', 'live-cohort': 'Live cohort', 'pdf-ebook': 'PDF or ebook' }[form.format]} · ${form.level} · ${form.duration || 'Duration not set'}`;
  return (
    <aside className="min-w-0 min-[860px]:sticky min-[860px]:top-6 min-[860px]:self-start">
      <h2 className="mb-3 font-display text-xl">Live preview</h2>
      <article className="overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
        <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-paper-2">
          {cover ? <img src={cover.previewUrl} alt={form.title ? `${form.title} cover` : 'Listing cover preview'} className="h-full w-full object-cover" /> : <span aria-hidden="true" className="font-display text-6xl text-ink/25">{form.title.trim().charAt(0).toUpperCase() || '?'}</span>}
          <span className="absolute left-3 top-3 rounded-full bg-paper/90 px-3 py-1 text-xs font-semibold">{form.type}</span>
          {form.category && <span className="absolute right-3 top-3 rounded-full bg-paper/90 px-3 py-1 text-xs font-semibold">{form.category}</span>}
        </div>
        <div className="p-4">
          <h3 className="break-words font-display text-xl">{form.title.trim() || 'Your listing title'}</h3>
          <p className="mt-2 font-mono text-lg font-semibold">{formatNaira(form.price)}</p>
          <p className="mt-3 text-sm text-ink/65">{deliveryLine}</p>
          {form.type === 'product' && form.allowOffers && <p className="mt-3 text-sm font-medium text-accent">Offers welcome</p>}
          <div className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-full border border-released/30 bg-released-soft px-3 text-xs font-semibold text-released">
            <ShieldCheckIcon width={16} height={16} /> Escrow protected
          </div>
        </div>
      </article>
      <StrengthMeter form={form} photos={photos} />
    </aside>
  );
}

export function PublishSuccess({ published, onCopy, copied, onAnother }) {
  return (
    <section className={`${CARD_CLASS} mx-auto max-w-2xl text-center`}>
      <CheckCircleIcon className="mx-auto text-released" width={48} height={48} />
      <h2 className="mt-4 font-display text-3xl">Your listing is live</h2>
      <p className="mt-2 break-words font-semibold">{published.item.title}</p>
      <p className="mt-1 font-mono text-lg">{formatNaira(published.item.price ?? published.item.basePrice)}</p>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-ink/65">Share the link to get your first order. Payment is held in escrow until the buyer confirms.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onCopy} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{copied ? 'Link copied ✓' : 'Copy listing link'}</button>
        <button type="button" onClick={onAnother} className="min-h-11 rounded-xl border border-line px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">List another</button>
        <Link to="/dashboard" className="inline-flex min-h-11 items-center rounded-xl border border-line px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Back to dashboard</Link>
      </div>
    </section>
  );
}

export function ListProductPage({ embedded = false }) {
  usePageTitle('List a product');
  const navigate = useNavigate();
  const { hasBankAccount } = useAuthContext();
  const draft = useListingDraft();
  const create = useCreateListing();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const errors = validateListing(draft.form, draft.photos);
  const photoError = draft.photos.some((photo) => photo.error || photo.progress < 100);
  const publishDisabled = Object.keys(errors).length > 0 || photoError || create.publishing || draft.loading;
  const photos = draft.photos;
  const PageContainer = embedded ? 'div' : 'main';

  async function publish() {
    const success = await create.publish({ ...draft.form, images: photos.filter((photo) => photo.url).map((photo) => photo.url) });
    if (success) {
      draft.clearAfterPublish();
      if (embedded) window.dispatchEvent(new Event('escrit:listing-published'));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(create.published.url);
      setCopied(true);
      setCopyError('');
    } catch (error) {
      setCopyError(friendlyListingError(error));
    }
  }

  async function retryDraftSave() {
    draft.updateField('type', draft.form.type);
    await draft.saveDraft();
  }

  if (draft.loading) {
    return <PageContainer className="mx-auto max-w-7xl space-y-5" aria-busy="true" aria-label="Loading listing draft"><div className="skeleton h-10 w-64" /><div className="skeleton h-48 w-full" /><div className="skeleton h-72 w-full" /></PageContainer>;
  }

  if (create.published) {
    return (
      <PageContainer className="mx-auto max-w-7xl">
        <h1 className="mb-6 font-display text-3xl">List a product</h1>
        <PublishSuccess
          published={create.published}
          copied={copied}
          onCopy={copyLink}
          onAnother={() => { create.reset(); setCopied(false); if (!embedded) navigate('/account/list-product'); }}
        />
        {copyError && <p role="alert" className="mt-4 text-center text-sm text-dispute">{copyError}</p>}
        {create.error && <p role="alert" className="mt-4 text-center text-sm text-dispute">{create.error}</p>}
      </PageContainer>
    );
  }

  return (
    <PageContainer className="mx-auto max-w-7xl pb-24">
      <header className="mb-8 border-b border-line pb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Marketplace</p>
        <h1 className="mt-2 font-display text-3xl lg:text-4xl">List a product</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60 lg:text-base">Add what you are selling. Buyers pay through Escrit escrow.</p>
      </header>

      {!hasBankAccount && (
        <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ochre/35 bg-ochre/10 p-4 text-sm text-ink sm:p-5">
          <p className="font-medium">You can publish now, but you can&apos;t get paid until a bank account is verified.</p>
          <Link to="/account/bank" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ochre/40 px-4 font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Add bank</Link>
        </div>
      )}
      {draft.error && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dispute/30 bg-dispute-soft p-3 text-sm text-dispute"><p role="alert">{draft.error}</p><button type="button" onClick={retryDraftSave} className="min-h-11 rounded-lg border border-dispute/40 px-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Retry save</button></div>}
      {create.error && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dispute/30 bg-dispute-soft p-3 text-sm text-dispute"><p role="alert">{create.error}</p><button type="button" onClick={publish} className="min-h-11 rounded-lg border border-dispute/40 px-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Retry publish</button></div>}

      <div className="grid items-start gap-6 lg:gap-8 min-[860px]:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
        <div className="space-y-5 lg:space-y-6">
          <ListingForm form={draft.form} onChange={draft.updateField} errors={errors} />
          <PhotoUploader photos={photos} onAdd={draft.addPhotos} onRemove={draft.removePhoto} onRetry={draft.retryPhoto} />
          <PriceDeliveryCard form={draft.form} onChange={draft.updateField} errors={errors} />
        </div>
        <ListingPreview form={draft.form} photos={photos} />
      </div>

      {errors.photos && <p className="mt-3 text-sm text-dispute" aria-live="polite">{errors.photos}</p>}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 shadow-card backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink/55" role="status" aria-live="polite">{draft.saving ? 'Saving draft…' : 'Drafts save automatically'}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={draft.saving || create.publishing} onClick={() => draft.saveDraft()} className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50">Save draft</button>
            <button type="button" disabled={publishDisabled} onClick={publish} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45">{create.publishing ? 'Publishing…' : 'Publish listing'}</button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default ListProductPage;
