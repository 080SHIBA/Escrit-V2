import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { localDraftKey, mergeDraftIntoDefaults, pickNewerDraft, serializableValues } from '../lib/formDraftStore.js';

// WHAT: one hook that makes any form remember what was typed, everywhere.
//
//   const draft = useFormDraft('profile', { name: '', city: '' });
//   <input value={draft.values.name} onChange={e => draft.setField('name', e.target.value)} />
//   ...on successful submit: draft.clear();
//
// Covered cases, and how:
//   * Page reload / navigating away and back: every change is written to
//     localStorage immediately (synchronously), so nothing typed is ever lost,
//     even if the network is down or the tab dies a moment later.
//   * Sign out and in again, or another device: changes are also saved to the
//     server a short moment after typing stops. On load the newer of the local
//     and server copies wins (see pickNewerDraft).
//   * Closing the tab mid-edit: a final save is fired on pagehide/hidden using
//     fetch keepalive, which the browser lets finish after the page is gone.
//   * Going offline: saving is retried when the connection returns.
//
// `extra` is a second piece of state (like the current wizard step) saved with
// the values so the visitor returns to the same place, not just the same text.
// `exclude` names fields never saved (e.g. File objects, anything secret).

const SAVE_DELAY_MS = 900;

export function useFormDraft(formKey, defaults, { exclude = [], enabled = true, extraDefaults = {} } = {}) {
  const { status, seller } = useAuthContext();
  const userId = String(seller?._id || seller?.id || '');
  const active = enabled && status === 'authed' && Boolean(userId) && Boolean(formKey);
  const storageKey = active ? localDraftKey(userId, formKey) : '';

  // WHY refs for defaults/exclude: callers pass fresh objects every render; reading
  // through refs stops that from re-running effects.
  const defaultsRef = useRef(defaults);
  const extraDefaultsRef = useRef(extraDefaults);
  const excludeRef = useRef(exclude);
  excludeRef.current = exclude;

  const [values, setValuesState] = useState(() => ({ ...defaults }));
  const [extra, setExtraState] = useState(() => ({ ...extraDefaults }));
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  // 'idle' | 'saving' | 'saved' | 'offline' | 'error'
  const [saveState, setSaveState] = useState('idle');

  const latest = useRef({ values, extra });
  const editedAt = useRef(0);       // when the visitor last changed anything
  const dirty = useRef(false);      // true when there are unsent changes
  const touched = useRef(false);    // true once the visitor typed (protects against a late server load)
  const timer = useRef(null);
  const inFlight = useRef(false);

  const writeLocal = useCallback(() => {
    if (!storageKey) return;
    try {
      const payload = { updatedAt: editedAt.current, data: { values: serializableValues(latest.current.values, excludeRef.current), extra: serializableValues(latest.current.extra) } };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // WHY ignore: storage can be full or blocked (private mode). Server save still works.
    }
  }, [storageKey]);

  const flush = useCallback(async ({ keepalive = false } = {}) => {
    if (!active || !dirty.current || inFlight.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSaveState('offline');
      return;
    }
    inFlight.current = true;
    const sentAt = editedAt.current;
    setSaveState('saving');
    try {
      const data = { values: serializableValues(latest.current.values, excludeRef.current), extra: serializableValues(latest.current.extra) };
      await api.saveFormDraft(formKey, data, new Date(sentAt).toISOString(), { keepalive });
      // WHY compare timestamps: if the visitor kept typing during the request, the
      // newer edit still needs its own save, so we stay dirty.
      if (editedAt.current === sentAt) dirty.current = false;
      setSaveState(dirty.current ? 'saving' : 'saved');
    } catch {
      setSaveState('error');
    } finally {
      inFlight.current = false;
      if (dirty.current && !keepalive) {
        // WHY reschedule: covers both "kept typing" and "failed, try again shortly".
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => flush(), SAVE_DELAY_MS * 3);
      }
    }
  }, [active, formKey]);

  const schedule = useCallback(() => {
    editedAt.current = Date.now();
    dirty.current = true;
    touched.current = true;
    writeLocal();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flush(), SAVE_DELAY_MS);
  }, [flush, writeLocal]);

  // Restore on mount / when the account or form changes.
  useEffect(() => {
    if (!active) { setReady(status !== 'checking'); return undefined; }
    let cancelled = false;
    setReady(false);
    let local = null;
    try { local = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { local = null; }

    const apply = (draft) => {
      if (cancelled || touched.current || !draft?.data) return;
      setValuesState(mergeDraftIntoDefaults(defaultsRef.current, draft.data.values));
      setExtraState(mergeDraftIntoDefaults(extraDefaultsRef.current, draft.data.extra));
      setRestored(true);
    };
    // Show the local copy instantly, before the network answers.
    if (local) apply(local);

    api.getFormDraft(formKey)
      .then(({ draft: server }) => {
        if (cancelled) return;
        const choice = pickNewerDraft(local, server);
        if (choice === 'server') {
          apply({ data: server.data });
          // Keep this device's copy in step so a later reload is instant.
          try { localStorage.setItem(storageKey, JSON.stringify({ updatedAt: new Date(server.updatedAt).getTime(), data: server.data })); } catch { /* see writeLocal */ }
        } else if (choice === 'local' && local && !touched.current) {
          // Local is newer than the server: push it up so other devices get it.
          editedAt.current = Number(local.updatedAt) || Date.now();
          dirty.current = true;
          flush();
        }
      })
      .catch(() => { /* offline or server asleep: the local copy (if any) is already applied */ })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, formKey, storageKey]);

  // Final save when the tab is hidden or closed, and retry when back online.
  useEffect(() => {
    if (!active) return undefined;
    const onHide = () => {
      if (document.visibilityState === 'hidden' && dirty.current) { window.clearTimeout(timer.current); flush({ keepalive: true }); }
    };
    const onPageHide = () => { if (dirty.current) flush({ keepalive: true }); };
    const onOnline = () => { if (dirty.current) flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
      // WHY flush on unmount: navigating to another page inside the app must not drop the last edit.
      window.clearTimeout(timer.current);
      if (dirty.current) flush({ keepalive: true });
    };
  }, [active, flush]);

  const setField = useCallback((name, value) => {
    setValuesState((current) => {
      const next = { ...current, [name]: typeof value === 'function' ? value(current[name]) : value };
      latest.current = { ...latest.current, values: next };
      return next;
    });
    schedule();
  }, [schedule]);

  const setValues = useCallback((updater) => {
    setValuesState((current) => {
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      latest.current = { ...latest.current, values: next };
      return next;
    });
    schedule();
  }, [schedule]);

  // WHAT: replace the values WITHOUT marking them as an edit.
  // WHY: some forms are filled from the server (an existing profile). That is not
  // something the person typed, so it must not be saved as a draft or it would
  // overwrite the real saved profile on the next device.
  const reset = useCallback((next) => {
    setValuesState(next);
    latest.current = { ...latest.current, values: next };
  }, []);

  const setExtra = useCallback((name, value) => {
    setExtraState((current) => {
      const next = { ...current, [name]: value };
      latest.current = { ...latest.current, extra: next };
      return next;
    });
    schedule();
  }, [schedule]);

  // WHY keep `latest` in sync on every render too: restores and resets also change state.
  latest.current = { values, extra };

  // WHAT: forget the draft (call after a successful submit).
  // WHY: otherwise the next visit would pre-fill the form with data that was already sent.
  const clear = useCallback(async ({ keepValues = false } = {}) => {
    window.clearTimeout(timer.current);
    dirty.current = false;
    touched.current = true;
    if (storageKey) { try { localStorage.removeItem(storageKey); } catch { /* ignore */ } }
    // WHY keepValues: after saving, the screen should keep showing what was just saved, not snap back to the old defaults.
    if (!keepValues) setValuesState({ ...defaultsRef.current });
    setExtraState({ ...extraDefaultsRef.current });
    setRestored(false);
    setSaveState('idle');
    try { await api.deleteFormDraft(formKey); } catch { /* it expires on its own after 90 days */ }
  }, [formKey, storageKey]);

  return { values, setField, setValues, reset, extra, setExtra, restored, ready, saveState, clear };
}
