import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  Sparkles,
  TrendingUp,
  Gift,
  History,
  Copy,
  Check,
  Share2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Calendar,
  ChevronRight,
  Plus,
  Tag,
  Clock,
  Award,
  ArrowUpRight,
  Rocket,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { usePageTitle } from '../../lib/usePageTitle.js';

function formatNaira(kobo = 0) {
  return `₦${(Number(kobo || 0) / 100).toLocaleString()}`;
}

export default function PlatformCredits() {
  usePageTitle('Promotion credits');
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary data state
  const [data, setData] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('promote'); // 'promote' | 'buy' | 'referrals' | 'history'

  // Buy Credits state
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('paystack');
  const [buyBusy, setBuyBusy] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Promote Listing state
  const [selectedListingId, setSelectedListingId] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(7);
  const [selectedPerk, setSelectedPerk] = useState('promote'); // 'promote' | 'feature'
  const [startDateChoice, setStartDateChoice] = useState('now'); // 'now' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [campaignTab, setCampaignTab] = useState('active'); // 'active' | 'scheduled' | 'completed' | 'all'
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [showConfirmPromoteModal, setShowConfirmPromoteModal] = useState(false);

  // Referral state
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // History state
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'purchased' | 'earned' | 'spent'

  // Load credits summary and seller listings
  async function loadData() {
    try {
      setError('');
      const [creditsRes, listingsRes] = await Promise.all([
        api.getPlatformCredits(),
        api.getMyListings(),
      ]);
      setData(creditsRes);

      const verified = (listingsRes.listings || []).filter((l) => l.isVerified);
      setListings(verified);
      if (verified.length > 0 && !selectedListingId) {
        setSelectedListingId(verified[0]._id);
      }
    } catch (err) {
      setError(err.message || 'Unable to load promotion credits information.');
    } finally {
      setLoading(false);
    }
  }

  // Handle callback verification on page load if coming from payment provider
  useEffect(() => {
    const verifyRef = searchParams.get('verify_ref') || searchParams.get('reference') || searchParams.get('trxref');
    if (verifyRef) {
      setVerifyingPayment(true);
      api.verifyCreditPurchase(verifyRef)
        .then((res) => {
          setToast({
            type: 'success',
            message: res.alreadyCompleted
              ? 'Payment was already verified. Your credit balance is up to date.'
              : `Payment confirmed! ${res.creditsAdded || res.credits || ''} Promotion Credits added to your balance.`,
          });
          loadData();
        })
        .catch((err) => {
          setToast({
            type: 'error',
            message: err.message || 'We could not verify your payment. If you were debited, please contact support.',
          });
          loadData();
        })
        .finally(() => {
          setVerifyingPayment(false);
          searchParams.delete('verify_ref');
          searchParams.delete('reference');
          searchParams.delete('trxref');
          setSearchParams(searchParams, { replace: true });
        });
    } else {
      loadData();
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Packages configured by the backend
  const packages = useMemo(() => {
    if (data?.packages && data.packages.length > 0) return data.packages;
    return [
      { id: 'starter', name: 'Starter', credits: 50, priceKobo: 500000, bonusText: 'Standard rate', popular: false },
      { id: 'growth', name: 'Growth', credits: 120, priceKobo: 1000000, bonusText: 'Save 17% · 20 bonus credits', popular: true },
      { id: 'business', name: 'Business', credits: 300, priceKobo: 2250000, bonusText: 'Save 25% · Best value', popular: false },
    ];
  }, [data]);

  // Pricing configuration for durations
  const pricingOptions = useMemo(() => {
    if (data?.promotionPricing && data.promotionPricing.length > 0) return data.promotionPricing;
    return [
      { days: 3, label: '3 days', promoteCredits: 15, featureCredits: 25 },
      { days: 7, label: '7 days', promoteCredits: 30, featureCredits: 50 },
      { days: 14, label: '14 days', promoteCredits: 55, featureCredits: 90 },
      { days: 30, label: '30 days', promoteCredits: 100, featureCredits: 160 },
    ];
  }, [data]);

  const currentListing = useMemo(() => {
    return listings.find((l) => l._id === selectedListingId) || null;
  }, [listings, selectedListingId]);

  const currentPromotionCost = useMemo(() => {
    const option = pricingOptions.find((p) => p.days === Number(selectedDuration));
    if (option) {
      return selectedPerk === 'feature' ? option.featureCredits : option.promoteCredits;
    }
    return selectedPerk === 'feature' ? selectedDuration * 8 : selectedDuration * 5;
  }, [pricingOptions, selectedDuration, selectedPerk]);

  const availableCredits = data?.stats?.availableCredits ?? (data?.balanceCredits ?? 0);
  const hasEnoughCredits = availableCredits >= currentPromotionCost;

  const filteredCampaigns = useMemo(() => {
    const list = data?.campaigns || [];
    if (campaignTab === 'all') return list;
    return list.filter((c) => c.status === campaignTab);
  }, [data?.campaigns, campaignTab]);

  const filteredEntries = useMemo(() => {
    const entries = data?.entries || [];
    if (historyFilter === 'all') return entries;
    return entries.filter((e) => e.type === historyFilter);
  }, [data?.entries, historyFilter]);

  async function handleProceedToPayment() {
    if (!selectedPackage) return;
    setBuyBusy(true);
    setError('');
    try {
      const res = await api.buyPlatformCredits({
        packageId: selectedPackage.id,
        paymentProvider: selectedProvider,
      });

      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      } else {
        throw new Error('Unable to initialize payment authorization URL.');
      }
    } catch (err) {
      setError(err.message || 'Payment initialization failed. Please try again.');
      setBuyBusy(false);
      setShowBuyModal(false);
    }
  }

  async function handleConfirmPromote() {
    if (!currentListing) return;
    setPromoteBusy(true);
    setError('');
    try {
      const payload = {
        listingType: currentListing.listingType,
        listingId: currentListing._id,
        packageType: selectedPerk,
        durationDays: Number(selectedDuration),
        ...(startDateChoice === 'custom' && customStartDate ? { startDate: new Date(customStartDate).toISOString() } : {}),
      };

      await api.promoteListingWithCredits(payload);
      setShowConfirmPromoteModal(false);
      setToast({
        type: 'success',
        message: `Campaign created! "${currentListing.title}" is now set for ${selectedPerk === 'feature' ? 'Featured placement' : 'Marketplace boost'}.`,
      });
      await loadData();
    } catch (err) {
      setError(err.message || 'Unable to launch promotion campaign.');
    } finally {
      setPromoteBusy(false);
    }
  }

  function handleCopyReferralLink() {
    if (!data?.referral?.link) return;
    navigator.clipboard.writeText(data.referral.link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  function handleCopyReferralCode() {
    if (!data?.referral?.code) return;
    navigator.clipboard.writeText(data.referral.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  }

  return (
    <div className="w-full pb-16">
      {/* Toast Notifications */}
      {toast && (
        <div
          role="status"
          className={`mb-5 flex items-center justify-between gap-3 rounded-xl border p-4 text-sm transition-all ${
            toast.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-dispute/40 bg-dispute-soft text-dispute'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? <Check className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5" />}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-xs uppercase tracking-wider opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div role="alert" className="mb-5 flex items-center gap-2.5 rounded-xl border border-dispute/40 bg-dispute-soft p-4 text-sm text-dispute">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Payment Verification Banner */}
      {verifyingPayment && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-accent">
          <Clock className="h-5 w-5 animate-spin shrink-0" />
          <span>Verifying credit package payment with your payment provider. Please hold on…</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* MOBILE PORTRAIT VIEW HEADER (< lg)                        */}
      {/* ======================================================== */}
      <div className="lg:hidden mb-6">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink/50">Seller tools</span>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink/70"
          >
            Hub <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Promotion credits</h1>
        <p className="mt-1 text-xs text-ink/65 leading-relaxed">
          Boost your listings to gain top visibility across Escrit.
        </p>

        {/* Mobile Portrait Hero Balance Card */}
        <div className="mt-4 rounded-2xl border border-line bg-paper-2 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Available Credits
            </span>
            <span className="font-mono text-xs text-ink/50">
              {formatNaira(data?.balanceKobo || availableCredits * 10000)}
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-extrabold text-ink">
              {loading ? '—' : availableCredits.toLocaleString()}
            </span>
            <span className="text-sm font-semibold text-ink/60">Credits</span>
          </div>

          {/* Stats Bar */}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line/60 pt-3 text-center">
            <div>
              <p className="text-[10px] uppercase text-ink/50">Purchased</p>
              <p className="mt-0.5 font-mono text-xs font-bold text-ink">
                {loading ? '—' : (data?.stats?.purchasedCredits ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-ink/50">Earned</p>
              <p className="mt-0.5 font-mono text-xs font-bold text-emerald-400">
                +{loading ? '—' : (data?.stats?.earnedCredits ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-ink/50">Spent</p>
              <p className="mt-0.5 font-mono text-xs font-bold text-ink/70">
                {loading ? '—' : (data?.stats?.spentCredits ?? 0)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedPackage(packages[1] || packages[0]);
              setShowBuyModal(true);
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Buy credits
          </button>
        </div>

        {/* Mobile Navigation Pills */}
        <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'promote', label: 'Promote', icon: TrendingUp },
            { id: 'buy', label: 'Packages', icon: CreditCard },
            { id: 'referrals', label: 'Referrals', icon: Gift },
            { id: 'history', label: 'History', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors ${
                  active
                    ? 'border-accent bg-accent/15 text-accent font-semibold ring-1 ring-accent/30'
                    : 'border-line bg-paper-2 text-ink/65 hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* DESKTOP LANDSCAPE WORKBENCH LAYOUT (lg: and above)        */}
      {/* ======================================================== */}
      <div className="flex flex-col lg:flex-row items-start gap-8">
        
        {/* DESKTOP LEFT SIDEBAR: Landscape Control Center */}
        <aside className="hidden lg:block lg:w-[380px] xl:w-[410px] shrink-0 sticky top-6 self-start space-y-6">
          {/* Main Available Balance Hero */}
          <div className="rounded-2xl border border-line bg-paper-2 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Available balance
              </span>
              <span className="rounded-md bg-paper px-2 py-0.5 font-mono text-[11px] font-medium text-ink/60">
                Escrit Credits
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="font-mono text-5xl font-extrabold text-ink">
                {loading ? '—' : availableCredits.toLocaleString()}
              </span>
              <span className="text-base font-semibold text-ink/60">Credits</span>
            </div>

            <p className="mt-1 text-xs text-ink/50">
              Equivalent NGN value: {loading ? '—' : formatNaira(data?.balanceKobo || availableCredits * 10000)}
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedPackage(packages[1] || packages[0]);
                  setShowBuyModal(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink shadow-sm hover:brightness-110 active:scale-[0.99] transition-all"
              >
                <Plus className="h-4 w-4" />
                Buy promotion credits
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('promote')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-paper-3 transition-colors"
              >
                <Rocket className="h-4 w-4 text-accent" />
                Launch a campaign
              </button>
            </div>
          </div>

          {/* Purchased, Earned, Spent 3-Stat Breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-paper-2 p-3.5">
              <span className="text-[10px] uppercase tracking-wider text-ink/50">Purchased</span>
              <p className="mt-1.5 font-mono text-xl font-bold text-ink">
                {loading ? '—' : (data?.stats?.purchasedCredits ?? 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-ink/40">Packages</p>
            </div>

            <div className="rounded-xl border border-line bg-paper-2 p-3.5">
              <span className="text-[10px] uppercase tracking-wider text-ink/50">Earned</span>
              <p className="mt-1.5 font-mono text-xl font-bold text-emerald-400">
                +{loading ? '—' : (data?.stats?.earnedCredits ?? 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-ink/40">Referrals</p>
            </div>

            <div className="rounded-xl border border-line bg-paper-2 p-3.5">
              <span className="text-[10px] uppercase tracking-wider text-ink/50">Spent</span>
              <p className="mt-1.5 font-mono text-xl font-bold text-ink/70">
                {loading ? '—' : (data?.stats?.spentCredits ?? 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-ink/40">Promotions</p>
            </div>
          </div>

          {/* Persistent Desktop Referral Box */}
          <div className="rounded-2xl border border-line bg-paper-2 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink/60">
                <Gift className="h-3.5 w-3.5 text-accent" />
                Refer &amp; Earn 25 Credits
              </span>
              <span className="font-mono text-xs font-bold text-emerald-400">
                +{data?.referral?.totalEarnedCredits || 0} earned
              </span>
            </div>

            <p className="text-xs text-ink/65 leading-relaxed">
              Earn 25 credits every time a seller registers with your link and makes their first credit purchase.
            </p>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-ink/50">Referral Code:</span>
                <span className="font-mono font-bold text-accent">{data?.referral?.code || '—'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={data?.referral?.link || ''}
                  className="w-full truncate rounded-lg border border-line bg-input px-2.5 py-1.5 font-mono text-[11px] text-ink/80 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyReferralLink}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-surface border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-paper-3 transition-colors"
                >
                  {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-line/50 text-[11px]">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Join me on Escrit marketplace with escrow protection: ${data?.referral?.link}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-surface py-1.5 text-ink hover:bg-paper-3"
              >
                <Share2 className="h-3 w-3 text-emerald-400" /> WhatsApp
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Sell products, services, and courses on Escrit: ${data?.referral?.link}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-surface py-1.5 text-ink hover:bg-paper-3"
              >
                <ExternalLink className="h-3 w-3 text-sky-400" /> Twitter
              </a>
            </div>
          </div>

          {/* Quick Guide */}
          <div className="rounded-xl border border-line bg-surface/40 p-4 text-xs text-ink/50 space-y-2">
            <p className="font-semibold text-ink/70">Promotion Placement Types:</p>
            <p><strong>Marketplace Boost:</strong> Prioritizes listing in search results and relevant category grids.</p>
            <p><strong>Featured Placement:</strong> Puts listing in high-traffic spotlight banners and carousel placement.</p>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* DESKTOP RIGHT AREA: Primary Landscape Workspace          */}
        {/* ======================================================== */}
        <main className="flex-1 min-w-0 space-y-6">
          
          {/* Desktop Landscape Header & Tabs */}
          <div className="hidden lg:block border-b border-line pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Seller tools · Visibility engine</p>
                <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Promotion credits</h1>
                <p className="mt-1 text-sm text-ink/65">
                  Promote products, courses, and services for maximum exposure and conversions.
                </p>
              </div>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/75 hover:bg-paper-2 hover:text-ink transition-colors"
              >
                Back to dashboard
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Desktop Landscape Tab Navigation */}
            <div className="mt-6 flex space-x-2">
              {[
                { id: 'promote', label: 'Promote Listings', icon: TrendingUp, count: data?.activeCampaignsCount },
                { id: 'buy', label: 'Buy Credit Packages', icon: CreditCard },
                { id: 'referrals', label: 'Referral Rewards', icon: Gift, count: data?.referral?.referrals?.length },
                { id: 'history', label: 'Credit Ledger', icon: History, count: data?.entries?.length },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? 'bg-accent text-accent-ink font-semibold shadow-sm'
                        : 'border border-line bg-paper-2 text-ink/65 hover:bg-paper-3 hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-mono ${
                          active ? 'bg-accent-ink/20 text-accent-ink font-bold' : 'bg-surface text-ink/60'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ======================================================== */}
          {/* TAB 1: PROMOTE LISTINGS (LANDSCAPE WORKBENCH)            */}
          {/* ======================================================== */}
          {activeTab === 'promote' && (
            <div className="space-y-8">
              {/* Promotion Creator Landscape Form */}
              <div className="rounded-2xl border border-line bg-paper-2 p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div>
                    <h2 className="font-display text-xl font-bold text-ink flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-accent" />
                      Create a promotion campaign
                    </h2>
                    <p className="mt-0.5 text-xs text-ink/60">
                      Select any of your verified products, courses, or services and configure your placement.
                    </p>
                  </div>
                  <span className="hidden sm:inline-block rounded-md bg-accent/10 px-2.5 py-1 text-xs font-mono font-semibold text-accent">
                    Balance: {availableCredits} Credits
                  </span>
                </div>

                {listings.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-line bg-surface p-8 text-center">
                    <p className="text-sm font-semibold text-ink">No verified listings available to promote</p>
                    <p className="mt-1 text-xs text-ink/55 max-w-sm mx-auto">
                      Only verified products, courses, and services can be promoted. Complete verification on your listings to boost them.
                    </p>
                    <Link
                      to="/listings/new"
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:brightness-110"
                    >
                      Create a new listing
                    </Link>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
                    {/* Left Form Controls */}
                    <div className="space-y-5">
                      {/* 1. Select Listing */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-ink/65 mb-1.5">
                          1. Select verified listing
                        </label>
                        <select
                          value={selectedListingId}
                          onChange={(e) => setSelectedListingId(e.target.value)}
                          className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                        >
                          {listings.map((item) => (
                            <option key={item._id} value={item._id}>
                              [{item.listingType?.toUpperCase()}] {item.title} ({formatNaira(item.priceKobo || (item.price ? item.price * 100 : 0))})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Choose Placement */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-ink/65 mb-1.5">
                          2. Placement tier
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedPerk('promote')}
                            className={`rounded-xl border p-3.5 text-left transition-all ${
                              selectedPerk === 'promote'
                                ? 'border-accent bg-accent/15 text-ink ring-1 ring-accent/30'
                                : 'border-line bg-surface text-ink/70 hover:border-line-strong'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">Marketplace Boost</span>
                              {selectedPerk === 'promote' && <CheckCircle2 className="h-4 w-4 text-accent" />}
                            </div>
                            <p className="mt-1 text-xs text-ink/50 leading-relaxed">Top ranking in search &amp; marketplace filters</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedPerk('feature')}
                            className={`rounded-xl border p-3.5 text-left transition-all ${
                              selectedPerk === 'feature'
                                ? 'border-accent bg-accent/15 text-ink ring-1 ring-accent/30'
                                : 'border-line bg-surface text-ink/70 hover:border-line-strong'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm flex items-center gap-1.5">
                                <Award className="h-4 w-4 text-ochre" />
                                Featured Spot
                              </span>
                              {selectedPerk === 'feature' && <CheckCircle2 className="h-4 w-4 text-accent" />}
                            </div>
                            <p className="mt-1 text-xs text-ink/50 leading-relaxed">Prime homepage carousel &amp; spotlight badge</p>
                          </button>
                        </div>
                      </div>

                      {/* 3. Duration Selector */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-ink/65 mb-1.5">
                          3. Campaign duration
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {pricingOptions.map((opt) => {
                            const isSelected = Number(selectedDuration) === opt.days;
                            const cost = selectedPerk === 'feature' ? opt.featureCredits : opt.promoteCredits;
                            return (
                              <button
                                key={opt.days}
                                type="button"
                                onClick={() => setSelectedDuration(opt.days)}
                                className={`rounded-xl border p-3 text-center transition-all ${
                                  isSelected
                                    ? 'border-accent bg-accent/15 text-accent font-semibold ring-1 ring-accent/30'
                                    : 'border-line bg-surface text-ink/75 hover:border-line-strong'
                                }`}
                              >
                                <p className="text-sm font-medium">{opt.label}</p>
                                <p className="mt-1 font-mono text-xs font-bold">{cost} Credits</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4. Scheduling */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-ink/65 mb-1.5">
                          4. Start timing
                        </label>
                        <div className="flex flex-wrap items-center gap-5 text-sm">
                          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium">
                            <input
                              type="radio"
                              name="startChoice"
                              value="now"
                              checked={startDateChoice === 'now'}
                              onChange={() => setStartDateChoice('now')}
                              className="accent-accent"
                            />
                            <span>Start immediately upon confirmation</span>
                          </label>
                          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium">
                            <input
                              type="radio"
                              name="startChoice"
                              value="custom"
                              checked={startDateChoice === 'custom'}
                              onChange={() => setStartDateChoice('custom')}
                              className="accent-accent"
                            />
                            <span>Schedule for future date</span>
                          </label>
                        </div>
                        {startDateChoice === 'custom' && (
                          <input
                            type="datetime-local"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="mt-2.5 rounded-xl border border-line bg-input px-3.5 py-2 text-xs text-ink focus:border-accent focus:outline-none"
                          />
                        )}
                      </div>
                    </div>

                    {/* Right Interactive Preview Card */}
                    <div className="flex flex-col justify-between rounded-xl border border-line bg-surface p-5">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-ink/50 font-semibold">Live campaign preview</span>
                        {currentListing ? (
                          <div className="mt-3 flex items-start gap-3 rounded-xl border border-line bg-paper/60 p-3">
                            {currentListing.images?.[0] ? (
                              <img
                                src={currentListing.images[0]}
                                alt={currentListing.title}
                                className="h-16 w-16 rounded-lg object-cover border border-line shrink-0"
                              />
                            ) : (
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-ink/40">
                                <Tag className="h-6 w-6" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="inline-block rounded bg-paper-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
                                {currentListing.listingType}
                              </span>
                              <p className="mt-0.5 truncate text-sm font-semibold text-ink">{currentListing.title}</p>
                              <p className="font-mono text-xs text-ink/60">{formatNaira(currentListing.priceKobo || (currentListing.price ? currentListing.price * 100 : 0))}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-ink/50">Select a listing to preview</p>
                        )}

                        {/* Cost & Disclosure Breakdown */}
                        <div className="mt-5 space-y-2.5 border-t border-line/60 pt-4 text-xs">
                          <div className="flex justify-between text-ink/70">
                            <span>Placement:</span>
                            <span className="font-medium text-ink capitalize">{selectedPerk === 'feature' ? 'Featured spot' : 'Marketplace boost'}</span>
                          </div>
                          <div className="flex justify-between text-ink/70">
                            <span>Duration:</span>
                            <span className="font-medium text-ink">{selectedDuration} days</span>
                          </div>
                          <div className="flex justify-between text-ink/70">
                            <span>Credit cost:</span>
                            <span className="font-mono font-bold text-accent">{currentPromotionCost} Credits</span>
                          </div>
                          <div className="flex justify-between text-ink/70">
                            <span>Available balance:</span>
                            <span className="font-mono font-bold text-ink">{availableCredits} Credits</span>
                          </div>
                          <div className="flex justify-between border-t border-line/50 pt-2 font-semibold">
                            <span className="text-ink">Balance after launch:</span>
                            <span
                              className={`font-mono ${
                                hasEnoughCredits ? 'text-emerald-400' : 'text-dispute'
                              }`}
                            >
                              {availableCredits - currentPromotionCost} Credits
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-6">
                        {hasEnoughCredits ? (
                          <button
                            type="button"
                            onClick={() => setShowConfirmPromoteModal(true)}
                            disabled={promoteBusy || !currentListing}
                            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110 disabled:opacity-50 transition-all shadow-sm"
                          >
                            Launch promotion ({currentPromotionCost} credits)
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-center text-xs text-dispute">
                              You need {currentPromotionCost - availableCredits} more credits for this campaign.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPackage(packages[0]);
                                setShowBuyModal(true);
                              }}
                              className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110 transition-all"
                            >
                              Buy credits now
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Active, Scheduled & Completed Campaigns Landscape Table */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-xl font-bold text-ink">Promotion Campaigns</h3>
                  <div className="flex gap-1 rounded-xl border border-line bg-paper-2 p-1 text-xs font-medium">
                    {['active', 'scheduled', 'completed', 'all'].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setCampaignTab(tab)}
                        className={`rounded-lg px-3 py-1 capitalize transition-colors ${
                          campaignTab === tab
                            ? 'bg-accent text-accent-ink font-semibold'
                            : 'text-ink/65 hover:text-ink'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredCampaigns.length === 0 ? (
                  <div className="rounded-2xl border border-line bg-paper-2 p-8 text-center text-sm text-ink/55">
                    <p>No {campaignTab === 'all' ? '' : campaignTab} campaigns found.</p>
                    <p className="mt-1 text-xs text-ink/40">
                      Promote your products, courses, or services above to boost their visibility.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-line bg-paper-2">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-line bg-surface text-xs font-semibold uppercase tracking-wider text-ink/60">
                          <tr>
                            <th className="px-4 py-3">Listing</th>
                            <th className="px-4 py-3">Placement</th>
                            <th className="px-4 py-3">Schedule</th>
                            <th className="px-4 py-3">Cost</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line text-xs">
                          {filteredCampaigns.map((camp) => (
                            <tr key={camp._id} className="hover:bg-surface/50 transition-colors">
                              <td className="px-4 py-3 font-medium text-ink">
                                <div className="flex items-center gap-2.5">
                                  {camp.listingCoverUrl ? (
                                    <img
                                      src={camp.listingCoverUrl}
                                      alt=""
                                      className="h-9 w-9 rounded-md object-cover border border-line shrink-0"
                                    />
                                  ) : (
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink/40">
                                      <Tag className="h-4 w-4" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <span className="inline-block rounded bg-paper px-1 text-[9px] font-semibold uppercase text-ink/60">
                                      {camp.listingType}
                                    </span>
                                    <p className="truncate font-semibold text-ink">{camp.listingTitle}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="capitalize text-ink/80 font-medium">
                                  {camp.packageType === 'feature' ? 'Featured Spot' : 'Marketplace Boost'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-ink/65">
                                <p>{new Date(camp.startDate).toLocaleDateString()} – {new Date(camp.endDate).toLocaleDateString()}</p>
                                <p className="text-[10px] text-ink/40">{camp.durationDays} days duration</p>
                              </td>
                              <td className="px-4 py-3 font-mono font-semibold text-accent">
                                {camp.creditsCost} Credits
                              </td>
                              <td className="px-4 py-3">
                                {camp.status === 'active' && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Active
                                  </span>
                                )}
                                {camp.status === 'scheduled' && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400">
                                    Scheduled
                                  </span>
                                )}
                                {camp.status === 'completed' && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-line px-2.5 py-0.5 text-xs font-medium text-ink/60">
                                    Completed
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: BUY CREDITS (EXPANSIVE 3-COLUMN LANDSCAPE)        */}
          {/* ======================================================== */}
          {activeTab === 'buy' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-ink">Credit Packages</h2>
                <p className="mt-1 text-sm text-ink/65">
                  Choose a promotion package to boost your listings. Credits never expire and apply instantly.
                </p>
              </div>

              {/* 3-Column Landscape Packages */}
              <div className="grid gap-6 md:grid-cols-3">
                {packages.map((pkg) => {
                  const isPopular = pkg.popular;
                  const costPerCredit = Math.round((pkg.priceKobo / 100) / pkg.credits);
                  return (
                    <div
                      key={pkg.id}
                      className={`relative flex flex-col justify-between rounded-2xl border p-6 transition-all ${
                        isPopular
                          ? 'border-accent/80 bg-paper-2 shadow-lg shadow-accent/5 ring-1 ring-accent/30'
                          : 'border-line bg-paper-2 hover:border-line-strong'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-ink shadow">
                          Most popular
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-xl font-bold text-ink">{pkg.name}</h3>
                          <span className="rounded-lg border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink/60">
                            {costPerCredit} ₦/credit
                          </span>
                        </div>

                        <div className="mt-4 flex items-baseline gap-2">
                          <span className="font-mono text-3xl font-extrabold text-ink">{pkg.credits}</span>
                          <span className="text-sm font-semibold text-ink/60">Credits</span>
                        </div>

                        <p className="mt-2 font-mono text-xl font-bold text-accent">
                          {formatNaira(pkg.priceKobo)}
                        </p>

                        {pkg.bonusText && (
                          <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                            <Tag className="h-3 w-3" />
                            {pkg.bonusText}
                          </p>
                        )}

                        <ul className="mt-5 space-y-2.5 border-t border-line/60 pt-4 text-xs text-ink/70">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>Valid for Products, Courses &amp; Services</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>Instant server-side verification</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>Never expires</span>
                          </li>
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setShowBuyModal(true);
                        }}
                        className={`mt-6 w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
                          isPopular
                            ? 'bg-accent text-accent-ink hover:brightness-110 shadow-sm'
                            : 'border border-line bg-surface text-ink hover:bg-paper-3'
                        }`}
                      >
                        Select {pkg.name}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-line bg-surface/50 p-4 text-xs text-ink/60 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Payments are processed securely via Paystack or Flutterwave and verified instantly on our server.</span>
                </div>
                <span className="text-ink/40">Verified Escrow &amp; Payout Guard</span>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: REFERRAL REWARDS (LANDSCAPE WORKBENCH)            */}
          {/* ======================================================== */}
          {activeTab === 'referrals' && (
            <div className="space-y-8">
              <div>
                <h2 className="font-display text-2xl font-bold text-ink">Referral Program</h2>
                <p className="mt-1 text-sm text-ink/65">
                  Invite merchants, instructors, and service providers. Earn 25 credits on their first completed credit purchase.
                </p>
              </div>

              {/* Horizontal 3-Step Flow */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-line bg-paper-2 p-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-bold text-accent">
                    1
                  </span>
                  <h3 className="mt-3 text-sm font-bold text-ink">Share your invite</h3>
                  <p className="mt-1 text-xs text-ink/60 leading-relaxed">
                    Share your unique referral link on WhatsApp, social media, or directly with fellow sellers.
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-paper-2 p-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-bold text-accent">
                    2
                  </span>
                  <h3 className="mt-3 text-sm font-bold text-ink">They register</h3>
                  <p className="mt-1 text-xs text-ink/60 leading-relaxed">
                    They sign up on Escrit using your referral link and set up their store.
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-paper-2 p-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-bold text-accent">
                    3
                  </span>
                  <h3 className="mt-3 text-sm font-bold text-ink">Earn 25 credits</h3>
                  <p className="mt-1 text-xs text-ink/60 leading-relaxed">
                    When they complete their first credit package purchase, 25 promotion credits are credited to your balance.
                  </p>
                </div>
              </div>

              {/* Full Width Referral Table */}
              <div className="space-y-4">
                <h3 className="font-display text-xl font-bold text-ink">Referral History</h3>

                {(!data?.referral?.referrals || data.referral.referrals.length === 0) ? (
                  <div className="rounded-2xl border border-line bg-paper-2 p-8 text-center text-sm text-ink/55">
                    <Gift className="mx-auto h-8 w-8 text-ink/30" />
                    <p className="mt-2 font-medium">No referrals yet</p>
                    <p className="mt-1 text-xs text-ink/40">
                      Share your referral code <code className="font-mono text-accent font-bold">{data?.referral?.code}</code> to begin earning bonus credits.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-line bg-paper-2">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-line bg-surface text-xs font-semibold uppercase tracking-wider text-ink/60">
                        <tr>
                          <th className="px-4 py-3">Referred seller</th>
                          <th className="px-4 py-3">Registered date</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Reward</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-xs">
                        {data.referral.referrals.map((r) => (
                          <tr key={r._id} className="hover:bg-surface/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-ink">
                              <p>{r.name}</p>
                              <p className="text-[10px] text-ink/45 font-mono">{r.emailMasked}</p>
                            </td>
                            <td className="px-4 py-3 text-ink/65">
                              {new Date(r.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              {r.status === 'rewarded' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                                  <Check className="h-3 w-3" />
                                  Rewarded
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                                  <Clock className="h-3 w-3" />
                                  Pending first purchase
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold">
                              {r.status === 'rewarded' ? (
                                <span className="text-emerald-400">+{r.rewardCredits} Credits</span>
                              ) : (
                                <span className="text-ink/40">25 Credits (pending)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: CREDIT HISTORY LEDGER (LANDSCAPE WORKBENCH)        */}
          {/* ======================================================== */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink">Credit Activity Ledger</h2>
                  <p className="mt-1 text-sm text-ink/65">Complete transaction records for every credit movement.</p>
                </div>

                <div className="flex gap-1 rounded-xl border border-line bg-paper-2 p-1 text-xs font-medium">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'purchased', label: 'Purchases' },
                    { id: 'earned', label: 'Rewards' },
                    { id: 'spent', label: 'Deductions' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setHistoryFilter(f.id)}
                      className={`rounded-lg px-3 py-1 transition-colors ${
                        historyFilter === f.id
                          ? 'bg-accent text-accent-ink font-semibold'
                          : 'text-ink/65 hover:text-ink'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredEntries.length === 0 ? (
                <div className="rounded-2xl border border-line bg-paper-2 p-8 text-center text-sm text-ink/55">
                  <History className="mx-auto h-8 w-8 text-ink/30" />
                  <p className="mt-2 font-medium">No credit activity found</p>
                  <p className="mt-1 text-xs text-ink/40">
                    Your credit ledger and campaign movements will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-line bg-paper-2">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line bg-surface text-xs font-semibold uppercase tracking-wider text-ink/60">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Credits</th>
                        <th className="px-4 py-3 text-right">Balance after</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-xs">
                      {filteredEntries.map((entry) => {
                        const isPositive = entry.credits > 0 || entry.amountKobo > 0;
                        return (
                          <tr key={entry._id} className="hover:bg-surface/50 transition-colors">
                            <td className="px-4 py-3 text-ink/60 whitespace-nowrap">
                              {new Date(entry.createdAt).toLocaleString(undefined, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  entry.type === 'purchased'
                                    ? 'bg-accent/15 text-accent'
                                    : entry.type === 'earned'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-line text-ink/70'
                                }`}
                              >
                                {entry.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-ink max-w-md">
                              {entry.reason}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-ink/75'}`}>
                              {isPositive ? `+${entry.credits}` : entry.credits} Credits
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-ink/55">
                              {entry.balanceAfter !== null && entry.balanceAfter !== undefined
                                ? `${entry.balanceAfter} Credits`
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* BUY PACKAGE CONFIRMATION MODAL                           */}
      {/* ======================================================== */}
      {showBuyModal && selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-paper-2 p-6 shadow-2xl">
            <h3 className="font-display text-xl font-bold text-ink">Buy {selectedPackage.name} Package</h3>
            <p className="mt-1 text-xs text-ink/65">
              Confirm your promotion package and select your preferred payment provider.
            </p>

            <div className="mt-5 rounded-xl border border-line bg-surface p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-ink/70">Credits:</span>
                <span className="font-mono font-bold text-ink">{selectedPackage.credits} Credits</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink/70">Amount to pay:</span>
                <span className="font-mono font-bold text-accent">{formatNaira(selectedPackage.priceKobo)}</span>
              </div>
              {selectedPackage.bonusText && (
                <div className="flex justify-between text-xs text-accent">
                  <span>Bonus perk:</span>
                  <span>{selectedPackage.bonusText}</span>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink/60">
                Payment Provider
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedProvider('paystack')}
                  className={`rounded-xl border p-3 text-center text-xs font-semibold transition-all ${
                    selectedProvider === 'paystack'
                      ? 'border-accent bg-accent/15 text-accent ring-1 ring-accent/30'
                      : 'border-line bg-surface text-ink/70 hover:border-line-strong'
                  }`}
                >
                  Paystack
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider('flutterwave')}
                  className={`rounded-xl border p-3 text-center text-xs font-semibold transition-all ${
                    selectedProvider === 'flutterwave'
                      ? 'border-accent bg-accent/15 text-accent ring-1 ring-accent/30'
                      : 'border-line bg-surface text-ink/70 hover:border-line-strong'
                  }`}
                >
                  Flutterwave
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBuyModal(false)}
                disabled={buyBusy}
                className="rounded-xl border border-line px-4 py-2 text-xs font-medium text-ink hover:bg-paper-3 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToPayment}
                disabled={buyBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-accent-ink hover:brightness-110 disabled:opacity-50 transition-all shadow-sm"
              >
                {buyBusy ? (
                  <>
                    <Clock className="h-3.5 w-3.5 animate-spin" />
                    <span>Connecting…</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to payment</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CONFIRM PROMOTION CREATION MODAL                         */}
      {/* ======================================================== */}
      {showConfirmPromoteModal && currentListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-paper-2 p-6 shadow-2xl">
            <h3 className="font-display text-xl font-bold text-ink">Launch Promotion Campaign</h3>
            <p className="mt-1 text-xs text-ink/65">
              Confirm your campaign details. Credits are deducted only after successful creation.
            </p>

            <div className="mt-4 rounded-xl border border-line bg-surface p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink/60">Listing:</span>
                <span className="font-semibold text-ink truncate max-w-[200px]">{currentListing.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">Placement:</span>
                <span className="font-semibold text-ink capitalize">{selectedPerk === 'feature' ? 'Featured Placement' : 'Marketplace Boost'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">Duration:</span>
                <span className="font-semibold text-ink">{selectedDuration} Days</span>
              </div>
              <div className="flex justify-between border-t border-line/60 pt-2 text-sm font-bold">
                <span className="text-ink">Credits to deduct:</span>
                <span className="font-mono text-accent">{currentPromotionCost} Credits</span>
              </div>
              <div className="flex justify-between text-ink/60">
                <span>Remaining balance:</span>
                <span className="font-mono">{availableCredits - currentPromotionCost} Credits</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmPromoteModal(false)}
                disabled={promoteBusy}
                className="rounded-xl border border-line px-4 py-2 text-xs font-medium text-ink hover:bg-paper-3 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPromote}
                disabled={promoteBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-accent-ink hover:brightness-110 disabled:opacity-50 transition-all shadow-sm"
              >
                {promoteBusy ? (
                  <>
                    <Clock className="h-3.5 w-3.5 animate-spin" />
                    <span>Launching…</span>
                  </>
                ) : (
                  <span>Launch campaign</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
