"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Loads data on mount and exposes the loading/error/data triple.
 *
 * Every dashboard list screen repeats the same `useState` + `useEffect` +
 * manual `loading` flag dance. This centralises it, including the two details
 * that are easy to get wrong by hand: a fetch that resolves after the component
 * unmounts must not set state, and a stale response from a superseded `reload()`
 * must not overwrite a newer one.
 *
 * `fetcher` must be stable — wrap it in `useCallback` when it closes over props.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  initialValue: T,
): {
  data: T;
  loading: boolean;
  error: Error | null;
  setData: React.Dispatch<React.SetStateAction<T>>;
  reload: () => void;
} {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Flipping `loading` here rather than inside the effect keeps the effect body
  // free of synchronous setState, which would trigger a cascading render.
  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;

    fetcher()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetcher, reloadToken]);

  return { data, loading, error, setData, reload };
}
