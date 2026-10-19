import { ONBOARDING_CATEGORIES, ONBOARDING_GOALS, ONBOARDING_INTERESTS, firstName } from '../../lib/onboardingState.js';
import { Link } from 'react-router-dom';

function Heading({ headingRef, children, description }) {
  return (
    <header className="onboarding-step-header">
      <h1 ref={headingRef} id="onboarding-step-heading" tabIndex="-1">{children}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}

function ToggleGrid({ choices, selected, onToggle, label }) {
  return (
    <div className="onboarding-choice-grid" role="group" aria-label={label}>
      {choices.map(({ label: choice, detail }) => (
        <button
          key={choice}
          type="button"
          className={`onboarding-choice ${selected.includes(choice) ? 'is-selected' : ''}`}
          aria-pressed={selected.includes(choice)}
          onClick={() => onToggle(choice)}
        >
          <span>{choice}</span>
          {detail && <small>{detail}</small>}
        </button>
      ))}
    </div>
  );
}

function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function WelcomeStep({ headingRef, state, update, name }) {
  const choices = [
    { label: 'Buy', detail: 'Shop on the marketplace' },
    { label: 'Sell', detail: 'Start selling on Escrit' },
    { label: 'Escrow', detail: 'Create an escrow payment link' },
  ];
  return (
    <>
      <Heading headingRef={headingRef}>Welcome to Escrit, {firstName(name)}</Heading>
      <p className="onboarding-intro">Your account is ready. One account lets you shop, sell and manage escrow transactions. What would you like to do first?</p>
      <ToggleGrid
        choices={choices}
        selected={state.goals}
        label="Choose your goals"
        onToggle={(value) => update({ goals: toggleValue(state.goals, value) })}
      />
      {!state.goals.length && <p className="onboarding-validation" role="alert">Choose at least one way you’d like to use Escrit.</p>}
    </>
  );
}

export function BuyStep({ headingRef, state, update }) {
  return (
    <>
      <Heading headingRef={headingRef}>What are you interested in?</Heading>
      <p className="onboarding-intro">Choose what you’d like to see on the marketplace. You can change this any time.</p>
      <ToggleGrid
        choices={ONBOARDING_INTERESTS.map((label) => ({ label }))}
        selected={state.interests}
        label="Shopping interests"
        onToggle={(value) => update({ interests: toggleValue(state.interests, value) })}
      />
      <fieldset className="onboarding-fieldset">
        <legend>Categories <span>Optional</span></legend>
        <div className="onboarding-chips">
          {ONBOARDING_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={`onboarding-chip ${state.categories.includes(category) ? 'is-selected' : ''}`}
              aria-pressed={state.categories.includes(category)}
              onClick={() => update({ categories: toggleValue(state.categories, category) })}
            >
              {category}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="onboarding-input-field">
        <label htmlFor="onboarding-city">City or state <span>Optional</span></label>
        <input
          id="onboarding-city"
          type="text"
          autoComplete="address-level2"
          value={state.city}
          onChange={(event) => update({ city: event.target.value })}
          placeholder="e.g. Lagos"
        />
      </div>
    </>
  );
}

export function SellOneStep({ headingRef, state, update }) {
  return (
    <>
      <Heading headingRef={headingRef}>What will you offer?</Heading>
      <ToggleGrid
        choices={ONBOARDING_INTERESTS.map((label) => ({ label }))}
        selected={state.sellerTypes}
        label="What you will offer"
        onToggle={(value) => update({ sellerTypes: toggleValue(state.sellerTypes, value) })}
      />
      <div className="onboarding-input-field">
        <label htmlFor="onboarding-display-name">Name buyers will see</label>
        <input
          id="onboarding-display-name"
          type="text"
          autoComplete="organization"
          value={state.displayName}
          onChange={(event) => update({ displayName: event.target.value })}
          aria-invalid={!state.displayName.trim()}
          required
        />
        <small>Your legal name for verification is collected separately.</small>
        {(!state.sellerTypes.length || !state.displayName.trim()) && (
          <p className="onboarding-hint">Choose at least one offer type and enter the name buyers will see.</p>
        )}
      </div>
    </>
  );
}

export function SellTwoStep({ headingRef, state, update }) {
  const options = [
    ['delivery', 'I arrange delivery'],
    ['pickup', 'Buyer pickup'],
    ['both', 'Both'],
  ];
  return (
    <>
      <Heading headingRef={headingRef}>How will you hand over physical items?</Heading>
      <div className="onboarding-choice-grid" role="group" aria-label="Default fulfilment">
        {options.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={state.fulfilmentDefault === value}
            className={`onboarding-choice ${state.fulfilmentDefault === value ? 'is-selected' : ''}`}
            onClick={() => update({ fulfilmentDefault: value })}
          >
            <span>{label}</span>
          </button>
        ))}
      </div>
      <p className="onboarding-note">This is saved as your account default and can be changed for each listing. Terms are saved with each order.</p>
    </>
  );
}

