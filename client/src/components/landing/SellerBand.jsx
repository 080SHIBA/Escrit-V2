import { ArrowRight, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SellerBand({ isAuthed }) {
  return (
    <section id="sell" className="landing-seller-band landing-anchor">
      <div className="landing-container landing-seller-band-inner">
        <span className="landing-seller-band-icon"><Store size={23} aria-hidden="true" /></span>
        <div>
          <p className="landing-overline">For sellers</p>
          <h2>Have something to sell?</h2>
          <p>Bring your products, expertise, courses, or services to Escrit.</p>
        </div>
        <Link
          to={isAuthed ? '/account/list-product' : '/register?next=%2Faccount%2Flist-product'}
          className="landing-button landing-button-primary"
        >
          Start selling on Escrit <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
