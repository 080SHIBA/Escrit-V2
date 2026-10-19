const STATUS_ITEMS = [
  ['account', 'Account created'],
  ['email', 'Email verification'],
  ['shopping', 'Shopping interests'],
  ['seller', 'Seller profile'],
  ['identity', 'Identity verification'],
  ['bank', 'Bank verification'],
  ['escrow', 'First escrow link'],
];

function statusFor(key, onboarding, seller) {
  const goals = onboarding.goals || [];
  if (key === 'account') return 'Done';
  if (key === 'email') return seller?.emailVerified ? 'Done' : 'Planned';
  if (key === 'shopping') return goals.includes('Buy') ? (onboarding.interests?.length ? 'Done' : 'Planned') : 'To do';
  if (key === 'seller') return goals.includes('Sell') ? (onboarding.displayName?.trim() ? 'Done' : 'Planned') : 'To do';
  if (key === 'identity') return seller?.kycStatus === 'verified' ? 'Done' : goals.includes('Sell') ? (onboarding.verificationIntent?.identity ? 'Planned' : 'To do') : 'To do';
  if (key === 'bank') return seller?.bankAccount ? 'Done' : goals.includes('Sell') ? (onboarding.verificationIntent?.bank ? 'Planned' : 'To do') : 'To do';
  return goals.includes('Escrow') ? 'Planned' : 'To do';
}

export default function SetupSidebar({ onboarding, seller }) {
  if (onboarding.flow === 'escrow-link') {
    const statuses = [
      ['Account created', 'Done'],
      ['Email verification', seller?.emailVerified ? 'Done' : 'To do'],
      ['Return to your transaction', 'Planned'],
    ];
    return (
      <aside className="onboarding-sidebar" aria-labelledby="onboarding-sidebar-heading">
        <h2 id="onboarding-sidebar-heading">Your Escrit account</h2>
        <div className="onboarding-goal-pills"><span>Escrow link recipient</span></div>
        <p className="onboarding-sidebar-label">Your setup</p>
        <ul>
          {statuses.map(([label, status]) => (
            <li key={label}>
              <span>{label}</span>
              <span className={`onboarding-status-pill onboarding-status-${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
            </li>
          ))}
        </ul>
      </aside>
    );
  }
  return (
    <aside className="onboarding-sidebar" aria-labelledby="onboarding-sidebar-heading">
      <h2 id="onboarding-sidebar-heading">Your Escrit account</h2>
      <p className="onboarding-sidebar-label">Your goals</p>
      <div className="onboarding-goal-pills">
        {(onboarding.goals.length ? onboarding.goals : ['Choose a goal']).map((goal) => (
          <span key={goal}>{goal}</span>
        ))}
      </div>
      <p className="onboarding-sidebar-label">Your setup</p>
      <ul>
        {STATUS_ITEMS.map(([key, label]) => (
          <li key={key}>
            <span>{label}</span>
            <span className={`onboarding-status-pill onboarding-status-${statusFor(key, onboarding, seller).toLowerCase().replace(' ', '-')}`}>
              {statusFor(key, onboarding, seller)}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
