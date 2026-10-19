import { Brush, Camera, Flower2, House, Laptop, Shirt, ShoppingBasket, Smartphone } from 'lucide-react';

const CATEGORIES = [
  { name: 'Fashion', detail: 'Wearables and everyday style', Icon: Shirt },
  { name: 'Electronics', detail: 'Devices, audio and accessories', Icon: Smartphone },
  { name: 'Home & living', detail: 'Useful things for your space', Icon: House },
  { name: 'Beauty & health', detail: 'Care, wellness and beauty', Icon: Flower2 },
  { name: 'Food & groceries', detail: 'Local favourites and pantry goods', Icon: ShoppingBasket },
  { name: 'Digital goods', detail: 'Courses, tools and downloads', Icon: Laptop },
  { name: 'Design services', detail: 'Visual identity and creative work', Icon: Brush },
  { name: 'Tech services', detail: 'Product, web and technical help', Icon: Camera },
];

export default function BrowseCategories({ onSelectCategory }) {
  return (
    <section className="landing-section landing-categories landing-anchor" aria-labelledby="landing-categories-title">
      <div className="landing-container">
        <div className="landing-section-heading">
          <p className="landing-overline">Browse by category</p>
          <h2 id="landing-categories-title">Start with what you need.</h2>
          <p>Explore goods and skills from independent Nigerian sellers.</p>
        </div>
        <div className="landing-category-grid">
          {CATEGORIES.map(({ name, detail, Icon }) => (
            <button key={name} type="button" className="landing-category-card" onClick={() => onSelectCategory(name)}>
              <span className="landing-category-icon"><Icon size={21} aria-hidden="true" /></span>
              <span><strong>{name}</strong><small>{detail}</small></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
