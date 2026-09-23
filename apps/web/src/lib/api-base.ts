/**
 * Envelope API base for the browser UI.
 *
 * Three backends are **independent** (no backend calls another):
 *   - Next (default): same-origin `/api/v1`
 *   - Python: set NEXT_PUBLIC_API_BASE=http://localhost:8000/v1
 *   - Go:     set NEXT_PUBLIC_API_BASE=http://localhost:8080/v1
 *
 * `path` is the contract path after `/v1`, e.g. `/envelopes`, `/health`.
 */
export function apiV1(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (!base) return `/api/v1${suffix}`;
  return `${base}${suffix}`;
}
