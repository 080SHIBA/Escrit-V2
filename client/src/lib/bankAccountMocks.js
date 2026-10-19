const curatedBanks = [
  ['Access Bank', '044'],
  ['Guaranty Trust Bank', '058'],
  ['First Bank of Nigeria', '011'],
  ['United Bank for Africa', '033'],
  ['Zenith Bank', '057'],
  ['Kuda Microfinance Bank', '50211'],
  ['OPay Digital Services Limited', '999992'],
  ['Moniepoint Microfinance Bank', '50515'],
  ['Wema Bank', '035'],
];

export const bankAccountMocksEnabled =
  import.meta.env.DEV && import.meta.env.VITE_BANK_ACCOUNT_MOCK === 'true';

export const bankAccountMockHandlers = {
  async listBanks() {
    return { banks: curatedBanks.map(([name, code]) => ({ name, code })) };
  },

  async resolveAccount({ accountNumber }) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { account_name: `DEMO ACCOUNT ${accountNumber.slice(-4)}` };
  },

  async saveAccount({ accountNumber, bankCode, bankName }) {
    const bankAccount = {
      accountNumber,
      bankCode,
      bankName,
      resolvedAccountName: `DEMO ACCOUNT ${accountNumber.slice(-4)}`,
    };
    return { seller: { bankAccount } };
  },

  async payoutData() {
    return {
      summary: { heldInEscrowKobo: 0, paidOutKobo: 0 },
      payouts: [],
    };
  },
};
