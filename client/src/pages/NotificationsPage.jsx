import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { usePageTitle } from '../lib/usePageTitle.js';

function messageSummary(message) {
  if (message.type === 'offer') {
    const action = message.offerEvent?.action || 'updated';
    return `Sent a service proposal (${action}).`;
  }
  return message.body;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(null);
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
    window.addEventListener('escrit:notification-received', loadNotifications);
    return () => window.removeEventListener('escrit:notification-received', loadNotifications);
  }, [loadNotifications]);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink/50">Account</p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl"><Bell aria-hidden="true" size={26} />Notifications</h1>
          <p className="mt-2 text-sm text-ink/60">Messages and service proposal updates from your Escrit conversations.</p>
        </div>
        <Link to="/account/offers" className="text-sm font-medium text-accent hover:underline">View all conversations</Link>
      </header>

      {error && <div role="alert" className="mt-5 rounded-lg border border-dispute/30 bg-dispute/5 px-4 py-3 text-sm text-dispute"><p>{error}</p><button type="button" onClick={loadNotifications} className="mt-2 font-semibold underline underline-offset-2">Try again</button></div>}
      {notifications === null && !error && <p className="py-10 text-sm text-ink/55">Loading notifications…</p>}
      {notifications?.length === 0 && (
        <div className="mt-6 rounded-xl border border-line px-5 py-10 text-center">
          <CheckCheck aria-hidden="true" className="mx-auto text-ink/35" size={28} />
          <h2 className="mt-3 font-display text-xl">You&apos;re all caught up</h2>
          <p className="mt-2 text-sm text-ink/55">New messages and service proposal updates will appear here.</p>
          <Link to="/account/offers" className="mt-5 inline-flex rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-paper">Open conversations</Link>
        </div>
      )}

      {notifications?.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {notifications.map((message) => {
            const offer = message.offerId;
            const serviceName = offer?.serviceId?.title || 'Service conversation';
            const sender = message.senderId?.displayName || message.senderId?.businessName || 'Escrit user';
            return (
              <li key={message._id}>
                <Link to={`/account/offers/${offer?._id || offer}`} className="flex gap-4 py-5 transition-colors hover:bg-paper-2/50">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${message.readAt ? 'bg-line-strong' : 'bg-accent'}`}><span className="sr-only">{message.readAt ? 'Read' : 'Unread'}</span></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <strong className="truncate text-sm"><Link to={`/marketplace/seller/${message.senderId?._id}`} onClick={(event) => event.stopPropagation()} className="hover:underline">{sender}</Link> <span className="font-normal text-ink/55">· {serviceName}</span></strong>
                      <time className="shrink-0 text-xs text-ink/45" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
                    </span>
                    <span className="mt-1 block line-clamp-2 whitespace-pre-wrap break-words text-sm text-ink/65">{messageSummary(message)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 border-t border-line pt-4 text-xs text-ink/45">Showing your 50 most recent incoming messages. Email alerts go to your account address when a new message arrives; delivery requires Brevo to be configured.</p>
    </div>
  );
}
