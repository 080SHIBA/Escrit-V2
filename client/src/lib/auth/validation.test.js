import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordStrength, validateEmail, validateSignIn, validateSignUp } from './validation.js';

test('email validation accepts standard addresses and rejects malformed input', () => {
  assert.equal(validateEmail('buyer@example.com'), true);
  assert.equal(validateEmail('not-an-email'), false);
});

test('sign in requires a valid email and password', () => {
  assert.deepEqual(validateSignIn({ email: 'bad', password: '' }), { email: 'Enter a valid email address.', password: 'Enter your password.' });
  assert.deepEqual(validateSignIn({ email: 'buyer@example.com', password: 'secret' }), { email: '', password: '' });
});

test('sign up requires two name words and an 8 character password with a number or symbol', () => {
  const invalid = validateSignUp({ email: 'buyer@example.com', fullName: 'Buyer', password: 'password' });
  assert.match(invalid.fullName, /first and last/);
  assert.match(invalid.password, /8 characters/);
  assert.match(validateSignUp({ email: 'buyer@example.com', fullName: 'Buyer Example', password: '        ' }).password, /number or symbol/);
  assert.deepEqual(validateSignUp({ email: 'buyer@example.com', fullName: 'Buyer Example', password: 'password1' }), { email: '', fullName: '', password: '' });
});

test('password strength reports the expected label and four bar score', () => {
  assert.deepEqual(passwordStrength(''), { score: 0, label: 'Too weak' });
  assert.deepEqual(passwordStrength('abcdefg'), { score: 1, label: 'Weak' });
  assert.equal(passwordStrength('password1').label, 'Good');
  assert.equal(passwordStrength('Complex1!').label, 'Strong');
});
