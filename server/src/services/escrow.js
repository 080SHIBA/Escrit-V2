// The escrow state machine. A transaction (one buyer's checkout) only
// moves through the transitions below, and any transition that pays out
// or refunds money calls the payment provider first. If that call fails, the status
// does not change: better to show "still held" than claim a payout that
// never happened.
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { Link } from '../models/Link.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import * as paymentProvider from './paymentProvider.js';
import { Product } from '../models/Product.js';
import { getPlatformSettings } from './platformSettings.js';
import { PlatformCreditEntry } from '../models/PlatformCreditEntry.js';
import { isAutomaticReleaseDue } from '../shared/orderState.js';
import { notifyPaymentConfirmed } from './notificationEvents.js';
import { ServiceOrder } from '../models/ServiceOrder.js';

/**
 * CREATED -> PAID_HELD. Called after a verified payment success (webhook
 * or on-demand re-check). Idempotent: repeat calls are no-ops.
 */
export async function markPaidAndHeld(tx) {
  if (tx.status !== TX_STATUS.CREATED) return tx; // already processed

  tx.status = TX_STATUS.PAID_HELD;
  tx.paidAt = new Date();
  await tx.save();

  const link = await Link.findById(tx.linkId);
  if (link?.listingType === 'product' && link.listingId) {
    const product = await Product.findOneAndUpdate(
      { _id: link.listingId, stock: { $gte: tx.checkoutQuantity || 1 } },
      { $inc: { stock: -(tx.checkoutQuantity || 1) } },
      { new: true }
    );
    if (!product) {
      tx.status = TX_STATUS.DISPUTED;
      tx.disputeReason = 'The item sold out during checkout. Escrit is reviewing this payment for a refund.';
      tx.disputeRaisedAt = new Date();
      await tx.save();
      return tx;
    }

  }
  return tx;
}

async function verifyCheckoutGroup(tx, io) {
  if (!tx.paymentProviderTransactionId) return tx;
  const group = await Transaction.find({ paymentProvider: tx.paymentProvider, paymentReference: tx.paymentReference, status: TX_STATUS.CREATED });
  if (!group.length) return tx;
  const links = await Link.find({ _id: { $in: group.map((entry) => entry.linkId) } });
  const linkById = new Map(links.map((link) => [String(link._id), link]));
  const subtotalKobo = group.reduce((sum, entry) => sum + (linkById.get(String(entry.linkId))?.priceKobo || 0) * (entry.checkoutQuantity || 1), 0);
  const expectedKobo = group[0].checkoutTotalKobo || subtotalKobo;
  const verified = await paymentProvider.verifyTransactionById(tx.paymentProviderTransactionId);
  if (
    verified.status !== 'successful' ||
    verified.tx_ref !== tx.paymentReference ||
    verified.currency !== 'NGN' ||
    Math.round(Number(verified.amount) * 100) !== expectedKobo
  ) return tx;

  let target = tx;
  for (const entry of group) {
    entry.paymentProviderTransactionId = String(verified.id);
    const paid = entry.checkoutMode === 'direct' ? await settleDirectPurchase(entry) : await markPaidAndHeld(entry);
    if (entry.serviceOrderId && [TX_STATUS.PAID_HELD, TX_STATUS.DIRECT_PAID].includes(paid.status)) {
      await ServiceOrder.updateOne(
        { _id: entry.serviceOrderId, status: 'awaiting_payment', paymentStatus: { $ne: 'paid' } },
        {
          $set: {
            paymentStatus: 'paid',
            status: entry.serviceOrderKind === 'appointment' ? 'confirmed' : 'ready_to_start',
            reservationExpiresAt: null,
          },
          $push: {
            events: {
              status: entry.serviceOrderKind === 'appointment' ? 'confirmed' : 'ready_to_start',
              actorId: entry.buyerUserId,
              note: 'Payment verified by the provider.',
            },
          },
        }
      );
    }
    if ([TX_STATUS.PAID_HELD, TX_STATUS.DIRECT_PAID].includes(paid.status)) {
      await notifyPaymentConfirmed({
        io,
        transaction: paid,
        link: linkById.get(String(entry.linkId)),
      });
    }
    if (String(entry._id) === String(tx._id)) target = paid;
  }

  const buyerId = group[0].buyerUserId;
  if (buyerId) {
    const paidLinkIds = group.map((entry) => linkById.get(String(entry.linkId))).filter(Boolean)
      .filter((link) => link.listingId)
      .map((link) => ({ listingType: link.listingType, listingId: link.listingId }));
    const buyer = await User.findById(buyerId);
    if (buyer) {
      buyer.cartItems = buyer.cartItems.filter((cartItem) => !paidLinkIds.some((paidItem) =>
        paidItem.listingType === cartItem.listingType && String(paidItem.listingId) === String(cartItem.listingId)
      ));
      await buyer.save();
    }
  }
  return target;
}

