const ADMIN_ICON_URLS = {
  disputes: 'https://uxwing.com/wp-content/themes/uxwing/download/business-professional-services/political-debate-icon.svg',
  complaints: 'https://uxwing.com/wp-content/themes/uxwing/download/peoples-avatars/query-what-how-why-icon.svg',
  listings: 'https://uxwing.com/wp-content/themes/uxwing/download/file-and-folder-type/audit-report-survey-icon.svg',
  categories: 'https://uxwing.com/wp-content/themes/uxwing/download/business-professional-services/hierarchy-management-icon.svg',
  settings: 'https://uxwing.com/wp-content/themes/uxwing/download/web-app-development/administrator-developer-icon.svg',
  transactionPreferences: 'https://uxwing.com/wp-content/themes/uxwing/download/banking-finance/payment-dollar-icon.svg',
  kyc: 'https://uxwing.com/wp-content/themes/uxwing/download/computers-mobile-hardware/face-id-icon.svg',
};

export function AdminNavIcon({ name, width = 20, height = 20, className = '' }) {
  const src = ADMIN_ICON_URLS[name];
  if (!src) return null;

  return <img src={src} alt="" aria-hidden="true" width={width} height={height} className={`shrink-0 object-contain dark:invert ${className}`} />;
}

export const AdminDisputesIcon = (props) => <AdminNavIcon name="disputes" {...props} />;
export const AdminComplaintsIcon = (props) => <AdminNavIcon name="complaints" {...props} />;
export const AdminListingsIcon = (props) => <AdminNavIcon name="listings" {...props} />;
export const AdminCategoriesIcon = (props) => <AdminNavIcon name="categories" {...props} />;
export const AdminSettingsIcon = (props) => <AdminNavIcon name="settings" {...props} />;
export const TransactionPreferencesIcon = (props) => <AdminNavIcon name="transactionPreferences" {...props} />;
export const KycPreviewIcon = (props) => <AdminNavIcon name="kyc" {...props} />;
