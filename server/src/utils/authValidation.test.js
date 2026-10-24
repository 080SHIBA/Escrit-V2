import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedEmailSchema } from './authValidation.js';

test('email auth inputs are trimmed and lowercased before database lookup', () => {
  const { error, value } = normalizedEmailSchema.validate('  Existing.User@Example.COM  ');

  assert.equal(error, undefined);
  assert.equal(value, 'existing.user@example.com');
});

test('email auth inputs still reject malformed addresses', () => {
  const { error } = normalizedEmailSchema.validate('not-an-email');

  assert.ok(error);
});
