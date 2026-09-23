"use client";

import { useCallback, useRef, useState } from "react";

/**
 * List/query loader that keeps previous data visible while refreshing,
 * so the UI doesn't jump to a full-page loading skeleton.
 */
export function useRefreshableLoad() {
  const booted = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (booted.current) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await fn();
      booted.current = true;
      return result;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  return { loading, refreshing, run };
}
