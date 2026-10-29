import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import PhotoField from '../components/PhotoField.jsx';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/usePageTitle.js';
import { MARKETPLACE_CATEGORIES_BY_TYPE } from '../lib/marketplaceState.js';

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

function serviceListingToForm(listing, defaults) {
  const packages = listing.packages || [];
  const standardPackage = packages[0] || {};
  const premiumPackage = packages[1] || {};
  const availability = listing.availability || [];
  const dateValue = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
  const blockedPeriods = (listing.blockedDates || []).map((period) => ({
    start: dateValue(period.startAt),
    end: dateValue(period.endAt),
  }));
  return {
    ...defaults,
    title: listing.title || '',
    summary: listing.summary || '',
    description: listing.description || '',
    category: listing.category || 'General',
    subcategory: listing.subcategory || '',
    images: listing.images?.length ? [...listing.images] : [''],
    serviceModel: listing.serviceModel || 'appointment',
    basePrice: listing.serviceModel === 'custom_quote'
      ? Number(listing.startingPrice || 0)
      : Number(listing.basePrice || defaults.basePrice),
    packageName: standardPackage.name || defaults.packageName,
    packageDescription: standardPackage.description || '',
    packagePrice: standardPackage.priceNaira || defaults.packagePrice,
    packageDeliveryDays: standardPackage.deliveryDays || defaults.packageDeliveryDays,
    packageRevisionCount: standardPackage.revisionCount ?? defaults.packageRevisionCount,
    packageDeliverablesText: (standardPackage.deliverables || []).join('\n'),
    plusPackageEnabled: packages.length > 1,
    plusPackageName: premiumPackage.name || defaults.plusPackageName,
    plusPackageDescription: premiumPackage.description || '',
    plusPackagePrice: premiumPackage.priceNaira || defaults.plusPackagePrice,
    plusPackageDeliveryDays: premiumPackage.deliveryDays || defaults.plusPackageDeliveryDays,
    plusPackageRevisionCount: premiumPackage.revisionCount ?? defaults.plusPackageRevisionCount,
    plusPackageDeliverablesText: (premiumPackage.deliverables || []).join('\n'),
    addOnEnabled: Boolean(listing.addOns?.length),
    addOnName: listing.addOns?.[0]?.name || '',
    addOnDescription: listing.addOns?.[0]?.description || '',
    addOnPrice: listing.addOns?.[0]?.priceNaira || defaults.addOnPrice,
    pricingUnit: listing.pricingUnit || defaults.pricingUnit,
    estimatedTime: listing.estimatedTime || '',
    location: listing.location || defaults.location,
    deliveryMode: listing.deliveryMode || defaults.deliveryMode,
    serviceRadiusKm: listing.serviceRadiusKm || 0,
    serviceArea: listing.serviceArea || '',
    travelFeeNaira: listing.travelFeeNaira || 0,
    durationMinutes: listing.durationMinutes || defaults.durationMinutes,
    bookingLeadTimeHours: listing.bookingLeadTimeHours ?? defaults.bookingLeadTimeHours,
    maxAdvanceBookingDays: listing.maxAdvanceBookingDays || defaults.maxAdvanceBookingDays,
    bufferMinutes: listing.bufferMinutes || 0,
    slotCapacity: listing.slotCapacity || defaults.slotCapacity,
    maxBookingsPerDay: listing.maxBookingsPerDay || defaults.maxBookingsPerDay,
    instantConfirmation: Boolean(listing.instantConfirmation),
    timeZone: listing.timeZone || defaults.timeZone,
    availabilityDays: availability.length ? availability.map((entry) => entry.day) : [],
    availabilityStart: availability[0]?.startTime || defaults.availabilityStart,
    availabilityEnd: availability[0]?.endTime || defaults.availabilityEnd,
    availabilitySnapshot: availability.map((entry) => ({ day: entry.day, startTime: entry.startTime, endTime: entry.endTime })),
    availabilityCustomized: false,
    blockedPeriods: blockedPeriods.length ? blockedPeriods : [{ start: '', end: '' }],
    deliveryMethods: listing.deliveryMethods?.length ? [...listing.deliveryMethods] : [],
    deliverablesText: (listing.deliverables || []).join('\n'),
    requirementsText: (listing.requirements || []).join('\n'),
    exclusionsText: (listing.exclusions || []).join('\n'),
    completionConditions: listing.completionConditions || '',
    responseTimeHours: listing.responseTimeHours || defaults.responseTimeHours,
    quoteExpiryDays: listing.quoteExpiryDays || defaults.quoteExpiryDays,
    buyerRequirements: (listing.buyerRequirements || []).map((requirement) => ({
      ...requirement,
      optionsText: (requirement.options || []).join('\n'),
    })),
    cancellationPolicy: listing.cancellationPolicy || defaults.cancellationPolicy,
    cancellationTerms: listing.cancellationTerms || '',
    reschedulePolicy: listing.reschedulePolicy || '',
  };
}

