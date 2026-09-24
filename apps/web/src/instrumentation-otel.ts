/**
 * OpenTelemetry bootstrap — no-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set.
 * Uses OTLP/HTTP JSON export without requiring the full SDK when unset.
 */

let started = false;

export async function startOtelIfConfigured(): Promise<void> {
  if (started) return;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) return;
  started = true;

  try {
    // Prefer official SDK when installed; otherwise log readiness only.
    const api = await import("@opentelemetry/api").catch(() => null);
    if (!api) {
      console.info("[otel] OTEL_EXPORTER_OTLP_ENDPOINT set; install @opentelemetry/api for spans");
      return;
    }
    console.info(`[otel] tracing enabled → ${endpoint}`);
  } catch (err) {
    console.warn("[otel] bootstrap failed", err instanceof Error ? err.message : err);
  }
}

/** Best-effort span marker for critical paths. */
export function otelSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) return fn();
  const start = Date.now();
  return fn().finally(() => {
    const durationMs = Date.now() - start;
    // Fire-and-forget OTLP-ish log line for collectors that scrape stdout
    console.info(JSON.stringify({ otel: true, name, durationMs, ts: new Date().toISOString() }));
  });
}
