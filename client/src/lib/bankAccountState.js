export const initialBankAccountState = {
  banks: [],
  banksStatus: 'loading',
  banksError: '',
  resolveStatus: 'idle',
  resolvedAccountName: '',
  resolveError: '',
  saveStatus: 'idle',
  saveError: '',
  payoutsStatus: 'loading',
  payouts: [],
  payoutsError: '',
  summary: null,
};

export function validateAccountNumber(value) {
  return /^\d{10}$/.test(value);
}

export function friendlyBankError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('identity') || message.includes('match')) {
    return 'The bank account name does not match your verified identity. Check the account details or update your KYC profile.';
  }
  if (message.includes('unavailable') || message.includes('timeout') || message.includes('temporarily')) {
    return 'Account verification is temporarily unavailable. Please try again shortly.';
  }
  if (message.includes('resolve') || message.includes('account number') || message.includes('invalid') || message.includes('verify this account')) {
    return 'We could not verify that account. Check the bank and 10-digit account number, then try again.';
  }
  return 'We could not complete this request. Please try again.';
}

export function bankAccountReducer(state, action) {
  switch (action.type) {
    case 'banks/success':
      return { ...state, banks: action.banks, banksStatus: 'success', banksError: '' };
    case 'banks/error':
      return { ...state, banksStatus: 'error', banksError: action.message };
    case 'banks/retry':
      return { ...state, banksStatus: 'loading', banksError: '' };
    case 'resolve/start':
      return { ...state, resolveStatus: 'checking', resolvedAccountName: '', resolveError: '' };
    case 'resolve/success':
      return { ...state, resolveStatus: 'success', resolvedAccountName: action.accountName, resolveError: '' };
    case 'resolve/error':
      return { ...state, resolveStatus: 'error', resolvedAccountName: '', resolveError: action.message };
    case 'resolve/clear':
      return { ...state, resolveStatus: 'idle', resolvedAccountName: '', resolveError: '' };
    case 'save/start':
      return { ...state, saveStatus: 'saving', saveError: '' };
    case 'save/success':
      return { ...state, saveStatus: 'success', saveError: '' };
    case 'save/error':
      return { ...state, saveStatus: 'error', saveError: action.message };
    case 'save/clear':
      return { ...state, saveStatus: 'idle', saveError: '' };
    case 'replace':
      return { ...state, saveStatus: 'idle', saveError: '', resolveStatus: 'idle', resolvedAccountName: '', resolveError: '' };
    case 'payouts/success':
      return { ...state, payoutsStatus: 'success', payouts: action.payouts, summary: action.summary, payoutsError: '' };
    case 'payouts/error':
      return { ...state, payoutsStatus: 'error', payoutsError: action.message };
    case 'payouts/retry':
      return { ...state, payoutsStatus: 'loading', payoutsError: '' };
    default:
      return state;
  }
}
