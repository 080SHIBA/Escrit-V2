import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Guided tour: each step spotlights a real element (found through a
// data-tour attribute) and explains it in a card.
//
//   <SpotlightTour
//     storageKey="escrit_seller_tour"
//     steps={[{ selector: '[data-tour="new-link"]', title: '...', body: '...' }]}
//     active={links !== null}   // delay until the targets have rendered
//   />
//
// Steps whose target is missing or hidden (for example a desktop-only
// nav item on a phone) are skipped automatically.
//
// The overlay is portaled to <body>: its pieces are `position: fixed` and
// positioned from viewport coordinates, and any transformed ancestor would
// re-anchor them and shift the spotlight off its target.

const PAD = 8; // breathing room around the highlighted element
const EDGE = 4; // minimum distance from the viewport edge
const GAP = 14; // space between the highlight and the card
const MARGIN = 16; // minimum distance from the card to the viewport edge
const CARD_MAX_WIDTH = 320;
const CARD_MIN_HEIGHT = 170;

// The element for a selector, or null if it is absent or not visible.
function findTarget(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const { width, height } = el.getBoundingClientRect();
  return width > 0 && height > 0 ? el : null;
}

// Highlight box for an element, clamped so it never leaves the viewport.
function measureTarget(el) {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(EDGE, Math.min(r.left - PAD, vw - EDGE));
  const top = Math.max(EDGE, Math.min(r.top - PAD, vh - EDGE));
  return {
    top,
    left,
    width: Math.min(r.width + PAD * 2, vw - left - EDGE),
    height: Math.min(r.height + PAD * 2, vh - top - EDGE),
  };
}

// Card position: below the highlight if it fits, otherwise above, and
// docked to the bottom of the screen when the target fills the viewport.
function layoutCard(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_MAX_WIDTH, vw - MARGIN * 2);
  const left = Math.min(Math.max(rect.left, MARGIN), Math.max(MARGIN, vw - width - MARGIN));

  const spaceBelow = vh - (rect.top + rect.height) - GAP - MARGIN;
  const spaceAbove = rect.top - GAP - MARGIN;

  if (spaceBelow < CARD_MIN_HEIGHT && spaceAbove < CARD_MIN_HEIGHT) {
    return { width, left, bottom: MARGIN, maxHeight: vh - MARGIN * 2 };
  }
  if (spaceBelow >= CARD_MIN_HEIGHT || spaceBelow >= spaceAbove) {
    return { width, left, top: rect.top + rect.height + GAP, maxHeight: spaceBelow };
  }
  return { width, left, bottom: vh - rect.top + GAP, maxHeight: spaceAbove };
}

const sameRect = (a, b) =>
  a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

export default function SpotlightTour({ storageKey, userId, steps, active = true, onDone }) {
  const scopedStorageKey = userId ? `${storageKey}:${userId}` : storageKey;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(scopedStorageKey) === '1');
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [card, setCard] = useState(null);
  const direction = useRef(1); // 1 = moving forward, -1 = moving back (used when skipping)

  useLayoutEffect(() => {
    setDismissed(localStorage.getItem(scopedStorageKey) === '1');
  }, [scopedStorageKey]);

  const running = active && !dismissed;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const finish = useCallback(() => {
    localStorage.setItem(scopedStorageKey, '1');
    setDismissed(true);
    onDone?.();
  }, [scopedStorageKey, onDone]);

  const next = useCallback(() => {
    direction.current = 1;
    if (stepIndex >= steps.length - 1) finish();
    else setStepIndex(stepIndex + 1);
  }, [stepIndex, steps.length, finish]);

  const back = useCallback(() => {
    direction.current = -1;
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Skip a step whose target is not on screen, continuing in the
  // direction the person was already moving.
  useEffect(() => {
    if (!running || !step) return undefined;
    const frame = requestAnimationFrame(() => {
      if (findTarget(step.selector)) return;
      const target = stepIndex + direction.current;
      if (target >= steps.length) finish();
      else if (target < 0) {
        direction.current = 1;
        setStepIndex(stepIndex + 1);
      } else setStepIndex(target);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, step, stepIndex, steps.length, finish]);

  // Bring the target into view once per step, then keep the highlight
  // aligned as the page scrolls, resizes or the target changes size.
  useLayoutEffect(() => {
    if (!running || !step) return undefined;
    const el = findTarget(step.selector);
    if (!el) {
      setRect(null);
      return undefined;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = measureTarget(el);
        setRect((prev) => (sameRect(prev, box) ? prev : box));
      });
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(el);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      observer?.disconnect();
    };
  }, [running, step, stepIndex]);

  useLayoutEffect(() => {
    if (!rect) {
      setCard(null);
      return undefined;
    }
    const update = () => setCard(layoutCard(rect));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [rect]);

  useEffect(() => {
    if (running && rect && card) localStorage.setItem(scopedStorageKey, '1');
  }, [running, rect, card, scopedStorageKey]);

  useEffect(() => {
    if (!running) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') back();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, next, back, finish]);

  if (!running || !step || !rect || !card) return null;

  const boxStyle = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Transparent layer so stray taps cannot navigate away mid-tour. */}
      <div className="fixed inset-0 z-[59]" />
      <div className="tour-overlay-hole" style={boxStyle} />
      <div className="tour-ring" style={boxStyle} />
      <div
        className="fixed z-[62] certificate p-4 shadow-lg animate-pop-in overflow-y-auto"
        style={{
          top: card.top,
          bottom: card.bottom,
          left: card.left,
          width: card.width,
          maxHeight: card.maxHeight,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIndex ? 'w-5 bg-seal' : 'w-1.5 bg-line'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-ink/45">
            {stepIndex + 1} of {steps.length}
          </span>
        </div>
        <p className="font-display text-lg leading-snug">{step.title}</p>
        <p className="text-sm text-ink/70 mt-1.5">{step.body}</p>
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={finish}
            className="text-xs text-ink/50 hover:text-ink/80 transition-colors py-2 -ml-1 px-1"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={back}
                className="text-sm font-medium border border-line px-3 py-1.5 hover:border-ink transition-colors rounded-lg"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="text-sm font-medium border border-ink bg-ink text-paper px-3 py-1.5 hover:bg-ink/90 transition-colors rounded-lg"
            >
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Re-arms a finished tour so it plays again.
export function resetTour(storageKey) {
  localStorage.removeItem(storageKey);
}

// Every stage of the seller walkthrough (bank account, dashboard, new
// link, link detail) plays once per page, each under its own key.
// Replaying the whole tour clears all of them.
export const SELLER_TOUR_KEYS = [
  'escrit_seller_tour_bank',
  'escrit_seller_tour', // dashboard
  'escrit_seller_tour_createlink',
  'escrit_seller_tour_linkdetail',
];

export function resetTours(storageKeys, userId) {
  storageKeys.forEach((storageKey) => {
    resetTour(storageKey);
    if (userId) resetTour(`${storageKey}:${userId}`);
  });
}
