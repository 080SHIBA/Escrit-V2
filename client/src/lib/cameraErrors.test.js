import test from 'node:test';
import assert from 'node:assert/strict';
import { browserFamily, cameraProblem, classifyCameraError } from './cameraErrors.js';

test('classifies real causes separately', () => {
  assert.equal(classifyCameraError({ name: 'NotAllowedError' }), 'denied');
  assert.equal(classifyCameraError({ name: 'NotFoundError' }), 'no-device');
  assert.equal(classifyCameraError({ name: 'NotReadableError' }), 'busy');
  assert.equal(classifyCameraError({ code: 'model' }), 'model');
  assert.equal(classifyCameraError(new TypeError('x')), 'unknown');
});
test('only a real block tells the person to change site settings', () => {
  assert.match(cameraProblem('denied', 'Mozilla/5.0 (iPhone)').body, /Website Settings/);
  assert.doesNotMatch(cameraProblem('model').body, /settings/i);
  assert.doesNotMatch(cameraProblem('unknown').body, /permission/i);
});
test('browser family', () => {
  assert.equal(browserFamily('Mozilla/5.0 (Linux; Android 13) Chrome/120'), 'android-chrome');
});
