// WHAT: the conversation a buyer has with Escrit on a USSD session (dial a short code on any phone,
// no internet needed) to sign for a delivery with their PIN.
// WHY a pure state machine with injected helpers: USSD responses are tiny strings, easy to get wrong,
// and security-sensitive (a PIN is typed). Keeping it free of database and HTTP code lets us test every
// branch with fakes.
//
// USSD gives us the whole input so far joined by "*": "" -> "12345678" -> "12345678*1234" -> "...*1".
// Replies start with "CON " (session continues) or "END " (session over).
//
// SECURITY NOTE: USSD travels over the mobile network, not end-to-end encrypted. That is the same
// trade-off mobile banking USSD makes. It is protected by: the caller's phone number must match the
// number on the buyer's account, a PIN only the buyer set on the web app, and a lockout after repeated
// wrong PINs.
export const MAX_PIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 30;

export async function ussdReply({ text = '', phoneNumber }, deps) {
  const steps = String(text).split('*').map((step) => step.trim());
  const [code, pin, confirm] = text === '' ? [] : steps;

  if (!code) return 'CON Escrit delivery signing\nEnter the 8-digit delivery code from your order:';
  if (!/^\d{8}$/.test(code)) return 'END That delivery code is not valid. Check your order and dial again.';

  const order = await deps.findOrder(code, phoneNumber);
  // WHY one vague message for "no such order" and "not your phone": an attacker must not learn which codes exist.
  if (!order) return 'END We could not match this code to your number. Dial from the phone saved on your Escrit account.';
  if (order.blockReason) return `END ${order.blockReason}`;

  if (!pin) return `CON ${order.title}\nEnter your 4 to 6 digit signing PIN:`;
  const pinResult = await deps.checkPin(order.buyerId, pin);
  if (pinResult === 'locked') return `END Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes or sign in the app.`;
  if (pinResult === 'not-set') return 'END You have not set a signing PIN. Set one in the Escrit app first.';
  if (pinResult !== 'ok') return 'END Wrong PIN. Dial again to retry.';

  if (!confirm) return `CON Confirm you have received:\n${order.title}\n1. Yes, sign\n2. Cancel`;
  if (confirm !== '1') return 'END Cancelled. Nothing was signed.';

  await deps.sign(order, phoneNumber);
  return 'END Signed. Thank you. The seller has been told to hand over your goods.';
}
