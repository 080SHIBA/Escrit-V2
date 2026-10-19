import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// Only show the public payment warning when live payments can move real money.
export default function PaymentModeRibbon() {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    let active = true;
    const load = () => api.getPublicConfig().then((config) => active && setMode(config.paymentMode)).catch(() => {});
    load();
    const onChanged = (event) => (event.detail ? setMode(event.detail) : load());
    window.addEventListener('escrit:payment-mode-changed', onChanged);
    return () => { active = false; window.removeEventListener('escrit:payment-mode-changed', onChanged); };
  }, []);

  if (mode !== 'live') return null;
  return (
    <div role="status" className="px-4 py-1.5 text-center text-xs font-medium bg-dispute text-white">
      LIVE payments: real money is being charged and paid out.
    </div>
  );
}
