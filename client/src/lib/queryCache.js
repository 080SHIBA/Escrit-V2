// =============================================================================
// queryCache.js: a small "stale-while-revalidate" cache for API data.
//
// WHAT: remembers the answer to a request, hands it back instantly the next
// time the same data is wanted, and quietly re-fetches in the background so the
// screen corrects itself if anything changed.
//
// WHY: before this, every page visit started from an empty skeleton and waited
// for the server, even when the visitor had looked at that exact page seconds
// ago. The API is hosted on a free-tier style platform where responses are
// slow, so repeat visits felt slow for no reason. Showing known data first and
// refreshing behind it makes navigation feel instant without ever showing
// data that stays wrong.
//
// WHY hand-rolled and not a library: the app needs only four things (dedupe,
// freshness, persistence for public data, wipe on logout). A library would add
// bundle weight for features we would not use, and these rules are small enough
// to read in one sitting.
//
// KEY CONVENTION (this is a security rule, not just naming):
//   "pub:..."  public data, identical for everyone (listings, reviews). Safe to
//              keep in localStorage so even a brand-new tab paints instantly.
//   "u:..."    data about the signed-in person (orders, cart, favourites).
//              Kept in MEMORY ONLY and wiped on login/logout, so it can never
//              be read from disk or leak to the next person on a shared device.
// =============================================================================

const PUBLIC_PREFIX = 'pub:';
const STORAGE_PREFIX = 'escrit:qc:';
// WHY 24h: public data on disk is only a first-paint placeholder; the
// background refresh corrects it. A day-old placeholder is still far better
// than a skeleton, but we should not show week-old prices as if they were news.
const MAX_PERSISTED_AGE_MS = 24 * 60 * 60 * 1000;

// key -> { data, updatedAt }
const store = new Map();
// key -> Promise: the request currently running for that key.
// WHY: if three components ask for the same listings at once, only ONE network
// request should be made and all three should share its answer.
const inflight = new Map();
// key -> Set<function>: components listening for changes to that key.
const listeners = new Map();

const hasStorage = () => {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    // WHY: merely touching localStorage can throw when storage is blocked.
    return false;
  }
};

const isPublicKey = (key) => key.startsWith(PUBLIC_PREFIX);

function readPersisted(key) {
  if (!isPublicKey(key) || !hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.updatedAt > MAX_PERSISTED_AGE_MS) {
      window.localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    // WHY: corrupt JSON or blocked storage must degrade to "no cache", never crash.
    return null;
  }
}

function writePersisted(key, entry) {
  if (!isPublicKey(key) || !hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // WHY ignored: a full disk (quota) only means we lose the head start next
    // visit. The in-memory copy still works for this session.
  }
}

function notify(key) {
  listeners.get(key)?.forEach((listener) => {
    try { listener(); } catch { /* one broken listener must not block the others */ }
  });
}

// WHAT: read what we currently know for a key (memory first, then disk).
export function getEntry(key) {
  if (!key) return null;
  const inMemory = store.get(key);
  if (inMemory) return inMemory;
  const persisted = readPersisted(key);
  if (persisted) store.set(key, persisted); // WHY: avoid re-parsing JSON on every read.
  return persisted;
}

// WHAT: true when the cached data is younger than staleTime.
// WHY: fresh data needs no network call at all; stale data is still shown but
// refreshed behind the scenes.
export function isFresh(key, staleTime) {
  const entry = getEntry(key);
  return Boolean(entry) && Date.now() - entry.updatedAt < staleTime;
}

// WHAT: overwrite cached data. `next` may be a value or an updater function.
// WHY an updater: optimistic updates (e.g. an order changing status) need to
// build on whatever is cached right now, not on a stale copy held by a component.
export function setData(key, next) {
  if (!key) return;
  const previous = store.get(key)?.data;
  const data = typeof next === 'function' ? next(previous) : next;
  // WHY the equality check: a background refresh that returns identical data
  // must NOT create a new object. Components compare by reference in effects;
  // a "new" but identical listing would, for example, reset the quantity the
  // buyer just picked on the listing page.
  if (previous !== undefined && sameJson(previous, data)) {
    store.set(key, { data: previous, updatedAt: Date.now() });
    return;
  }
  const entry = { data, updatedAt: Date.now() };
  store.set(key, entry);
  writePersisted(key, entry);
  notify(key);
}

function sameJson(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// WHAT: run `fetcher` for `key` and store the result. Returns the data.
// Options:
//   staleTime   skip the network when cached data is younger than this (ms)
//   force       ignore freshness and always fetch (used by "Retry")
//   retryDelays waits between automatic retries for network/5xx failures
//   merge       (old, fresh) => data. Lets paginated lists keep the extra pages
//               the visitor already scrolled through when page 1 is refreshed.
export function fetchQuery(key, fetcher, {
  staleTime = 0,
  force = false,
  retryDelays = [],
  merge,
} = {}) {
  if (!force && isFresh(key, staleTime)) return Promise.resolve(getEntry(key).data);
  // WHY dedupe: see `inflight` above.
  if (inflight.has(key)) return inflight.get(key);

  const run = (async () => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const fresh = await fetcher();
        const old = store.get(key)?.data;
        setData(key, merge && old !== undefined ? merge(old, fresh) : fresh);
        return getEntry(key).data;
      } catch (error) {
        // WHY retry only when there is no HTTP status or it is 5xx: a real 4xx
        // (not found, forbidden) will not fix itself, but a network failure or
        // 5xx usually means the server is still waking from sleep.
        const retryable = !error?.status || error.status >= 500;
        if (!retryable || attempt >= retryDelays.length) throw error;
        await sleep(retryDelays[attempt]);
      }
    }
  })().finally(() => inflight.delete(key));

  inflight.set(key, run);
  return run;
}

// WHAT: warm the cache for data the visitor is likely to want next (for example
// when they hover a listing card). Errors are swallowed: it is only a head start.
export function prefetch(key, fetcher, options = {}) {
  return fetchQuery(key, fetcher, { staleTime: 60_000, ...options }).catch(() => {});
}

// WHAT: subscribe to changes of one key. Returns the unsubscribe function.
export function subscribe(key, listener) {
  if (!key) return () => {};
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(listener);
  return () => {
    listeners.get(key)?.delete(listener);
    if (!listeners.get(key)?.size) listeners.delete(key);
  };
}

// WHAT: mark data as out of date so the next read refetches. Matches a key or a
// prefix. WHY: after a mutation (checkout, KYC approval) cached lists are wrong.
export function invalidate(prefix) {
  for (const [key, entry] of store.entries()) {
    if (key.startsWith(prefix)) {
      store.set(key, { ...entry, updatedAt: 0 });
      notify(key);
    }
  }
}

// WHAT: forget everything about the signed-in person.
// WHY: called on login and logout so one account's orders or cart can never be
// shown to the next account that signs in on the same browser.
export function clearPrivateCache() {
  for (const key of [...store.keys()]) {
    if (!isPublicKey(key)) {
      store.delete(key);
      notify(key);
    }
  }
  for (const key of [...inflight.keys()]) {
    if (!isPublicKey(key)) inflight.delete(key);
  }
}

// WHAT: test helper that resets all state.
export function __resetForTests() {
  store.clear();
  inflight.clear();
  listeners.clear();
}
