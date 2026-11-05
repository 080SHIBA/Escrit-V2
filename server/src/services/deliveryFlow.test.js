import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-0123456789';
process.env.MONGODB_URI ||= 'mongodb://localhost/test';

const { generateDeliveryCode, generateTrackingCode, parseReceiptToken, receiptToken, samePhone } = await import('./deliveryCodes.js');
const { buildTimeline, validateTrackingUpdate } = await import('./deliveryTracking.js');
const { ussdReply } = await import('./ussdSigning.js');
const { signingBlockReason } = await import('./deliverySigning.js');
const { issueLivenessSession, verifyLivenessProof } = await import('./livenessSession.js');

test('codes have the expected shape', () => {
  assert.match(generateTrackingCode(), /^ESC-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.match(generateDeliveryCode(), /^[1-9]\d{7}$/);
});

test('receipt token round-trips and rejects tampering', () => {
  const id = '5f0000000000000000000001';
  const token = receiptToken(id);
  assert.equal(parseReceiptToken(token), id);
  assert.equal(parseReceiptToken(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')), null);
  assert.equal(parseReceiptToken('5f0000000000000000000002-' + token.split('-')[1]), null);
  assert.equal(parseReceiptToken('nonsense'), null);
});

test('phone numbers match across formats', () => {
  assert.equal(samePhone('+234 801 234 5678', '08012345678'), true);
  assert.equal(samePhone('08012345678', '08012345679'), false);
  assert.equal(samePhone('', ''), false);
});

test('seller tracking updates move forward only and validate the estimate', () => {
  const tx = { trackingEvents: [{ status: 'SHIPPED', source: 'seller' }], fulfillmentStatus: 'IN_TRANSIT' };
  assert.equal(validateTrackingUpdate(tx, { status: 'PACKED' }).ok, false);
  assert.equal(validateTrackingUpdate(tx, { status: 'OUT_FOR_DELIVERY' }).ok, true);
  assert.equal(validateTrackingUpdate(tx, { status: 'ARRIVED', estimatedArrivalAt: new Date(Date.now() - 86_400_000) }).ok, false);
  assert.equal(validateTrackingUpdate({ ...tx, deliverySignature: { signedAt: new Date() } }, { status: 'ARRIVED' }).ok, false);
});

test('timeline shows Escrit milestones even when the seller posts nothing', () => {
  const timeline = buildTimeline({ createdAt: new Date(1000), paidAt: new Date(2000), trackingEvents: [] });
  assert.deepEqual(timeline.map((e) => e.status), ['PLACED', 'PAID']);
  const signed = buildTimeline({ createdAt: new Date(1000), trackingEvents: [], deliverySignature: { signedAt: new Date(3000) } });
  assert.equal(signed.at(-1).status, 'DELIVERED');
});

test('signing is blocked for disputes, services, duplicates and unpaid orders', () => {
  const link = { fulfillmentType: 'product' };
  assert.equal(signingBlockReason({ status: 'PAID_HELD' }, link), '');
  assert.match(signingBlockReason({ status: 'DISPUTED' }, link), /dispute/);
  assert.match(signingBlockReason({ status: 'CREATED' }, link), /not ready/);
  assert.match(signingBlockReason({ status: 'PAID_HELD', deliverySignature: { signedAt: new Date() } }, link), /already/);
  assert.match(signingBlockReason({ status: 'PAID_HELD' }, { fulfillmentType: 'service' }), /product/i);
});

test('USSD flow: code, PIN, confirm, sign', async () => {
  const calls = [];
  const deps = {
    findOrder: async (code, phone) => (code === '12345678' && phone === '+2348012345678' ? { buyerId: 'b1', title: 'Red sneakers', blockReason: '' } : null),
    checkPin: async (_b, pin) => (pin === '4821' ? 'ok' : pin === '0000' ? 'locked' : 'wrong'),
    sign: async (order, phone) => calls.push(['sign', order.title, phone]),
  };
  const ask = (text) => ussdReply({ text, phoneNumber: '+2348012345678' }, deps);
  assert.match(await ask(''), /^CON .*8-digit/s);
  assert.match(await ask('abc'), /^END .*not valid/);
  assert.match(await ask('99999999'), /^END .*could not match/);
  assert.match(await ask('12345678'), /^CON .*PIN/s);
  assert.match(await ask('12345678*1111'), /^END Wrong PIN/);
  assert.match(await ask('12345678*0000'), /^END Too many/);
  assert.match(await ask('12345678*4821'), /^CON Confirm/);
  assert.match(await ask('12345678*4821*2'), /^END Cancelled/);
  assert.equal(calls.length, 0, 'nothing is signed until the buyer confirms');
  assert.match(await ask('12345678*4821*1'), /^END Signed/);
  assert.equal(calls.length, 1);
});

test('USSD from a different phone cannot sign', async () => {
  const deps = { findOrder: async (_c, phone) => (phone === '+2348012345678' ? { buyerId: 'b1', title: 'x', blockReason: '' } : null), checkPin: async () => 'ok', sign: async () => { throw new Error('must not sign'); } };
  assert.match(await ussdReply({ text: '12345678*4821*1', phoneNumber: '+2349999999999' }, deps), /^END .*could not match/);
});

test('liveness sessions are bound to a user and purpose and need realistic timing', () => {
  const session = issueLivenessSession('user1', 'delivery');
  const fast = { steps: session.steps.map((type) => ({ type, completedAt: Date.now() })) };
  assert.throws(() => verifyLivenessProof({ token: session.token, proof: fast, userId: 'user1', purpose: 'delivery' }), /too quickly/);
  assert.throws(() => verifyLivenessProof({ token: session.token, proof: fast, userId: 'someone-else', purpose: 'delivery' }), /does not belong/);
  assert.throws(() => verifyLivenessProof({ token: session.token, proof: fast, userId: 'user1', purpose: 'kyc' }), /does not belong/);
});
