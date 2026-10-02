import { DependencyList, useCallback, useEffect, useState, useSyncExternalStore } from "react";

/** Runs an async API call on mount and whenever deps change. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fn()
      .then((result) => {
        if (cancelled) return;
        setError(null);
        setData(result);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError(err);
        setData(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, loading, error, reload };
}

// Tab pages stay mounted, so a write on one tab has to tell the others to reload.
let dataVersion = 0;
const listeners = new Set<() => void>();

/** Call after any write so mounted pages reload their data. */
export function notifyChanged() {
  dataVersion += 1;
  listeners.forEach((l) => l());
}

/** A counter that increases after every write; use it as a dependency to reload. */
export function useDataVersion() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => dataVersion
  );
}
