import { useCallback, useEffect, useRef, useState } from "react";

const PAGE = 30;

/**
 * Loads items page by page as a sentinel element scrolls into view.
 * Changing `key` (or calling reset) starts over from the first page.
 */
export function usePagedList<T>(
  fetchPage: (opts: { limit: number; offset: number }) => Promise<T[]>,
  key: unknown = null
) {
  const [items, setItems] = useState<T[] | null>(null);
  const [done, setDone] = useState(false);
  const [generation, setGeneration] = useState(0);

  // Mutable state read by the IntersectionObserver callback.
  const state = useRef({ token: 0, loading: false, done: false, count: 0, fetchPage });
  state.current.fetchPage = fetchPage;

  const observer = useRef<IntersectionObserver | null>(null);
  const sentinelEl = useRef<HTMLElement | null>(null);

  const load = useCallback(async (token: number, offset: number) => {
    const s = state.current;
    s.loading = true;
    try {
      const page = await s.fetchPage({ limit: PAGE, offset });
      if (token !== s.token) return; // a newer reset started meanwhile
      s.count = offset + page.length;
      s.done = page.length < PAGE;
      setItems((prev) => (offset === 0 ? page : [...(prev ?? []), ...page]));
      setDone(s.done);
      // Re-observing makes the observer report again if the sentinel is still visible.
      requestAnimationFrame(() => {
        const el = sentinelEl.current;
        if (el && observer.current) {
          observer.current.unobserve(el);
          observer.current.observe(el);
        }
      });
    } catch (err) {
      console.error(err);
      if (token === s.token) setDone((s.done = true));
    } finally {
      if (token === s.token) s.loading = false;
    }
  }, []);

  useEffect(() => {
    const s = state.current;
    s.token += 1;
    s.done = false;
    s.count = 0;
    setDone(false);
    load(s.token, 0);
  }, [generation, key, load]);

  /** Ref callback for an element at the end of the list. */
  const sentinel = useCallback(
    (el: HTMLElement | null) => {
      observer.current?.disconnect();
      sentinelEl.current = el;
      if (!el) return;
      observer.current = new IntersectionObserver(
        (entries) => {
          const s = state.current;
          if (entries[0].isIntersecting && !s.loading && !s.done && s.count > 0) load(s.token, s.count);
        },
        { rootMargin: "400px" }
      );
      observer.current.observe(el);
    },
    [load]
  );

  const reset = useCallback(() => setGeneration((g) => g + 1), []);
  return { items, done, sentinel, reset };
}