async function settleDirectPurchase(tx) {
  if (tx.status !== TX_STATUS.CREATED) return tx;
  tx.paidAt = new Date();
  const link = await Link.findById(tx.linkId);
  if (!link) throw new AppError(404, 'Listing checkout not found');
  if (link.listingType === 'product' && link.listingId && !tx.directInventoryReserved) {
    const product = await Product.findOneAndUpdate(
      { _id: link.listingId, stock: { $gte: tx.checkoutQuantity || 1 } },
      { $inc: { stock: -(tx.checkoutQuantity || 1) } },
      { new: true }
    );
    if (!product) {
      tx.status = TX_STATUS.DISPUTED;
      tx.disputeReason = 'The item sold out during checkout. The payment requires review.';
      tx.disputeRaisedAt = new Date();
      await tx.save();
      return tx;
    }
    tx.directInventoryReserved = true;
    await tx.save();
  }
  await payOutToSeller(tx, `Escrit: direct ${link.listingType} purchase`, [TX_STATUS.CREATED]);
  tx.status = TX_STATUS.DIRECT_PAID;
  await tx.save();
  return tx;
}

async function claimSettlementOperation(tx, operation, allowedStatuses = [TX_STATUS.PAID_HELD]) {
  const stateField = operation === 'payout' ? 'payoutState' : 'refundState';
  const timestampField = operation === 'payout' ? 'payoutProcessingAt' : 'refundProcessingAt';
  if (tx[stateField] === 'completed') return false;
  const claimed = await Transaction.findOneAndUpdate(
    { _id: tx._id, status: { $in: allowedStatuses }, [stateField]: { $in: ['idle', 'failed'] } },
    { $set: { [stateField]: 'processing', [timestampField]: new Date() } },
    { new: true }
  );
  if (!claimed) throw new AppError(409, `This ${operation} is already being processed`);
  tx[stateField] = 'processing';
  return true;
}

/**
 * Asks the configured provider whether an unpaid transaction has actually succeeded and,
 * if so, applies the same transition as the webhook. Webhooks can lag or
 * be missed (for example in local development), so status routes call
 * this and a stuck "awaiting payment" order heals on the next poll.
 */
export async function reconcileWithPaymentProvider(tx, io) {
  if (tx.status !== TX_STATUS.CREATED) return tx;
  try {
    if (tx.paymentReference && tx.paymentProvider) {
      return await verifyCheckoutGroup(tx, io);
    }
  } catch (err) {
    // Provider unreachable or reference not found yet: leave the order
    // as-is and retry on the next poll.
    console.warn(`[reconcile] verify failed for ${tx.id}: ${err.message}`);
  }
  return tx;
}

