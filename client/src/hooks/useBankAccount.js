import { useEffect, useReducer, useState } from 'react';
import { api } from '../lib/api.js';
import {
  bankAccountReducer,
  friendlyBankError,
  initialBankAccountState,
  validateAccountNumber,
} from '../lib/bankAccountState.js';

/**
 * @typedef {{ bankCode: string, bankName: string, accountNumber: string }} BankAccountForm
 * @typedef {{ accountNumber: string, bankCode: string, bankName: string, resolvedAccountName: string }} VerifiedBankAccount
 * @typedef {{ banks: Array<{ code: string, name: string }>, banksStatus: 'loading'|'success'|'error', banksError: string, resolveStatus: 'idle'|'checking'|'success'|'error', resolvedAccountName: string, resolveError: string, saveStatus: 'idle'|'saving'|'success'|'error', saveError: string, payoutsStatus: 'loading'|'success'|'error', payouts: Array<{ orderId: string, itemName: string, amountKobo: number, releasedAt: string, status: string }>, payoutsError: string, summary: { heldInEscrowKobo: number, paidOutKobo: number }|null }} BankAccountState
 * @typedef {{ state: BankAccountState, form: BankAccountForm, bankAccount?: VerifiedBankAccount|null, setBank: (bankCode: string, bankName: string) => void, setAccountNumber: (accountNumber: string) => void, retryBanks: () => void, retryResolve: () => void, retryPayouts: () => void, save: () => Promise<boolean>, beginReplace: () => void }} BankAccountController
 */

/**
 * @param {{ bankAccount?: VerifiedBankAccount|null, updateSeller: (seller: object) => void }} options
 * @returns {BankAccountController}
 */
export function useBankAccount({ bankAccount, updateSeller }) {
  const [state, dispatch] = useReducer(bankAccountReducer, initialBankAccountState);
  const [form, setForm] = useState({ bankCode: '', bankName: '', accountNumber: '' });
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [banksAttempt, setBanksAttempt] = useState(0);
  const [payoutsAttempt, setPayoutsAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api.listBanks()
      .then(({ banks }) => {
        if (!active) return;
        if (!banks?.length) {
          dispatch({ type: 'banks/error', message: 'No banks are available right now. Please retry.' });
          return;
        }
        dispatch({ type: 'banks/success', banks });
      })
      .catch((error) => {
        if (active) dispatch({ type: 'banks/error', message: friendlyBankError(error) });
      });
    return () => { active = false; };
  }, [banksAttempt]);

  useEffect(() => {
    let active = true;
    api.getPayoutData()
      .then((data) => {
        if (active) dispatch({
          type: 'payouts/success',
          payouts: data.payouts || [],
          summary: data.summary || { heldInEscrowKobo: 0, paidOutKobo: 0 },
        });
      })
      .catch((error) => {
        if (active) dispatch({ type: 'payouts/error', message: friendlyBankError(error) });
      });
    return () => { active = false; };
  }, [payoutsAttempt]);

  useEffect(() => {
    if (!form.bankCode || !validateAccountNumber(form.accountNumber)) {
      dispatch({ type: 'resolve/clear' });
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      dispatch({ type: 'resolve/start' });
      api.resolveBankAccount(form.bankCode, form.accountNumber, { signal: controller.signal })
        .then((data) => {
          if (activeRequest()) dispatch({ type: 'resolve/success', accountName: data.account_name });
        })
        .catch((error) => {
          if (error.name !== 'AbortError' && activeRequest()) {
            dispatch({ type: 'resolve/error', message: friendlyBankError(error) });
          }
        });
    }, 400);
    function activeRequest() {
      return !controller.signal.aborted;
    }
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form.bankCode, form.accountNumber, lookupAttempt]);

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    dispatch({ type: 'resolve/clear' });
    dispatch({ type: 'save/clear' });
  }

  async function save() {
    if (!validateAccountNumber(form.accountNumber) || !state.resolvedAccountName || !form.bankCode) return false;
    dispatch({ type: 'save/start' });
    try {
      const result = await api.saveBankAccount({
        accountNumber: form.accountNumber,
        bankCode: form.bankCode,
        bankName: form.bankName,
      });
      const updatedSeller = result.seller || { bankAccount: result.bankAccount };
      updateSeller(updatedSeller);
      dispatch({ type: 'save/success' });
      return true;
    } catch (error) {
      dispatch({ type: 'save/error', message: friendlyBankError(error) });
      return false;
    }
  }

  function beginReplace() {
    dispatch({ type: 'replace' });
    setForm({ bankCode: '', bankName: '', accountNumber: '' });
  }

  return {
    state,
    form,
    bankAccount,
    setBank: (bankCode, bankName) => {
      setForm((current) => ({ ...current, bankCode, bankName }));
      dispatch({ type: 'resolve/clear' });
    },
    setAccountNumber: (accountNumber) => updateForm('accountNumber', accountNumber.replace(/\D/g, '').slice(0, 10)),
    retryBanks: () => {
      dispatch({ type: 'banks/retry' });
      setBanksAttempt((attempt) => attempt + 1);
    },
    retryResolve: () => setLookupAttempt((attempt) => attempt + 1),
    retryPayouts: () => {
      dispatch({ type: 'payouts/retry' });
      setPayoutsAttempt((attempt) => attempt + 1);
    },
    save,
    beginReplace,
  };
}
