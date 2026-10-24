import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { usePageTitle } from '../lib/usePageTitle.js';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(null);
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState('');
  const [error, setError] = useState('');
  usePageTitle('Notifications');

  const loadNotifications = useCallback(() => {
    setError('');
    api.getNotifications()
      .then(({ notifications: items }) => setNotifications(items || []))
      .catch((loadError) => setError(loadError.message || 'Unable to load notifications.'));
  }, []);

  useEffect(() => {
    loadNotifications();
    api.getNotificationPreferences()
      .then(({ marketingEmailOptIn: enabled }) => {
        setMarketingEmailOptIn(Boolean(enabled));
        setPreferencesLoaded(true);
      })
      .catch((loadError) => setError(loadError.message || 'Unable to load email preferences.'));
    window.addEventListener('escrit:notification-received', loadNotifications);
    return () => window.removeEventListener('escrit:notification-received', loadNotifications);
  }, [loadNotifications]);

  async function updateMarketingEmailOptIn(enabled) {
    setSavingPreferences(true);
    setPreferenceMessage('');
    try {
      const result = await api.updateNotificationPreferences({ marketingEmailOptIn: enabled });
      setMarketingEmailOptIn(Boolean(result.marketingEmailOptIn));
      setPreferenceMessage('Email preference saved.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save your email preference.');
    } finally {
      setSavingPreferences(false);
    }
  }

  async function markRead(notification) {
    if (notification.readAt || !notification.notificationType || notification.notificationType === 'service_message') return;
    try {
      const { readAt } = await api.markNotificationRead(notification._id);
      if (readAt) {
        setNotifications((current) => current?.map((item) => (
          item._id === notification._id ? { ...item, readAt } : item
        )));
        window.dispatchEvent(new Event('escrit:notification-received'));
      }
    } catch (readError) {
      setError(readError.message || 'Unable to update this notification.');
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink/50">Account</p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl"><Bell aria-hidden="true" size={26} />Notifications</h1>
          <p className="mt-2 text-sm text-ink/60">Account activity, order updates, saved listings, and service conversations.</p>
        </div>
        <Link to="/account/offers" className="text-sm font-medium text-accent hover:underline">View conversations</Link>
      </header>

      <section aria-labelledby="email-preferences-heading" className="mt-5 rounded-xl border border-line bg-paper p-4">
        <h2 id="email-preferences-heading" className="font-display text-lg">Email preferences</h2>
        <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6 text-ink/70">
          <input
            type="checkbox"
            checked={marketingEmailOptIn}
            disabled={!preferencesLoaded || savingPreferences}
            onChange={(event) => updateMarketingEmailOptIn(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-ink"
          />
          <span>Send me promotional emails about Escrit offers and marketplace updates. Important payment, listing, dispute, and verification emails are separate from this preference.</span>
        </label>
        <p role="status" className="mt-2 text-xs text-ink/55">{savingPreferences ? 'Saving…' : preferenceMessage}</p>
      </section>

      {error && <div role="alert" className="mt-5 rounded-lg border border-dispute/30 bg-dispute/5 px-4 py-3 text-sm text-dispute"><p>{error}</p><button type="button" onClick={loadNotifications} className="mt-2 font-semibold underline underline-offset-2">Try again</button></div>}
      {notifications === null && !error && <p className="py-10 text-sm text-ink/55">Loading notifications…</p>}
      {notifications?.length === 0 && (
        <div className="mt-6 rounded-xl border border-line px-5 py-10 text-center">
          <CheckCheck aria-hidden="true" className="mx-auto text-ink/35" size={28} />
          <h2 className="mt-3 font-display text-xl">You&apos;re all caught up</h2>
          <p className="mt-2 text-sm text-ink/55">New account, listing, order, and service updates will appear here.</p>
          <Link to="/marketplace" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-paper">Explore the marketplace</Link>
        </div>
      )}

      {notifications?.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {notifications.map((notification) => {
            const isMessage = notification.notificationType === 'service_message';
            const sender = notification.senderId?.displayName || notification.senderId?.businessName || 'Escrit user';
            const title = isMessage ? notification.title : notification.title;
            const href = notification.href || '/account/notifications';
            return (
              <li key={notification._id}>
                <Link
                  to={href}
                  onClick={() => markRead(notification)}
                  className="flex min-h-16 gap-4 py-5 transition-colors hover:bg-paper-2/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? 'bg-line-strong' : 'bg-accent'}`}><span className="sr-only">{notification.readAt ? 'Read' : 'Unread'}</span></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <strong className="truncate text-sm">{title}{isMessage && <span className="font-normal text-ink/55"> · {sender}</span>}</strong>
                      <time className="shrink-0 text-xs text-ink/45" dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap break-words text-sm text-ink/65">{notification.body}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 border-t border-line pt-4 text-xs text-ink/45">Showing your 50 most recent notifications. Transactional emails are limited to important account and order events. Promotional email is optional.</p>
    </div>
  );
}
