# Service level objectives (starter)

Targets for self-hosted HRSign operators. Wire these into your scraper/alerts (Prometheus + Alertmanager, Datadog, etc.). Metrics: `GET /api/metrics`. Health: `GET /api/health?probe=ready|live`.

| SLO | Target | Signal |
|-----|--------|--------|
| Availability | 99.5% monthly excluding planned maintenance | `probe=ready` success ratio |
| API latency (p95) | < 500 ms for `/api/v1/*` read paths | `hrsign_http_request_duration_ms` |
| Signing success | ≥ 99% of send→complete within expiry | product dashboard + audit |
| Worker job failures | < 1% of attempts | `hrsign_job_failures_total` |

## Tracing

Set `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g. `http://otel-collector:4318`) to enable stdout/OTLP markers. Install `@opentelemetry/api` in the web app for richer spans.

## Multi-instance rate limits

Set `RATE_LIMIT_REDIS_URL` (e.g. `redis://redis:6379/0`) and install `ioredis` so limiters share state across web replicas.
