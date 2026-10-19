export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export function passwordStrength(password) {
  const value = String(password);
  const score = [value.length >= 8, /[0-9]/.test(value), /[^A-Za-z0-9\s]/.test(value), /[A-Z]/.test(value) || /[a-z]/.test(value)].filter(Boolean).length;
  if (!value) return { score: 0, label: 'Too weak' };
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score] };
}

export function validateSignIn({ email, password }) {
  return { email: validateEmail(email) ? '' : 'Enter a valid email address.', password: password ? '' : 'Enter your password.' };
}

export function validateSignUp({ email, fullName, password }) {
  return {
    email: validateEmail(email) ? '' : 'Enter a valid email address.',
    fullName: String(fullName).trim().split(/\s+/).filter(Boolean).length >= 2 ? '' : 'Enter your first and last name.',
    password: String(password).length >= 8 && (/[0-9]/.test(password) || /[^A-Za-z0-9\s]/.test(password)) ? '' : 'Use at least 8 characters and include a number or symbol.',
  };
}
