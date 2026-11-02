// WHAT: A tiny, non-secret flag in localStorage that says "this browser has
// signed in before". It holds no token and no personal data.
// WHY: On first paint we do not know yet whether the httpOnly refresh cookie
// is still valid (only the server can tell us). Without this flag every
// visitor had to wait for the server before anything rendered. With it we can
// tell brand-new visitors (render public pages instantly) apart from returning
// users (keep retrying the session restore while the server wakes up).
const KEY = 'escrit:session-hint';

// WHY try/catch: localStorage throws in private mode or when storage is
// blocked. A missing hint must degrade to "treat as visitor", never crash.
export function hasSessionHint() {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setSessionHint() {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // Ignored on purpose: the hint is an optimisation, not a requirement.
  }
}

export function clearSessionHint() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignored on purpose: see setSessionHint.
  }
}
