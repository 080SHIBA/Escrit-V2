const demo = import.meta.env?.VITE_AUTH_MOCKS === 'true';
const wait = () => new Promise((resolve) => setTimeout(resolve, 20));
const verificationRequests = new Map();

function parseMockReturn(value = '') {
  const match = /^\/(?:r|escrow)\/([a-f\d]{24})(?:\/t\/([a-f\d]{24}))?$/i.exec(value);
  return match ? { linkId: match[1].toLowerCase(), transactionId: match[2]?.toLowerCase() || '' } : null;
}

export async function signIn(payload) {
  const normalizedPayload = { ...payload, email: payload.email.trim() };

  if (demo) {
    await wait();
    if (normalizedPayload.password === 'wrong-password') throw new Error('That password doesn’t match this email. Try again or reset your password.');
    const pendingEscrowReturn = parseMockReturn(normalizedPayload.returnTo);
    return {
      accessToken: 'demo-auth-token',
      seller: { email: normalizedPayload.email, pendingEscrowReturn },
      returnTo: normalizedPayload.returnTo || '',
    };
  }
  return request('/api/auth/sign-in', normalizedPayload);
}

export async function signUp(payload) {
  const normalizedPayload = {
    ...payload,
    email: payload.email.trim(),
    fullName: payload.fullName.trim(),
  };

  if (demo) {
    await wait();
    if (normalizedPayload.email.toLowerCase() === 'registered@example.com') throw new Error('An account with this email already exists. Sign in instead.');
    return {
      email: normalizedPayload.email,
      demo: true,
      accountCreated: true,
      accessToken: 'demo-auth-token',
      seller: {
        email: normalizedPayload.email,
        fullName: normalizedPayload.fullName,
        businessName: normalizedPayload.fullName,
        accountIntents: normalizedPayload.intents,
        emailVerified: false,
        pendingEscrowReturn: parseMockReturn(normalizedPayload.returnTo),
      },
      returnTo: normalizedPayload.returnTo || '',
    };
  }
  return request('/api/auth/sign-up', normalizedPayload);
}

export function signInWithGoogle(idToken, returnTo = '') {
  return request('/api/auth/google', { idToken, ...(returnTo ? { returnTo } : {}) });
}

export function resendVerification(email) {
  return request('/api/auth/resend-verification', { email: email.trim() });
}

export function verifyEmailToken(token) {
  if (verificationRequests.has(token)) return verificationRequests.get(token);
  const pending = request('/api/auth/verify-email-link', { token })
    .finally(() => verificationRequests.delete(token));
  verificationRequests.set(token, pending);
  return pending;
}

async function request(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('We couldn’t reach Escrit. Check your connection and try again.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    if (response.status >= 500) {
      const error = new Error('We couldn’t complete that request. Please try again.');
      error.status = response.status;
      throw error;
    }
    throw new Error(data?.error || 'We couldn’t complete that request. Please try again.');
  }

  if (!response.ok) {
    const cause = String(data?.error || data?.message || '').toLowerCase();
    if (url.endsWith('/sign-in') && (response.status === 401 || cause.includes('password') || cause.includes('credential'))) {
      throw new Error('That password doesn’t match this email. Try again or reset your password.');
    }
    if (url.endsWith('/sign-up') && (response.status === 409 || cause.includes('already registered') || cause.includes('already exists'))) {
      throw new Error('An account with this email already exists. Sign in instead.');
    }
    if (url.endsWith('/sign-up') && response.status === 502) {
      const error = new Error('Your account was created, but we couldn’t send the verification email. Resend the link to try again.');
      error.status = response.status;
      throw error;
    }
    if (url.endsWith('/sign-up') && response.status === 503) {
      const error = new Error(data?.error || 'Email verification is not available right now. Please try again later.');
      error.status = response.status;
      throw error;
    }
    if (response.status >= 500) {
      const error = new Error('We couldn’t complete that request. Please try again.');
      error.status = response.status;
      throw error;
    }
    if (url.endsWith('/sign-in') && response.status === 403 && cause.includes('verify')) {
      const error = new Error(data.error);
      error.status = response.status;
      throw error;
    }
    throw new Error(data?.error || 'We couldn’t complete that request. Please try again.');
  }

  return data;
}
