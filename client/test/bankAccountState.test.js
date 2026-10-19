import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bankAccountReducer,
  friendlyBankError,
  initialBankAccountState,
  validateAccountNumber,
} from '../src/lib/bankAccountState.js';

test('account-number validation accepts exactly ten digits', () => {
  assert.equal(validateAccountNumber('0123456789'), true);
  assert.equal(validateAccountNumber('123456789'), false);
  assert.equal(validateAccountNumber('12345678901'), false);
  assert.equal(validateAccountNumber('12345a7890'), false);
  assert.equal(validateAccountNumber(''), false);
});

test('bank-list loading, loaded and error states', () => {
  assert.equal(initialBankAccountState.banksStatus, 'loading');
  const loaded = bankAccountReducer(initialBankAccountState, {
    type: 'banks/success',
    banks: [{ code: '044', name: 'Access Bank' }],
  });
  assert.equal(loaded.banksStatus, 'success');
  assert.equal(loaded.banks[0].code, '044');
  const failed = bankAccountReducer(loaded, { type: 'banks/error', message: 'Try again' });
  assert.equal(failed.banksStatus, 'error');
  assert.equal(failed.banksError, 'Try again');
  assert.equal(bankAccountReducer(failed, { type: 'banks/retry' }).banksStatus, 'loading');
});

test('account-resolution idle, checking, verified, error and cleared states', () => {
  assert.equal(initialBankAccountState.resolveStatus, 'idle');
  const checking = bankAccountReducer(initialBankAccountState, { type: 'resolve/start' });
  assert.equal(checking.resolveStatus, 'checking');
  const verified = bankAccountReducer(checking, { type: 'resolve/success', accountName: 'Ada Seller' });
  assert.equal(verified.resolveStatus, 'success');
  assert.equal(verified.resolvedAccountName, 'Ada Seller');
  const failed = bankAccountReducer(verified, { type: 'resolve/error', message: 'No match' });
  assert.equal(failed.resolveStatus, 'error');
  assert.equal(failed.resolvedAccountName, '');
  assert.equal(bankAccountReducer(failed, { type: 'resolve/clear' }).resolveStatus, 'idle');
});

test('save flow handles saving, saved and failure states', () => {
  const saving = bankAccountReducer(initialBankAccountState, { type: 'save/start' });
  assert.equal(saving.saveStatus, 'saving');
  const saved = bankAccountReducer(saving, { type: 'save/success' });
  assert.equal(saved.saveStatus, 'success');
  const failed = bankAccountReducer(saving, { type: 'save/error', message: 'Mismatch' });
  assert.equal(failed.saveStatus, 'error');
  assert.equal(failed.saveError, 'Mismatch');
  const replacing = bankAccountReducer(failed, { type: 'replace' });
  assert.equal(replacing.saveStatus, 'idle');
  assert.equal(replacing.resolveStatus, 'idle');
  assert.equal(replacing.saveError, '');
});

test('payout summary and history handle loading, results, empty and failure states', () => {
  assert.equal(initialBankAccountState.payoutsStatus, 'loading');
  const loaded = bankAccountReducer(initialBankAccountState, {
    type: 'payouts/success',
    payouts: [{ orderId: 'tx-1', amountKobo: 12000 }],
    summary: { heldInEscrowKobo: 3000, paidOutKobo: 12000 },
  });
  assert.equal(loaded.payoutsStatus, 'success');
  assert.equal(loaded.payouts[0].amountKobo, 12000);
  assert.equal(loaded.summary.heldInEscrowKobo, 3000);
  const empty = bankAccountReducer(loaded, {
    type: 'payouts/success',
    payouts: [],
    summary: { heldInEscrowKobo: 0, paidOutKobo: 0 },
  });
  assert.deepEqual(empty.payouts, []);
  const failed = bankAccountReducer(empty, { type: 'payouts/error', message: 'Try again' });
  assert.equal(failed.payoutsStatus, 'error');
  assert.equal(bankAccountReducer(failed, { type: 'payouts/retry' }).payoutsStatus, 'loading');
});

test('bank errors are presented without raw server errors', () => {
  assert.match(friendlyBankError(new Error('Account name mismatch')), /verified identity/);
  assert.match(friendlyBankError(new Error('Provider temporarily unavailable')), /temporarily unavailable/);
  assert.doesNotMatch(friendlyBankError(new Error('Request failed (500)')), /Request failed/);
});
