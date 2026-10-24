import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LayoutGrid, List } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { useCheckoutCart } from '../../hooks/useCheckoutCart.js';
import { useRecentlyViewed } from '../../hooks/useRecentlyViewed.js';
import {
  filterRecommendations,
  groupCartBySeller,
} from '../../lib/cartCheckout.js';
import ConfirmationStep from '../../components/cart/ConfirmationStep.jsx';
import OrderSummary from '../../components/cart/OrderSummary.jsx';
import PaymentStep from '../../components/cart/PaymentStep.jsx';
import ProductRow from '../../components/cart/ProductRow.jsx';
import ReviewStep from '../../components/cart/ReviewStep.jsx';
import SellerGroup from '../../components/cart/SellerGroup.jsx';

function idOf(item) {
  const listing = item?.listing || item;
  return String(listing?._id || listing?.id || item?.listingId || '');
}

function asListing(item) {
  return item?.listing ? { ...item.listing, type: item.listingType || item.listing.type } : item;
}

function CheckoutProgress({ step }) {
  const current = step === 'confirmation' ? 4 : ({ cart: 1, review: 2, payment: 3 }[step] || 1);
  const steps = ['Cart', 'Review', 'Payment', 'Confirmation'];
  return (
    <nav aria-label="Checkout progress" className="mb-7">
      <ol className="grid grid-cols-4 gap-2">
        {steps.map((label, index) => {
          const number = index + 1;
          const active = number === current;
          const complete = number < current;
          return (
            <li key={label} aria-current={active ? 'step' : undefined} className={`border-t-2 pt-2 text-xs sm:text-sm ${active || complete ? 'border-accent font-semibold text-ink' : 'border-line text-ink/45'}`}>
              <span className="mr-1.5">{number}</span>{label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function CartPage() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') || '';
  const checkout = useCheckoutCart(reference);
  const { seller } = useAuthContext();
  const recentItems = useRecentlyViewed(null);
  const [savedItems, setSavedItems] = useState([]);
  const [similarItems, setSimilarItems] = useState([]);
  const [recommendationError, setRecommendationError] = useState('');
  const [savedError, setSavedError] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const groups = useMemo(() => groupCartBySeller(checkout.items), [checkout.items]);
  const cartIds = useMemo(() => checkout.items.map(idOf).filter(Boolean), [checkout.items]);
  const ownSellerId = String(seller?._id || seller?.id || seller?.sellerId || '');
  const filteredSaved = useMemo(() => filterRecommendations(
    savedItems.map(asListing),
    { excludedIds: cartIds, ownSellerId },
  ), [cartIds, ownSellerId, savedItems]);
  const filteredRecent = useMemo(() => filterRecommendations(
    recentItems.map(asListing),
    { excludedIds: cartIds, ownSellerId, limit: 10 },
  ), [cartIds, ownSellerId, recentItems]);
  const filteredSimilar = useMemo(() => filterRecommendations(
    similarItems.map(asListing),
    { excludedIds: cartIds, ownSellerId, limit: 10 },
  ), [cartIds, ownSellerId, similarItems]);

  useEffect(() => {
    let active = true;
    api.getFavorites()
      .then(({ items = [] }) => {
        if (active) {
          setSavedItems(items);
          setSavedError('');
        }
      })
      .catch((error) => {
        if (active) setSavedError(error.message || 'Saved listings could not be loaded.');
      });
    return () => { active = false; };
  }, [checkout.items.length]);

  useEffect(() => {
    let active = true;
    const request = cartIds.length
      ? api.getSimilarListings(cartIds)
      : api.getListings({ type: 'all', sort: 'top-rated', limit: 30 }).then((result) => result);
    request.then((result) => {
      if (active) {
        setSimilarItems(result.items || []);
        setRecommendationError('');
      }
    }).catch((error) => {
      if (active) setRecommendationError(error.message || 'Recommendations could not be loaded.');
    });
    return () => { active = false; };
  }, [cartIds.join(',')]);

  async function addListing(listing) {
    setAdding(true);
    setAddError('');
    checkout.clearError();
    try {
      await api.addCartItem(listing.type, String(listing.id || listing._id), {
        paymentOption: listing.paymentOptions?.escrow ? 'escrow' : 'direct',
      });
      await checkout.reload();
    } catch (error) {
      setAddError(error.message || 'We couldn’t add this listing. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  async function saveForLater(item) {
    await checkout.saveForLater(item);
    if (!checkout.error) {
      api.getFavorites()
        .then(({ items = [] }) => setSavedItems(items))
        .catch((error) => setSavedError(error.message || 'Saved listings could not be refreshed.'));
    }
  }

  if (checkout.loading) {
    return <div className="mx-auto max-w-7xl px-4 py-12" aria-busy="true"><p className="text-sm text-ink/55">Loading your cart…</p></div>;
  }

  const mainStep = checkout.step === 'confirmation'
    ? <ConfirmationStep confirmation={{ ...checkout.confirmation, contactItems: checkout.confirmation?.contactItems || checkout.items }} />
    : checkout.step === 'payment'
      ? <PaymentStep />
      : checkout.step === 'review'
        ? (
          <ReviewStep
            review={checkout.review}
            items={checkout.items}
            selectedOrders={checkout.selectedOrders}
            termsAccepted={checkout.termsAccepted}
            setTermsAccepted={checkout.setTermsAccepted}
            busy={checkout.busy}
            error={checkout.paymentMessage || checkout.error}
            onPaymentChoice={checkout.setPaymentChoice}
            onBack={() => checkout.setCurrentStep('cart')}
            onPay={checkout.pay}
          />
        )
        : null;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-9">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Escrit marketplace</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">{checkout.step === 'confirmation' ? 'Your purchase' : 'Shopping cart'}</h1>
        </div>
        {checkout.step === 'cart' && checkout.items.length > 0 && (
          <div role="group" aria-label="Cart item layout" className="hidden items-center gap-1 rounded-lg border border-line bg-paper-2 p-1 lg:flex">
            <button
              type="button"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-ink/65 hover:text-ink aria-pressed:bg-paper aria-pressed:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <List size={17} aria-hidden="true" /> List
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-ink/65 hover:text-ink aria-pressed:bg-paper aria-pressed:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <LayoutGrid size={17} aria-hidden="true" /> Grid
            </button>
          </div>
        )}
      </header>
      <CheckoutProgress step={checkout.step} />

      {checkout.step === 'payment' || checkout.step === 'review' || checkout.step === 'confirmation' ? (
        mainStep
      ) : (
        <>
          {checkout.error && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dispute/30 bg-dispute/5 p-3 text-sm" role="alert"><span>{checkout.error}</span><button type="button" onClick={checkout.reload} className="min-h-11 rounded-lg px-3 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Try again</button></div>}
          <p className="sr-only" aria-live="polite">{checkout.items.length ? `${checkout.items.length} listings in your cart.` : 'Your cart is empty.'}</p>

          {checkout.items.length ? (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="min-w-0 space-y-4">
                {groups.map((group) => (
                  <SellerGroup
                    key={group.sellerId}
                    group={group}
                    busy={checkout.busy}
                    viewMode={viewMode}
                    onUpdate={checkout.updateItem}
                    onRemove={checkout.removeItem}
                    onSaveForLater={saveForLater}
                  />
                ))}
              </div>
              <OrderSummary
                cart={checkout.cart}
                requiresAddress={checkout.requiresAddress}
                addressValid={checkout.addressValid}
                busy={checkout.busy}
                onAddressChange={checkout.updateAddress}
                onReview={checkout.reviewOrder}
              />
            </div>
          ) : (
            <section className="rounded-2xl border border-line bg-paper px-5 py-10 text-center sm:py-14">
              <h2 className="font-display text-2xl">Your cart is taking a little break.</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/65">Browse the marketplace and add something you love. Your saved and recently viewed listings are below.</p>
              <Link to="/marketplace" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Browse marketplace</Link>
            </section>
          )}

          {savedError && <p role="status" className="mt-5 text-sm text-seal">{savedError}</p>}
          {addError && <p role="alert" className="mt-3 text-sm text-dispute">{addError}</p>}
          <ProductRow title="Saved for later" items={filteredSaved} onAdd={addListing} busy={adding} />
          <ProductRow
            title={checkout.items.length ? 'Similar to items in your cart' : 'Top rated right now'}
            items={filteredSimilar}
            onAdd={addListing}
            busy={adding}
          />
          {recommendationError && <p role="status" className="mt-2 text-sm text-seal">{recommendationError}</p>}
          <ProductRow title="Recently viewed" items={filteredRecent} onAdd={addListing} busy={adding} />
        </>
      )}
    </main>
  );
}
