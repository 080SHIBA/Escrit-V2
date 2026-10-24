import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import PhotoField from '../components/PhotoField.jsx';
import { Link } from 'react-router-dom';

const types = {
  product: {
    label: 'Product',
    defaults: { price: 25000, stock: 1, condition: 'new', negotiable: false, refundable: false },
  },
  course: {
    label: 'Course',
    defaults: { price: 15000, deliveryFormat: 'self-paced', refundable: false },
  },
  service: {
    label: 'Service',
    defaults: { basePrice: 30000, pricingUnit: 'project', estimatedTime: '1-2 weeks', location: 'Remote' },
  },
};

export default function CreateMarketplaceListing() {
  const navigate = useNavigate();
  const { type } = useParams();
  const safeType = types[type] ? type : 'product';
  const typeMeta = types[safeType];

  const initialState = useMemo(
    () => ({
      title: '',
      description: '',
      category: 'General',
      price: typeMeta.defaults.price ?? 0,
      stock: typeMeta.defaults.stock ?? 1,
      condition: typeMeta.defaults.condition ?? 'new',
      negotiable: typeMeta.defaults.negotiable ?? false,
      refundable: typeMeta.defaults.refundable ?? false,
      deliveryOptions: [{ method: 'pickup', fee: 0, details: '' }],
      scheduledDiscountEnabled: false,
      discountPercent: 10,
      discountStartsAt: '',
      discountEndsAt: '',
      deliveryFormat: typeMeta.defaults.deliveryFormat ?? 'self-paced',
      refundConditions: '',
      curriculum: [{ title: 'Module 1', description: '', videoUrl: '' }],
      basePrice: typeMeta.defaults.basePrice ?? 0,
      serviceModel: 'appointment',
      packageName: 'Standard',
      packageDescription: '',
      packagePrice: typeMeta.defaults.basePrice ?? 30000,
      packageDeliveryDays: 7,
      packageRevisionCount: 1,
      packageDeliverablesText: '',
      addOnEnabled: false,
      addOnName: '',
      addOnDescription: '',
      addOnPrice: 5000,
      pricingUnit: typeMeta.defaults.pricingUnit ?? 'project',
      estimatedTime: typeMeta.defaults.estimatedTime ?? '1-2 weeks',
      location: typeMeta.defaults.location ?? 'Remote',
      deliveryMode: 'remote',
      serviceRadiusKm: 0,
      durationMinutes: 60,
      bookingLeadTimeHours: 24,
      maxBookingsPerDay: 4,
      timeZone: 'Africa/Lagos',
      availabilityDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      availabilityStart: '09:00',
      availabilityEnd: '17:00',
      deliverablesText: '',
      requirementsText: '',
      cancellationPolicy: 'moderate',
      cancellationTerms: '',
      reschedulePolicy: '',
      images: [''],
    }),
    [typeMeta]
  );

  const [form, setForm] = useState(initialState);
  const [categories, setCategories] = useState([]);
  const [requestCategory, setRequestCategory] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pricePreview, setPricePreview] = useState(null);

  useEffect(() => {
    let active = true;
    api.getCategories(safeType).then(({ categories: list }) => {
      if (!active) return;
      setCategories(list || []);
      setForm((current) => current.category === 'General' && list?.length ? { ...current, category: list[0].name } : current);
    }).catch(() => {});
    return () => { active = false; };
  }, [safeType]);

  useEffect(() => {
    setForm(initialState);
    setRequestCategory(false);
  }, [safeType, initialState]);

  const basePrice = Number(safeType === 'service'
    ? form.serviceModel === 'fixed_scope' ? form.packagePrice : form.basePrice
    : form.price);

  useEffect(() => {
    if (!Number.isFinite(basePrice) || basePrice < 100 || (safeType === 'service' && form.serviceModel === 'custom_quote')) {
      setPricePreview(null);
      return undefined;
    }
    if (safeType !== 'service' && form.scheduledDiscountEnabled && (!form.discountStartsAt || !form.discountEndsAt)) {
      setPricePreview(null);
      return undefined;
    }
    const discount = safeType !== 'service' && form.scheduledDiscountEnabled
      ? { percent: form.discountPercent, startsAt: new Date(form.discountStartsAt).toISOString(), endsAt: new Date(form.discountEndsAt).toISOString() }
      : null;
    let active = true;
    const timer = window.setTimeout(() => {
      api.previewListingPrice(basePrice, discount)
        .then((preview) => active && setPricePreview(preview))
        .catch(() => active && setPricePreview(null));
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [basePrice, safeType, form.serviceModel, form.scheduledDiscountEnabled, form.discountPercent, form.discountStartsAt, form.discountEndsAt]);

  function setValue(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        images: form.images.map((value) => value.trim()).filter(Boolean),
        price: Number(form.price || 0),
        stock: Number(form.stock || 1),
        condition: form.condition,
        negotiable: Boolean(form.negotiable),
        refundable: Boolean(form.refundable),
        deliveryOptions: safeType === 'product' ? form.deliveryOptions.filter((option) => option.method) : undefined,
        scheduledDiscount: safeType !== 'service' && form.scheduledDiscountEnabled ? {
          percent: Number(form.discountPercent),
          startsAt: new Date(form.discountStartsAt).toISOString(),
          endsAt: new Date(form.discountEndsAt).toISOString(),
        } : null,
        deliveryFormat: form.deliveryFormat,
        curriculum: safeType === 'course' ? form.curriculum : undefined,
        refundConditions: form.refundConditions,
        basePrice: Number(safeType === 'service' && form.serviceModel === 'fixed_scope' ? form.packagePrice : form.basePrice || 0),
        serviceModel: form.serviceModel,
        packages: safeType === 'service' && form.serviceModel === 'fixed_scope' ? [{
          key: 'standard',
          name: form.packageName,
          description: form.packageDescription,
          priceNaira: Number(form.packagePrice),
          deliveryDays: Number(form.packageDeliveryDays),
          revisionCount: Number(form.packageRevisionCount),
          deliverables: form.packageDeliverablesText.split('\n').map((value) => value.trim()).filter(Boolean),
        }] : [],
        addOns: safeType === 'service' && form.serviceModel === 'fixed_scope' && form.addOnEnabled ? [{
          key: 'extra',
          name: form.addOnName,
          description: form.addOnDescription,
          priceNaira: Number(form.addOnPrice),
        }] : [],
        maxRevisions: Number(form.packageRevisionCount || 0),
        pricingUnit: form.pricingUnit,
        estimatedTime: form.estimatedTime,
        location: form.location,
        deliveryMode: form.deliveryMode,
        serviceRadiusKm: Number(form.serviceRadiusKm || 0),
        durationMinutes: Number(form.durationMinutes || 60),
        bookingLeadTimeHours: Number(form.bookingLeadTimeHours || 0),
        maxBookingsPerDay: Number(form.maxBookingsPerDay || 1),
        timeZone: form.timeZone,
        availability: form.availabilityDays.map((day) => ({ day, startTime: form.availabilityStart, endTime: form.availabilityEnd })),
        deliverables: form.deliverablesText.split('\n').map((value) => value.trim()).filter(Boolean),
        requirements: form.requirementsText.split('\n').map((value) => value.trim()).filter(Boolean),
        cancellationPolicy: form.cancellationPolicy,
        cancellationTerms: form.cancellationTerms,
        reschedulePolicy: form.reschedulePolicy,
      };

      await api.createMarketplaceListing(safeType, payload);
      navigate('/dashboard', { state: { listingSubmitted: true } });
    } catch (err) {
      setError(err.message || 'Unable to create this listing.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-ink/50">Create {typeMeta.label}</p>
        <h1 className="mt-2 font-display text-3xl">List on Escrit</h1>
        <label className="mt-4 block max-w-sm text-sm text-ink/65">Listing type
          <select value={safeType} onChange={(event) => {
            if (form.title && !window.confirm('Changing listing type will reset this draft. Continue?')) return;
            navigate(`/marketplace/new/${event.target.value}`, { replace: true });
          }} className="mt-1 w-full border border-line bg-input px-3 py-2"><option value="product">Product</option><option value="service">Service</option><option value="course">Course</option></select>
        </label>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-line bg-paper p-6">
        <label className="block">
          <span className="text-sm text-ink/70">Title</span>
          <input
            value={form.title}
            onChange={(e) => setValue('title', e.target.value)}
            required
            className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
          />
        </label>

        <label className="block">
          <span className="text-sm text-ink/70">Description</span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setValue('description', e.target.value)}
            className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
          />
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="text-sm text-ink/70">Category</span>
            <select value={requestCategory ? '__request' : form.category} onChange={(event) => {
              if (event.target.value === '__request') setRequestCategory(true);
              else { setRequestCategory(false); setValue('category', event.target.value); }
            }} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg">
              {categories.map((category) => <option key={category._id} value={category.name}>{category.name}</option>)}
              <option value="__request">Request a new category…</option>
            </select>
            {requestCategory && <div className="mt-2"><input required maxLength={80} value={form.category === 'General' || categories.some((category) => category.name === form.category) ? '' : form.category} onChange={(event) => setValue('category', event.target.value)} placeholder="Enter a category name" className="w-full border border-line bg-input px-3 py-2 rounded-lg" /><p className="mt-1 text-xs text-ink/50">An admin will approve this category or assign your listing to an existing one.</p></div>}
          </label>

        </div>

        <div className="space-y-4">
          {form.images.map((image, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <PhotoField value={image} onChange={(url) => setForm((prev) => ({ ...prev, images: prev.images.map((value, imageIndex) => imageIndex === index ? url : value) }))} />
              </div>
              {form.images.length > 1 && (
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, images: prev.images.filter((_, imageIndex) => imageIndex !== index) }))} aria-label={`Remove image ${index + 1}`} className="mt-6 text-sm text-ink/55 underline underline-offset-4">Remove</button>
              )}
            </div>
          ))}
          {form.images.length < 8 && (
            <button type="button" onClick={() => setForm((prev) => ({ ...prev, images: [...prev.images, ''] }))} className="text-sm font-medium underline underline-offset-4">Add another image</button>
          )}
        </div>

        {safeType === 'product' && (
          <div className="grid gap-5 md:grid-cols-3">
            <label className="block">
              <span className="text-sm text-ink/70">Price (₦)</span>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setValue('price', e.target.value)}
                className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Stock</span>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setValue('stock', e.target.value)}
                className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Condition</span>
              <select
                value={form.condition}
                onChange={(e) => setValue('condition', e.target.value)}
                className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
              >
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </label>
          </div>
        )}

        {safeType === 'product' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input type="checkbox" checked={form.negotiable} onChange={(e) => setValue('negotiable', e.target.checked)} />
              Negotiable product
            </label>
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input type="checkbox" checked={form.refundable} onChange={(e) => setValue('refundable', e.target.checked)} />
              Refundable if the buyer misses the agreed pickup
            </label>
            {form.refundable && <p className="text-xs text-ink/55">If the seller records a buyer no-show, 95% of the seller's item price is refunded automatically; 5% is retained as the disclosed no-show fee.</p>}
            <fieldset className="space-y-3 border-t border-line pt-4"><legend className="text-sm font-medium">Delivery options</legend>
              {form.deliveryOptions.map((option, index) => <div key={option.method} className="grid gap-2 sm:grid-cols-[auto_8rem_1fr] sm:items-center"><label className="flex items-center gap-2 text-sm text-ink/70"><input type="checkbox" checked={Boolean(option.method)} onChange={(event) => setForm((current) => ({ ...current, deliveryOptions: event.target.checked ? [...current.deliveryOptions, { method: index === 0 ? 'pickup' : 'seller_delivery', fee: 0, details: '' }] : current.deliveryOptions.filter((_, optionIndex) => optionIndex !== index) }))} />{option.method === 'pickup' ? 'Buyer pickup' : 'Seller-arranged delivery'}</label><input type="number" min="0" value={option.fee} onChange={(event) => setForm((current) => ({ ...current, deliveryOptions: current.deliveryOptions.map((entry, entryIndex) => entryIndex === index ? { ...entry, fee: event.target.value } : entry) }))} className="w-full border border-line bg-input px-2 py-1.5 text-sm" placeholder="Fee (₦)" /><input value={option.details} onChange={(event) => setForm((current) => ({ ...current, deliveryOptions: current.deliveryOptions.map((entry, entryIndex) => entryIndex === index ? { ...entry, details: event.target.value } : entry) }))} className="w-full border border-line bg-input px-2 py-1.5 text-sm" placeholder="Area or handover details" /></div>)}
              {form.deliveryOptions.length < 2 && <button type="button" onClick={() => setForm((current) => ({ ...current, deliveryOptions: [...current.deliveryOptions, { method: 'seller_delivery', fee: 0, details: '' }] }))} className="text-xs font-medium underline underline-offset-4">Add seller delivery</button>}
            </fieldset>
          </div>
        )}

        {safeType === 'course' && (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-ink/70">Price (₦)</span>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setValue('price', e.target.value)}
                  className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink/70">Delivery format</span>
                <select
                  value={form.deliveryFormat}
                  onChange={(e) => setValue('deliveryFormat', e.target.value)}
                  className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
                >
                  <option value="self-paced">Self-paced</option>
                  <option value="live">Live</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input type="checkbox" checked={form.refundable} onChange={(e) => setValue('refundable', e.target.checked)} />
              This course is refundable
            </label>

            {form.refundable && (
              <label className="block">
                <span className="text-sm text-ink/70">Refund conditions</span>
                <textarea
                  rows={3}
                  value={form.refundConditions}
                  onChange={(e) => setValue('refundConditions', e.target.value)}
                  className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
                />
              </label>
            )}

            <section className="space-y-4 border-t border-line pt-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Course curriculum</h2><p className="mt-1 text-xs text-ink/55">Use text, images, and short-form lessons. Buyers unlock this after payment.</p></div><button type="button" onClick={() => setForm((current) => ({ ...current, curriculum: [...current.curriculum, { title: `Module ${current.curriculum.length + 1}`, description: '', videoUrl: '' }] }))} className="text-sm font-medium underline underline-offset-4">Add module</button></div>
              {form.curriculum.map((module, index) => <fieldset key={index} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2"><legend className="px-1 text-xs uppercase tracking-wider text-ink/50">Module {index + 1}</legend><label className="block text-sm text-ink/65">Title<input required maxLength={120} value={module.title} onChange={(event) => setForm((current) => ({ ...current, curriculum: current.curriculum.map((entry, entryIndex) => entryIndex === index ? { ...entry, title: event.target.value } : entry) }))} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label><label className="block text-sm text-ink/65">Description<textarea rows={2} maxLength={1000} value={module.description} onChange={(event) => setForm((current) => ({ ...current, curriculum: current.curriculum.map((entry, entryIndex) => entryIndex === index ? { ...entry, description: event.target.value } : entry) }))} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label><div className="sm:col-span-2"><PhotoField mediaType="video" value={module.videoUrl} onChange={(videoUrl) => setForm((current) => ({ ...current, curriculum: current.curriculum.map((entry, entryIndex) => entryIndex === index ? { ...entry, videoUrl } : entry) }))} /></div>{form.curriculum.length > 1 && <button type="button" onClick={() => setForm((current) => ({ ...current, curriculum: current.curriculum.filter((_, entryIndex) => entryIndex !== index) }))} className="text-left text-xs text-dispute underline underline-offset-4">Remove module</button>}</fieldset>)}
            </section>
          </>
        )}

        {safeType === 'service' && (
          <div className="space-y-5">
            <fieldset className="space-y-3 rounded-lg border border-line p-4">
              <legend className="px-1 text-sm font-medium">How buyers book this service</legend>
              {[
                ['appointment', 'Appointment', 'Buyer requests an available time; you confirm before payment.'],
                ['fixed_scope', 'Fixed scope', 'Buyer chooses a defined package and pays after accepting its terms.'],
                ['custom_quote', 'Custom quote', 'Buyer describes the work; you agree scope and price in Escrit chat.'],
              ].map(([value, label, description]) => (
                <label key={value} className="flex min-h-11 items-start gap-3 rounded-md p-2 text-sm hover:bg-paper/70">
                  <input type="radio" name="serviceModel" value={value} checked={form.serviceModel === value} onChange={() => setValue('serviceModel', value)} className="mt-1" />
                  <span><strong className="block font-medium">{label}</strong><span className="text-xs text-ink/55">{description}</span></span>
                </label>
              ))}
            </fieldset>
            {form.serviceModel === 'fixed_scope' ? (
              <fieldset className="grid gap-4 rounded-lg border border-line p-4 sm:grid-cols-2">
                <legend className="px-1 text-sm font-medium">Standard package</legend>
                <label className="text-sm text-ink/70">Package name<input required maxLength={80} value={form.packageName} onChange={(event) => setValue('packageName', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
                <label className="text-sm text-ink/70">Price (₦)<input type="number" min="100" required value={form.packagePrice} onChange={(event) => setValue('packagePrice', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
                <label className="text-sm text-ink/70">Delivery time (days)<input type="number" min="1" max="365" required value={form.packageDeliveryDays} onChange={(event) => setValue('packageDeliveryDays', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
                <label className="text-sm text-ink/70">Included revisions<input type="number" min="0" max="20" required value={form.packageRevisionCount} onChange={(event) => setValue('packageRevisionCount', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
                <label className="text-sm text-ink/70 sm:col-span-2">Scope summary<textarea rows={2} maxLength={500} value={form.packageDescription} onChange={(event) => setValue('packageDescription', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
                <label className="text-sm text-ink/70 sm:col-span-2">Deliverables, one per line<textarea rows={3} value={form.packageDeliverablesText} onChange={(event) => setValue('packageDeliverablesText', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
                <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.addOnEnabled} onChange={(event) => setValue('addOnEnabled', event.target.checked)} />Offer one optional extra</label>
                {form.addOnEnabled && <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2"><label className="text-sm text-ink/70">Extra name<input required maxLength={80} value={form.addOnName} onChange={(event) => setValue('addOnName', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label><label className="text-sm text-ink/70">Extra price (₦)<input type="number" min="100" required value={form.addOnPrice} onChange={(event) => setValue('addOnPrice', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label><label className="text-sm text-ink/70 sm:col-span-2">Extra description<input maxLength={300} value={form.addOnDescription} onChange={(event) => setValue('addOnDescription', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label></div>}
              </fieldset>
            ) : null}
            <div className="grid gap-5 md:grid-cols-2">
            {form.serviceModel === 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Base price (₦)</span>
              <input
                type="number"
                min="100"
                required
                value={form.basePrice}
                onChange={(e) => setValue('basePrice', e.target.value)}
                className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
              />
              <span className="mt-1 block text-xs text-ink/50">Buyers can choose the supported payment option at checkout.</span>
            </label>}
            {form.serviceModel !== 'custom_quote' && <label className="block">
              <span className="text-sm text-ink/70">Pricing unit</span>
              <input
                value={form.pricingUnit}
                onChange={(e) => setValue('pricingUnit', e.target.value)}
                className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
              />
            </label>}
            {form.serviceModel === 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Estimated time</span>
              <input
                value={form.estimatedTime}
                onChange={(e) => setValue('estimatedTime', e.target.value)}
                className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
              />
            </label>}
            {form.serviceModel === 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Location</span>
              <input
                value={form.location}
                onChange={(e) => setValue('location', e.target.value)}
                className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
              />
            </label>}
            </div>
            {form.serviceModel === 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">How is this service delivered?</span>
              <select value={form.deliveryMode} onChange={(e) => setValue('deliveryMode', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg">
                <option value="remote">Remote</option>
                <option value="in-person">In person</option>
                <option value="hybrid">Remote or in person</option>
              </select>
            </label>}
            {form.serviceModel === 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Time zone</span>
              <input value={form.timeZone} onChange={(e) => setValue('timeZone', e.target.value)} required className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
            <label className="block">
              <span className="text-sm text-ink/70">Service radius (km, for in-person work)</span>
              <input type="number" min="0" max="1000" value={form.serviceRadiusKm} onChange={(e) => setValue('serviceRadiusKm', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Typical appointment duration (minutes)</span>
              <input type="number" min="15" max="1440" value={form.durationMinutes} onChange={(e) => setValue('durationMinutes', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Minimum booking notice (hours)</span>
              <input type="number" min="0" max="8760" value={form.bookingLeadTimeHours} onChange={(e) => setValue('bookingLeadTimeHours', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Maximum bookings per day</span>
              <input type="number" min="1" max="100" value={form.maxBookingsPerDay} onChange={(e) => setValue('maxBookingsPerDay', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>
            {form.serviceModel === 'appointment' && <fieldset className="md:col-span-2">
              <legend className="text-sm text-ink/70">Weekly availability ({form.timeZone})</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                  <label key={day} className="flex items-center gap-1.5 text-sm capitalize">
                    <input type="checkbox" checked={form.availabilityDays.includes(day)} onChange={(e) => setForm((prev) => ({ ...prev, availabilityDays: e.target.checked ? [...prev.availabilityDays, day] : prev.availabilityDays.filter((value) => value !== day) }))} />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
              <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
                <label className="text-sm">From<input type="time" value={form.availabilityStart} onChange={(e) => setValue('availabilityStart', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" /></label>
                <label className="text-sm">To<input type="time" value={form.availabilityEnd} onChange={(e) => setValue('availabilityEnd', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" /></label>
              </div>
            </fieldset>}
            <label className="block md:col-span-2">
              <span className="text-sm text-ink/70">What the buyer receives (one item per line)</span>
              <textarea rows={3} value={form.deliverablesText} onChange={(e) => setValue('deliverablesText', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm text-ink/70">What the buyer must provide (one item per line)</span>
              <textarea rows={3} value={form.requirementsText} onChange={(e) => setValue('requirementsText', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Cancellation policy</span>
              <select value={form.cancellationPolicy} onChange={(e) => setValue('cancellationPolicy', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg">
                <option value="flexible">Flexible</option><option value="moderate">Moderate</option><option value="strict">Strict</option><option value="custom">Custom terms below</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Cancellation terms</span>
              <input value={form.cancellationTerms} onChange={(e) => setValue('cancellationTerms', e.target.value)} maxLength={1000} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm text-ink/70">Rescheduling terms</span>
              <input value={form.reschedulePolicy} onChange={(e) => setValue('reschedulePolicy', e.target.value)} maxLength={500} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>
          </div>
        )}

        {safeType !== 'service' && (
          <section className="space-y-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.scheduledDiscountEnabled} onChange={(event) => setValue('scheduledDiscountEnabled', event.target.checked)} />
              Schedule a flash sale
            </label>
            {form.scheduledDiscountEnabled && <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-ink/65">Discount (%)<input type="number" min="1" max="90" required value={form.discountPercent} onChange={(event) => setValue('discountPercent', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
              <label className="text-sm text-ink/65">Starts<input type="datetime-local" required value={form.discountStartsAt} onChange={(event) => setValue('discountStartsAt', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
              <label className="text-sm text-ink/65">Ends<input type="datetime-local" required value={form.discountEndsAt} onChange={(event) => setValue('discountEndsAt', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
            </div>}
            {form.scheduledDiscountEnabled && form.discountStartsAt && form.discountEndsAt && new Date(form.discountEndsAt) <= new Date(form.discountStartsAt) && <p className="text-xs text-dispute">The sale must end after it starts.</p>}
          </section>
        )}

        {safeType !== 'service' ? <PricePreview preview={pricePreview} basePrice={basePrice} /> : basePrice >= 100 && <PricePreview preview={pricePreview} basePrice={basePrice} />}

        {error && <div><p className="text-sm text-dispute">{error}</p>{error.toLowerCase().includes('identity details') && <Link to={`/settings?next=${encodeURIComponent(window.location.pathname)}`} className="mt-2 inline-block text-sm underline underline-offset-4">Complete identity details</Link>}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ink px-4 py-3 font-medium text-paper hover:bg-ink/90 disabled:opacity-60"
        >
          {loading ? 'Creating…' : `Create ${typeMeta.label}`}
        </button>
      </form>
    </div>
  );
}

function PricePreview({ preview, basePrice }) {
  return (
    <aside className="rounded-lg border border-line bg-paper/70 p-4" aria-live="polite">
      <p className="text-sm font-medium">Price preview</p>
      {preview ? (
        <div className="mt-2 flex flex-wrap justify-between gap-x-5 gap-y-2 text-sm">
          <p className="text-ink/65">Buyer pays <strong className="text-ink">₦{(preview.buyerPriceKobo / 100).toLocaleString()}</strong></p>
          <p className="text-ink/65">You receive <strong className="text-ink">₦{(preview.sellerPayoutKobo / 100).toLocaleString()}</strong></p>
        </div>
      ) : (
        <p className="mt-1 text-xs text-ink/55">{basePrice >= 100 ? 'Fetching the current checkout estimate…' : 'Enter a price of at least ₦100 to see the buyer total and your payout.'}</p>
      )}
    </aside>
  );
}
