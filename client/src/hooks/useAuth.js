import { useState } from 'react';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { resendVerification, signIn, signInWithGoogle, signUp } from '../lib/auth/authApi.js';

/**
 * @typedef {{ email: string, password: string }} SignInPayload
 * @typedef {{ email: string, fullName: string, password: string, intents: string[] }} SignUpPayload
 * @typedef {{ accessToken?: string, user?: { email: string }, seller?: { email: string } }} SignInResult
 * @typedef {{ email: string, demo?: boolean, accessToken?: string, seller?: { email: string } }} SignUpResult
 * @typedef {{ loading: boolean, signIn: (payload: SignInPayload) => Promise<SignInResult>, signUp: (payload: SignUpPayload) => Promise<SignUpResult>, google: (idToken: string, returnTo?: string) => Promise<SignInResult>, resendVerification: (email: string) => Promise<void> }} AuthActions
 */

/** @returns {AuthActions} */
export function useAuth() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuthContext();

  /**
   * @template T
   * @param {() => Promise<T>} action
   * @returns {Promise<T>}
   */
  async function run(action) {
    setLoading(true);
    try {
      return await action();
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    signIn: (payload) => run(async () => {
      const result = await signIn(payload);
      if (result.accessToken) await login(result.accessToken, result.seller || result.user || null);
      return result;
    }),
    signUp: (payload) => run(async () => {
      const result = await signUp(payload);
      if (result.accessToken) await login(result.accessToken, result.seller || null);
      return result;
    }),
    google: (idToken, returnTo = '') => run(async () => {
      const result = await signInWithGoogle(idToken, returnTo);
      if (result.accessToken) await login(result.accessToken, result.seller || result.user || null);
      return result;
    }),
    resendVerification: (email) => run(() => resendVerification(email)),
  };
}
