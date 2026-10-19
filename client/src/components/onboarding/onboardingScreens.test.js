import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import React from 'react';
import { StaticRouter } from 'react-router-dom/server.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createInitialOnboarding } from '../../lib/onboardingState.js';

let vite;
let screens;

before(async () => {
  vite = await createServer({
    root: process.cwd(),
    configFile: path.resolve('vite.config.js'),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });
  ({ ONBOARDING_SCREEN_COMPONENTS: screens } = await vite.ssrLoadModule('/src/components/onboarding/OnboardingSteps.jsx'));
});

after(async () => {
  await vite?.close();
});

const cases = [
  ['welcome', 'Welcome to Escrit'],
  ['buy', 'What are you interested in?'],
  ['sell1', 'What will you offer?'],
  ['sell2', 'How will you hand over physical items?'],
  ['sell3', 'Get ready to be paid.'],
  ['escrow', 'How escrow payment links work'],
  ['trust', 'Before you start'],
  ['done', 'You’re all set'],
  ['escrow-welcome', 'Welcome to Escrit'],
  ['escrow-preview', 'Back to your transaction'],
];

for (const [id, heading] of cases) {
  test(`${id} onboarding screen renders its heading and accessible controls`, () => {
    const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: '/' }, React.createElement(screens[id], {
      headingRef: null,
      state: createInitialOnboarding({ goals: ['Buy', 'Sell', 'Escrow'], sellerTypes: ['Products'] }),
      update: () => {},
      name: 'Ada Okafor',
      email: 'ada@example.test',
      onResend: () => {},
      resendMessage: '',
      preview: id === 'escrow-preview' ? {
        state: 'valid',
        title: 'Handwoven tote bag',
        amountKobo: 125000,
        from: 'Demo seller',
        releaseRule: 'As agreed.',
        fees: 'Shown before you pay.',
        termsSnapshot: 'Delivery terms.',
      } : undefined,
      loading: false,
      onContinue: () => {},
      onReview: () => {},
      onDashboard: () => {},
    })));
    assert.match(html, /<h1[^>]*tabindex="-1"/);
    assert.ok(html.includes(heading));
  });
}

test('recipient preview shows friendly screens for every non-valid link state', () => {
  const headings = {
    expired: 'This link has expired',
    cancelled: 'This link was cancelled',
    already_accepted: 'These terms were already accepted',
    invalid: 'We couldn’t find this transaction',
  };
  for (const [state, heading] of Object.entries(headings)) {
    const html = renderToStaticMarkup(React.createElement(screens['escrow-preview'], {
      headingRef: null,
      preview: { state },
      loading: false,
      onRetry: () => {},
      onReview: () => {},
      onDashboard: () => {},
    }));
    assert.ok(html.includes(heading), `Expected ${state} preview to show "${heading}"`);
  }
});
