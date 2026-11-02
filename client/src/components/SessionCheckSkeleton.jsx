import { useEffect, useState } from 'react';

// WHAT: The placeholder shown ONLY on pages that need a signed-in user while the
// session is still being restored.
// WHY separate component: App and RequireAuth previously each carried a copy,
// and neither told the user anything when the server was slow. After a few
// seconds this one explains the delay so a cold server does not look like a
// frozen site.
const SLOW_AFTER_MS = 5000;

export default function SessionCheckSkeleton() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-3" aria-busy="true" aria-label="Checking your session">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-24 w-full" />
      {slow && (
        <p role="status" className="text-sm text-ink/60">
          Waking up the server. This can take a little longer after a quiet period, and you do not need to refresh.
        </p>
      )}
    </div>
  );
}
