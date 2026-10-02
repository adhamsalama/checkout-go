import { DependencyList, useCallback, useEffect, useState } from "react";

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

/** Shows an error from an API call to the user. */
export function alertError(err: unknown) {
  console.error(err);
  alert(err instanceof Error ? err.message : String(err));
}
