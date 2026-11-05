// USSD gateway endpoint (built for Africa's Talking's callback format; other gateways are similar).
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Link } from '../models/Link.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { samePhone } from '../services/deliveryCodes.js';
import { signDelivery, signingBlockReason } from '../services/deliverySigning.js';
import { LOCK_MINUTES, MAX_PIN_ATTEMPTS, ussdReply } from '../services/ussdSigning.js';

export const ussdRouter = Router();

// WHAT: only accept calls that carry our shared secret.
// WHY: USSD gateways do not sign requests, so without this anyone on the internet could post fake
// sessions. The secret is configured in the gateway's callback URL (?key=...). Constant-time compare.
function authorised(req) {
  const expected = process.env.USSD_SHARED_SECRET || '';
  const given = String(req.query.key || '');
  return expected.length >= 16 && expected.length === given.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

const deps = {
  async findOrder(code, phoneNumber) {
    const transaction = await Transaction.findOne({ deliveryCode: code });
    if (!transaction?.buyerUserId) return null;
    const buyer = await User.findById(transaction.buyerUserId).select('phone');
    if (!buyer || !samePhone(buyer.phone, phoneNumber)) return null;
    const link = await Link.findById(transaction.linkId);
    return { transaction, buyerId: String(buyer._id), title: String(link?.itemName || 'your order').slice(0, 24), blockReason: signingBlockReason(transaction, link) };
  },
  async checkPin(buyerId, pin) {
    const user = await User.findById(buyerId).select('+signingPin');
    const record = user?.signingPin;
    if (!record?.hash) return 'not-set';
    if (record.lockedUntil && record.lockedUntil > new Date()) return 'locked';
    if (await bcrypt.compare(pin, record.hash)) {
      if (record.failedAttempts) await User.updateOne({ _id: buyerId }, { $set: { 'signingPin.failedAttempts': 0 } });
      return 'ok';
    }
    const failed = (record.failedAttempts || 0) + 1;
    const update = failed >= MAX_PIN_ATTEMPTS
      ? { 'signingPin.failedAttempts': 0, 'signingPin.lockedUntil': new Date(Date.now() + LOCK_MINUTES * 60_000) }
      : { 'signingPin.failedAttempts': failed };
    await User.updateOne({ _id: buyerId }, { $set: update });
    return failed >= MAX_PIN_ATTEMPTS ? 'locked' : 'wrong';
  },
  async sign(order, phoneNumber) {
    await signDelivery(order.transaction, { method: 'ussd', phoneLast4: String(phoneNumber).replace(/\D/g, '').slice(-4) });
  },
};

ussdRouter.post('/', async (req, res) => {
  res.type('text/plain');
  if (!authorised(req)) return res.status(403).send('END Service unavailable.');
  try {
    res.send(await ussdReply({ text: req.body?.text || '', phoneNumber: req.body?.phoneNumber || '' }, deps));
  } catch (error) {
    console.error('[ussd] error:', error.message);
    // WHY a plain END: the phone must always get a reply it can display; never an error page.
    res.send('END Something went wrong. Please try again or sign in the Escrit app.');
  }
});
