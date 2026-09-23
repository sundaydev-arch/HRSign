# Code and asset map (Code Map)

> Purpose: quickly find "where to change a feature, and how data flows".  
> Paths are relative to the **repo root**. The web app lives under `apps/web/` (pnpm workspace).  
> Convention: page → API Route → lib domain logic → Prisma/Provider.

For DocuSign-parity triple backends, see **[multi-backend.md](./multi-backend.md)**.

## 0. Monorepo layout

```
apps/web/                 # Next.js 15 UI + /api + /api/v1 Envelope API (Prisma)
apps/api-py/              # Python FastAPI Envelope API (standalone, in-memory)
apps/api-go/              # Go Envelope API (standalone, in-memory)
packages/contracts/       # OpenAPI, SQL, FEATURE_MATRIX, state machines
packages/sdk-ts/          # Thin TS client for /v1
prisma/                   # Shared Prisma schema (used by apps/web)
scripts/                  # contract:test, i18n, e2e, pdf worker
docs/                     # This knowledge base
```

## 1. Runtime layers (Next / primary)

```
Browser
 ├─ (dashboard)/* internal pages  ── middleware Edge session (auth.config, no Prisma)
 ├─ (auth)/login
 ├─ Envelope product pages (/envelopes, /powerforms, /clickwraps, …)
 └─ /sign/external/[token] , /sign/envelope/[id] ── public / token-gated
        │  fetch via apps/web/src/lib/client.ts (+ apiV1 for Envelope contract)
        ▼
Next.js Route Handlers
 ├─ apps/web/src/app/api/**          ← HR task/template trust boundary
 └─ apps/web/src/app/api/v1/**       ← DocuSign-parity Envelope contract
        │
        ▼
Domain  apps/web/src/lib/* (envelopes, signing, tasks, audit, rbac, pdf…)
        │
        ├─ Prisma ── PostgreSQL 16
        └─ Providers (apps/web/src/server/providers) ── MinIO / SMTP / signatures
```

Boundary rule: **API routes are the only trust boundary**; Client Components must not import Prisma.

## 2. Frontend (apps/web)

### 2.1 Notable routes

| Route | File under `apps/web/src/app` | Notes |
|-------|-------------------------------|-------|
| `/login` | `(auth)/login/page.tsx` | Credentials (+ optional OIDC) |
| `/tasks`, `/templates`, `/archive`, `/seals` | `(dashboard)/…` | HR workflow MVP |
| `/envelopes`, `/powerforms`, `/bulk-send` | `(dashboard)/…` | Envelope product surface |
| `/clickwraps`, `/rooms`, `/clm`, `/notary` | `(dashboard)/…` | Phase 3 products |
| `/admin/webhooks`, `/admin/accounts` | `(dashboard)/admin/…` | Connect + multi-account |
| `/sign/envelope/[id]` | `sign/envelope/…` | Hosted recipient sign |
| `/api/v1/*` | `api/v1/**` | Contract API (also used by SDK / Py-Go parity tests) |

### 2.2 Shared UI shells

| Component | Path | Use |
|-----------|------|-----|
| `PageHeader` | `components/layout/PageHeader.tsx` | Title + description |
| `CreatePanel` / `ListPanel` / `FieldHint` | `components/layout/ResourcePanels.tsx` | Resource create/list pages |
| `Surface` | `components/layout/Surface.tsx` | Card-like panel |
| `EmptyState` | `components/layout/EmptyState.tsx` | Empty tables |

### 2.3 Envelope client wiring

- `apps/web/src/lib/api-base.ts` — `apiV1(path)`; honors `NEXT_PUBLIC_API_BASE`
- `apps/web/src/lib/clipboard.ts` — `copyText` / `absoluteUrl`
- `apps/web/src/lib/conditional-tabs.ts` — DocuSign-style `showIf` rules
- `apps/web/src/lib/embedded-view.ts` — HMAC embed tokens
- Messages: `apps/web/messages/{en,zh-CN}.json` (keep keys in parity via `pnpm i18n:check`)

## 3. Backend (Next)

### 3.1 Envelope domain

Primary modules under `apps/web/src/lib/`:

- `envelopes.ts` — CRUD, send/void, recipient sign, Connect event hooks
- `envelope-delivery.ts` — email/SMS invite delivery
- `bulk-send.ts` — bulk batches
- Webhooks: `apps/web/src/server/webhooks/dispatch.ts` (+ Connect events in `schemas/webhook-payload.ts`)

Contract OpenAPI is the source of truth for `/api/v1` shapes — not the older `docs/openapi.yaml` task API alone.

### 3.2 HR task domain (unchanged MVP)

Still the path in product-spec for templates → tasks → approve → seal → sign. See sections below for historical flows (paths now prefixed with `apps/web/`).

| Module | Path |
|--------|------|
| Sign core | `apps/web/src/lib/signing.ts` |
| Tasks | `apps/web/src/lib/tasks.ts` / `create-task.ts` |
| RBAC | `apps/web/src/lib/rbac.ts` |
| Audit | `apps/web/src/lib/audit.ts` |
| State machines | `apps/web/src/server/state-machines/` |
| Providers | `apps/web/src/server/providers/` |

## 4. Data layer

- Prisma schema: [`prisma/schema.prisma`](../../prisma/schema.prisma) (includes Envelope*, Webhook, Clickwrap, Room, …)
- Migrations: `prisma/migrations/`
- Shared Envelope DDL (Py/Go future): [`packages/contracts/schema/envelope.sql`](../../packages/contracts/schema/envelope.sql)

## 5. Config / tooling

| File | Role |
|------|------|
| [`.env.example`](../../.env.example) | Root env template |
| `apps/web/.env` | **Required for Next** — symlink to `../../.env` (Next only loads env from the app directory) |
| [`docker-compose.yml`](../../docker-compose.yml) | Postgres `:5433`, MinIO `:9000` |
| `pnpm contract:test` | Artifact + optional live Py/Go/Next smoke |
| `pnpm i18n:check` | en/zh key parity |

## 6. Core data flows (HR task MVP)

### 6.1 Initiate → fill

`POST /api/tasks` → zod → PUBLISHED template → Document/SigningTask → `fillTemplate()` → Signer + external tokens → notify.

### 6.2 Approve → stamp → sign

State machines in `server/state-machines/*`; seal only after approval; `executeSign` writes a new DocumentVersion (no overwrite).

### 6.3 External login-free

`/sign/external/{token}` → hashed `SigningToken` lookup → optional email OTP → sign.

### 6.4 Envelope send → hosted sign → Connect

`POST /api/v1/envelopes/{id}/send` → access token hash + invites → `GET /api/v1/sign/envelope/{id}?r=&t=` (conditional tabs) → `envelope.*` / `recipient.*` Connect webhooks.

## 7. Known architecture debt

1. Py/Go still in-memory (no `HRSIGN_DATABASE_URL` wire-up yet).
2. Email/SMS delivery on Py/Go remains `stub` in FEATURE_MATRIX.
3. Official Py/Go SDKs are `planned`; TS SDK is `partial`.
4. Some FEATURE_MATRIX rows are `partial` (tabs catalog, production CA/PAdES).
5. Older `docs/openapi.yaml` documents the HR **task** API; Envelope contract lives in `packages/contracts`.

## 8. Historical note

Earlier versions of this map assumed a single-package `src/` tree. Paths above are the monorepo layout. Prefer `apps/web/src/...` when opening files.
