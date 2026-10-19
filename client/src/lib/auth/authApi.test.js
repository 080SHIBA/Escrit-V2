import test from 'node:test';
import assert from 'node:assert/strict';
import { resendVerification, signIn, signInWithGoogle, signUp, verifyEmailToken } from './authApi.js';

async function withFetch(handler, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

test('sign in sends normalized credentials to the real auth endpoint', async () => {
  await withFetch(async (url, options) => {
    assert.equal(url, '/api/auth/sign-in');
    assert.equal(options.credentials, 'include');
    assert.deepEqual(JSON.parse(options.body), { email: 'buyer@example.com', password: 'secret' });
    return jsonResponse({ accessToken: 'token', seller: { email: 'buyer@example.com' } });
  }, async () => {
    const result = await signIn({ email: ' buyer@example.com ', password: 'secret' });
    assert.equal(result.seller.email, 'buyer@example.com');
  });
});

test('sign up sends full name and selected intents to the email verification endpoint', async () => {
  await withFetch(async (url, options) => {
    assert.equal(url, '/api/auth/sign-up');
    assert.deepEqual(JSON.parse(options.body), {
      email: 'new@example.com',
      fullName: 'New Buyer',
      password: 'password1',
      intents: ['Buy', 'Sell'],
    });
    return jsonResponse({ email: 'new@example.com' }, 201);
  }, async () => {
    const result = await signUp({
      email: ' new@example.com ',
      fullName: ' New Buyer ',
      password: 'password1',
      intents: ['Buy', 'Sell'],
    });
    assert.deepEqual(result, { email: 'new@example.com' });
  });
});

test('duplicate email is presented as a friendly inline error', async () => {
  await withFetch(async () => jsonResponse({ error: 'An account with this email already exists' }, 409), async () => {
    await assert.rejects(
      signUp({ email: 'used@example.com', fullName: 'Existing Buyer', password: 'password1', intents: ['Buy'] }),
      /already exists/,
    );
  });
});

test('email delivery failure allows the UI to offer a verification resend', async () => {
  await withFetch(async () => jsonResponse({ error: 'Your account was created, but we could not send the verification email' }, 502), async () => {
    await assert.rejects(
      signUp({ email: 'new@example.com', fullName: 'New Buyer', password: 'password1', intents: ['Buy'] }),
      (error) => error.status === 502 && /Resend the link/.test(error.message),
    );
  });
});

test('Google credentials and email verification links use the real backend routes', async () => {
  const expected = [
    ['/api/auth/google', { idToken: 'google-id-token' }],
    ['/api/auth/resend-verification', { email: 'new@example.com' }],
    ['/api/auth/verify-email-link', { token: 'verification-token' }],
  ];
  await withFetch(async (url, options) => {
    const next = expected.shift();
    assert.equal(url, next[0]);
    assert.deepEqual(JSON.parse(options.body), next[1]);
    return jsonResponse({ ok: true });
  }, async () => {
    await signInWithGoogle('google-id-token');
    await resendVerification(' new@example.com ');
    await verifyEmailToken('verification-token');
  });
  assert.equal(expected.length, 0);
});

test('a verification link is submitted only once when React runs effects twice', async () => {
  let requestCount = 0;
  await withFetch(async () => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return jsonResponse({ ok: true });
  }, async () => {
    await Promise.all([
      verifyEmailToken('same-token'),
      verifyEmailToken('same-token'),
    ]);
  });
  assert.equal(requestCount, 1);
});

test('network failures return a helpful connection message', async () => {
  await withFetch(async () => {
    throw new Error('network detail');
  }, async () => {
    await assert.rejects(
      signIn({ email: 'buyer@example.com', password: 'secret' }),
      /couldn’t reach Escrit/,
    );
  });
});
