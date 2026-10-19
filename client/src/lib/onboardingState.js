export const ONBOARDING_GOALS = ['Buy', 'Sell', 'Escrow'];
export const ONBOARDING_INTERESTS = ['Products', 'Courses', 'Services'];
export const ONBOARDING_CATEGORIES = [
  'Fashion',
  'Electronics',
  'Home & living',
  'Beauty & health',
  'Food & groceries',
  'Digital goods',
  'Design services',
  'Tech services',
];

const STEP_DEFINITIONS = {
  'new-user': [
    { id: 'welcome' },
    { id: 'buy', when: (state) => state.goals.includes('Buy') },
    { id: 'sell1', when: (state) => state.goals.includes('Sell') },
    { id: 'sell2', when: (state) => state.goals.includes('Sell') && state.sellerTypes.includes('Products') },
    { id: 'sell3', when: (state) => state.goals.includes('Sell') },
    { id: 'escrow', when: (state) => state.goals.includes('Escrow') },
    { id: 'trust' },
    { id: 'done' },
  ],
  'escrow-link': [
    { id: 'escrow-welcome' },
    { id: 'escrow-preview' },
  ],
};

/**
 * @typedef {{
 *   goals: string[],
 *   interests: string[],
 *   categories: string[],
 *   city: string,
 *   sellerTypes: string[],
 *   displayName: string,
 *   fulfilmentDefault: string,
 *   verificationIntent: { identity: string, bank: string },
 *   currentStep: string,
 *   completed: boolean,
 *   flow: string,
 *   returnTo: string,
 * }} OnboardingState
 */

/** @param {Partial<OnboardingState>} [saved] */
export function createInitialOnboarding(saved = {}) {
  return {
    goals: ['Buy'],
    interests: [],
    categories: [],
    city: '',
    sellerTypes: [],
    displayName: '',
    fulfilmentDefault: '',
    verificationIntent: { identity: '', bank: '' },
    currentStep: 'welcome',
    completed: false,
    flow: 'new-user',
    returnTo: '',
    ...saved,
    verificationIntent: {
      identity: '',
      bank: '',
      ...saved.verificationIntent,
    },
  };
}

/** @param {Partial<OnboardingState>} state @param {string} [flow] */
export function computeOnboardingSteps(state, flow = state.flow || 'new-user') {
  const definitions = STEP_DEFINITIONS[flow] || STEP_DEFINITIONS['new-user'];
  return definitions.filter((step) => !step.when || step.when(state)).map((step) => step.id);
}

/** @param {string} [name] */
export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || 'there';
}

/** @param {OnboardingState} state */
export function getPrimaryGoal(state) {
  if (state.goals.includes('Sell')) return 'sell';
  if (state.goals.includes('Escrow')) return 'escrow';
  return 'buy';
}
