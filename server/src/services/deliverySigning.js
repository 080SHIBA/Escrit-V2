// WHAT: the one place that records "the buyer confirmed receipt" and reacts to it.
// WHY one function for all three ways to sign (face, device, USSD PIN): the consequences must be
// identical whichever way the buyer proved themselves, so they share this code and only the
// evidence differs.
//
// What signing does:
//   1. Claims the signature atomically, so two taps or two devices can never sign (or pay out) twice.
//   2. Marks the order delivered and adds the "Delivered. Confirmed by buyer" event.
//   3. Releases the money to the seller (escrow) or closes the order (direct payment).
//   4. Tells the seller the buyer has signed and they should now hand over the goods.
import { AppError } from '../middleware/errorHandler.js';
import { Link } from '../models/Link.js';
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { releaseOnBuyerConfirmation } from './escrow.js';
import { notifyUser } from './notifications.js';

const SIGNABLE = [TX_STATUS.PAID_HELD, TX_STATUS.DIRECT_PAID];

// WHAT: why an order cannot be signed right now, or '' when it can. Pure, so it is easy to test.
export function signingBlockReason(transaction, link) {
  if (!transaction || !link) return 'This order could not be found.';
  if (link.fulfillmentType && link.fulfillmentType !== 'product') return 'Only product deliveries are signed for. Courses and services complete another way.';
  if (transaction.deliverySignature?.signedAt) return 'This delivery has already been signed for.';
  if (transaction.status === TX_STATUS.DISPUTED) return 'This order is in dispute. Signing is paused until it is resolved.';
  if (!SIGNABLE.includes(transaction.status)) return 'This order is not ready to be signed for yet.';
  if (transaction.fulfillmentStatus === 'BUYER_NO_SHOW') return 'This order is under review for a missed delivery.';
  return '';
}

export async function signDelivery(transaction, { method, livenessSessionId, credentialId, phoneLast4, io }) {
  const link = await Link.findById(transaction.linkId);
  const reason = signingBlockReason(transaction, link);
  if (reason) throw new AppError(409, reason);

  const now = new Date();
  // Atomic claim: only the first request flips signedAt from null; every other request matches nothing.
  const claimed = await Transaction.findOneAndUpdate(
    { _id: transaction._id, status: { $in: SIGNABLE }, 'deliverySignature.signedAt': null },
    {
      $set: {
        'deliverySignature.method': method,
        'deliverySignature.signedAt': now,
        'deliverySignature.credentialId': credentialId || '',
        'deliverySignature.phoneLast4': phoneLast4 || '',
        ...(livenessSessionId ? { 'deliverySignature.livenessSessionId': livenessSessionId } : {}),
        fulfillmentStatus: 'DELIVERED',
        fulfillmentUpdatedAt: now,
        deliveredAt: transaction.deliveredAt || now,
        // WHY releaseDueAt = now: if the payout fails (bank outage), the existing safety-net job picks
        // the order up on its next run and retries, so a signed delivery is never stranded.
        releaseDueAt: now,
      },
      $push: { trackingEvents: { at: now, status: 'DELIVERED', note: `Signed by buyer (${method})`, source: 'buyer' } },
    },
    { new: true },
  );
  if (!claimed) throw new AppError(409, 'This delivery has already been signed for.');

  try {
    if (claimed.status === TX_STATUS.PAID_HELD) {
      await releaseOnBuyerConfirmation(claimed);
    } else {
      claimed.status = TX_STATUS.DIRECT_COMPLETED;
      await claimed.save();
    }
  } catch (error) {
    // The signature stands (it is real evidence); only the payout needs a retry.
    console.error(`[signing] payout after signature failed for ${claimed._id}:`, error.message);
  }

  try {
    const [buyer, seller] = await Promise.all([
      claimed.buyerUserId ? User.findById(claimed.buyerUserId).select('displayName businessName') : null,
      User.findById(link.sellerId).select('email'),
    ]);
    if (seller) {
      await notifyUser({
        io,
        recipientId: seller._id,
        type: 'delivery_signed',
        title: 'Buyer signed for delivery',
        message: `${buyer?.displayName || buyer?.businessName || 'The buyer'} signed for “${link.itemName}”. Hand over the goods now.`,
        href: '/account/orders',
        dedupeKey: `delivery-signed:${claimed._id}`,
      });
    }
  } catch (error) {
    console.error('[signing] seller notification failed:', error.message);
  }
  return claimed;
}