async function payOutToSeller(tx, reason, allowedStatuses = [TX_STATUS.PAID_HELD]) {
  const claimed = await claimSettlementOperation(tx, 'payout', allowedStatuses);
  if (!claimed) return null;
  const link = await Link.findById(tx.linkId);
  if (!link) {
    await Transaction.updateOne({ _id: tx._id }, { $set: { payoutState: 'failed' } });
    throw new AppError(500, 'This transaction has no associated payment link');
  }

  const seller = await User.findById(link.sellerId);
  if (!seller?.bankAccount?.accountNumber || !seller.bankAccount.bankCode) {
    await Transaction.updateOne({ _id: tx._id }, { $set: { payoutState: 'failed' } });
    throw new AppError(500, 'Seller has no payout destination on file');
  }

  const { commissionPercent } = await getPlatformSettings();
  const sellerBaseKobo = (tx.sellerPayoutBaseKobo ?? link.priceKobo) * (tx.checkoutQuantity || 1);
  const commissionKobo = Math.floor(sellerBaseKobo * commissionPercent / 100);
  let transfer;
  try {
    transfer = await paymentProvider.initiateTransfer({
      amountKobo: sellerBaseKobo - commissionKobo,
      accountNumber: seller.bankAccount.accountNumber,
      bankCode: seller.bankAccount.bankCode,
      accountName: seller.bankAccount.resolvedAccountName,
      reason,
      reference: `escrit-payout-${tx._id}`,
    });
  } catch (error) {
    await Transaction.updateOne({ _id: tx._id }, { $set: { payoutState: 'failed' } });
    throw error;
  }

  tx.payoutLog.push({ action: 'transfer_initiated', detail: { transfer, sellerBaseKobo, commissionPercent, commissionKobo } });
  tx.releasedAt = new Date();
  tx.payoutState = 'completed';
  await tx.save();
  return transfer;
}

/** Buyer confirms receipt. Only valid while funds are held. */
export async function releaseOnBuyerConfirmation(tx) {
  if (tx.status !== TX_STATUS.PAID_HELD) {
    throw new AppError(409, `Cannot release a transaction in status ${tx.status}`);
  }
  if (!['DELIVERED', 'SERVICE_COMPLETE'].includes(tx.fulfillmentStatus)) {
    throw new AppError(409, 'The seller must mark delivery or service completion before funds can be released');
  }
  await payOutToSeller(tx, 'Escrit: buyer confirmed receipt');
  tx.status = TX_STATUS.RELEASED;
  await tx.save();
  return tx;
}

export async function releaseAfterDeliveryDeadline(tx, now = new Date()) {
  if (!isAutomaticReleaseDue(tx, now)) return tx;
  await payOutToSeller(tx, 'Escrit: 72-hour delivery confirmation window elapsed');
  tx.status = TX_STATUS.RELEASED;
  await tx.save();
  return tx;
}

export async function completeDirectService(tx, sellerId) {
  if (tx.status !== TX_STATUS.DIRECT_PAID) throw new AppError(409, 'This direct service order is not awaiting completion');
  const link = await Link.findById(tx.linkId);
  if (!link || link.fulfillmentType !== 'service' || String(link.sellerId) !== String(sellerId)) {
    throw new AppError(403, 'Only the service seller can complete this booking');
  }
  tx.fulfillmentStatus = 'SERVICE_COMPLETE';
  tx.fulfillmentUpdatedAt = new Date();
  tx.status = TX_STATUS.DIRECT_COMPLETED;
  await tx.save();
  return tx;
}

/**
 * Buyer raises a dispute. This stops the auto-release, which only
 * considers PAID_HELD transactions.
 */
