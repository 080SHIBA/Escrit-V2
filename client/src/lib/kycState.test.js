import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KYC_STEPS,
  maskIdNumber,
  nextWizardStep,
  previousWizardStep,
  statusScreenFor,
  validateFile,
  validatePersonalDetails,
  validateStep,
} from './kycState.js';

const validForm = {
  legalName: 'Ada Okafor',
  dob: '1995-06-18',
  idType: 'nin',
  idNumber: '12345678901',
};

const image = (name = 'front.jpg', size = 1024, type = 'image/jpeg') => ({ name, size, type });

test('personal details require two name words, a valid DOB and a matching ID number', () => {
  assert.deepEqual(validatePersonalDetails(validForm), {});
  assert.equal(validatePersonalDetails({ ...validForm, legalName: 'Ada' }).legalName, 'Enter your legal name using at least two words.');
  assert.equal(validatePersonalDetails({ ...validForm, dob: '2999-01-01' }).dob, 'Enter a valid date of birth that is not in the future.');
  assert.equal(validatePersonalDetails({ ...validForm, idNumber: '1234567890' }).idNumber, 'NIN must be exactly 11 digits.');
  assert.equal(validatePersonalDetails({ ...validForm, idNumber: '1234567890x' }).idNumber, 'NIN must be exactly 11 digits.');
  assert.equal(validatePersonalDetails({ ...validForm, idType: 'passport', idNumber: 'ABCDE' }).idNumber, 'Enter at least 6 characters for this ID number.');
  assert.deepEqual(validatePersonalDetails({ ...validForm, idType: 'passport', idNumber: 'P1234567' }), {});
});

test('each wizard step validates its own required fields and documents', () => {
  assert.equal(validateStep(0, validForm, {}, false), '');
  assert.match(validateStep(1, validForm, {}, false), /front of your ID/);
  assert.equal(validateStep(1, validForm, { idFront: image() }, false), '');
  assert.match(validateStep(2, validForm, { idFront: image() }, false), /selfie/);
  assert.equal(validateStep(2, validForm, { selfie: image() }, false), '');
  assert.match(validateStep(3, validForm, {}, false), /Confirm/);
  assert.equal(validateStep(3, validForm, {}, true), '');
});

test('file validation accepts image and PDF ID files and enforces the 5 MB limit', () => {
  assert.equal(validateFile(image()), '');
  assert.equal(validateFile(image('id.pdf', 1024, 'application/pdf'), { allowPdf: true }), '');
  assert.equal(validateFile(image('id.pdf', 1024, 'application/pdf')), 'Choose an image file.');
  assert.match(validateFile(image('large.png', 5 * 1024 * 1024 + 1)), /5 MB/);
  assert.match(validateFile(image('wrong.exe', 1024, 'application/octet-stream'), { allowPdf: true }), /image or PDF/);
});

test('wizard navigation stays within visited steps and bounds', () => {
  assert.equal(KYC_STEPS.length, 4);
  assert.equal(nextWizardStep(0, false), 0);
  assert.equal(nextWizardStep(0, true), 1);
  assert.equal(nextWizardStep(3, true), 3);
  assert.equal(previousWizardStep(3), 2);
  assert.equal(previousWizardStep(0), 0);
});

test('each KYC status selects the expected screen and review IDs are masked', () => {
  assert.equal(statusScreenFor('none'), 'wizard');
  assert.equal(statusScreenFor('pending'), 'pending');
  assert.equal(statusScreenFor('verified'), 'verified');
  assert.equal(statusScreenFor('rejected'), 'rejected');
  assert.equal(maskIdNumber('12345678901'), '•••••••8901');
  assert.equal(maskIdNumber(''), '');
});
