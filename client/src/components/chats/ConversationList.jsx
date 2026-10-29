import { Search } from 'lucide-react';
import { getConversationStage } from '../../lib/serviceChat.js';

function displayName(participant) {
  return participant?.displayName || participant?.businessName || 'Escrit member';
}

function lastMessageText(conversation) {
  const message = conversation.latestMessage;
  if (!message) return conversation.projectRequest?.description || 'Start the conversation';
  if (message.type === 'offer') return `Offer ${message.offerEvent?.action || 'updated'}`;
  return message.body || 'New activity';
}

export default function ConversationList({
  role,
  conversations,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}) {
  const filtered = conversations.filter((conversation) => {
    const other = role === 'buyer' ? conversation.sellerId : conversation.buyerId;
    const query = search.trim().toLowerCase();
    return !query || [
      displayName(other),
      conversation.serviceId?.title,
      lastMessageText(conversation),
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-line bg-paper" aria-label="Conversations">
      <label className="relative m-3 block">
        <span className="sr-only">Search conversations</span>
        <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search conversations"
          className="min-h-11 w-full rounded-lg border border-line bg-input pl-10 pr-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        />
      </label>
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto" aria-label={`${role === 'buyer' ? 'Buying' : 'Selling'} conversations`}>
        {filtered.map((conversation) => {
          const other = role === 'buyer' ? conversation.sellerId : conversation.buyerId;
          const name = displayName(other);
          const active = String(conversation._id) === String(selectedId);
          const avatarUrl = other?.profilePictureUrl || other?.avatarUrl;
          return (
            <li key={conversation._id}>
              <button
                type="button"
                onClick={() => onSelect(conversation)}
                aria-current={active ? 'true' : undefined}
                className={`flex min-h-[5.5rem] w-full items-start gap-3 px-3 py-3 text-left hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus ${active ? 'bg-paper-2' : ''}`}
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  : <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 font-semibold text-accent">{name.charAt(0).toUpperCase()}</span>}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{name}</span>
                    <span className="shrink-0 rounded-full bg-paper-3 px-2 py-0.5 text-[11px] text-ink/65">{getConversationStage(conversation, conversation.order)}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-ink/60">{conversation.serviceId?.title || 'Service conversation'}</span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-ink/45">{lastMessageText(conversation)}</span>
                    {conversation.unreadCount > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-ink">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-ink/55">
            {search ? 'No conversations match that search.' : 'No conversations here yet.'}
          </li>
        )}
      </ul>
    </section>
  );
}
