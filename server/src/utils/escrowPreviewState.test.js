import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEscrowPreviewState } from './escrowPreviewState.js';
import { TX_STATUS } from '../models/Transaction.js';

const link = { _id: 'link-1', active: true, expiresAt: null };
const transaction = {
  _id: 'tx-1',
  linkId: 'link-1',
  buyerUserId: 'buyer-1',
  status: TX_STATUS.CREATED,
  termsAcceptedAt: null,
};

test('classifies a valid recipient preview', () => {
  assert.equal(classifyEscrowPreviewState({
    link,
    transaction,
    transactionRequested: true,
    requesterId: 'buyer-1',
  }), 'valid');
});

test('classifies an expired link', () => {
  assert.equal(classifyEscrowPreviewState({
    link: { ...link, expiresAt: new Date(Date.now() - 1000) },
  }), 'expired');
});

test('classifies a cancelled link', () => {
  assert.equal(classifyEscrowPreviewState({ link: { ...link, active: false } }), 'cancelled');
});

test('classifies accepted terms and rejects transactions owned by another user', () => {
  assert.equal(classifyEscrowPreviewState({
    link,
    transaction: { ...transaction, termsAcceptedAt: new Date() },
    transactionRequested: true,
    requesterId: 'buyer-1',
  }), 'already_accepted');
  assert.equal(classifyEscrowPreviewState({
    link,
    transaction,
    transactionRequested: true,
    requesterId: 'other-user',
  }), 'invalid');
});

test('classifies missing and mismatched links as invalid', () => {
  assert.equal(classifyEscrowPreviewState({ link: null }), 'invalid');
  assert.equal(classifyEscrowPreviewState({
    link,
    transaction: { ...transaction, linkId: 'other-link' },
    transactionRequested: true,
    requesterId: 'buyer-1',
  }), 'invalid');
});
