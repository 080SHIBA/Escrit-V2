import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { chatNowUrl } from '../lib/serviceChat.js';

const productChatEnabled = import.meta.env.VITE_PRODUCT_CHAT_ENABLED === 'true';

export default function ChatNowButton({
  sellerId,
  listingId,
  listingType = 'service',
  title = '',
  sellerName = '',
}) {
  if (!sellerId || !listingId) return null;
  if (listingType !== 'service' && !productChatEnabled) return null;

  return (
    <Link
      to={chatNowUrl({ sellerId, listingId, listingType, title, sellerName })}
      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line px-3 text-sm font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      aria-label={`Chat with ${sellerName || 'this seller'}`}
    >
      <MessageCircle aria-hidden="true" size={17} />
      Chat now
    </Link>
  );
}