function VerificationChoice({ label, value, onChange }) {
  const options = [['soon', 'Do this soon'], ['planned', 'Planned'], ['later', 'Later']];
  return (
    <fieldset className="onboarding-verification-card">
      <legend>{label}</legend>
      <div className="onboarding-verification-options" role="group" aria-label={`${label} timing`}>
        {options.map(([option, title]) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            className={`onboarding-chip ${value === option ? 'is-selected' : ''}`}
            onClick={() => onChange(option)}
          >
            {title}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SellThreeStep({ headingRef, state, update }) {
  return (
    <>
      <Heading headingRef={headingRef}>Get ready to be paid.</Heading>
      <p className="onboarding-intro">You can start creating listings now. Before your first payout, two separate checks are needed.</p>
      <div className="onboarding-verification-list">
        <VerificationChoice
          label="Verify your identity (KYC)"
          value={state.verificationIntent.identity}
          onChange={(identity) => update({ verificationIntent: { identity } })}
        />
        <VerificationChoice
          label="Verify your bank account"
          value={state.verificationIntent.bank}
          onChange={(bank) => update({ verificationIntent: { bank } })}
        />
      </div>
    </>
  );
}

export function EscrowStep({ headingRef }) {
  return (
    <>
      <Heading headingRef={headingRef}>How escrow payment links work</Heading>
      <ol className="onboarding-numbered">
        <li><span>1</span><div><strong>Create a link</strong><p>Set out what’s being offered and the terms.</p></div></li>
        <li><span>2</span><div><strong>Share it</strong><p>Send the link to the other person in the deal.</p></div></li>
        <li><span>3</span><div><strong>They review, then join</strong><p>Both sides review and agree to the details.</p></div></li>
        <li><span>4</span><div><strong>Complete the deal</strong><p>Follow the steps shown in the transaction.</p></div></li>
      </ol>
      <p className="onboarding-note">Protection depends on the supported payment arrangement. Its limits are explained in the link flow.</p>
    </>
  );
}

export function TrustStep({ headingRef }) {
  return (
    <>
      <Heading headingRef={headingRef}>Before you start</Heading>
      <div className="onboarding-trust-list">
        <article><strong>Agree on clear terms</strong><p>Make sure everyone understands what’s included and when it will be delivered.</p></article>
        <article><strong>Keep a shared record</strong><p>Use the Escrit transaction to keep the details and updates together.</p></article>
        <article><strong>Know the limits</strong><p>Not every purchase uses escrow. Check the arrangement and protections shown for each deal.</p></article>
      </div>
    </>
  );
}

export function DoneStep({ headingRef, state, name, email, onResend, resendMessage }) {
  const checklist = ['Account created', 'Verify your email'];
  if (state.goals.includes('Buy')) checklist.push('Explore the marketplace');
  if (state.goals.includes('Sell')) checklist.push('Verify your identity', 'Verify your bank account', 'Create your first listing', 'Preview your storefront');
  if (state.goals.includes('Escrow')) checklist.push('Create your first escrow payment link');
  return (
    <>
      <Heading headingRef={headingRef}>You’re all set, {firstName(name)}</Heading>
      <p className="onboarding-intro">Your Escrit account is ready to use.</p>
      <ul className="onboarding-checklist">
        {checklist.map((item, index) => (
          <li key={item}><span className={index === 0 ? 'is-done' : ''} aria-hidden="true">{index === 0 ? '✓' : '○'}</span>{item}
            {item === 'Verify your email' && email && <small>{email}</small>}
            {item === 'Verify your email' && <button className="onboarding-inline-link" type="button" onClick={onResend}>Resend</button>}
            {item === 'Preview your storefront' && <Link className="onboarding-inline-link" to="/account/storefront">Preview</Link>}
          </li>
        ))}
      </ul>
      {resendMessage && <p className="onboarding-status" role="status">{resendMessage}</p>}
    </>
  );
}

export function EscrowReturnWelcome({ headingRef, name, onContinue }) {
  return (
    <>
      <Heading headingRef={headingRef}>Welcome to Escrit, {firstName(name)}</Heading>
      <p className="onboarding-intro">Your account is ready. Let’s take you back to the transaction you came for.</p>
      <div className="onboarding-note">
        <strong>One account for everything</strong>
        <p>You can also shop, sell and create escrow links later from your dashboard, with no separate accounts.</p>
      </div>
      <div className="onboarding-actions onboarding-finish-actions">
        <button className="onboarding-button primary" type="button" onClick={onContinue}>Continue to my transaction</button>
      </div>
    </>
  );
}

const LINK_STATE_COPY = {
  expired: {
    title: 'This link has expired',
    body: 'Ask the sender to create a new link, or contact Escrit support if you think this is a mistake.',
  },
  cancelled: {
    title: 'This link was cancelled',
    body: 'The sender is no longer accepting this transaction. Contact them for an updated link.',
  },
  already_accepted: {
    title: 'These terms were already accepted',
    body: 'You can review the transaction details and its latest status from your orders.',
  },
  invalid: {
    title: 'We couldn’t find this transaction',
    body: 'Check that you opened the original link. If it still doesn’t work, contact Escrit support.',
  },
};

export function TransactionPreviewCard({ headingRef, preview, loading, error, onRetry, onReview, onDashboard, reviewLabel = 'Review terms and continue' }) {
  if (loading) {
    return (
      <>
        <Heading headingRef={headingRef}>Back to your transaction</Heading>
        <p className="onboarding-intro">Loading the transaction details securely…</p>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Heading headingRef={headingRef}>We couldn’t load this link</Heading>
        <p className="onboarding-intro" role="alert">{error}</p>
        <div className="onboarding-actions">
          <button className="onboarding-button primary" type="button" onClick={onRetry}>Try again</button>
          <button className="onboarding-button secondary" type="button" onClick={onDashboard}>Go to dashboard</button>
        </div>
      </>
    );
  }

  if (preview?.state !== 'valid') {
    const stateCopy = LINK_STATE_COPY[preview?.state] || LINK_STATE_COPY.invalid;
    return (
      <>
        <Heading headingRef={headingRef}>{stateCopy.title}</Heading>
        <p className="onboarding-intro">{stateCopy.body}</p>
        <div className="onboarding-actions onboarding-finish-actions">
          <button className="onboarding-button primary" type="button" onClick={onDashboard}>Go to dashboard</button>
          <a className="onboarding-inline-link" href="/#contact">Visit the help centre</a>
        </div>
      </>
    );
  }

  const amount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(preview.amountKobo || 0) / 100);
  return (
    <>
      <Heading headingRef={headingRef}>Back to your transaction</Heading>
      <p className="onboarding-intro">We kept your link. Review the terms before you accept anything.</p>
      <article className="onboarding-transaction-card" aria-label="Transaction preview">
        <span className="onboarding-transaction-status">Waiting for you to accept terms</span>
        <p className="onboarding-transaction-amount">{amount}</p>
        <h2>{preview.title}</h2>
        <dl>
          <div><dt>From</dt><dd>{preview.from}</dd></div>
          <div><dt>Release rule</dt><dd>{preview.releaseRule}</dd></div>
          <div><dt>Fees</dt><dd>{preview.fees || 'Shown before you pay.'}</dd></div>
        </dl>
        {preview.termsSnapshot && (
          <div className="onboarding-terms-snapshot">
            <h3>Terms summary</h3>
            <p>{preview.termsSnapshot}</p>
          </div>
        )}
      </article>
      <p className="onboarding-note">You will confirm your details and accept the terms on the next screen. Nothing is paid yet.</p>
      <div className="onboarding-actions onboarding-finish-actions">
        <button className="onboarding-button primary" type="button" onClick={onReview}>{reviewLabel}</button>
        <button className="onboarding-button secondary" type="button" onClick={onDashboard}>Go to dashboard</button>
      </div>
    </>
  );
}

export const ONBOARDING_SCREEN_COMPONENTS = {
  welcome: WelcomeStep,
  buy: BuyStep,
  sell1: SellOneStep,
  sell2: SellTwoStep,
  sell3: SellThreeStep,
  escrow: EscrowStep,
  trust: TrustStep,
  done: DoneStep,
  'escrow-welcome': EscrowReturnWelcome,
  'escrow-preview': TransactionPreviewCard,
};

export { ONBOARDING_GOALS };
