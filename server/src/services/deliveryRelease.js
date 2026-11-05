import cron from 'node-cron';
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { releaseAfterDeliveryDeadline } from './escrow.js';

async function sweep() {
  const due = await Transaction.find({
    status: TX_STATUS.PAID_HELD,
    fulfillmentStatus: { $in: ['DELIVERED', 'SERVICE_COMPLETE'] },
    releaseDueAt: { $lte: new Date() },
    payoutState: { $in: ['idle', 'failed'] },
  });
  for (const transaction of due) {
    try {
      await releaseAfterDeliveryDeadline(transaction);
      console.log(`[delivery-release] checked transaction ${transaction._id}`);
    } catch (error) {
      console.error(`[delivery-release] payout failed for ${transaction._id}:`, error.message);
    }
  }
}

export function startDeliveryReleaseJob() {
  cron.schedule('* * * * *', sweep);
  // WHY this job still runs: it is the safety net for buyers who never sign for a delivery. When a
  // buyer signs (face, device or USSD) funds are released immediately and this job is not needed
  // for that order. It only releases orders the seller marked delivered whose release window
  // (releaseWindowHours, 72 by default but configurable per listing) has passed with no dispute.
  console.log('[delivery-release] safety-net release job started (runs only for unsigned, undisputed deliveries)');
}
