import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import SpotlightTour from '../../components/SpotlightTour.jsx';
import {
  BankIcon,
  CartIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CompassIcon,
  PriceOffersIcon,
  HeartIcon,
  HandshakeIcon,
  LinkIcon,
  PlusIcon,
  PromotionCreditsIcon,
  MyOrdersIcon,
  ShieldCheckIcon,
  UserIcon,
} from '../../components/icons.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';

const TOUR_STEPS = [
  {
    selector: '[data-tour="new-link"]',
    title: 'Create a payment link',
    body: 'One link per item. Share it anywhere, such as WhatsApp or an Instagram story. Buyers never need an account.',
  },
  {
    selector: '[data-tour="links-list"]',
    title: 'Every link, live',
    body: 'Track each order here: awaiting payment, held in escrow, released or disputed. It updates on its own.',
  },
  {
    selector: '[data-tour="bank-nav"]',
    title: 'Where your money lands',
    body: 'Payments are only ever released to the bank account you verified. You can change it any time from here.',
  },
];

const POLL_MS = 15000;

export default function Dashboard() {
  usePageTitle('Dashboard');
  const location = useLocation();
  const { hasBankAccount, seller } = useAuthContext();
  const canCreatePaymentLinks = hasBankAccount && seller?.kycStatus === 'verified';
  const [links, setLinks] = useState(null);
  const [linksError, setLinksError] = useState('');
  const [myListings, setMyListings] = useState(null);
  const [listingsError, setListingsError] = useState('');
  const [listingsState, setListingsState] = useState('loading');
  const [listingsAttempt, setListingsAttempt] = useState(0);
  const [listingUpdateError, setListingUpdateError] = useState('');
  const [updatingListingId, setUpdatingListingId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsState, setAnalyticsState] = useState('loading');
  const [analyticsAttempt, setAnalyticsAttempt] = useState(0);
  const [cartCount, setCartCount] = useState(null);
  const [cartError, setCartError] = useState('');
  const [serviceOffers, setServiceOffers] = useState(null);
  const [serviceOffersError, setServiceOffersError] = useState('');
  const [showEscrowPrompt, setShowEscrowPrompt] = useState(false);
  const [escrowPromptError, setEscrowPromptError] = useState('');

  useEffect(() => {
    let active = true;
    api.getEscrowRecipientPrompt()
      .then(({ show }) => {
        if (active) setShowEscrowPrompt(Boolean(show));
      })
      .catch((error) => {
        if (active) setEscrowPromptError(error.message || 'We couldn’t load your Escrit suggestions.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadLinks() {
      try {
        const data = await api.listLinks();
        if (active) {
          setLinks(data.links || []);
          setLinksError('');
        }
      } catch (err) {
        if (active) setLinksError(err.message || 'Unable to load payment links.');
      }
    }
    loadLinks();
    const timer = setInterval(loadLinks, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setListingsState('loading');
    setListingsError('');
    api.getMyListings()
      .then(({ listings }) => {
        if (!active) return;
        setMyListings(listings || []);
        setListingsState('success');
        setListingUpdateError('');
      })
      .catch((err) => {
        if (!active) return;
        setListingsError(err.message || 'Unable to load your listings.');
        setListingsState('error');
      });
    return () => { active = false; };
  }, [listingsAttempt]);

  useEffect(() => {
    let active = true;
    setAnalyticsState('loading');
    setAnalyticsError('');
    api.getSellerAnalytics()
      .then((data) => {
        if (!active) return;
        setAnalytics(data);
        setAnalyticsState('success');
      })
      .catch((err) => {
        if (!active) return;
        setAnalyticsError(err.message || 'Unable to load performance data.');
        setAnalyticsState('error');
      });
    return () => { active = false; };
  }, [analyticsAttempt]);

  useEffect(() => {
    let active = true;
    async function loadCart() {
      try {
        const { items = [] } = await api.getCart();
        if (active) {
          setCartCount(items.reduce((sum, entry) => sum + Number(entry.quantity || 1), 0));
          setCartError('');
        }
      } catch (err) {
        if (active) setCartError(err.message || 'Unable to load your cart.');
      }
    }
    loadCart();
    window.addEventListener('escrit:cart-updated', loadCart);
    return () => {
      active = false;
      window.removeEventListener('escrit:cart-updated', loadCart);
    };
  }, []);

  useEffect(() => {
    let active = true;
    api.listServiceOffers()
      .then(({ offers }) => {
        if (!active) return;
        setServiceOffers(offers || []);
        setServiceOffersError('');
      })
      .catch((err) => {
        if (!active) return;
        setServiceOffersError(err.message || 'Unable to load conversations.');
      });
    return () => { active = false; };
  }, []);

  async function toggleListing(listing) {
    setUpdatingListingId(String(listing._id));
    setListingUpdateError('');
    try {
      const { item } = await api.setMyListingActive(listing.listingType, listing._id, !listing.isActive);
      setMyListings((current) => current.map((entry) => entry._id === item._id
        ? { ...entry, isActive: item.isActive }
        : entry));
    } catch (err) {
      setListingUpdateError(err.message || 'Unable to update this listing.');
    } finally {
      setUpdatingListingId(null);
    }
  }

  const liveListings = myListings?.filter((item) => item.isActive && item.isVerified).length;
  const hasFirstListing = myListings?.length > 0 || links?.length > 0;
  const onboardingSteps = [
    {
      label: 'Verify identity',
      description: 'Confirm your identity to unlock account workflows.',
      to: '/settings',
      Icon: ShieldCheckIcon,
      complete: seller?.kycStatus === 'verified',
      status: seller?.kycStatus === 'verified'
        ? 'Verified'
        : seller?.kycStatus === 'rejected'
          ? 'Needs attention'
          : seller?.kycStatus === 'pending' ? 'Under review' : 'Not started',
    },
    {
      label: 'Add verified bank account',
      description: 'Choose where eligible seller payouts are sent.',
      to: '/dashboard/bank',
      Icon: BankIcon,
      complete: hasBankAccount,
      status: hasBankAccount ? 'Added' : 'Required',
    },
    {
      label: 'List something or create a payment link',
      description: 'Start with a marketplace listing or a shareable link.',
      to: myListings?.length ? '/account/list-product' : '/dashboard/new',
      Icon: PlusIcon,
      complete: Boolean(hasFirstListing),
      status: myListings === null || links === null ? 'Checking' : hasFirstListing ? 'Started' : 'Not started',
      unavailable: !hasFirstListing && ((listingsState === 'error' && myListings === null) || (linksError && links === null)),
    },
  ];
  const onboardingComplete = onboardingSteps.filter((step) => step.complete).length;
  const orderedListings = myListings
    ? [...myListings].sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))
    : [];
  const latestListing = orderedListings[0];
  const sellerConversations = (serviceOffers || []).filter((offer) => (
    String(offer.sellerId?._id || offer.sellerId) === String(seller?._id)
  ));
  const latestConversation = [...sellerConversations].sort((left, right) => (
    new Date(right.latestMessage?.createdAt || right.updatedAt || 0)
    - new Date(left.latestMessage?.createdAt || left.updatedAt || 0)
  ))[0];
  const unreadMessageCount = sellerConversations.reduce((sum, offer) => sum + Number(offer.unreadCount || 0), 0);
  const latestMessagePreview = latestConversation?.latestMessage
    ? latestConversation.latestMessage.body
      || latestConversation.latestMessage.offerEvent?.note
      || `Offer update: ${latestConversation.latestMessage.offerEvent?.action || 'new activity'}`
    : '';
  const serviceOffersDescription = serviceOffersError
    ? `Messages unavailable: ${serviceOffersError}`
    : serviceOffers === null
      ? 'Loading messages from buyers…'
      : latestMessagePreview || 'Messages from buyers';

  const linksForListing = (listing) => links?.find(({ link }) => (
    String(link.listingId) === String(listing._id)
    && (link.listingType || listing.listingType) === listing.listingType
  ));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-7 flex flex-col items-start justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="text-sm text-ink/55">Your account, at a glance</p>
          <h1 className="mt-1 break-words font-display text-2xl tracking-tight sm:text-3xl">
            Welcome back, {seller?.businessName || 'seller'}.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink/65">
            Your money, orders and account in one place.
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-auto">
          {canCreatePaymentLinks ? (
            <Link
              data-tour="new-link"
              to="/dashboard/new"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus active:translate-y-px motion-reduce:transition-none sm:w-auto"
            >
              <PlusIcon aria-hidden="true" width={17} height={17} />
              New payment link
            </Link>
          ) : (
            <button data-tour="new-link" type="button" disabled title="Verify your identity and bank account to create payment links" className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink opacity-50 sm:w-auto">
              <PlusIcon aria-hidden="true" width={17} height={17} />
              New payment link
            </button>
          )}
        </div>
      </header>

      {location.state?.listingSubmitted && (
        <p role="status" className="mb-6 rounded-lg border border-seal/30 bg-seal-soft/40 px-4 py-3 text-sm text-ink/75">
          Your listing was submitted for admin review. It will appear in the marketplace after approval.
        </p>
      )}
      {escrowPromptError && !showEscrowPrompt && (
        <p role="status" className="mb-6 rounded-lg border border-line px-4 py-3 text-sm text-ink/65">{escrowPromptError}</p>
      )}
      {showEscrowPrompt && (
        <section className="mb-7 rounded-2xl border border-line bg-paper-2 p-5 sm:p-6" aria-labelledby="escrow-recipient-prompt">
          <h2 id="escrow-recipient-prompt" className="font-display text-xl">Want to use Escrit for your own deals?</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" to="/dashboard/new">
              Create your own escrow link
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-paper px-5 text-sm font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" to="/marketplace">
              Shop the marketplace
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-paper px-5 text-sm font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" to="/account/list-product">
              Start selling on Escrit
            </Link>
          </div>
        </section>
      )}

      <section aria-labelledby="financial-summary-heading" className="mb-9">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="financial-summary-heading" className="font-display text-lg">Financial summary</h2>
          {analyticsState === 'loading' && <span className="text-xs text-ink/50" role="status">Loading balances…</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <FinancialSummaryCard
            label="Awaiting payment"
            value={analytics ? formatNaira(analytics.financialSummary?.awaitingPaymentKobo) : '—'}
            Icon={ClockIcon}
            detail="Checkout started; payment is not confirmed yet."
          />
          <FinancialSummaryCard
            label="Held in escrow"
            value={analytics ? formatNaira(analytics.financialSummary?.heldInEscrowKobo) : '—'}
            Icon={ShieldCheckIcon}
            detail="Paid orders waiting for the applicable release step."
          />
          <FinancialSummaryCard
            label="Paid out"
            value={analytics ? formatNaira(analytics.financialSummary?.paidOutKobo) : '—'}
            Icon={BankIcon}
            detail="Payouts confirmed as completed."
          />
        </div>
        <p className="mt-3 max-w-3xl text-xs leading-5 text-ink/55">
          Once delivery or service completion is marked, the buyer can confirm receipt and release escrow. A dispute pauses release.
        </p>
      </section>

      <section aria-labelledby="onboarding-heading" className="mb-9 rounded-xl border border-line bg-paper-2/50 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">A few steps to get started</p>
            <h2 id="onboarding-heading" className="mt-1 font-display text-lg">Get ready to sell</h2>
          </div>
          <p className="rounded-full border border-line px-3 py-1 text-sm font-semibold" aria-label={`${onboardingComplete} of 3 steps complete`}>
            {onboardingComplete}/3
          </p>
        </div>
        <ol className="grid gap-2 lg:grid-cols-3">
          {onboardingSteps.map((step, index) => (
            <li key={step.label}>
              <Link
                to={step.to}
                className={`group flex min-h-[5.25rem] items-center gap-3 rounded-lg border p-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus active:translate-y-px motion-reduce:transition-none ${
                  !step.complete && !step.unavailable
                    ? 'border-accent/35 bg-accent/5 hover:bg-accent/10'
                    : 'border-line bg-paper hover:border-line-strong'
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-ink/65" aria-hidden="true">
                  {step.complete ? <CheckIcon width={18} height={18} /> : <step.Icon width={18} height={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-medium">{index + 1}. {step.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-ink/55">{step.description}</span>
                </span>
                <span className="shrink-0 text-right text-[11px] font-medium text-ink/55">
                  {step.unavailable ? 'Unavailable' : step.complete ? 'Complete' : step.status}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <LatestListingsFeedback
        state={listingsState}
        error={listingsError}
        listing={latestListing}
        onRetry={() => setListingsAttempt((attempt) => attempt + 1)}
      />

      <DashboardSection title="Sell" description="Tools for your listings and payouts" className="mb-9">
        <div className="grid gap-3 sm:grid-cols-2">
          <DashboardActionCard to="/account/list-product" title="List a product" description="Add something to sell" Icon={PlusIcon} />
          <DashboardActionCard
            to="/dashboard/bank"
            title="Bank and payouts"
            description="Where your money goes"
            Icon={BankIcon}
            badge={!hasBankAccount ? 'Required' : null}
          />
          <DashboardActionCard to="/account/price-offers" title="Product price offers" description="Offers from buyers" Icon={PriceOffersIcon} />
          <DashboardActionCard
            to="/account/credits"
            title="Promotion credits"
            description={seller?.promoCreditsKobo > 0
              ? `${formatNaira(seller.promoCreditsKobo)} available to use`
              : 'Boost your listings'}
            Icon={PromotionCreditsIcon}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Buy" description="Keep track of the things you want and buy" className="mb-9">
        <div className="grid gap-3 sm:grid-cols-2">
          <DashboardActionCard to="/account/orders" title="Buyer orders" description="Things you bought" Icon={MyOrdersIcon} />
          <DashboardActionCard
            to="/account/cart"
            title="Shopping cart"
            description={cartError
              ? `Cart unavailable: ${cartError}`
              : cartCount === null
                ? 'Your saved items, ready for checkout'
                : `${cartCount} ${cartCount === 1 ? 'item' : 'items'} in your cart`}
            Icon={CartIcon}
            badge={cartCount === null && cartError ? 'Unavailable' : null}
            badgeTone="attention"
          />
          <DashboardActionCard to="/account/favorites" title="Saved listings" description="Your wishlist" Icon={HeartIcon} />
        </div>
      </DashboardSection>

      <DashboardSection title="Talk & verify" description="Messages, account details and identity" className="mb-9">
        <div className="grid gap-3 sm:grid-cols-2">
          <DashboardActionCard
            to={latestConversation ? `/account/offers/${latestConversation._id}` : '/account/offers'}
            title="Service offers and chat"
            description={serviceOffersDescription}
            Icon={HandshakeIcon}
            badge={unreadMessageCount > 0 ? `${unreadMessageCount} unread` : serviceOffersError ? 'Unavailable' : null}
            badgeTone={unreadMessageCount > 0 ? 'attention' : 'neutral'}
          />
          <DashboardActionCard
            to="/settings"
            title="Profile and KYC"
            description={seller?.kycStatus === 'verified' ? 'Your identity is verified' : 'Review identity details and next steps'}
            Icon={UserIcon}
            badge={seller?.kycStatus === 'verified' ? 'Verified' : seller?.kycStatus === 'rejected' ? 'Needs attention' : 'Pending'}
          />
        </div>
      </DashboardSection>

      <section aria-labelledby="performance-heading" className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="performance-heading" className="font-display text-lg">Performance</h2>
            <p className="mt-1 text-xs text-ink/55">Order activity and gross paid · last 30 days</p>
          </div>
          {analyticsState === 'error' && (
            <button
              type="button"
              onClick={() => setAnalyticsAttempt((attempt) => attempt + 1)}
              className="min-h-10 rounded-lg border border-line px-3 text-sm font-medium hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus active:translate-y-px"
            >
              Retry performance
            </button>
          )}
        </div>
        {analyticsState === 'error' && (
          <p role="alert" className="mb-3 rounded-lg border border-dispute/30 bg-dispute-soft/30 px-3 py-2 text-sm text-ink/75">
            Performance data could not be loaded. {analyticsError}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <PerformanceMetric
            label="Live listings"
            value={myListings === null ? '—' : liveListings}
            detail="Current"
            loading={listingsState === 'loading' && myListings === null}
          />
          <PerformanceMetric
            label="Orders"
            value={analytics?.last30Days?.orders ?? '—'}
            detail="Created in the last 30 days"
            loading={analyticsState === 'loading'}
          />
          <PerformanceMetric
            label="Gross paid"
            value={analytics ? formatNaira(analytics.last30Days?.grossPaidKobo) : '—'}
            detail="Confirmed payments in the last 30 days"
            loading={analyticsState === 'loading'}
          />
          <PerformanceMetric
            label="Open disputes"
            value={analytics?.disputedOrders ?? '—'}
            detail="Current"
            loading={analyticsState === 'loading'}
          />
        </div>
        <p className="mt-2 text-[11px] leading-5 text-ink/45">
          Live listings and open disputes are current totals; orders and gross paid use the 30-day period.
        </p>
      </section>

      <section id="my-marketplace-listings" aria-labelledby="my-listings-heading" className="mb-10 scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="my-listings-heading" className="font-display text-lg">My marketplace listings</h2>
            <p className="mt-1 text-xs text-ink/55">
              {myListings === null ? 'Your current products, courses and services' : `${liveListings} live ${liveListings === 1 ? 'listing' : 'listings'}`}
            </p>
          </div>
          <Link to="/account/list-product" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium transition-colors hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            <PlusIcon aria-hidden="true" width={15} height={15} /> List another
          </Link>
        </div>

        {listingsState === 'loading' && myListings === null && <LoadingRows label="Loading your marketplace listings" />}
        {listingsState === 'error' && myListings === null && (
          <ErrorState message="Your listings are unavailable right now." detail={listingsError} />
        )}
        {listingUpdateError && <ErrorState message="Unable to update the listing." detail={listingUpdateError} />}
        {listingsState === 'success' && myListings?.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong px-4 py-7 text-center">
            <p className="font-medium">Your marketplace is ready for its first listing.</p>
            <p className="mt-1 text-sm text-ink/55">Add a product, course or service to get started.</p>
            <Link to="/account/list-product" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
              Create your first listing
            </Link>
          </div>
        )}
        {orderedListings.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {orderedListings.map((item) => (
              <MarketplaceListingRow
                key={`${item.listingType}:${item._id}`}
                listing={item}
                linkedOrder={linksForListing(item)}
                linksLoading={links === null && !linksError}
                linksUnavailable={Boolean(linksError && links === null)}
                isUpdating={updatingListingId === String(item._id)}
                onToggle={() => toggleListing(item)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="payment-links-heading" className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="payment-links-heading" className="font-display text-lg">Payment links</h2>
            <p className="mt-1 text-xs text-ink/55">Share a link and follow each order through payment and fulfillment.</p>
          </div>
          <Link to="/dashboard/new" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium transition-colors hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            <PlusIcon aria-hidden="true" width={15} height={15} /> Create link
          </Link>
        </div>
        {linksError && (
          <p role="alert" className="mb-3 rounded-lg border border-dispute/30 bg-dispute-soft/30 px-3 py-2 text-sm text-ink/75">
            Payment links could not be refreshed. {linksError}
          </p>
        )}
        {!links && !linksError && <LoadingRows label="Loading your payment links" />}
        {links?.length === 0 && (
          <div data-tour="links-list" className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center">
            <ShieldCheckIcon aria-hidden="true" className="mx-auto mb-2 text-ink/40" width={25} height={25} />
            <p className="text-sm text-ink/70">No payment links yet. Create one to get paid safely by someone who has never met you.</p>
          </div>
        )}
        {links?.length > 0 && (
          <ul data-tour="links-list" className="space-y-2">
            {links.map(({ link, transactionCounts }) => (
              <li key={link._id}>
                <Link
                  to={`/dashboard/links/${link._id}`}
                  className="group flex min-h-[4.5rem] items-center justify-between gap-3 rounded-xl border border-line bg-paper p-3 transition-colors hover:border-line-strong hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus active:translate-y-px motion-reduce:transition-none sm:p-4"
                >
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium group-hover:underline">{link.itemName}</span>
                    <span className="mt-1 block text-sm font-mono text-ink/60">
                      {formatNaira(link.priceKobo)}{!link.active && <span className="font-sans text-ink/45"> · inactive</span>}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <TransactionCountsSummary counts={transactionCounts} />
                    <ChevronRightIcon aria-hidden="true" className="text-ink/35" width={16} height={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SpotlightTour storageKey="escrit_seller_tour" userId={seller?._id} steps={TOUR_STEPS} active={links !== null} />
    </div>
  );
}

function FinancialSummaryCard({ label, value, Icon, detail }) {
  return (
    <article className="min-h-32 rounded-xl border border-line bg-paper p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-ink/55">
        <Icon aria-hidden="true" width={16} height={16} />
        <span>{label}</span>
      </div>
      <p className="mt-3 break-words font-display text-2xl tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-ink/50">{detail}</p>
    </article>
  );
}

function DashboardSection({ title, description, className, children }) {
  return (
    <section className={className} aria-labelledby={`section-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
      <div className="mb-3">
        <h2 id={`section-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`} className="font-display text-lg">{title}</h2>
        <p className="mt-1 text-xs text-ink/55">{description}</p>
      </div>
      {children}
    </section>
  );
}

function DashboardActionCard({ to, title, description, Icon, badge, badgeTone = 'neutral' }) {
  return (
    <Link
      to={to}
      className="group flex min-h-28 items-start gap-3 rounded-xl border border-line bg-paper p-4 transition-colors hover:border-line-strong hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus active:translate-y-px motion-reduce:transition-none"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-2 text-accent" aria-hidden="true">
        <Icon width={19} height={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="break-words text-sm font-semibold">{title}</span>
          {badge && <StatusBadge label={badge} tone={badgeTone} />}
        </span>
        <span className="mt-1 block break-words text-xs leading-5 text-ink/55">{description}</span>
      </span>
      <ChevronRightIcon aria-hidden="true" className="mt-1 shrink-0 text-ink/35 transition-transform group-hover:translate-x-0.5" width={16} height={16} />
    </Link>
  );
}

function StatusBadge({ label, tone = 'neutral' }) {
  const toneClass = tone === 'attention'
    ? 'border-dispute/30 bg-dispute-soft/30 text-dispute'
    : tone === 'success'
      ? 'border-released/30 bg-released-soft/30 text-released'
      : 'border-line bg-paper-2 text-ink/60';
  return <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>{label}</span>;
}

function LatestListingsFeedback({ state, error, listing, onRetry }) {
  return (
    <section aria-labelledby="latest-listing-feedback-heading" className="mb-9">
      <div className="mb-2">
        <h2 id="latest-listing-feedback-heading" className="font-display text-base">Latest listings</h2>
      </div>
      {state === 'loading' && (
        <div className="flex min-h-14 items-center gap-3 rounded-lg border border-line px-4 text-sm text-ink/55" role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none" aria-hidden="true" />
          {listing ? 'Refreshing your latest listings…' : 'Checking your latest listings…'}
        </div>
      )}
      {state === 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dispute/30 bg-dispute-soft/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Couldn’t load your latest listings. Nothing was lost.</p>
            {error && <p className="mt-1 break-words text-xs text-ink/55">{error}</p>}
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-10 shrink-0 rounded-lg border border-line px-3 text-sm font-medium transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus active:translate-y-px"
          >
            Retry
          </button>
        </div>
      )}
      {state === 'success' && !listing && (
        <p className="rounded-lg border border-line px-4 py-3 text-sm text-ink/55">
          No listings yet. Your first one will appear here after you create it.
        </p>
      )}
      {state === 'success' && listing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper-2 text-ink/55" aria-hidden="true">
              <CompassIcon width={17} height={17} />
            </span>
            <span className="min-w-0">
              <span className="block break-words text-sm font-medium">{listing.title}</span>
              <span className="mt-0.5 block text-xs text-ink/55">{listingStatus(listing)}</span>
            </span>
          </div>
          <a href="#my-marketplace-listings" className="min-h-10 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            View listings <ChevronRightIcon aria-hidden="true" width={15} height={15} />
          </a>
        </div>
      )}
    </section>
  );
}

function PerformanceMetric({ label, value, detail, loading }) {
  return (
    <article className="flex min-h-28 min-w-0 flex-col justify-between rounded-xl border border-line bg-paper p-3 sm:p-4">
      <p className="text-xs font-medium text-ink/55">{label}</p>
      <p className="my-2 break-words font-display text-xl tracking-tight sm:text-2xl" aria-live={loading ? 'polite' : undefined}>
        {loading ? <span className="text-base text-ink/45">Loading…</span> : value}
      </p>
      <p className="break-words text-[10px] leading-4 text-ink/45">{detail}</p>
    </article>
  );
}

function MarketplaceListingRow({ listing, linkedOrder, linksLoading, linksUnavailable, isUpdating, onToggle }) {
  const isPublic = listing.isVerified && listing.isActive;
  const detailPath = `/marketplace/${listing.listingType}/${listing._id}`;
  const priceNaira = listing.price ?? listing.basePrice;
  const formattedPrice = priceNaira == null || !Number.isFinite(Number(priceNaira))
    ? '—'
    : `₦${Number(priceNaira).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
  const orderSummary = linksUnavailable
    ? 'Order status unavailable'
    : linksLoading
      ? 'Loading order status…'
    : linkedOrder
      ? <TransactionCountsSummary counts={linkedOrder.transactionCounts} />
      : 'No orders yet';

  const content = (
    <>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper-2 text-ink/35" aria-hidden="true">
        {listing.images?.[0] || listing.itemPhotoUrl
          ? <img src={listing.images?.[0] || listing.itemPhotoUrl} alt="" className="h-full w-full object-cover" />
          : <CompassIcon width={20} height={20} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-medium">{listing.title}</span>
        <span className="mt-1 block text-xs text-ink/55">
          {listing.listingType} · {formattedPrice}
        </span>
      </span>
      <span className="max-w-[42%] shrink-0 text-right text-xs leading-5 text-ink/55">
        <span className="mb-1 block"><StatusBadge label={listingStatus(listing)} tone={isPublic ? 'success' : listing.isVerified ? 'neutral' : 'attention'} /></span>
        <span className="break-words">{orderSummary}</span>
      </span>
    </>
  );

  return (
    <li className="flex items-center gap-3 p-3 sm:p-4">
      {isPublic ? (
        <Link
          to={detailPath}
          aria-label={`Open listing details for ${listing.title}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
      )}
      {listing.isVerified && (
        <button
          type="button"
          onClick={onToggle}
          disabled={isUpdating}
          aria-label={`${listing.isActive ? 'Pause' : 'Reactivate'} ${listing.title}`}
          className="min-h-10 shrink-0 rounded-lg border border-line px-2.5 text-xs font-medium transition-colors hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus active:translate-y-px disabled:opacity-50 sm:px-3"
        >
          {isUpdating ? 'Updating…' : listing.isActive ? 'Pause' : 'Reactivate'}
        </button>
      )}
    </li>
  );
}

function listingStatus(listing) {
  if (listing.isVerified && listing.isActive) return 'Live';
  if (listing.isVerified) return 'Paused';
  if (listing.reviewStatus === 'rejected' || listing.categoryReviewStatus === 'rejected') return 'Needs changes';
  return 'Pending review';
}

function LoadingRows({ label }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label={label}>
      {[0, 1].map((row) => <div key={row} className="skeleton h-[4.5rem] rounded-xl" />)}
    </div>
  );
}

function ErrorState({ message, detail }) {
  return (
    <p role="alert" className="rounded-lg border border-dispute/30 bg-dispute-soft/20 px-4 py-3 text-sm text-ink/75">
      {message} {detail}
    </p>
  );
}

function formatNaira(kobo) {
  if (kobo == null || !Number.isFinite(Number(kobo))) return '—';
  return `₦${(Number(kobo) / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function TransactionCountsSummary({ counts = {} }) {
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  if (total === 0) return <span>No orders yet</span>;

  const resolved = (counts.RESOLVED_RELEASED || 0) + (counts.RESOLVED_REFUNDED || 0) + (counts.RESOLVED_CREDITED || 0);
  const parts = [
    counts.PAID_HELD > 0 && `${counts.PAID_HELD} held`,
    counts.DISPUTED > 0 && `${counts.DISPUTED} disputed`,
    counts.CREATED > 0 && `${counts.CREATED} awaiting`,
    counts.RELEASED > 0 && `${counts.RELEASED} released`,
    resolved > 0 && `${resolved} resolved`,
  ].filter(Boolean);
  return <span>{parts.join(' · ')}</span>;
}
