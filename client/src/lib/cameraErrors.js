// WHAT: turns the browser's camera errors into (a) a category the UI can act on and
// (b) a plain explanation with the exact steps for the person's browser.
//
// WHY it exists: the old code showed "Allow camera access in your browser settings" for
// almost every failure, including ones where permission WAS granted but something else
// (loading the face model, the camera being busy, a hidden video element) failed. People
// who had just tapped Allow were told to go to site settings, which is the bug that was
// reported. Each real cause now gets its own message, and only a real permission block
// mentions settings.

export function classifyCameraError(error) {
  const name = error?.name || '';
  if (error?.code === 'insecure') return 'insecure';
  if (error?.code === 'model') return 'model';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'no-device';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return 'constraints';
  return 'unknown';
}

// Steps differ a lot between browsers, so we detect the family from the user agent.
export function browserFamily(userAgent = '') {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Android/i.test(userAgent) && /Chrome/i.test(userAgent)) return 'android-chrome';
  if (/Firefox/i.test(userAgent)) return 'firefox';
  if (/Edg\//i.test(userAgent)) return 'chrome-desktop';
  if (/Chrome/i.test(userAgent)) return 'chrome-desktop';
  if (/Safari/i.test(userAgent)) return 'safari-desktop';
  return 'other';
}

const DENIED_STEPS = {
  ios: 'Tap the “aA” icon in the address bar, choose Website Settings, set Camera to Allow, then come back.',
  'android-chrome': 'Tap the lock or tune icon beside the address, choose Permissions, set Camera to Allow, then come back.',
  'chrome-desktop': 'Click the lock icon beside the address, set Camera to Allow, then come back.',
  firefox: 'Click the camera icon in the address bar, remove the block, then come back.',
  'safari-desktop': 'Open Safari › Settings › Websites › Camera, set this site to Allow, then come back.',
  other: 'Open your browser’s site settings, set Camera to Allow for this site, then come back.',
};

export function cameraProblem(category, userAgent = '') {
  switch (category) {
    case 'denied':
      return {
        title: 'Camera is blocked for this site',
        body: `${DENIED_STEPS[browserFamily(userAgent)]} The check starts by itself once access is allowed.`,
        canRetry: true,
      };
    case 'no-device':
      return { title: 'No camera found', body: 'Connect a camera or use a device that has one, then try again.', canRetry: true };
    case 'busy':
      return { title: 'Camera is in use', body: 'Another app or tab is using the camera. Close it, then try again.', canRetry: true };
    case 'insecure':
      return { title: 'Camera needs a secure page', body: 'Open Escrit using its https:// address and try again.', canRetry: false };
    case 'model':
      return { title: 'The face check couldn’t load', body: 'Your camera is fine. The check itself failed to download. Check your connection and try again.', canRetry: true };
    default:
      return { title: 'The camera couldn’t start', body: 'Try again. If it keeps happening, reload the page or try a different browser.', canRetry: true };
  }
}
