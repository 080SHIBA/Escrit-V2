import test from 'node:test';
import assert from 'node:assert/strict';
import { joinApiUrl } from './apiBase.js';

test('API request URLs use the configured backend origin without duplicate slashes', () => {
  assert.equal(joinApiUrl('/api/auth/sign-in', 'https://api.example.test/'), 'https://api.example.test/api/auth/sign-in');
  assert.equal(joinApiUrl('/api/auth/sign-up', ''), '/api/auth/sign-up');
});