export async function raiseDispute(tx, reason, evidence = {}) {
  if (tx.status !== TX_STATUS.PAID_HELD) {
    throw new AppError(409, `Cannot dispute a transaction in status ${tx.status}`);
  }
  const link = await Link.findById(tx.linkId);
  if (link?.fulfillmentType === 'course' && !link.refundable) {
    throw new AppError(409, 'This course is non-refundable and is not eligible for an escrow dispute');
  }
  const update = {
    $set: { status: TX_STATUS.DISPUTED, disputeReason: reason, disputeRaisedAt: new Date() },
  };
  if (evidence.text || evidence.mediaUrl) {
    update.$push = {
      evidence: { submittedBy: tx.buyerUserId, party: 'buyer', text: evidence.text || '', mediaUrl: evidence.mediaUrl || '' },
    };
  }
  const disputed = await Transaction.findOneAndUpdate(
    { _id: tx._id, status: TX_STATUS.PAID_HELD, payoutState: { $in: ['idle', 'failed'] } },
    update,
    { new: true },
  );
  if (!disputed) throw new AppError(409, 'A payout is already being processed; this order can no longer be disputed.');
  return disputed;
}

async function refundNoShow(tx, amountKobo, reason) {
  const claimed = await claimSettlementOperation(tx, 'refund');
  if (!claimed) return tx;
  const link = await Link.findById(tx.linkId);
  if (!link) throw new AppError(500, 'This transaction has no associated payment link');
  let refund;
  try {
    refund = await paymentProvider.refundTransaction({ transactionId: tx.paymentProviderTransactionId, amountKobo, reason });
  } catch (error) {
    await Transaction.updateOne({ _id: tx._id }, { $set: { refundState: 'failed' } });
    throw error;
  }
  tx.payoutLog.push({ action: 'refund_issued', detail: refund });
  tx.status = TX_STATUS.RESOLVED_REFUNDED;
  tx.refundState = 'completed';
  tx.resolutionNote = reason;
  tx.resolvedAt = new Date();
  await tx.save();
  return tx;
}

export async function refundProductNoShow(tx) {
  if (tx.status !== TX_STATUS.PAID_HELD || tx.fulfillmentStatus !== 'BUYER_NO_SHOW') {
    throw new AppError(409, 'This order is not awaiting a product no-show refund');
  }
  const link = await Link.findById(tx.linkId);
  if (!link?.refundable || link.fulfillmentType !== 'product') {
    throw new AppError(409, 'This product is not refundable for a missed pickup');
  }
  const refundableKobo = (tx.buyerPriceKoboSnapshot ?? link.checkoutPriceKobo ?? link.priceKobo) * (tx.checkoutQuantity || 1);
  const refundKobo = Math.floor(refundableKobo * 0.95);
  return refundNoShow(tx, refundKobo, 'Escrit: 95% refund after seller-reported buyer no-show; 5% fee retained');
}

export async function refundServiceNoShow(tx, reason) {
  if (tx.status !== TX_STATUS.PAID_HELD || tx.fulfillmentStatus !== 'BUYER_NO_SHOW') {
    throw new AppError(409, 'This service order is not awaiting a no-show refund');
  }
  const link = await Link.findById(tx.linkId);
  if (link?.fulfillmentType !== 'service') throw new AppError(409, 'This order is not a service booking');
  const responseDeadline = tx.noShowResponseDueAt;
  if (responseDeadline && responseDeadline < new Date()) throw new AppError(409, 'The buyer response period has ended');
  tx.buyerNoShowReason = reason;
  tx.resolutionNote = 'Service no-show reported by buyer. Full refund requested.';
  return refundNoShow(tx, (tx.buyerPriceKoboSnapshot ?? link.checkoutPriceKobo ?? link.priceKobo) * (tx.checkoutQuantity || 1), tx.resolutionNote);
}

