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
  console.log('[delivery-release] 72-hour release job started');
}
