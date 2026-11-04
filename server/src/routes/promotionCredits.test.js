import test from 'node:test';
import assert from 'node:assert/strict';
import Joi from 'joi';
import { maskEmail } from '../services/promotionCredits.js';
import { generateRandomCode } from '../utils/referralCode.js';

// Schemas to validate business rules
const creditBuySchema = Joi.object({
  packageId: Joi.string().required(),
  paymentProvider: Joi.string().valid('paystack', 'flutterwave').optional(),
});

const creditVerifySchema = Joi.object({
  reference: Joi.string().required(),
});

const creditPromoteSchema = Joi.object({
  listingType: Joi.string().valid('product', 'course', 'service').required(),
  listingId: Joi.string().hex().length(24).required(),
  packageType: Joi.string().valid('promote', 'feature').default('promote'),
  durationDays: Joi.number().integer().valid(3, 7, 14, 30).required(),
  startDate: Joi.date().iso().optional().allow(null, ''),
});

test('maskEmail obfuscates email addresses safely', () => {
  assert.equal(maskEmail('john.doe@example.com'), 'jo***@example.com');
  assert.equal(maskEmail('al@domain.org'), 'a***@domain.org');
  assert.equal(maskEmail(''), '');
  assert.equal(maskEmail(null), null);
});

test('generateRandomCode produces clean 6-character referral codes with valid characters', () => {
  const code = generateRandomCode(6);
  assert.equal(code.length, 6);
  assert.match(code, /^[A-Z2-9]+$/);
  // Never confusing characters like 0, O, 1, I
  assert.ok(!code.includes('0'));
  assert.ok(!code.includes('O'));
  assert.ok(!code.includes('1'));
  assert.ok(!code.includes('I'));
});

test('credit purchase schema validates packageId and supported payment providers', () => {
  assert.equal(creditBuySchema.validate({ packageId: 'growth' }).error, undefined);
  assert.equal(creditBuySchema.validate({ packageId: 'growth', paymentProvider: 'paystack' }).error, undefined);
  assert.equal(creditBuySchema.validate({ packageId: 'growth', paymentProvider: 'flutterwave' }).error, undefined);
  assert.ok(creditBuySchema.validate({ packageId: 'growth', paymentProvider: 'stripe' }).error);
  assert.ok(creditBuySchema.validate({}).error);
});

test('credit verification schema requires a non-empty payment reference', () => {
  assert.equal(creditVerifySchema.validate({ reference: 'promo_abc123' }).error, undefined);
  assert.ok(creditVerifySchema.validate({}).error);
  assert.ok(creditVerifySchema.validate({ reference: '' }).error);
});

test('promotion campaign schema requires valid listing types, 24-char id and permitted durations', () => {
  const valid = {
    listingType: 'product',
    listingId: '0123456789abcdef01234567',
    packageType: 'promote',
    durationDays: 7,
  };
  assert.equal(creditPromoteSchema.validate(valid).error, undefined);
  assert.equal(creditPromoteSchema.validate({ ...valid, listingType: 'service' }).error, undefined);
  assert.equal(creditPromoteSchema.validate({ ...valid, listingType: 'course' }).error, undefined);
  assert.equal(creditPromoteSchema.validate({ ...valid, packageType: 'feature', durationDays: 14 }).error, undefined);

  // Invalid duration
  assert.ok(creditPromoteSchema.validate({ ...valid, durationDays: 10 }).error);
  // Invalid listing type
  assert.ok(creditPromoteSchema.validate({ ...valid, listingType: 'unknown' }).error);
  // Invalid listing id length
  assert.ok(creditPromoteSchema.validate({ ...valid, listingId: 'short-id' }).error);
});

test('configurable promotion durations have expected credit costs', () => {
  const pricingOptions = [
    { days: 3, label: '3 days', promoteCredits: 15, featureCredits: 25 },
    { days: 7, label: '7 days', promoteCredits: 30, featureCredits: 50 },
    { days: 14, label: '14 days', promoteCredits: 55, featureCredits: 90 },
    { days: 30, label: '30 days', promoteCredits: 100, featureCredits: 160 },
  ];

  for (const opt of pricingOptions) {
    assert.ok(opt.promoteCredits > 0);
    assert.ok(opt.featureCredits > opt.promoteCredits);
  }
});
