import test from 'node:test';
import assert from 'node:assert/strict';
import { escrowReturnPath, parseEscrowReturnTo } from './escrowReturn.js';

test('only known relative escrow link return routes are accepted', () => {
  assert.deepEqual(parseEscrowReturnTo('/r/aaaaaaaaaaaaaaaaaaaaaaaa'), {
    linkId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    transactionId: '',
  });
  assert.deepEqual(parseEscrowReturnTo('/r/aaaaaaaaaaaaaaaaaaaaaaaa/t/bbbbbbbbbbbbbbbbbbbbbbbb'), {
    linkId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    transactionId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  });
  assert.equal(parseEscrowReturnTo('https://example.test/'), null);
  assert.equal(parseEscrowReturnTo('//example.test'), null);
  assert.equal(parseEscrowReturnTo('/dashboard'), null);
});

test('return paths are reconstructed from validated link and transaction ids', () => {
  assert.equal(
    escrowReturnPath({ linkId: 'aaaaaaaaaaaaaaaaaaaaaaaa', transactionId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }),
    '/r/aaaaaaaaaaaaaaaaaaaaaaaa/t/bbbbbbbbbbbbbbbbbbbbbbbb',
  );
});
