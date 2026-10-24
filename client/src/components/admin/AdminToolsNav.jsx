import { Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { AdminNavIcon } from './AdminNavIcon.jsx';

const ADMIN_LINKS = [
  ['/admin/disputes', 'Disputes', 'disputes'],
  ['/admin/complaints', 'Complaints', 'complaints'],
  ['/admin/kyc', 'KYC', 'kyc'],
  ['/admin/listings', 'Listings', 'listings'],
  ['/admin/categories', 'Categories', 'categories'],
  ['/admin/settings', 'Settings', 'settings'],
];

export default function AdminToolsNav() {
  const { seller } = useAuthContext();
  const location = useLocation();
  const links = seller?.isOwner ? [...ADMIN_LINKS, ['/admin/users', 'Roles', null]] : ADMIN_LINKS;

  return (
    <nav aria-label="Admin tools" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {links.map(([to, label, icon]) => {
        const active = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={`underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus lg:no-underline lg:inline-flex lg:min-h-11 lg:items-center lg:rounded-lg lg:border lg:px-4 lg:font-semibold lg:shadow-card-md lg:transition-colors ${
              active
                ? 'lg:border-accent lg:bg-accent lg:text-accent-ink'
                : 'lg:border-accent/40 lg:bg-accent/10 lg:text-ink lg:hover:bg-accent/20'
            }`}
          >
            {icon && <AdminNavIcon name={icon} width={18} height={18} className="mr-2" />}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
