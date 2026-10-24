import { Link } from '../models/Link.js';
import { User } from '../models/User.js';
import { notifyUser } from './notifications.js';
import { env } from '../config/env.js';

function clientUrl(path) {
  return new URL(path, env.clientUrl).toString();
}

export async function notifyPaymentConfirmed({ io, transaction, link }) {
  try {
    const [buyer, seller] = await Promise.all([
      transaction.buyerUserId
        ? User.findById(transaction.buyerUserId).select('email')
        : User.findOne({ email: transaction.buyerEmail }).select('email'),
      User.findById(link.sellerId).select('email'),
    ]);
    const escrow = transaction.checkoutMode !== 'direct';
    const buyerMessage = escrow
      ? `Payment confirmed for “${link.itemName}”. Funds are held under this order’s escrow terms until completion.`
      : `Payment confirmed for “${link.itemName}”. This was paid directly to the seller; Escrit does not hold or recover direct payments.`;
    const sellerMessage = escrow
      ? `A buyer paid for “${link.itemName}” using Escrit escrow. Funds remain held until the order is completed under its terms.`
      : `A buyer’s direct payment for “${link.itemName}” was confirmed. This payment was not held by Escrit.`;

    await Promise.all([
      buyer && notifyUser({
        io,
        recipientId: buyer._id,
        type: 'payment_confirmed',
        title: 'Payment confirmed',
        message: buyerMessage,
        href: '/account/orders',
        dedupeKey: `payment-confirmed:${transaction._id}:buyer`,
        email: {
          to: buyer.email,
          subject: `Payment confirmed for ${link.itemName} — Escrit`,
          href: clientUrl('/account/orders'),
        },
      }),
      seller && notifyUser({
        io,
        recipientId: seller._id,
        type: 'payment_confirmed',
        title: 'Buyer payment confirmed',
        message: sellerMessage,
        href: '/account/orders',
        dedupeKey: `payment-confirmed:${transaction._id}:seller`,
        email: {
          to: seller.email,
          subject: `A buyer paid for ${link.itemName} — Escrit`,
          href: clientUrl('/account/orders'),
        },
      }),
    ]);
  } catch (error) {
    console.error(`[notifications] Could not prepare payment notification ${transaction._id}:`, error.message);
  }
}

export async function notifyDisputeRaised({ io, transaction }) {
  try {
    const link = await Link.findById(transaction.linkId).select('sellerId itemName');
    if (!link) {
      console.error(`[notifications] Could not find listing for disputed order ${transaction._id}`);
      return;
    }
    const [buyer, seller] = await Promise.all([
      transaction.buyerUserId
        ? User.findById(transaction.buyerUserId).select('email')
        : User.findOne({ email: transaction.buyerEmail }).select('email'),
      User.findById(link.sellerId).select('email'),
    ]);
    const recipients = [
      buyer && { user: buyer, role: 'buyer' },
      seller && { user: seller, role: 'seller' },
    ].filter(Boolean);
    await Promise.all(recipients.map(({ user, role }) => notifyUser({
      io,
      recipientId: user._id,
      type: 'dispute_raised',
      title: 'Dispute raised',
      message: `A dispute was raised for “${link.itemName}”. Review the order and respond in your orders.`,
      href: '/account/orders',
      dedupeKey: `dispute-raised:${transaction._id}:${role}`,
      email: {
        to: user.email,
        subject: `A dispute was raised for ${link.itemName} — Escrit`,
        href: clientUrl('/account/orders'),
      },
    })));
  } catch (error) {
    console.error(`[notifications] Could not prepare dispute notification ${transaction._id}:`, error.message);
  }
}

export async function notifyListingSubmitted({ io, seller, listing, listingType }) {
  try {
    await notifyUser({
      io,
      recipientId: seller._id,
      type: 'listing_submitted',
      title: `${listingType[0].toUpperCase()}${listingType.slice(1)} listing submitted`,
      message: `“${listing.title}” was submitted to Escrit and is awaiting review.`,
      href: '/dashboard',
      dedupeKey: `listing-submitted:${listing._id}`,
      email: {
        to: seller.email,
        subject: `Your ${listingType} listing was submitted — Escrit`,
        href: clientUrl('/dashboard'),
      },
    });
  } catch (error) {
    console.error(`[notifications] Could not notify about listing ${listing._id}:`, error.message);
  }
}
