import { useEffect, useRef } from 'react';

// WHAT: calls `onLoadMore` whenever an invisible "sentinel" element near the
// bottom of a list scrolls into (or close to) view, and returns a ref to attach
// to that sentinel.
//
// WHY IntersectionObserver instead of a scroll listener: the browser tells us
// when the sentinel is visible without us measuring on every scroll event, so
// scrolling stays smooth even on low-end phones.
//
// WHY a large rootMargin (default 1200px): the next page starts loading while
// the visitor is still about a screen and a half away from the end. By the time
// they get there the new cards are already rendered, so they never see a
// "Load more" button or a loading pause.
//
// WHY `enabled`: the caller turns this off while a page is loading, when there
// is nothing more to load, or after a failure. Without that, a failing request
// would be retried in a tight loop because the sentinel would stay on screen.
export function useInfiniteScroll({ onLoadMore, enabled, rootMargin = '1200px 0px' }) {
  const sentinelRef = useRef(null);
  // WHY a ref for the callback: the caller's function changes identity every
  // render; reading it through a ref avoids tearing down and re-creating the
  // observer each time.
  const callbackRef = useRef(onLoadMore);
  callbackRef.current = onLoadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!enabled || !node) return undefined;

    // WHY a feature check: very old browsers lack IntersectionObserver. In that
    // case we simply do nothing here and the grid shows a manual button instead.
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) callbackRef.current();
    }, { rootMargin });
    observer.observe(node);
    // WHY cleanup: stops observing when the list changes or unmounts so we never
    // call into a component that is gone.
    return () => observer.disconnect();
    // WHY `enabled` is a dependency: when a page finishes loading, `enabled`
    // flips back to true and the observer is re-created. If the sentinel is
    // STILL in view (because the new cards did not fill the screen), the fresh
    // observer fires immediately and the next page loads. That is what makes the
    // list keep filling itself on tall screens.
  }, [enabled, rootMargin]);

  return sentinelRef;
}
