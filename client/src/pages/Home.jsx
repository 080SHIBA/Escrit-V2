import { useNavigate } from 'react-router-dom';
import BuyerProtection from '../components/landing/BuyerProtection.jsx';
import BrowseCategories from '../components/landing/BrowseCategories.jsx';
import EscrowSection from '../components/landing/EscrowSection.jsx';
import EscrowSteps from '../components/landing/EscrowSteps.jsx';
import ExploreEscrit from '../components/landing/ExploreEscrit.jsx';
import FeaturedListings from '../components/landing/FeaturedListings.jsx';
import LandingFaq from '../components/landing/LandingFaq.jsx';
import SellerBand from '../components/landing/SellerBand.jsx';
import TrustFacts from '../components/landing/TrustFacts.jsx';
import LandingHero from '../components/landing/LandingHero.jsx';
import LandingHeader from '../components/landing/LandingHeader.jsx';
import LandingFooter from '../components/landing/LandingFooter.jsx';
import { useListingFilters } from '../hooks/useListingFilters.js';
import { useListings } from '../hooks/useListings.js';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { MARKETPLACE_CATEGORIES } from '../lib/marketplaceState.js';
import { usePageTitle } from '../lib/usePageTitle.js';

export default function Home() {
  usePageTitle('Marketplace and Escrow');
  const navigate = useNavigate();
  const { status } = useAuthContext();
  const { listings, loading, error, retry } = useListings();
  const filters = useListingFilters(listings);
  const isAuthed = status === 'authed';

  function searchListings(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (filters.query.trim()) params.set('q', filters.query.trim());
    if (filters.category !== 'all') params.set('category', filters.category);
    if (filters.type !== 'all') params.set('type', filters.type);
    navigate(`/marketplace${params.size ? `?${params}` : ''}`);
  }

  function scrollToListings() {
    window.requestAnimationFrame(() => document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function selectType(type) { filters.setType(type); scrollToListings(); }
  function selectCategory(category) { filters.setCategory(category); scrollToListings(); }

  return (
    <div className="landing-page">
      <LandingHeader />
      <LandingHero
        query={filters.query}
        onQueryChange={filters.setQuery}
        category={MARKETPLACE_CATEGORIES.includes(filters.category) ? filters.category : 'all'}
        onCategoryChange={filters.setCategory}
        onSearch={searchListings}
      />
      <TrustFacts />
      <ExploreEscrit onSelectType={selectType} />
      <BrowseCategories onSelectCategory={selectCategory} />
      <FeaturedListings filters={filters} listings={listings} loading={loading} error={error} isAuthed={isAuthed} onRetry={retry} onClearFilters={filters.clearFilters} />
      <EscrowSection isAuthed={isAuthed} />
      <EscrowSteps />
      <BuyerProtection />
      <SellerBand isAuthed={isAuthed} />
      <LandingFaq />
      <LandingFooter />
    </div>
  );
}
