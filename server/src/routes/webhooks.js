// Flutterwave webhook: the configured secret hash is compared in constant
// time; repeat deliveries are harmless because state transitions are idempotent.
import { Router } from 'express';
import crypto from 'node:crypto';
import { Transaction } from '../models/Transaction.js';
import { reconcileWithPaymentProvider } from '../services/escrow.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getFlutterwaveCredentials, getPaystackCredentials } from '../services/paymentMode.js';
import { recordFunnelEvent } from '../services/funnel.js';

export const webhooksRouter = Router();

async function reconcileEvent(provider, event) {
  const reference = provider === 'flutterwave' ? event.data?.tx_ref : event.data?.reference;
  const providerId = event.data?.id;
  if (!reference || !providerId) return;
  const tx = await Transaction.findOne({ paymentProvider: provider, paymentReference: reference });
  if (tx && tx.status === 'CREATED') {
    tx.paymentProviderTransactionId = provider === 'flutterwave' ? String(providerId) : String(reference);
    await tx.save();
    const reconciled = await reconcileWithPaymentProvider(tx);
    if (reconciled.status !== 'CREATED') {
      recordFunnelEvent('payment_completed', {
        userId: reconciled.buyerUserId,
        linkId: String(reconciled.linkId),
        transactionId: String(reconciled._id),
      }).catch((error) => console.error('[funnel] could not record payment_completed', error.message));
    }
  }
}

webhooksRouter.post('/flutterwave', asyncHandler(async (req, res) => {
  // Verified against the secret of the mode that is currently active.
  const { webhookSecret } = await getFlutterwaveCredentials();
  if (!webhookSecret) return res.status(404).end();
  const signature = req.headers['verif-hash'];
  const expected = webhookSecret;
  const signatureBuffer = Buffer.from(String(signature || ''));
  const expectedBuffer = Buffer.from(expected || '');
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    console.warn('[webhook] rejected Flutterwave event: signature mismatch');
    return res.status(401).end();
  }

  const event = JSON.parse(req.body.toString('utf8'));
  if (event.event === 'charge.completed') await reconcileEvent('flutterwave', event);

  res.status(200).end();
}));

webhooksRouter.post('/paystack', asyncHandler(async (req, res) => {
  const { webhookSecret } = await getPaystackCredentials();
  if (!webhookSecret) return res.status(404).end();
  const signature = req.headers['x-paystack-signature'];
  const expected = crypto.createHmac('sha512', webhookSecret).update(req.body).digest('hex');
  const signatureBuffer = Buffer.from(String(signature || ''));
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    console.warn('[webhook] rejected Paystack event: signature mismatch');
    return res.status(401).end();
  }

  const event = JSON.parse(req.body.toString('utf8'));
  if (event.event === 'charge.success') await reconcileEvent('paystack', event);

  res.status(200).end();
}));
