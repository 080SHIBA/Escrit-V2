import { ArrowRight, BriefcaseBusiness, GraduationCap, ShoppingBag } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

const TYPES = [
  { type: 'product', path: 'products', label: 'Products', detail: 'Browse independent goods', Icon: ShoppingBag },
  { type: 'service', path: 'services', label: 'Services', detail: 'Find help from skilled sellers', Icon: BriefcaseBusiness },
  { type: 'course', path: 'courses', label: 'Courses', detail: 'Learn from independent creators', Icon: GraduationCap },
];

export default function TypeSwitch({ value }) {
  const location = useLocation();

  return (
    <nav className="grid grid-cols-3 gap-2 sm:gap-4" aria-label="Marketplace categories">
      {TYPES.map(({ type, path, label, detail, Icon }) => (
        <NavLink
          key={type}
          to={{ pathname: `/marketplace/${path}`, search: location.search }}
          aria-current={value === type ? 'page' : undefined}
          className={({ isActive }) => `group flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-center transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus sm:min-h-20 sm:justify-start sm:gap-4 sm:rounded-xl sm:px-5 sm:py-4 sm:text-left ${
            isActive
              ? 'border-accent/60 bg-accent/10 text-ink shadow-sm'
              : 'border-line bg-surface text-ink/70 hover:border-accent/45 hover:bg-paper-2 hover:text-ink'
          }`}
        >
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center transition-colors motion-reduce:transition-none sm:h-11 sm:w-11 sm:rounded-lg ${value === type ? 'text-accent sm:bg-accent sm:text-accent-ink' : 'text-ink/70 group-hover:text-accent sm:bg-paper-2'}`}>
            <Icon size={16} aria-hidden="true" className="sm:h-5 sm:w-5" />
          </span>
          <span className="min-w-0 sm:flex-1">
            <span className="block whitespace-nowrap text-xs font-semibold sm:text-base">{label}</span>
            <span className="mt-1 hidden text-xs leading-5 text-ink/55 sm:block">{detail}</span>
          </span>
          <ArrowRight size={17} aria-hidden="true" className="hidden shrink-0 text-ink/35 transition-transform group-hover:translate-x-1 group-hover:text-accent motion-reduce:transition-none sm:block" />
        </NavLink>
      ))}
    </nav>
  );
}