export default function CreateMarketplaceListing() {
  const location = useLocation();
  const navigate = useNavigate();
  const { type } = useParams();
  const [searchParams] = useSearchParams();
  const safeType = types[type] ? type : 'product';
  const editingListingId = searchParams.get('edit') || '';
  const localDraftKey = editingListingId
    ? `escrit:service-listing-draft:${editingListingId}`
    : safeType === 'service' ? 'escrit:service-listing-draft' : `escrit:${safeType}-listing-draft`;
  const typeMeta = types[safeType];
  usePageTitle(`${editingListingId ? 'Edit' : 'List'} ${typeMeta.label.toLowerCase()}`);

  const initialState = useMemo(
    () => ({
      title: '',
      summary: '',
      description: '',
      category: 'General',
      subcategory: '',
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
      plusPackageEnabled: false,
      plusPackageName: 'Premium',
      plusPackageDescription: '',
      plusPackagePrice: 65000,
      plusPackageDeliveryDays: 10,
      plusPackageRevisionCount: 2,
      plusPackageDeliverablesText: '',
      addOnEnabled: false,
      addOnName: '',
      addOnDescription: '',
      addOnPrice: 5000,
      pricingUnit: typeMeta.defaults.pricingUnit ?? 'project',
      estimatedTime: typeMeta.defaults.estimatedTime ?? '1-2 weeks',
      location: typeMeta.defaults.location ?? 'Remote',
      deliveryMode: 'remote',
      serviceRadiusKm: 0,
      serviceArea: '',
      travelFeeNaira: 0,
      durationMinutes: 60,
      bookingLeadTimeHours: 24,
      maxAdvanceBookingDays: 90,
      bufferMinutes: 0,
      slotCapacity: 1,
      maxBookingsPerDay: 4,
      instantConfirmation: false,
      timeZone: 'Africa/Lagos',
      availabilityDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      availabilityStart: '09:00',
      availabilityEnd: '17:00',
      availabilitySnapshot: [],
      availabilityCustomized: false,
      blockedDateStart: '',
      blockedDateEnd: '',
      blockedPeriods: [{ start: '', end: '' }],
      deliveryMethods: ['online'],
      deliverablesText: '',
      requirementsText: '',
      exclusionsText: '',
      completionConditions: '',
      responseTimeHours: 48,
      quoteExpiryDays: 7,
      buyerRequirements: [],
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
  const [serviceStep, setServiceStep] = useState(1);
  const [previewMode, setPreviewMode] = useState(false);
  const [serverDraftId, setServerDraftId] = useState('');
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftChanged = useRef(false);

  useEffect(() => {
    let active = true;
    api.getCategories(safeType).then(({ categories: list }) => {
      if (!active) return;
      const defaults = MARKETPLACE_CATEGORIES_BY_TYPE[safeType] || MARKETPLACE_CATEGORIES_BY_TYPE.product;
      const available = list || [];
      setCategories([
        ...available,
        ...defaults.filter((name) => !available.some((category) => category.name === name))
          .map((name) => ({ _id: name, name })),
      ]);
      setForm((current) => current.category === 'General'
        ? { ...current, category: available[0]?.name || defaults[0] }
        : current);
    }).catch(() => {
      if (!active) return;
      const defaults = MARKETPLACE_CATEGORIES_BY_TYPE[safeType] || MARKETPLACE_CATEGORIES_BY_TYPE.product;
      setCategories(defaults.map((name) => ({ _id: name, name })));
      setForm((current) => current.category === 'General' ? { ...current, category: defaults[0] } : current);
    });
    return () => { active = false; };
  }, [safeType]);

  useEffect(() => {
    setDraftReady(false);
    draftChanged.current = false;
    setForm(initialState);
    setRequestCategory(false);
    setServiceStep(1);
    setPreviewMode(false);
    setServerDraftId('');
  }, [safeType, initialState, editingListingId]);

  useEffect(() => {
    let active = true;
    let localDraft = null;
    try {
      const saved = window.localStorage.getItem(localDraftKey);
      localDraft = saved ? JSON.parse(saved) : null;
    } catch {
      setError('Your saved listing draft could not be restored. You can continue with a new listing.');
    }
    Promise.all([
      api.getListingDraft(),
      editingListingId ? api.getMyListings() : Promise.resolve({ listings: [] }),
    ]).then(([{ draft }, { listings }]) => {
      if (!active) return;
      const targetListing = editingListingId
        ? (listings || []).find((listing) => String(listing._id) === editingListingId && listing.listingType === safeType)
        : null;
      if (editingListingId && !targetListing) {
        setError('That listing could not be found in your account.');
        return;
      }
      const matchingDraft = draft?.type === safeType
        && String(draft.listingId || '') === editingListingId
        ? draft
        : null;
      setServerDraftId(matchingDraft?._id || '');
      const savedForm = localDraft || (matchingDraft?.formData && Object.keys(matchingDraft.formData).length
        ? matchingDraft.formData
        : matchingDraft ? {
            title: matchingDraft.title || '',
            summary: (matchingDraft.description || '').slice(0, 240),
            description: matchingDraft.description || '',
            category: matchingDraft.category || 'General',
            images: matchingDraft.images?.length ? [...matchingDraft.images] : [''],
            ...(safeType === 'service'
              ? { basePrice: Number(matchingDraft.price) || undefined }
              : { price: Number(matchingDraft.price) || undefined }),
            estimatedTime: matchingDraft.deliveryTime || undefined,
            stock: Number(matchingDraft.quantity) || undefined,
          } : editingListingId ? serviceListingToForm(targetListing, initialState) : null);
      const incomingDraft = safeType === 'service' && !editingListingId && location.state?.serviceDraft;
      const incomingFields = incomingDraft ? Object.fromEntries(
        Object.entries(incomingDraft).filter(([, value]) => value !== '' && value !== undefined && value !== null
          && (!Array.isArray(value) || value.length > 0)),
      ) : {};
      if (savedForm || Object.keys(incomingFields).length) {
        setForm((current) => ({
          ...current,
          ...(savedForm || {}),
          ...incomingFields,
          blockedPeriods: savedForm?.blockedPeriods || (savedForm?.blockedDateStart && savedForm?.blockedDateEnd
            ? [{ start: savedForm.blockedDateStart, end: savedForm.blockedDateEnd }]
            : current.blockedPeriods),
        }));
      }
    }).catch((err) => {
      if (!active) return;
      if (localDraft) setForm((current) => ({ ...current, ...localDraft }));
      setError(err.message || 'Could not load your saved listing draft.');
    }).finally(() => {
      if (active) setDraftReady(true);
    });
    return () => { active = false; };
  }, [safeType, editingListingId, localDraftKey, initialState, location.state]);

  useEffect(() => {
    if (!draftReady || !draftChanged.current) return;
    try {
      window.localStorage.setItem(localDraftKey, JSON.stringify(form));
    } catch {
      setError('This browser could not save your listing draft. Keep this page open until you publish.');
    }
  }, [draftReady, form, localDraftKey]);

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

  const saveListingDraft = useCallback(async (values = form) => {
    setDraftSaving(true);
    setError('');
    try {
      const { draft } = await api.saveListingDraft({
        type: safeType,
        listingId: editingListingId || null,
        title: values.title,
        category: values.category,
        description: values.description,
        price: Number(safeType === 'service'
          ? values.serviceModel === 'fixed_scope' ? values.packagePrice : values.basePrice || 0
          : values.price || 0),
        images: values.images.map((image) => image.trim()).filter((image) => image.startsWith('https://')),
        deliveryTime: values.estimatedTime || '',
        formData: values,
      }, serverDraftId);
      setServerDraftId(draft?._id || serverDraftId);
      return true;
    } catch (err) {
      setError(err.message || 'Unable to save this listing draft.');
      return false;
    } finally {
      setDraftSaving(false);
    }
  }, [editingListingId, form, safeType, serverDraftId]);

  useEffect(() => {
    if (!draftReady || !draftChanged.current) return undefined;
    const timeout = window.setTimeout(() => { saveListingDraft(form); }, 900);
    return () => window.clearTimeout(timeout);
  }, [draftReady, form, saveListingDraft]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (safeType === 'service') {
      if (form.title.trim().length < 5 || !form.category || !form.images[0]?.trim()) {
        setServiceStep(1);
        setError('Add a title of at least 5 characters, choose a category, and add a cover image.');
        return;
      }
      if (form.serviceModel === 'appointment' && (!form.availabilityDays.length || form.availabilityStart >= form.availabilityEnd)) {
        setServiceStep(2);
        setError('Choose at least one working day and a valid availability window.');
        return;
      }
      if (form.serviceModel === 'fixed_scope' && (!form.packageName.trim() || Number(form.packagePrice) < 100)) {
        setServiceStep(2);
        setError('Add a package name and price of at least ₦100.');
        return;
      }
      const blockedPeriods = form.blockedPeriods || [];
      if (blockedPeriods.some((period) => Boolean(period.start) !== Boolean(period.end) || (period.start && period.end < period.start))) {
        setServiceStep(2);
        setError('Complete both dates for every blocked period, and make sure the end date is not before the start date.');
        return;
      }
    }
    setLoading(true);

    try {
      const payload = {
        title: form.title,
        summary: form.summary,
        description: form.description,
        category: form.category,
        subcategory: form.subcategory,
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
        packages: safeType === 'service' && form.serviceModel === 'fixed_scope' ? [
          {
            key: 'standard',
            name: form.packageName,
            description: form.packageDescription,
            priceNaira: Number(form.packagePrice),
            deliveryDays: Number(form.packageDeliveryDays),
            revisionCount: Number(form.packageRevisionCount),
            deliverables: form.packageDeliverablesText.split('\n').map((value) => value.trim()).filter(Boolean),
          },
          ...(form.plusPackageEnabled ? [{
            key: 'premium',
            name: form.plusPackageName,
            description: form.plusPackageDescription,
            priceNaira: Number(form.plusPackagePrice),
            deliveryDays: Number(form.plusPackageDeliveryDays),
            revisionCount: Number(form.plusPackageRevisionCount),
            deliverables: form.plusPackageDeliverablesText.split('\n').map((value) => value.trim()).filter(Boolean),
          }] : []),
        ] : [],
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
        serviceArea: form.serviceArea,
        travelFeeNaira: Number(form.travelFeeNaira || 0),
        durationMinutes: Number(form.durationMinutes || 60),
        bookingLeadTimeHours: Number(form.bookingLeadTimeHours || 0),
        maxAdvanceBookingDays: Number(form.maxAdvanceBookingDays || 90),
        bufferMinutes: Number(form.bufferMinutes || 0),
        slotCapacity: Number(form.slotCapacity || 1),
        maxBookingsPerDay: Number(form.maxBookingsPerDay || 1),
        instantConfirmation: Boolean(form.instantConfirmation),
        timeZone: form.timeZone,
        availability: form.serviceModel !== 'appointment'
          ? []
          : form.availabilitySnapshot.length && !form.availabilityCustomized
            ? form.availabilitySnapshot
            : form.availabilityDays.map((day) => ({ day, startTime: form.availabilityStart, endTime: form.availabilityEnd })),
        startingPrice: form.serviceModel === 'custom_quote' ? Number(form.basePrice || 0) : 0,
        blockedDates: form.serviceModel !== 'appointment' ? [] : (form.blockedPeriods || []).filter((period) => period.start && period.end).map((period) => ({
          startAt: new Date(`${period.start}T00:00:00`).toISOString(),
          endAt: new Date(`${period.end}T23:59:59`).toISOString(),
        })),
        deliveryMethods: form.deliveryMethods,
        deliverables: form.deliverablesText.split('\n').map((value) => value.trim()).filter(Boolean),
        requirements: form.requirementsText.split('\n').map((value) => value.trim()).filter(Boolean),
        buyerRequirements: form.buyerRequirements.map((requirement, index) => {
          const { optionsText, ...definition } = requirement;
          return {
            ...definition,
            key: requirement.key || `requirement-${index + 1}`,
            options: ['single_select', 'multi_select'].includes(requirement.type)
              ? String(optionsText || '').split('\n').map((value) => value.trim()).filter(Boolean)
              : [],
          };
        }),
        exclusions: form.exclusionsText.split('\n').map((value) => value.trim()).filter(Boolean),
        responseTimeHours: Number(form.responseTimeHours),
        completionConditions: form.completionConditions,
        quoteExpiryDays: Number(form.quoteExpiryDays),
        cancellationPolicy: form.cancellationPolicy,
        cancellationTerms: form.cancellationTerms,
        reschedulePolicy: form.reschedulePolicy,
      };

      if (safeType === 'service') {
        if (editingListingId) {
          await api.updateMyServiceListing(editingListingId, payload);
        } else {
          await api.publishListing({
            type: 'service',
            title: form.title,
            category: form.category,
            description: form.description,
            price: Number(payload.basePrice || 0),
            images: payload.images,
            deliveryTime: form.estimatedTime || '',
            serviceData: payload,
            formData: form,
          });
        }
      } else {
        await api.createMarketplaceListing(safeType, payload);
      }
      window.localStorage.removeItem(localDraftKey);
      draftChanged.current = false;
      navigate('/dashboard', { state: { listingSubmitted: !editingListingId, listingUpdated: Boolean(editingListingId) } });
    } catch (err) {
      setError(err.message || 'Unable to create this listing.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-ink/50">{editingListingId ? 'Edit' : 'Create'} {typeMeta.label}</p>
        <h1 className="mt-2 font-display text-3xl">{editingListingId ? 'Edit service listing' : 'List on Escrit'}</h1>
        <label className="mt-4 block max-w-sm text-sm text-ink/65">Listing type
          <select value={safeType} onChange={(event) => {
            if (form.title && !window.confirm('Changing listing type will reset this draft. Continue?')) return;
            navigate(`/marketplace/new/${event.target.value}`, { replace: true });
          }} className="mt-1 w-full border border-line bg-input px-3 py-2"><option value="product">Product</option><option value="service">Service</option><option value="course">Course</option></select>
        </label>
      </div>

      <form onSubmit={handleSubmit} onChange={() => {
        draftChanged.current = true;
      }} onClickCapture={(event) => {
        if (event.target.closest('button') && event.target.closest('button').type !== 'submit') {
          draftChanged.current = true;
        }
      }} className="space-y-5 rounded-2xl border border-line bg-paper p-6">
        {safeType === 'service' && (
          <ol aria-label="Service listing progress" className="grid grid-cols-3 gap-2 border-b border-line pb-4">
            {['Basics', 'Model and pricing', 'Review'].map((label, index) => (
              <li key={label} aria-current={serviceStep === index + 1 ? 'step' : undefined} className={`rounded-lg px-2 py-2 text-center text-xs font-semibold sm:text-sm ${serviceStep === index + 1 ? 'bg-accent text-accent-ink' : 'bg-paper-2 text-ink/55'}`}>
                {index + 1}. {label}
              </li>
            ))}
          </ol>
        )}
        {(safeType !== 'service' || serviceStep === 1) && <>
        <label className="block">
          <span className="text-sm text-ink/70">Title</span>
          <input
            value={form.title}
            onChange={(e) => setValue('title', e.target.value)}
            required
            minLength={safeType === 'service' ? 5 : 3}
            className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg"
          />
        </label>

        {safeType === 'service' && <label className="block">
          <span className="text-sm text-ink/70">Short summary</span>
          <input value={form.summary} maxLength={240} onChange={(event) => setValue('summary', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" placeholder="A concise description shown on service cards" />
        </label>}

        <label className="block">
          <span className="text-sm text-ink/70">Service description</span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setValue('description', e.target.value)}
            required={safeType === 'service'}
            maxLength={2000}
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
              {form.category && !categories.some((category) => category.name === form.category) && <option value={form.category}>{form.category}</option>}
              {categories.map((category) => <option key={category._id} value={category.name}>{category.name}</option>)}
              <option value="__request">Request a new category…</option>
            </select>
            {requestCategory && <div className="mt-2"><input required maxLength={80} value={form.category === 'General' || categories.some((category) => category.name === form.category) ? '' : form.category} onChange={(event) => setValue('category', event.target.value)} placeholder="Enter a category name" className="w-full border border-line bg-input px-3 py-2 rounded-lg" /><p className="mt-1 text-xs text-ink/50">An admin will approve this category or assign your listing to an existing one.</p></div>}
          </label>
          {safeType === 'service' && <label className="block">
            <span className="text-sm text-ink/70">Subcategory</span>
            <input maxLength={80} value={form.subcategory} onChange={(event) => setValue('subcategory', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" placeholder="e.g. Portrait photography" />
          </label>}

        </div>

        <div className="space-y-4">
          {form.images.map((image, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <PhotoField required={safeType === 'service' && index === 0} value={image} onChange={(url) => setForm((prev) => ({ ...prev, images: prev.images.map((value, imageIndex) => imageIndex === index ? url : value) }))} />
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
        {safeType === 'service' && <button type="button" onClick={() => {
          if (form.title.trim().length < 5 || !form.category || !form.description.trim() || !form.images[0]?.trim()) {
            setError('Complete the service title, description, category, and cover image before continuing.');
            return;
          }
          setError('');
          setServiceStep(2);
        }} className="min-h-11 w-full rounded-lg bg-ink px-4 py-3 font-medium text-paper hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Continue to service setup</button>}
        </>}

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

        {safeType === 'service' && serviceStep === 2 && (
          <div className="space-y-5">
            <fieldset className="space-y-3 rounded-lg border border-line p-4">
              <legend className="px-1 text-sm font-medium">How buyers book this service</legend>
              {[
                ['appointment', 'Appointment', 'Buyer requests an available time; you confirm before payment.'],
                ['fixed_scope', 'Fixed scope', 'Buyer chooses a defined package and pays after accepting its terms.'],
                ['custom_quote', 'Custom quote', 'Buyer describes the work; you agree scope and price in Escrit chat.'],
              ].map(([value, label, description]) => (
                <label key={value} className="flex min-h-11 items-start gap-3 rounded-md p-2 text-sm hover:bg-paper/70">
                  <input type="radio" name="serviceModel" value={value} checked={form.serviceModel === value} onChange={() => {
                    setValue('serviceModel', value);
                    if (value === 'custom_quote') setValue('basePrice', 0);
                    else if (form.basePrice < 100) setValue('basePrice', 30000);
                  }} className="mt-1" />
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
                <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.plusPackageEnabled} onChange={(event) => setValue('plusPackageEnabled', event.target.checked)} />Add a second package</label>
                {form.plusPackageEnabled && <div className="grid gap-3 rounded-lg border border-line p-3 sm:col-span-2 sm:grid-cols-2">
                  <label className="text-sm text-ink/70">Package name<input required maxLength={80} value={form.plusPackageName} onChange={(event) => setValue('plusPackageName', event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" /></label>
                  <label className="text-sm text-ink/70">Price (₦)<input type="number" min="100" required value={form.plusPackagePrice} onChange={(event) => setValue('plusPackagePrice', event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" /></label>
                  <label className="text-sm text-ink/70">Delivery time (days)<input type="number" min="1" max="365" required value={form.plusPackageDeliveryDays} onChange={(event) => setValue('plusPackageDeliveryDays', event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" /></label>
                  <label className="text-sm text-ink/70">Included revisions<input type="number" min="0" max="20" required value={form.plusPackageRevisionCount} onChange={(event) => setValue('plusPackageRevisionCount', event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" /></label>
                  <label className="text-sm text-ink/70 sm:col-span-2">Scope summary<textarea rows={2} maxLength={500} value={form.plusPackageDescription} onChange={(event) => setValue('plusPackageDescription', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
                  <label className="text-sm text-ink/70 sm:col-span-2">Deliverables, one per line<textarea rows={2} value={form.plusPackageDeliverablesText} onChange={(event) => setValue('plusPackageDeliverablesText', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
                </div>}
                <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.addOnEnabled} onChange={(event) => setValue('addOnEnabled', event.target.checked)} />Offer one optional extra</label>
                {form.addOnEnabled && <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2"><label className="text-sm text-ink/70">Extra name<input required maxLength={80} value={form.addOnName} onChange={(event) => setValue('addOnName', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label><label className="text-sm text-ink/70">Extra price (₦)<input type="number" min="100" required value={form.addOnPrice} onChange={(event) => setValue('addOnPrice', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label><label className="text-sm text-ink/70 sm:col-span-2">Extra description<input maxLength={300} value={form.addOnDescription} onChange={(event) => setValue('addOnDescription', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label></div>}
              </fieldset>
            ) : null}
            <div className="grid gap-5 md:grid-cols-2">
            {form.serviceModel === 'custom_quote' && <label className="block">
              <span className="text-sm text-ink/70">Starting price (optional, ₦)</span>
              <input type="number" min="0" value={form.basePrice} onChange={(event) => setValue('basePrice', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
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
            {form.serviceModel !== 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Estimated delivery time</span>
              <input value={form.estimatedTime} onChange={(e) => setValue('estimatedTime', e.target.value)} maxLength={120} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
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
            {form.serviceModel !== 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Location (if relevant)</span>
              <input value={form.location} onChange={(e) => setValue('location', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
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
            {form.serviceModel !== 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">How is this service delivered?</span>
              <select value={form.deliveryMode} onChange={(e) => setValue('deliveryMode', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg">
                <option value="remote">Remote</option><option value="in-person">In person</option><option value="hybrid">Remote or in person</option>
              </select>
            </label>}
            <fieldset className="rounded-lg border border-line p-4 md:col-span-2">
              <legend className="px-1 text-sm font-medium">Available delivery methods</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['online', 'Online'],
                  ['provider_location', 'At my location'],
                  ['buyer_location', 'At the buyer location'],
                  ['remote_deliverable', 'Remote deliverables'],
                ].map(([value, label]) => <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.deliveryMethods.includes(value)} onChange={(event) => setForm((current) => ({ ...current, deliveryMethods: event.target.checked ? [...current.deliveryMethods, value] : current.deliveryMethods.filter((method) => method !== value) }))} />
                  {label}
                </label>)}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-sm text-ink/70">Service area or location</span>
              <input value={form.serviceArea} onChange={(event) => setValue('serviceArea', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" placeholder="City, region, or remote" />
            </label>
            {form.serviceModel === 'appointment' && form.deliveryMethods.includes('buyer_location') && <label className="block">
              <span className="text-sm text-ink/70">Travel fee (₦)</span>
              <input type="number" min="0" value={form.travelFeeNaira} onChange={(event) => setValue('travelFeeNaira', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
            {form.deliveryMethods.includes('buyer_location') && <label className="block">
              <span className="text-sm text-ink/70">Travel radius (km)</span>
              <input type="number" min="0" max="1000" value={form.serviceRadiusKm} onChange={(event) => setValue('serviceRadiusKm', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
            {form.serviceModel === 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Maximum advance-booking window (days)</span>
              <input type="number" min="1" max="730" value={form.maxAdvanceBookingDays} onChange={(event) => setValue('maxAdvanceBookingDays', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
            {form.serviceModel === 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Buffer between appointments (minutes)</span>
              <input type="number" min="0" max="1440" value={form.bufferMinutes} onChange={(event) => setValue('bufferMinutes', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
            {form.serviceModel === 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Capacity per time slot</span>
              <input type="number" min="1" max="100" value={form.slotCapacity} onChange={(event) => setValue('slotCapacity', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
            {form.serviceModel === 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Typical appointment duration (minutes)</span>
              <input type="number" min="15" max="1440" value={form.durationMinutes} onChange={(e) => setValue('durationMinutes', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
            {form.serviceModel === 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Minimum booking notice (hours)</span>
              <input type="number" min="0" max="8760" value={form.bookingLeadTimeHours} onChange={(e) => setValue('bookingLeadTimeHours', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
            {form.serviceModel === 'appointment' && <label className="block">
              <span className="text-sm text-ink/70">Maximum bookings per day</span>
              <input type="number" min="1" max="100" value={form.maxBookingsPerDay} onChange={(e) => setValue('maxBookingsPerDay', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
            {form.serviceModel === 'appointment' && <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={form.instantConfirmation} onChange={(event) => setValue('instantConfirmation', event.target.checked)} />
              Confirm appointments instantly
            </label>}
            {form.serviceModel === 'appointment' && <fieldset className="md:col-span-2">
              <legend className="text-sm text-ink/70">Weekly availability ({form.timeZone})</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                  <label key={day} className="flex items-center gap-1.5 text-sm capitalize">
                    <input type="checkbox" checked={form.availabilityDays.includes(day)} onChange={(e) => setForm((prev) => ({ ...prev, availabilityCustomized: true, availabilityDays: e.target.checked ? [...prev.availabilityDays, day] : prev.availabilityDays.filter((value) => value !== day) }))} />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
              <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
                <label className="text-sm">From<input type="time" value={form.availabilityStart} onChange={(e) => setForm((prev) => ({ ...prev, availabilityCustomized: true, availabilityStart: e.target.value }))} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" /></label>
                <label className="text-sm">To<input type="time" value={form.availabilityEnd} onChange={(e) => setForm((prev) => ({ ...prev, availabilityCustomized: true, availabilityEnd: e.target.value }))} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" /></label>
              </div>
            </fieldset>}
            {form.serviceModel === 'appointment' && <fieldset className="rounded-lg border border-line p-4 md:col-span-2">
              <legend className="px-1 text-sm font-medium">Blocked dates and unavailable periods</legend>
              <div className="space-y-3">
                {(form.blockedPeriods || []).map((period, index) => <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="text-sm">From<input type="date" value={period.start} onChange={(event) => setForm((current) => ({ ...current, blockedPeriods: current.blockedPeriods.map((entry, entryIndex) => entryIndex === index ? { ...entry, start: event.target.value } : entry) }))} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" /></label>
                  <label className="text-sm">Through<input type="date" min={period.start} value={period.end} onChange={(event) => setForm((current) => ({ ...current, blockedPeriods: current.blockedPeriods.map((entry, entryIndex) => entryIndex === index ? { ...entry, end: event.target.value } : entry) }))} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" /></label>
                  {(form.blockedPeriods || []).length > 1 && <button type="button" onClick={() => setForm((current) => ({ ...current, blockedPeriods: current.blockedPeriods.filter((_, entryIndex) => entryIndex !== index) }))} className="min-h-11 self-end text-sm text-dispute underline">Remove</button>}
                </div>)}
              </div>
              <button type="button" onClick={() => setForm((current) => ({ ...current, blockedPeriods: [...(current.blockedPeriods || []), { start: '', end: '' }] }))} className="mt-3 min-h-11 text-sm font-medium underline underline-offset-4">Add unavailable period</button>
            </fieldset>}
            <label className="block md:col-span-2">
              <span className="text-sm text-ink/70">What the buyer receives (one item per line)</span>
              <textarea rows={3} value={form.deliverablesText} onChange={(e) => setValue('deliverablesText', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>
            {form.serviceModel === 'fixed_scope' && <label className="block md:col-span-2">
              <span className="text-sm text-ink/70">Exclusions (one per line)</span>
              <textarea rows={2} value={form.exclusionsText} onChange={(event) => setValue('exclusionsText', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>}
            <label className="block md:col-span-2">
              <span className="text-sm text-ink/70">What the buyer must provide (one item per line)</span>
              <textarea rows={3} value={form.requirementsText} onChange={(e) => setValue('requirementsText', e.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
            </label>
            <section className="space-y-3 border-t border-line pt-4 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="font-semibold">Buyer questions</h3><p className="mt-1 text-xs text-ink/55">Required answers are collected before an order or request is submitted.</p></div>
                <button type="button" onClick={() => setForm((current) => ({ ...current, buyerRequirements: [...current.buyerRequirements, { key: `question-${current.buyerRequirements.length + 1}`, label: '', type: 'short_text', required: false, optionsText: '' }] }))} className="min-h-11 rounded-lg border border-line px-3 text-sm font-medium">Add question</button>
              </div>
              {form.buyerRequirements.map((requirement, index) => <fieldset key={requirement.key} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-2">
                <label className="text-sm">Question<input value={requirement.label} required maxLength={160} onChange={(event) => setForm((current) => ({ ...current, buyerRequirements: current.buyerRequirements.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry) }))} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" /></label>
                <label className="text-sm">Answer type<select value={requirement.type} onChange={(event) => setForm((current) => ({ ...current, buyerRequirements: current.buyerRequirements.map((entry, entryIndex) => entryIndex === index ? { ...entry, type: event.target.value } : entry) }))} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2"><option value="short_text">Short text</option><option value="long_text">Long text</option><option value="single_select">Choose one</option><option value="multi_select">Choose multiple</option><option value="file">File URL</option><option value="link">Reference link</option></select></label>
                {['single_select', 'multi_select'].includes(requirement.type) && <label className="text-sm sm:col-span-2">Options (one per line)<textarea required rows={2} value={requirement.optionsText} onChange={(event) => setForm((current) => ({ ...current, buyerRequirements: current.buyerRequirements.map((entry, entryIndex) => entryIndex === index ? { ...entry, optionsText: event.target.value } : entry) }))} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>}
                <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={requirement.required} onChange={(event) => setForm((current) => ({ ...current, buyerRequirements: current.buyerRequirements.map((entry, entryIndex) => entryIndex === index ? { ...entry, required: event.target.checked } : entry) }))} />Required</label>
                <button type="button" onClick={() => setForm((current) => ({ ...current, buyerRequirements: current.buyerRequirements.filter((_, entryIndex) => entryIndex !== index) }))} className="min-h-11 justify-self-start text-sm text-dispute underline underline-offset-4">Remove question</button>
              </fieldset>)}
            </section>
            {form.serviceModel === 'custom_quote' && <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
              <label className="text-sm text-ink/70">Quote response target (hours)<input type="number" min="1" max="720" value={form.responseTimeHours} onChange={(event) => setValue('responseTimeHours', event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" /></label>
              <label className="text-sm text-ink/70">Quote expiry after sending (days)<input type="number" min="1" max="90" value={form.quoteExpiryDays} onChange={(event) => setValue('quoteExpiryDays', event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" /></label>
            </div>}
            <label className="block md:col-span-2">
              <span className="text-sm text-ink/70">Completion conditions</span>
              <textarea rows={2} maxLength={2000} value={form.completionConditions} onChange={(event) => setValue('completionConditions', event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" />
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

        {safeType === 'service' && serviceStep === 2 && <div className="flex flex-wrap justify-between gap-3">
          <button type="button" onClick={() => setServiceStep(1)} className="min-h-11 rounded-lg border border-line px-4 text-sm font-medium">Back to basics</button>
          <button type="button" onClick={() => {
            if (form.serviceModel === 'appointment' && (!form.availabilityDays.length || form.availabilityStart >= form.availabilityEnd)) {
              setError('Choose at least one working day and a valid availability window.');
              return;
            }
            if (form.serviceModel === 'fixed_scope' && Number(form.packagePrice) < 100) {
              setError('Set a package price of at least ₦100.');
              return;
            }
            if (!form.deliveryMethods.length) {
              setError('Select at least one service delivery method.');
              return;
            }
            setError('');
            setServiceStep(3);
          }} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper">Review service</button>
        </div>}

        {safeType === 'service' && serviceStep === 3 && (
          <section className="space-y-4 rounded-xl border border-line bg-paper-2 p-4" aria-labelledby="service-review-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs uppercase tracking-wider text-ink/50">Listing preview</p><h2 id="service-review-heading" className="mt-1 font-display text-2xl">{form.title}</h2><p className="mt-1 text-sm text-ink/55">{form.category}{form.subcategory ? ` · ${form.subcategory}` : ''} · {form.serviceModel.replace('_', ' ')}</p></div>
              <button type="button" onClick={() => setServiceStep(2)} className="min-h-11 rounded-lg border border-line px-3 text-sm">Edit details</button>
            </div>
            {form.images[0] && <img src={form.images[0]} alt="" className="aspect-[16/7] max-h-64 w-full rounded-lg object-cover" />}
            <p className="whitespace-pre-line text-sm leading-6 text-ink/70">{form.description}</p>
            {form.serviceModel === 'appointment'
              ? <p className="text-sm">₦{Number(form.basePrice || 0).toLocaleString()} · {form.durationMinutes} minutes · {form.deliveryMethods.join(', ').replaceAll('_', ' ')} · {form.instantConfirmation ? 'Instant confirmation' : 'Provider approval'}</p>
              : form.serviceModel === 'fixed_scope'
                ? <ul className="grid gap-2 sm:grid-cols-2">{[form.packageName, ...(form.plusPackageEnabled ? [form.plusPackageName] : [])].map((name) => <li key={name} className="rounded-lg border border-line bg-paper p-3 text-sm">{name}</li>)}</ul>
                : <p className="text-sm">{Number(form.basePrice) >= 100 ? `Starting at ₦${Number(form.basePrice).toLocaleString()} · ` : ''}Custom quote · Provider responds within {form.responseTimeHours} hours.</p>}
            <p className="text-xs leading-5 text-ink/55">Payment terms and fees are shown before checkout. Existing account payment defaults remain in effect unless you later choose listing overrides.</p>
          </section>
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

        {(safeType !== 'service' || serviceStep === 3) && safeType !== 'service' && <PricePreview preview={pricePreview} basePrice={basePrice} />}
        {safeType === 'service' && serviceStep === 3 && form.serviceModel !== 'custom_quote' && basePrice >= 100 && <PricePreview preview={pricePreview} basePrice={basePrice} />}

        {error && <div><p className="text-sm text-dispute">{error}</p>{error.toLowerCase().includes('identity details') && <Link to={`/settings?next=${encodeURIComponent(window.location.pathname)}`} className="mt-2 inline-block text-sm underline underline-offset-4">Complete identity details</Link>}</div>}

        {safeType !== 'service' || serviceStep === 3 ? <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => saveListingDraft()} disabled={loading || draftSaving} className="min-h-11 rounded-lg border border-line px-4 py-3 font-medium hover:border-ink disabled:opacity-60">
            {draftSaving ? 'Saving draft…' : 'Save draft'}
          </button>
          <button type="submit" disabled={loading || draftSaving} className="min-h-11 rounded-lg bg-ink px-4 py-3 font-medium text-paper hover:bg-ink/90 disabled:opacity-60">
            {loading ? editingListingId ? 'Saving changes…' : 'Publishing…' : editingListingId ? 'Save service changes' : `Publish ${typeMeta.label}`}
          </button>
        </div> : null}
        <p role="status" aria-live="polite" className="text-xs text-ink/55">
          {!draftReady ? 'Restoring saved draft…' : draftSaving ? 'Saving draft…' : 'Your changes save automatically as a draft.'}
        </p>
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
