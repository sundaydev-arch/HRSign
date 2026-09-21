"use client";

import { useTranslations } from "next-intl";
import { ApiClientError } from "@/lib/client";
import { useCallback } from "react";

/**
 * Resolve a thrown value to a localized, user-facing message.
 *
 * ApiClientError carries the backend error code plus interpolation params;
 * the message is rendered from the `errors.<CODE>` catalog. Unknown errors
 * fall back to a caller-provided generic message.
 *
 * The returned callback is memoized (it only changes when the active locale
 * or message catalog changes), so callers can safely list it in useCallback
 * / useEffect dependencies without triggering refetch loops.
 */
export function useApiError() {
  const t = useTranslations();

  return useCallback(
    (err: unknown, fallbackKey = "common.actionFailed"): string => {
      if (err instanceof ApiClientError) {
        const key = `errors.${err.code}`;
        if (t.has(key)) {
          return t(key, (err.params ?? {}) as Record<string, string | number>);
        }
      }
      return t(fallbackKey);
    },
    [t],
  );
}
