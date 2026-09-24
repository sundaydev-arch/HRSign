# HRSign Python API

**Standalone** Envelope backend (FastAPI). Implements [`packages/contracts/openapi/docusign-parity.yaml`](../../packages/contracts/openapi/docusign-parity.yaml).

- Does **not** import or call Next.js / `apps/web`
- Same routes & JSON as Go and the Next `/api/v1` surface
- Can be the only process you deploy (with Postgres + object storage later)

## Run

```bash
cd apps/api-py
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

Health: http://localhost:8000/v1/health

## Use with the web UI

```bash
# repo root .env  (+ apps/web/.env → ../../.env)
NEXT_PUBLIC_API_BASE=http://localhost:8000/v1
pnpm dev
```

## Parity

In-memory store covering Phase 0–4 contract routes plus hosted sign, conditional tabs, and Connect configurations. Status: [`FEATURE_MATRIX.md`](../../packages/contracts/FEATURE_MATRIX.md). Architecture: [`docs/architecture/multi-backend.md`](../../docs/architecture/multi-backend.md).

```bash
# from repo root — smoke Python (+ Go if running)
PY_URL=http://127.0.0.1:8000/v1 GO_URL=http://127.0.0.1:8080/v1 pnpm contract:test
```

## Persistence

Set `HRSIGN_DATABASE_URL` (or `DATABASE_URL`) to the same Postgres as Prisma to persist Envelope list/create/get. Without it, data resets on process restart. Schema: shared Prisma migrations / [`packages/contracts/schema/envelope.sql`](../../packages/contracts/schema/envelope.sql).
