import { Check, CloudOff, Loader2 } from 'lucide-react';

// WHAT: a small "Saved" / "Saving…" / "Offline" label for forms using useFormDraft.
// WHY: people only trust autosave if they can see it working. role="status" lets
// screen readers announce changes politely without stealing focus.
const COPY = {
  saving: { text: 'Saving…', icon: Loader2, spin: true },
  saved: { text: 'Draft saved', icon: Check },
  offline: { text: 'Offline. Saved on this device and will sync when you reconnect.', icon: CloudOff },
  error: { text: 'Couldn’t sync yet. Your changes are safe on this device.', icon: CloudOff },
};

export default function AutosaveStatus({ state, className = '' }) {
  const item = COPY[state];
  if (!item) return <span className={className} aria-hidden="true" />;
  const Icon = item.icon;
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 text-xs text-ink/60 ${className}`}>
      <Icon size={13} aria-hidden="true" className={item.spin ? 'animate-spin' : ''} />
      {item.text}
    </span>
  );
}
