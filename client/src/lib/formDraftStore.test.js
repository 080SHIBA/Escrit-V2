import test from 'node:test';
import assert from 'node:assert/strict';
import { isForbiddenField, localDraftKey, mergeDraftIntoDefaults, pickNewerDraft, serializableValues } from './formDraftStore.js';

test('secret fields are blocked by whole word, ordinary fields are kept', () => {
  assert.equal(isForbiddenField('password'), true);
  assert.equal(isForbiddenField('pinCode'), true);
  assert.equal(isForbiddenField('otp'), true);
  assert.equal(isForbiddenField('shippingAddress'), false);
  assert.equal(isForbiddenField('footprint'), false);
});

test('serializableValues drops files, functions and secrets', () => {
  const out = serializableValues({ name: 'Ada', password: 'x', file: new Blob(['a']), fn() {}, nested: { city: 'Jos', otp: '1' }, tags: ['a', 1] }, ['skipMe']);
  assert.deepEqual(out, { name: 'Ada', nested: { city: 'Jos' }, tags: ['a', 1] });
});

test('newer draft wins between local and server', () => {
  assert.equal(pickNewerDraft(null, null), 'none');
  assert.equal(pickNewerDraft({ updatedAt: 5 }, null), 'local');
  assert.equal(pickNewerDraft(null, { updatedAt: '2026-01-01T00:00:00Z' }), 'server');
  assert.equal(pickNewerDraft({ updatedAt: Date.parse('2026-02-01') }, { updatedAt: '2026-01-01T00:00:00Z' }), 'local');
  assert.equal(pickNewerDraft({ updatedAt: Date.parse('2026-01-01') }, { updatedAt: '2026-02-01T00:00:00Z' }), 'server');
});

test('merge only restores known fields over defaults', () => {
  assert.deepEqual(mergeDraftIntoDefaults({ a: '', b: 1 }, { a: 'x', zzz: 'ignored' }), { a: 'x', b: 1 });
  assert.deepEqual(mergeDraftIntoDefaults({ a: '' }, null), { a: '' });
});

test('local key is scoped per user', () => {
  assert.notEqual(localDraftKey('u1', 'kyc'), localDraftKey('u2', 'kyc'));
});
