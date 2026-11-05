// WHAT: keeps a chosen file (as a Blob) in the browser's IndexedDB so it survives a page reload.
// WHY: a File cannot go in localStorage or a server draft, and on low-memory phones the browser
// often reloads the page while the camera or file picker is open. Without this, the person
// would pick their ID again and again. IndexedDB can store Blobs directly and lives on the
// device only; nothing here is uploaded.
//
// All functions swallow storage errors (private mode, quota) and simply behave as "nothing
// stored": the file still works for the current session, it just will not survive a reload.
const DB_NAME = 'escrit-files';
const STORE = 'blobs';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, action) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function stashFile(key, file) {
  try { await run('readwrite', (store) => store.put({ blob: file, name: file.name, type: file.type, savedAt: Date.now() }, key)); return true; } catch { return false; }
}

export async function readStashedFile(key) {
  try {
    const record = await run('readonly', (store) => store.get(key));
    return record?.blob ? new File([record.blob], record.name || 'document', { type: record.type || record.blob.type }) : null;
  } catch { return null; }
}

export async function dropStashedFile(key) {
  try { await run('readwrite', (store) => store.delete(key)); } catch { /* nothing stored */ }
}

// Marks that the system file picker is open for `key`. If the page is killed while the picker
// is open, the flag is still there on the next load and tells us to explain what happened.
export function markPickerOpen(key) { try { localStorage.setItem(`escrit:picker:${key}`, String(Date.now())); } catch { /* ignore */ } }
export function clearPickerMark(key) { try { localStorage.removeItem(`escrit:picker:${key}`); } catch { /* ignore */ } }
export function pickerWasInterrupted(key) {
  try {
    const at = Number(localStorage.getItem(`escrit:picker:${key}`));
    // WHY a 10 minute window: an old stale mark should not trigger a confusing message days later.
    return Boolean(at) && Date.now() - at < 10 * 60 * 1000;
  } catch { return false; }
}
