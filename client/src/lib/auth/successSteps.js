export function getSignInSuccessContent() {
  return {
    heading: "You're signed in",
    actionLabel: 'Go to dashboard',
    actionHref: '/dashboard',
  };
}

export function getSignUpNextSteps(intents) {
  const steps = ['Verify your email'];
  if (intents.some((intent) => intent === 'Sell' || intent === 'Escrow links')) {
    steps.push('Verify your identity', 'Add a bank account to get paid');
  } else {
    steps.push('Browse the marketplace');
  }
  return steps;
}

export function getSignUpSuccessContent(email, intents) {
  return {
    heading: 'Check your inbox',
    email,
    nextSteps: getSignUpNextSteps(intents),
  };
}
