import { DEFAULT_RELEASE_WINDOW_HOURS, releaseRuleText } from '../shared/releaseConditions.js';

const delay = () => new Promise((resolve) => window.setTimeout(resolve, 100));
const PREFIX = 'escrit:onboarding:';
const MOCK_LINKS = {
  '000000000000000000000001': { state: 'valid', title: 'Handwoven tote bag' },
  '000000000000000000000002': { state: 'expired', title: 'Course access' },
  '000000000000000000000003': { state: 'cancelled', title: 'Ceramic table lamp' },
  '000000000000000000000004': { state: 'already_accepted', title: 'Design consultation' },
};
export const onboardingMockEvents = [];

export const onboardingMocksEnabled = import.meta.env?.DEV && import.meta.env?.VITE_ONBOARDING_MOCK !== 'false';

function storageKey(account) {
  return `${PREFIX}${String(account || 'demo').toLowerCase()}`;
}

export const onboardingMockHandlers = {
  async get(account) {
    await delay();
    try {
      const value = window.localStorage.getItem(storageKey(account));
      return { onboarding: value ? JSON.parse(value) : null };
    } catch (error) {
      throw new Error('We couldn’t restore your setup. Please refresh and try again.');
    }
  },
  async save(account, onboarding) {
    await delay();
    try {
      window.localStorage.setItem(storageKey(account), JSON.stringify(onboarding));
      return { onboarding: structuredClone(onboarding) };
    } catch (error) {
      throw new Error('We couldn’t save your setup on this device. Your account is still available.');
    }
  },
  async preview(linkId, transactionId = '') {
    await delay();
    return { preview: createMockEscrowPreview(linkId, transactionId) };
  },
  async publicLink(linkId) {
    await delay();
    const preview = createMockEscrowPreview(linkId);
    return {
      link: {
        id: String(linkId),
        itemName: preview.title || 'Escrow transaction',
        itemDescription: preview.termsSnapshot || '',
        termsSnapshot: preview.termsSnapshot || '',
        itemPhotoUrl: null,
        priceKobo: preview.amountKobo || 1250000,
        checkoutPriceKobo: preview.amountKobo || 1250000,
        fulfillmentType: 'product',
        releaseWindowHours: DEFAULT_RELEASE_WINDOW_HOURS,
        refundable: false,
        active: preview.state === 'valid',
      },
      seller: {
        businessName: preview.from || 'Demo seller',
        verifiedAccountName: null,
        demoOnly: true,
      },
    };
  },
  async track(event, linkId = '', transactionId = '') {
    onboardingMockEvents.push({ event, linkId, transactionId });
    return { ok: true, mock: true };
  },
  async dismissRecipientScreen() {
    window.localStorage.setItem(`${PREFIX}recipient-prompt`, JSON.stringify({ eligible: true, shown: false }));
    return { ok: true, mock: true };
  },
  async completeRecipientFlow() {
    return { ok: true, mock: true };
  },
  async getRecipientPrompt() {
    const key = `${PREFIX}recipient-prompt`;
    const prompt = JSON.parse(window.localStorage.getItem(key) || '{"eligible":false,"shown":false}');
    if (!prompt.eligible || prompt.shown) return { show: false };
    window.localStorage.setItem(key, JSON.stringify({ ...prompt, shown: true }));
    return { show: true };
  },
};

export function createMockEscrowPreview(linkId, transactionId = '') {
  const mock = MOCK_LINKS[String(linkId)] || (String(linkId).startsWith('mock-') ? { state: 'valid', title: 'Mock escrow item' } : null);
  if (!mock) return { state: 'invalid' };
  const state = transactionId && mock.state === 'valid' ? 'already_accepted' : mock.state;
  return {
    state,
    linkId,
    transactionId,
    title: mock.title,
    fulfillmentType: 'product',
    releaseWindowHours: DEFAULT_RELEASE_WINDOW_HOURS,
    amountKobo: 1250000,
    from: 'Demo seller',
    releaseRule: releaseRuleText(DEFAULT_RELEASE_WINDOW_HOURS),
    fees: 'Shown before you pay.',
    termsSnapshot: 'The item will be delivered as agreed. Confirm completion before release.',
  };
}
