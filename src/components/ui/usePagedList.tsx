import { IonInfiniteScroll, IonInfiniteScrollContent } from "@ionic/react";
import { useCallback, useEffect, useRef, useState } from "react";

const PAGE = 30;

type Paged = { done: boolean; loadMore: () => Promise<void> };

/**
 * Loads items page by page; render `<LoadMore list={...} />` after the items to fetch more on scroll.
 * Changing `key` (or calling reset) starts over from the first page.
 */
export function usePagedList<T>(
  fetchPage: (opts: { limit: number; offset: number }) => Promise<T[]>,
  key: unknown = null,
  pageSize = PAGE
) {
  const [items, setItems] = useState<T[] | null>(null);
  const [done, setDone] = useState(false);
  const [generation, setGeneration] = useState(0);

  // `token` identifies the current reset, so pages from an older one are dropped.
  const state = useRef({ token: 0, loading: false, done: false, count: 0, fetchPage, pageSize });
  state.current.fetchPage = fetchPage;
  state.current.pageSize = pageSize;

  const load = useCallback(async (token: number, offset: number) => {
    const s = state.current;
    s.loading = true;
    try {
      const page = await s.fetchPage({ limit: s.pageSize, offset });
      if (token !== s.token) return;
      s.count = offset + page.length;
      s.done = page.length < s.pageSize;
      setItems((prev) => (offset === 0 ? page : [...(prev ?? []), ...page]));
      setDone(s.done);
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

  const loadMore = useCallback(async () => {
    const s = state.current;
    if (!s.loading && !s.done && s.count > 0) await load(s.token, s.count);
  }, [load]);

  const reset = useCallback(() => setGeneration((g) => g + 1), []);
  return { items, done, loadMore, reset };
}

/** Infinite-scroll trigger for a usePagedList result. */
export function LoadMore({ list }: { list: Paged }) {
  return (
    <IonInfiniteScroll
      disabled={list.done}
      onIonInfinite={(e) => list.loadMore().finally(() => e.target.complete())}
    >
      <IonInfiniteScrollContent />
    </IonInfiniteScroll>
  );
}
