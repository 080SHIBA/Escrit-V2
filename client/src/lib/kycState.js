export const KYC_STEPS = Object.freeze([
  'Personal details',
  'ID document',
  'Selfie check',
  'Review',
]);

export const KYC_ID_TYPES = Object.freeze([
  { value: 'nin', label: 'NIN' },
  { value: 'drivers-license', label: "Driver's license" },
  { value: 'passport', label: 'International passport' },
  { value: 'voters-card', label: "Voter's card" },
]);

/**
 * @typedef {Object} KycSubmission
 * @property {string} legalName
 * @property {string} dob
 * @property {'nin'|'drivers-license'|'passport'|'voters-card'} idType
 * @property {string} idNumber
 * @property {string} idFrontUrl
 * @property {string=} idBackUrl
 * @property {string} selfieUrl
 * @property {'none'|'pending'|'verified'|'rejected'} status
 */

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'image/avif', 'image/gif', 'image/bmp', 'image/tiff',
]);

export function validatePersonalDetails(form) {
  const errors = {};
  const words = form.legalName.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) errors.legalName = 'Enter your legal name using at least two words.';
  if (!form.dob || Number.isNaN(Date.parse(`${form.dob}T00:00:00Z`)) || form.dob > new Date().toISOString().slice(0, 10)) {
    errors.dob = 'Enter a valid date of birth that is not in the future.';
  }
  if (!KYC_ID_TYPES.some((type) => type.value === form.idType)) errors.idType = 'Choose an ID type.';
  const number = form.idNumber.trim();
  if (form.idType === 'nin' && !/^\d{11}$/.test(number)) errors.idNumber = 'NIN must be exactly 11 digits.';
  else if (form.idType && number.length < 6) errors.idNumber = 'Enter at least 6 characters for this ID number.';
  else if (!number) errors.idNumber = 'Enter your ID number.';
  return errors;
}

export function validateFile(file, { allowPdf = false } = {}) {
  if (!file) return '';
  const accepted = ACCEPTED_IMAGES.has(file.type) || (allowPdf && file.type === 'application/pdf');
  if (!accepted) return allowPdf ? 'Choose an image or PDF file.' : 'Choose an image file.';
  if (file.size > MAX_FILE_BYTES) return 'Choose a file that is 5 MB or smaller.';
  return '';
}

export function validateStep(step, form, files, consent) {
  if (step === 0) return Object.values(validatePersonalDetails(form))[0] || '';
  if (step === 1) return validateFile(files.idFront, { allowPdf: true }) || (!files.idFront ? 'Upload the front of your ID.' : '');
  if (step === 2) return validateFile(files.selfie) || (!files.selfie ? 'Upload a selfie.' : '');
  if (step === 3 && !consent) return 'Confirm that these details are yours and accurate.';
  return '';
}

export function nextWizardStep(step, valid) {
  return valid ? Math.min(KYC_STEPS.length - 1, step + 1) : step;
}

export function previousWizardStep(step) {
  return Math.max(0, step - 1);
}

export function statusScreenFor(status) {
  if (status === 'verified') return 'verified';
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  return 'wizard';
}

export function maskIdNumber(idNumber) {
  const normalized = idNumber.trim();
  return normalized ? `${'•'.repeat(Math.max(4, normalized.length - 4))}${normalized.slice(-4)}` : '';
}

export function friendlyKycError(error) {
  const message = error?.message || '';
  if (/request failed|internal server|(^|\D)5\d\d(\D|$)/i.test(message)) {
    return 'We couldn’t complete that request. Please try again.';
  }
  return message || 'We couldn’t complete that request. Please try again.';
}
