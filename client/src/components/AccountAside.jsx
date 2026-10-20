import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from './icons.jsx';

const BENEFITS = [
  {
    title: 'One marketplace, three ways to find value',
    body: 'Shop independent products, learn from course creators, or find a service provider in one account.',
  },
  {
    title: 'Know who you are buying from',
    body: 'Compare seller storefronts, listing details, and buyer reviews before you make a decision.',
  },
  {
    title: 'Escrow is built into eligible checkout',
    body: 'For escrow purchases, payment is held while the seller fulfils the order. Confirm delivery or raise a dispute before release.',
  },
];

export default function AccountAside({ isLogin = false, isRegister = false }) {
  const hasPhotoBackground = isLogin || isRegister;
  return (
    <aside
      className={`py-2 lg:py-8 ${hasPhotoBackground ? 'px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10' : ''}`}
    >
      <p className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${hasPhotoBackground ? 'text-white' : 'text-seal'}`}>
        <ShieldCheckIcon width={15} height={15} /> Escrit marketplace
      </p>
      <h2 className={`mt-4 max-w-xl font-display text-3xl leading-tight sm:text-4xl ${hasPhotoBackground ? 'text-white' : ''}`}>
        {isLogin ? 'Your marketplace, right where you left it.' : 'One account for the whole marketplace.'}
      </h2>
      <p className={`mt-4 max-w-xl text-base leading-7 ${hasPhotoBackground ? 'text-white' : 'text-ink/65'}`}>
        {isLogin
          ? 'Pick up your shopping, orders, saved listings, and seller tools from one place.'
          : 'Browse and buy, save things for later, or start selling when you are ready. Your account works on both sides of every deal.'}
      </p>

      <ul className={`mt-8 divide-y border-y ${hasPhotoBackground ? 'divide-white/25 border-white/25' : 'divide-line border-line'}`}>
        {BENEFITS.map(({ title, body }) => (
          <li key={title} className="flex gap-3 py-4">
            <CheckIcon width={18} height={18} className={`mt-0.5 shrink-0 ${hasPhotoBackground ? 'text-white' : 'text-released'}`} />
            <div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className={`mt-1 max-w-lg text-sm leading-6 ${hasPhotoBackground ? 'text-white/85' : 'text-ink/60'}`}>{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <Link to="/marketplace" className={`mt-6 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 ${hasPhotoBackground ? 'text-white' : ''}`}>
        Browse the marketplace <ArrowRightIcon width={16} height={16} />
      </Link>
    </aside>
  );
}