export async function resolveNonRefundableProductNoShow(tx, outcome) {
  if (tx.status !== TX_STATUS.PAID_HELD || tx.fulfillmentStatus !== 'BUYER_NO_SHOW') {
    throw new AppError(409, 'This order is not awaiting a seller no-show decision');
  }
  const link = await Link.findById(tx.linkId);
  if (link?.fulfillmentType !== 'product' || link.refundable) {
    throw new AppError(409, 'Seller no-show choices only apply to non-refundable products');
  }

  if (outcome === 'release') {
    await payOutToSeller(tx, 'Escrit: seller retained non-refundable product after buyer no-show');
    tx.status = TX_STATUS.RESOLVED_RELEASED;
    tx.resolutionNote = 'Seller chose to receive the full item price after the buyer missed the agreed pickup.';
  } else if (outcome === 'credit') {
    const creditKobo = Math.floor(link.priceKobo * (tx.checkoutQuantity || 1) * 0.9);
    await User.findByIdAndUpdate(link.sellerId, { $inc: { promoCreditsKobo: creditKobo } });
    await PlatformCreditEntry.create({ userId: link.sellerId, type: 'earned', amountKobo: creditKobo, reason: 'Non-refundable product no-show claim converted to promotion credits', listingId: link.listingId, listingType: link.listingType });
    tx.status = TX_STATUS.RESOLVED_CREDITED;
    tx.resolutionNote = `Seller received ₦${(creditKobo / 100).toLocaleString()} in Escrit promotion credits (90% of the item price).`;
    tx.payoutLog.push({ action: 'promotion_credits_issued', detail: { amountKobo: creditKobo } });
    tx.resolvedAt = new Date();
    await tx.save();
  } else {
    throw new AppError(400, 'outcome must be "release" or "credit"');
  }
  await tx.save();
  return tx;
}

export async function settleServiceNoShow(tx) {
  if (
    tx.status !== TX_STATUS.PAID_HELD ||
    tx.fulfillmentStatus !== 'BUYER_NO_SHOW' ||
    tx.buyerNoShowReason ||
    !tx.noShowResponseDueAt ||
    tx.noShowResponseDueAt > new Date()
  ) return tx;
  const link = await Link.findById(tx.linkId);
  if (link?.fulfillmentType !== 'service') return tx;
  await payOutToSeller(tx, 'Escrit: buyer did not respond during the service no-show refund period');
  tx.status = TX_STATUS.RELEASED;
  tx.resolutionNote = 'Seller settled after the buyer did not provide a service no-show reason within the response period.';
  await tx.save();
  return tx;
}

/**
 * Manual dispute resolution by an admin: pay the seller or refund the
 * buyer. The written `note` is stored on the transaction and shown to
 * both sides, so a decision is never a silent status change.
 */
export async function resolveDispute(tx, outcome, note) {
  if (tx.status !== TX_STATUS.DISPUTED) {
    throw new AppError(409, `Cannot resolve a transaction in status ${tx.status}`);
  }

  if (outcome === 'release') {
    await payOutToSeller(tx, 'Escrit: dispute resolved in seller favor', [TX_STATUS.DISPUTED]);
    tx.status = TX_STATUS.RESOLVED_RELEASED;
  } else if (outcome === 'refund') {
    const link = await Link.findById(tx.linkId);
    await claimSettlementOperation(tx, 'refund', [TX_STATUS.DISPUTED]);
    let refund;
    try {
      refund = await paymentProvider.refundTransaction({
        transactionId: tx.paymentProviderTransactionId,
        amountKobo: (tx.buyerPriceKoboSnapshot ?? link?.checkoutPriceKobo ?? link?.priceKobo) * (tx.checkoutQuantity || 1),
        reason: 'Escrit: dispute resolved in buyer favor',
      });
    } catch (error) {
      await Transaction.updateOne({ _id: tx._id }, { $set: { refundState: 'failed' } });
      throw error;
    }
    tx.payoutLog.push({ action: 'refund_issued', detail: refund });
    tx.status = TX_STATUS.RESOLVED_REFUNDED;
    tx.refundState = 'completed';
  } else {
    throw new AppError(400, 'outcome must be "release" or "refund"');
  }

  tx.resolutionNote = note;
  tx.resolvedAt = new Date();
  await tx.save();
  return tx;
}

export { Transaction, TX_STATUS };
