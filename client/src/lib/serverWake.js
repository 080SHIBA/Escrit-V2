import { apiUrl } from './apiBase.js';

// WHAT: Fire-and-forget request to the API's /api/health endpoint the moment
// the app boots.
// WHY: The API is hosted on a platform that puts idle servers to sleep, and a
// cold start can take a minute or more. Starting the wake-up now, in parallel
// with rendering, means the server is usually ready by the time the first real
// data request is made, instead of the first real request paying the delay.
export function wakeServer() {
  try {
    // WHY no credentials and no await: health needs no auth, and nothing may
    // ever block or fail the page because of this ping.
    fetch(apiUrl('/api/health'), { method: 'GET', cache: 'no-store' }).catch(() => {});
  } catch {
    // Ignored on purpose: purely an optimisation.
  }
}
