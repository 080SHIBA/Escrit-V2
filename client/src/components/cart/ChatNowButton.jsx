import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const productChatEnabled = import.meta.env.VITE_PRODUCT_CHAT_ENABLED === 'true';

export default function ChatNowButton({ sellerId, listingId, listingType = 'product' }) {
  if (!productChatEnabled || listingType !== 'product') return null;
  return (
    <Link
      to={`/account/chats?sellerId=${encodeURIComponent(sellerId)}&listingId=${encodeURIComponent(listingId)}`}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      aria-label="Chat with this seller"
    >
      <MessageCircle aria-hidden="true" size={17} />
      Chat now
    </Link>
  );
}
