import { ArrowUpRight, BookOpen, BriefcaseBusiness, ShoppingBag } from 'lucide-react';

const TYPES = [
  { type: 'product', title: 'Products', body: 'Find thoughtful goods from independent sellers.', Icon: ShoppingBag },
  { type: 'course', title: 'Courses', body: 'Learn practical skills from people who do the work.', Icon: BookOpen },
  { type: 'service', title: 'Services', body: 'Connect with experts for your next project.', Icon: BriefcaseBusiness },
];

export default function ExploreEscrit({ onSelectType }) {
  return (
    <section id="explore" className="landing-section landing-anchor">
      <div className="landing-container">
        <div className="landing-section-heading">
          <p className="landing-overline">Explore Escrit</p>
          <h2>Find what moves you forward.</h2>
          <p>One place to discover useful things, new skills, and people who can help.</p>
        </div>
        <div className="landing-type-grid">
          {TYPES.map(({ type, title, body, Icon }) => (
            <button key={type} type="button" className="landing-type-card" onClick={() => onSelectType(type)}>
              <span className="landing-type-icon"><Icon size={21} aria-hidden="true" /></span>
              <span className="landing-type-copy">
                <strong>{title}</strong>
                <span>{body}</span>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" className="landing-type-arrow" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
