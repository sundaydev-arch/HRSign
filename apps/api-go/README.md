# HRSign Go API

**Standalone** Envelope backend. Implements [`packages/contracts/openapi/docusign-parity.yaml`](../../packages/contracts/openapi/docusign-parity.yaml).

- Does **not** import or call Next.js / `apps/web`
- Same routes & JSON as Python and the Next `/api/v1` surface
- Can be the only process you deploy (with Postgres + object storage later)

## Run

```bash
cd apps/api-go
go mod tidy
go run ./cmd/server
```

Health: http://localhost:8080/v1/health

## Use with the web UI

```bash
# repo root .env  (+ apps/web/.env → ../../.env)
NEXT_PUBLIC_API_BASE=http://localhost:8080/v1
pnpm dev
```

## Parity

In-memory store covering Phase 0–4 contract routes plus hosted sign, conditional tabs, and Connect configurations. Status: [`FEATURE_MATRIX.md`](../../packages/contracts/FEATURE_MATRIX.md). Architecture: [`docs/architecture/multi-backend.md`](../../docs/architecture/multi-backend.md).

```bash
# from repo root — smoke Go (+ Python if running)
PY_URL=http://127.0.0.1:8000/v1 GO_URL=http://127.0.0.1:8080/v1 pnpm contract:test
```

## Persistence (planned)

Set `HRSIGN_DATABASE_URL` in a future iteration to use [`packages/contracts/schema/envelope.sql`](../../packages/contracts/schema/envelope.sql). Until then, data resets on process restart.
