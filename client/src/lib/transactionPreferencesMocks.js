import { DEFAULT_TRANSACTION_PREFERENCES } from './transactionPreferences.js';

const delay = (milliseconds = 120) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

let preferences = { ...DEFAULT_TRANSACTION_PREFERENCES };

export const transactionPreferencesMockHandlers = {
  async get() {
    await delay();
    return { preferences: { ...preferences } };
  },
  async save(nextPreferences) {
    await delay();
    preferences = { ...preferences, ...nextPreferences };
    return { preferences: { ...preferences } };
  },
  reset() {
    preferences = { ...DEFAULT_TRANSACTION_PREFERENCES };
  },
};
