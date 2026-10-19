import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateVerificationToken,
  hashVerificationToken,
  verifyVerificationToken,
} from './otp.js';

test('verification tokens can be verified and are stored as hashes', () => {
  const { token, hash, expiresAt } = generateVerificationToken();

  assert.equal(token.length, 64);
  assert.notEqual(token, hash);
  assert.equal(hash, hashVerificationToken(token));
  assert.equal(verifyVerificationToken(token, hash, expiresAt), true);
  assert.equal(verifyVerificationToken('wrong-token', hash, expiresAt), false);
});

test('verification tokens expire', () => {
  const { token, hash } = generateVerificationToken();

  assert.equal(verifyVerificationToken(token, hash, new Date(Date.now() - 1)), false);
});
