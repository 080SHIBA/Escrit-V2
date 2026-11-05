// WHAT: the pure (no React, no network) rules behind form autosave.
// WHY separate from the hook: these rules decide whether someone's typing is
// kept or lost, so they are small, side-effect free and unit-tested.

// WHAT: field names that are never saved. Mirrors the server's list.
// WHY: passwords, PINs and one-time codes must exist only in the request that
// uses them. Whole-word matching avoids dropping "shipping" because of "pin".
const FORBIDDEN_WORDS = new Set(['password', 'passcode', 'pin', 'pincode', 'otp', 'cvv', 'cvc', 'secret', 'token', 'cardnumber']);

export function isForbiddenField(name) {
  const words = String(name)
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z\d]+/)
    .filter(Boolean);
  return words.some((word) => FORBIDDEN_WORDS.has(word));
}

// WHAT: reduce form values to what can safely be stored: JSON-friendly values only.
// WHY: File/Blob objects and functions cannot be serialised (and a photo could be
// megabytes). Only text, numbers, booleans, arrays and plain objects are kept;
// uploaded files are remembered by their URL once uploaded, never by content.
export function serializableValues(values, exclude = []) {
  const skip = new Set(exclude);
  const walk = (value) => {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (Array.isArray(value)) return value.map(walk).filter((item) => item !== undefined);
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      const out = {};
      for (const [name, inner] of Object.entries(value)) {
        if (skip.has(name) || isForbiddenField(name)) continue;
        const kept = walk(inner);
        if (kept !== undefined) out[name] = kept;
      }
      return out;
    }
    return undefined;
  };
  return walk(values) ?? {};
}

// WHAT: choose between the copy on this device and the copy from the server.
// WHY: the visitor may have typed offline (local is newer) or on another device
// (server is newer). The one with the later edit time wins; ties favour local
// because it is already on screen. Returns 'local', 'server' or 'none'.
export function pickNewerDraft(local, server) {
  if (!local && !server) return 'none';
  if (!server) return 'local';
  if (!local) return 'server';
  return Number(local.updatedAt) >= Number(new Date(server.updatedAt).getTime()) ? 'local' : 'server';
}

// WHAT: layer saved values over the form's defaults.
// WHY: a form may have gained new fields since the draft was saved. Starting from
// defaults and overlaying only keys we know about keeps the form valid, and stops
// a draft from injecting unexpected fields.
export function mergeDraftIntoDefaults(defaults, saved) {
  if (!saved || typeof saved !== 'object') return { ...defaults };
  const merged = { ...defaults };
  for (const name of Object.keys(defaults)) {
    if (Object.prototype.hasOwnProperty.call(saved, name) && saved[name] !== undefined) merged[name] = saved[name];
  }
  return merged;
}

// WHAT: the browser-storage key for a draft.
// WHY include the user id: on a shared phone, one person's half-filled KYC
// must never appear for the next person who signs in.
export function localDraftKey(userId, formKey) {
  return `escrit:draft:${userId}:${formKey}`;
}
