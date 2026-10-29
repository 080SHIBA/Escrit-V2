import { AlertCircle, RotateCcw } from 'lucide-react';

function timeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, mine, onRetry, children }) {
  if (message.type === 'system') {
    return <li className="py-1 text-center text-xs text-ink/50">{message.body}</li>;
  }
  return (
    <li className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <article className={`max-w-[88%] rounded-2xl border px-3.5 py-3 sm:max-w-[78%] ${mine ? 'border-accent/20 bg-accent/10' : 'border-line bg-paper-2'}`}>
        {children || <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>}
        <div className="mt-1.5 flex items-center justify-end gap-2 text-[10px] text-ink/45">
          {message.failed && (
            <button type="button" onClick={() => onRetry?.(message)} className="inline-flex min-h-8 items-center gap-1 text-dispute underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
              <RotateCcw size={12} aria-hidden="true" /> Retry
            </button>
          )}
          {message.failed && <AlertCircle size={12} aria-label="Message not sent" />}
          {message.optimistic && <span>Sending…</span>}
          <time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time>
          {mine && !message.failed && <span aria-label={message.readAt ? 'Read' : message.deliveredAt ? 'Delivered' : 'Sent'}>{message.readAt ? '✓✓' : message.deliveredAt ? '✓✓' : '✓'}</span>}
        </div>
      </article>
    </li>
  );
}
