import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';

import Home from './pages/Home.jsx';
import MarketplacePage from './pages/MarketplacePage.jsx';
import CreateMarketplaceListing from './pages/CreateMarketplaceListing.jsx';
import ForgotPassword from './pages/seller/ForgotPassword.jsx';
import ResetPassword from './pages/seller/ResetPassword.jsx';
import VerifyEmail from './pages/seller/VerifyEmail.jsx';
import Dashboard from './pages/seller/Dashboard.jsx';
import CreateLink from './pages/seller/CreateLink.jsx';
import LinkDetail from './pages/seller/LinkDetail.jsx';
import BankPage from './pages/seller/BankAccount.jsx';
import ProfileKycPage from './pages/seller/ProfileKycPage.jsx';
import Disputes from './pages/admin/Disputes.jsx';
import AdminQueue from './pages/admin/AdminQueue.jsx';
import PlatformSettings from './pages/admin/PlatformSettings.jsx';
import SignInPage from './pages/auth/SignInPage.jsx';
import GetStartedPage from './pages/auth/GetStartedPage.jsx';
import ConfirmEmailPage from './pages/auth/ConfirmEmailPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';

import PublicLinkPage from './pages/buyer/PublicLinkPage.jsx';
import Result from './pages/buyer/Result.jsx';
import BuyerLists from './pages/buyer/BuyerLists.jsx';
import CartPage from './pages/buyer/CartPage.jsx';
import MarketplaceListing from './pages/MarketplaceListing.jsx';
import ListingDetailPage from './pages/ListingDetailPage.jsx';
import SellerStorefront from './pages/SellerStorefront.jsx';
import BuyerOrders from './pages/buyer/BuyerOrders.jsx';
import ServiceOffers from './pages/buyer/ServiceOffers.jsx';
import ServiceOrders from './pages/buyer/ServiceOrders.jsx';
import ProductOffers from './pages/buyer/ProductOffers.jsx';
import PlatformCredits from './pages/seller/PlatformCredits.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import TransactionPreferencesPage from './pages/seller/TransactionPreferencesPage.jsx';
import { orderMocksEnabled } from './lib/orderMocks.js';
import { kycMocksEnabled } from './lib/kycMocks.js';
import { useAuthContext } from './lib/AuthContext.jsx';

function LegacyAuthRedirect({ to }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function MarketplaceRedirect() {
  const [searchParams] = useSearchParams();
  const legacyType = searchParams.get('type');
  const categoryPath = {
    product: 'products',
    service: 'services',
    course: 'courses',
  }[legacyType] || 'products';
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete('type');
  const query = nextParams.toString();

  return <Navigate to={{ pathname: `/marketplace/${categoryPath}`, search: query ? `?${query}` : '' }} replace />;
}

function HomeRoute() {
  const { status } = useAuthContext();

  if (status === 'authed') return <Navigate to="/marketplace" replace />;
  if (status === 'checking') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Checking your session">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-24 w-full" />
      </div>
    );
  }
  return <Home />;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/get-started" element={<GetStartedPage />} />
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
        {/* Public marketing page */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/marketplace" element={<MarketplaceRedirect />} />
        <Route path="/marketplace/products" element={<MarketplacePage type="product" />} />
        <Route path="/marketplace/services" element={<MarketplacePage type="service" />} />
        <Route path="/marketplace/courses" element={<MarketplacePage type="course" />} />
        <Route path="/listing/:id" element={<ListingDetailPage />} />
        <Route path="/marketplace/seller/:sellerId" element={<SellerStorefront />} />
        <Route path="/marketplace/:type/:id" element={<MarketplaceListing />} />
        <Route path="/marketplace/new/:type" element={<RequireAuth><CreateMarketplaceListing /></RequireAuth>} />

        {/* Seller: account */}
        <Route path="/login" element={<LegacyAuthRedirect to="/sign-in" />} />
        <Route path="/register" element={<LegacyAuthRedirect to="/get-started" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<RequireAuth><VerifyEmail /></RequireAuth>} />

        {/* Seller: signed in */}
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/dashboard/new" element={<RequireAuth><CreateLink /></RequireAuth>} />
        <Route path="/dashboard/links/:id" element={<RequireAuth><LinkDetail /></RequireAuth>} />
        <Route path="/dashboard/bank" element={<RequireAuth><BankPage /></RequireAuth>} />
        <Route path="/settings" element={kycMocksEnabled ? <ProfileKycPage /> : <RequireAuth><ProfileKycPage /></RequireAuth>} />
        <Route path="/account/list-product" element={<Navigate to="/account/storefront?tab=list" replace />} />
        <Route path="/account/bank" element={<RequireAuth><BankPage /></RequireAuth>} />
        <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
        <Route path="/account/cart" element={<Navigate to="/cart" replace />} />
        <Route path="/account/favorites" element={<RequireAuth><BuyerLists mode="favorites" /></RequireAuth>} />
        <Route path="/account/orders" element={orderMocksEnabled ? <BuyerOrders /> : <RequireAuth><BuyerOrders /></RequireAuth>} />
        <Route path="/account/offers" element={<RequireAuth><ServiceOffers /></RequireAuth>} />
        <Route path="/account/offers/:offerId" element={<RequireAuth><ServiceOffers /></RequireAuth>} />
        <Route path="/account/service-orders" element={<RequireAuth><ServiceOrders /></RequireAuth>} />
        <Route path="/account/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
        <Route path="/account/storefront" element={<RequireAuth><SellerStorefront /></RequireAuth>} />
        <Route path="/account/price-offers" element={<RequireAuth><ProductOffers /></RequireAuth>} />
        <Route path="/account/credits" element={<RequireAuth><PlatformCredits /></RequireAuth>} />
        <Route path="/account/transaction-preferences" element={<RequireAuth><TransactionPreferencesPage /></RequireAuth>} />

        {/* Admin: the API enforces the ADMIN_EMAILS allowlist */}
        <Route path="/admin/disputes" element={<RequireAuth><Disputes /></RequireAuth>} />
        <Route path="/admin/complaints" element={<RequireAuth><AdminQueue mode="complaints" /></RequireAuth>} />
        <Route path="/admin/kyc" element={<RequireAuth><AdminQueue mode="kyc" /></RequireAuth>} />
        <Route path="/admin/listings" element={<RequireAuth><AdminQueue mode="listings" /></RequireAuth>} />
        <Route path="/admin/categories" element={<RequireAuth><AdminQueue mode="categories" /></RequireAuth>} />
        <Route path="/admin/users" element={<RequireAuth><AdminQueue mode="users" /></RequireAuth>} />
        <Route path="/admin/settings" element={<RequireAuth><PlatformSettings /></RequireAuth>} />

        {/* Public listing and order views. Checkout requires a signed-in buyer. */}
        <Route path="/r/:linkId" element={<PublicLinkPage />} />
        <Route path="/r/:linkId/t/:txId" element={<PublicLinkPage />} />
        <Route path="/r/:linkId/t/:txId/result" element={<Result />} />
        <Route path="/escrow/:id" element={<PublicLinkPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
