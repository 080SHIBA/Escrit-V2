import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { usePageTitle } from '../lib/usePageTitle.js';
import { CartIcon, ChevronRightIcon } from '../components/icons.jsx';
import ReviewSection from '../components/ReviewSection.jsx';
import ProductOfferPanel from '../components/ProductOfferPanel.jsx';

export default function MarketplaceListing() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { status } = useAuthContext();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [directBuying, setDirectBuying] = useState(false);
  const [appointmentAt, setAppointmentAt] = useState('');
  const [kycRequired, setKycRequired] = useState(false);
  usePageTitle(item?.title || 'Listing');

  useEffect(() => {
    let active = true;
    api.getMarketplaceListing(type, id)
      .then(({ item: listing }) => active && setItem(listing))
      .catch((err) => active && setError(err.message || 'Listing not found.'));
    return () => { active = false; };
  }, [type, id]);

  async function addToCart() {
    if (type === 'service') return;
    if (status !== 'authed') {
      navigate(`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setAdding(true);
    setError('');
    try {
      await api.addCartItem(type, item._id);
      setMessage('Added to your cart.');
    } catch (err) {
      setError(err.message || 'Unable to add this listing to your cart.');
    } finally {
      setAdding(false);
    }
  }

  async function buyDirectly(checkoutMode) {
    if (status !== 'authed') {
      navigate(`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setDirectBuying(true);
    setError('');
    try {
      const { authorizationUrl } = await api.directCheckout(type, id, { checkoutMode, appointmentAt: appointmentAt || null });
      window.location.assign(authorizationUrl);
    } catch (err) {
      setError(err.message || 'Direct checkout is unavailable.');
      setKycRequired(err.message.toLowerCase().includes('identity details'));
    } finally {
      setDirectBuying(false);
    }
  }

  if (error && !item) return <p role="alert" className="text-sm text-dispute">{error}</p>;
  if (!item) return <p className="py-10 text-sm text-ink/55">Loading listing…</p>;

  const price = item.buyerPriceKobo != null ? item.buyerPriceKobo / 100 : null;
  const paymentOptions = item.paymentOptions || { escrow: false, direct: true };
  return (
    <article className="mx-auto max-w-6xl">
      <Link to={`/marketplace?type=${type}`} className="inline-flex items-center gap-1 text-sm text-ink/55 hover:text-ink"><ChevronRightIcon className="rotate-180" width={16} height={16} />Back to {type}s</Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div>
          <img src={item.images?.[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80'} alt={item.title} className="aspect-[4/3] w-full rounded-lg object-cover" />
          {item.images?.length > 1 && <div className="mt-3 grid grid-cols-4 gap-3">{item.images.slice(1).map((image) => <img key={image} src={image} alt="" className="aspect-square w-full rounded-md object-cover" />)}</div>}
          <section className="mt-8 border-t border-line pt-6">
            <p className="text-xs uppercase tracking-wider text-ink/50">{item.category || 'General'} · {type}</p>
            <h1 className="mt-2 font-display text-3xl">{item.title}</h1>
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-ink/70">{item.description || 'The seller has not added a description yet.'}</p>
            {type === 'service' && <ServiceDetails service={item} />}
            {type === 'course' && <CourseDetails course={item} />}
            {type === 'product' && <div className="mt-5 text-sm text-ink/60"><p>{item.condition} · {item.stock} available{item.negotiable ? ' · Price negotiable' : ''}</p>{item.fulfillmentMethod ? <p className="mt-2">{{ delivery: 'Delivery', pickup: 'Pickup', 'delivery-or-pickup': 'Delivery or pickup', 'digital-download': 'Digital download' }[item.fulfillmentMethod]}</p> : item.deliveryOptions?.length > 0 && <p className="mt-2">{item.deliveryOptions.map((option) => `${option.method === 'pickup' ? 'Pickup' : 'Seller delivery'}${option.fee ? ` (₦${Number(option.fee).toLocaleString()})` : ''}`).join(' · ')}</p>}</div>}
          </section>
        </div>

        <aside className="h-fit border-y border-line py-6 lg:sticky lg:top-24">
          <p className="text-3xl font-semibold">{type === 'service' ? item.basePrice > 0 ? price == null ? 'Price unavailable' : `From ₦${Number(price).toLocaleString()}` : 'Get a quote' : price == null ? 'Price unavailable' : `₦${Number(price).toLocaleString()}`}</p>
          <p className="mt-2 text-sm font-medium">{item.paymentOptionLabel || (paymentOptions.escrow && paymentOptions.direct ? 'Escrow optional' : paymentOptions.escrow ? 'Escrow only' : 'No escrow')}</p>
          {paymentOptions.direct && <p className="mt-1 text-xs leading-5 text-ink/55">Without escrow, Escrit cannot hold or recover the money. You can still report problems.</p>}
          {item.seller?.isDemoSeed && <p className="mt-3 rounded-md border border-seal/30 bg-seal-soft/50 p-3 text-xs leading-5">Demo listing. Checkout is disabled; no real payment can be made.</p>}
          {type === 'service' && <label className="mt-4 block text-sm text-ink/65">Preferred appointment <span className="text-ink/40">(optional)</span><input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>}
          {type !== 'service' ? (
            <button type="button" onClick={addToCart} disabled={adding || price == null || item.seller?.isDemoSeed || item.stock < 1} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 font-medium text-paper disabled:opacity-50">
              <CartIcon />{adding ? 'Adding…' : type === 'product' && item.stock < 1 ? 'Out of stock' : 'Add to cart'}
            </button>
          ) : null}
          {paymentOptions.escrow && (
            <button type="button" onClick={() => buyDirectly('escrow')} disabled={directBuying || price == null || item.seller?.isDemoSeed} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line px-4 py-3 text-center font-medium text-ink disabled:opacity-50">
              {directBuying ? 'Opening checkout…' : type === 'service' ? 'Book with escrow' : 'Buy with escrow'}
            </button>
          )}
          {paymentOptions.direct && (
            <button type="button" onClick={() => buyDirectly('direct')} disabled={directBuying || price == null || item.seller?.isDemoSeed} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-ink px-4 py-3 text-center font-medium text-paper disabled:opacity-50">
              {directBuying ? 'Opening checkout…' : type === 'service' ? 'Book without escrow' : 'Pay without escrow'}
            </button>
          )}
          {kycRequired && <Link to={`/settings?next=${encodeURIComponent(window.location.pathname)}`} className="mt-3 inline-block text-sm underline underline-offset-4">Complete identity details to continue</Link>}
          {type === 'product' && <ProductOfferPanel product={item} />}
          {message && <p role="status" className="mt-3 text-sm text-released">{message} <Link to="/account/cart" className="underline">View cart</Link></p>}
          {error && <p role="alert" className="mt-3 text-sm text-dispute">{error}</p>}
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-xs uppercase tracking-wider text-ink/45">Seller</p>
            <Link to={`/marketplace/seller/${item.seller?._id}`} className="mt-2 block font-medium hover:underline">{item.seller?.displayName || item.seller?.businessName || 'Escrit seller'}</Link>
            {item.seller?.bio && <p className="mt-2 text-sm text-ink/60">{item.seller.bio}</p>}
            <Link to={`/marketplace/seller/${item.seller?._id}`} className="mt-3 inline-block text-sm underline underline-offset-4">View seller storefront</Link>
          </div>
          {paymentOptions.escrow && <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink/55">For escrow orders, payment is held until completion is confirmed or the default window ends.</p>}
        </aside>
      </div>
      <ReviewSection listingType={type} listingId={id} authStatus={status} />
    </article>
  );
}

function ServiceDetails({ service }) {
  return (
    <dl className="mt-6 grid gap-4 border-y border-line py-5 text-sm sm:grid-cols-2">
      <Detail label="Delivery" value={service.deliveryMode?.replace('-', ' ') || 'Remote'} />
      <Detail label="Location" value={service.location} />
      <Detail label="Duration" value={`${service.durationMinutes || 60} minutes`} />
      <Detail label="Estimated completion" value={service.estimatedTime} />
      <Detail label="Booking notice" value={`${service.bookingLeadTimeHours ?? 24} hours`} />
      <Detail label="Time zone" value={service.timeZone || 'Africa/Lagos'} />
      {service.availability?.length > 0 && <div className="sm:col-span-2"><dt className="text-ink/50">Weekly availability</dt><dd className="mt-1">{service.availability.map((slot) => `${slot.day} ${slot.startTime}-${slot.endTime}`).join(' · ')}</dd></div>}
      {service.deliverables?.length > 0 && <div><dt className="text-ink/50">Deliverables</dt><dd className="mt-1">{service.deliverables.join(', ')}</dd></div>}
      {service.requirements?.length > 0 && <div><dt className="text-ink/50">Buyer requirements</dt><dd className="mt-1">{service.requirements.join(', ')}</dd></div>}
      <Detail label="Cancellation" value={service.cancellationTerms || service.cancellationPolicy} />
      {service.reschedulePolicy && <Detail label="Rescheduling" value={service.reschedulePolicy} />}
    </dl>
  );
}

function CourseDetails({ course }) {
  return (
    <div className="mt-5 space-y-3 text-sm text-ink/65">
      <p>{course.deliveryFormat === 'live' ? 'Live course' : 'Self-paced course'}</p>
      {course.format && <Detail label="Format" value={{ 'self-paced-videos': 'Self-paced videos', 'live-cohort': 'Live cohort', 'pdf-ebook': 'PDF or ebook' }[course.format]} />}
      {course.level && <Detail label="Level" value={course.level} />}
      {course.duration && <Detail label="Duration or lessons" value={course.duration} />}
      {course.curriculum?.length > 0 && (
        <section>
          <h2 className="font-medium text-ink">Curriculum preview</h2>
          <ol className="mt-2 space-y-2">
            {course.curriculum.map((module, index) => (
              <li key={`${module.title}-${index}`} className="border-l-2 border-line pl-3">
                <p className="font-medium text-ink/80">{index + 1}. {module.title}</p>
                {module.description && <p className="mt-0.5 text-xs leading-5">{module.description}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {course.refundable && <p>Refund policy: {course.refundConditions}</p>}
    </div>
  );
}

function Detail({ label, value }) {
  return <div><dt className="text-ink/50">{label}</dt><dd className="mt-1 capitalize">{value || 'Not specified'}</dd></div>;
}
