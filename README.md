# HRSign — HR e-Sign Workflow

[English](./README.md) ｜ [中文](./README.zh-CN.md)

**HRSign** is an open-source, self-hosted, **single-tenant** electronic signing and company-seal workflow system purpose-built for **internal HR documents**: offer letters, employment contracts, onboarding/offboarding certificates, employment certificates, and income certificates.

It provides visual PDF template authoring, approval workflows, image-based company seals, handwritten signatures, passwordless external signing, tamper-evident audit logs, and role-based access control.

> ⚠️ **Legal disclaimer:** Phase 1 delivers *visual seals + handwritten signature images* for internal process traceability only. It is **not** a "reliable electronic signature" under PRC e-signature law and carries no legal-validity guarantee. Phase 2 will plug in compliant providers (CA / PAdES / SM2) behind the existing `SignatureProvider` interface. Legal conclusions are the responsibility of the operator, the CA, and legal counsel.

## Multi-backend (open source)

**Order (locked):** Next.js first → Python port → Go port.  
Py/Go are **standalone** (they never call Next). Shared contract only: [`packages/contracts`](./packages/contracts).

| Backend | Path | Role |
|---------|------|------|
| **Next.js** | [`apps/web`](./apps/web) | UI + durable `/api/v1` (Prisma) — primary |
| **Python** | [`apps/api-py`](./apps/api-py) | FastAPI port of the same OpenAPI (in-memory) |
| **Go** | [`apps/api-go`](./apps/api-go) | Go port of the same OpenAPI (in-memory) |

Status grid: [`packages/contracts/FEATURE_MATRIX.md`](./packages/contracts/FEATURE_MATRIX.md).  
Architecture: [`docs/architecture/multi-backend.md`](./docs/architecture/multi-backend.md).  
Ops (deploy / SLO / PAdES): [`docs/operations/`](./docs/operations/).

```bash
# Optional: point the UI at a sibling backend
# NEXT_PUBLIC_API_BASE=http://localhost:8000/v1   # Python
# NEXT_PUBLIC_API_BASE=http://localhost:8080/v1   # Go
pnpm contract:test
PY_URL=http://127.0.0.1:8000/v1 GO_URL=http://127.0.0.1:8080/v1 pnpm contract:test
```

---

## What is HRSign?

HRSign turns a blank PDF into a controlled, auditable signing workflow:

1. **HR uploads a PDF template** and visually places text / date / seal / signature fields.
2. **A signing task is initiated** from a published version: dynamic form values are rendered server-side into a new immutable PDF version; approvers, seal holders, and signers (internal employees or external people with no account) are assigned in sequential or parallel order.
3. **Approval** is required before any company seal may be applied — enforced on the backend by the state machine, not just hidden in the UI.
4. **Signing**: internal users stamp an approved seal or draw a handwritten signature; external signers open a one-time, hashed email link and sign without an account.
5. **Archive**: every PDF version is stored separately (never overwritten) with SHA-256 hashes, and every action is appended to a hash-chained audit log.

## Target audience & use cases

- **Audience:** HR / operations / IT teams of companies that want to keep employee documents and signing data **on their own infrastructure**, without per-envelope SaaS fees.
- **Typical deployments:** intranet HR document flow, internal approvals with company seals, candidate/employee remote signing via email links.
- **Not a fit (yet):** legally-compliant qualified electronic signatures requiring CA certificates (Phase 2), multi-tenant SaaS, or customer-facing mass e-contracting.

## Positioning — how it differs

| | HRSign | Commercial e-sign SaaS (DocuSign, Fadada, eSignbao) | Generic PDF tools |
|---|---|---|---|
| Hosting | **Self-hosted, single-tenant, data stays in your VPC** | Vendor cloud | Local files |
| Cost | Open-source (Apache-2.0), no per-document fee | Per-seat / per-envelope | License / free |
| Focus | **HR document workflows + approval-before-seal** | General-purpose contracting | Manual editing |
| Extensibility | Provider interfaces for storage/identity/signature/notification | Vendor-defined | None |
| Audit | Hash-chained append-only log, multi-version retention | Vendor-held evidence | None |

## Feature status (Phase 1 / MVP)

**Implemented**

- Template management with a visual PDF field editor (pdf.js; drag, resize, paging) and immutable versioning: DRAFT → PUBLISHED → ARCHIVED
- Signing task initiation with dynamic forms; sequential and parallel flows; configurable expiry
- Two independent state machines — approval (`DRAFT/PENDING/APPROVED/REJECTED/WITHDRAWN`) and signing (`NOT_STARTED/IN_PROGRESS/COMPLETED/DECLINED/EXPIRED/REVOKED`) — with a single transition table and 90+ unit tests
- Backend-only PDF pipeline (pdf-lib): field filling with embedded **Noto Sans SC** subset, image seal stamping, global watermark; every stage is a new immutable file version with SHA-256
- Handwritten signature pad; company seal management (demo seals only — never ship a real company seal)
- External passwordless signing via one-time **hashed** tokens (revocable, expiring, single-use for signing) plus email verification codes before sign
- RBAC: super admin / HR / department leader / employee; backend-enforced data scoping
- Append-only audit log with `SHA-256` hash chaining (`pnpm audit:verify`)
- S3-compatible storage abstraction (MinIO by default; replaceable via `StorageProvider`)
- Email (SMTP) notifications with i18n templates; pluggable Notifier interface
- Bilingual UI infrastructure: `zh-CN` / `en` via next-intl (Accept-Language + switcher + cookie; ICU MessageFormat)
- Docker one-shot (`Dockerfile` + compose `app`/`worker`/`mailpit` profiles), `/api/health`, zod env validation, Prisma migration baseline
- API Keys + HMAC webhooks + OpenAPI ([v1 contract](./packages/contracts/openapi/docusign-parity.yaml); legacy task routes in [`docs/openapi.yaml`](./docs/openapi.yaml)) + batch task create; admin UI for keys/webhooks/settings
- pg-boss worker for notify retries, expiry scan, retention scan; legal hold toggles in archive
- Optional OIDC SSO; CSP/security headers; in-process rate limits; PDF upload heuristics; GitHub Actions CI

**Roadmap** (see [docs/requirements/product-spec.md](./docs/requirements/product-spec.md) for authoritative status)

- Compliant PAdES / SM2 signatures (Phase 2 interfaces already stubbed)
- Multi-tenant SaaS / Helm charts

## Tech stack & requirements

- **Runtime:** Node.js **20 LTS+** (Node 18.18+ minimum), **pnpm 9**
- **Framework:** Next.js 15.1 (App Router) + React 19, TypeScript strict (`noUncheckedIndexedAccess`, no `any`)
- **UI:** Tailwind CSS + shadcn/ui only
- **Data:** PostgreSQL 16 + Prisma 6
- **Storage:** MinIO (S3-compatible; replaceable via `StorageProvider`)
- **PDF:** pdf-lib + @pdf-lib/fontkit (server), pdfjs-dist (client preview, scripts disabled)
- **Auth:** Auth.js (NextAuth v5 beta), credentials now; OIDC planned
- **Validation:** zod at every system boundary (API, forms, env, Prisma `Json` columns)
- **i18n:** next-intl; dates/numbers via `Intl` only
- **Tests:** Vitest (98 tests); Playwright planned

## Quick start

### Prerequisites by OS

You need **Node.js 20+**, **pnpm 9**, **Docker** (for PostgreSQL + MinIO), and `git`.

**macOS (Homebrew):**
```bash
brew install node@20 pnpm docker --cask docker
brew services start docker  # or open Docker Desktop manually
```

**Windows (winget / PowerShell):**
```powershell
winget install OpenJS.NodeJS.LTS
npm install -g pnpm@9
winget install Docker.DockerDesktop   # then start Docker Desktop once
```

**Linux (Debian/Ubuntu):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm@9
# Docker Engine: https://docs.docker.com/engine/install/ubuntu/
```

Verify:
```bash
node -v   # v20.x or higher
pnpm -v   # 9.x
docker -v
```

### 1. Get the code & install

```bash
git clone https://github.com/<your-org>/hrsign.git
cd hrsign
pnpm install          # also copies the pdf.js worker into public/
```

### 2. Start infrastructure

```bash
# Postgres + MinIO only (typical local app via pnpm dev)
docker compose up -d

# Full stack: app + worker + Mailpit UI (http://localhost:8025)
docker compose --profile full up -d --build
```

Starts PostgreSQL 16 on host port **5433** and MinIO on **9000** (console **9001**, `minioadmin / minioadmin123`), and creates the `hrsign` bucket automatically. With `--profile full`, the app listens on **3000** and the worker runs pg-boss jobs.

**Backup / restore (volumes)**

```bash
# Postgres dump
docker exec hrsign-postgres pg_dump -U hrsign hrsign > backup.sql
# Restore
cat backup.sql | docker exec -i hrsign-postgres psql -U hrsign hrsign

# MinIO data lives in Docker volume hrsign_miniodata — back up with
# `docker run --rm -v hrsign_miniodata:/data -v "$PWD":/backup alpine tar czf /backup/minio.tgz /data`
```

### 3. Configure environment

```bash
cp .env.example .env
# Next.js only loads env from apps/web — link once:
ln -sf ../../.env apps/web/.env
```

For local development the defaults work as-is. Before any non-local deployment, at minimum change `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`), database credentials, and MinIO keys. SMTP is optional — notifications are marked SKIPPED when unset.

### 4. Database & run

```bash
pnpm db:generate       # generate Prisma client
pnpm db:migrate        # create/upgrade schema (dev)
# production upgrades:
# pnpm db:migrate:deploy

pnpm db:seed           # demo accounts + demo data

pnpm dev               # http://localhost:3000
pnpm worker            # optional: pg-boss worker in another terminal
# production:
pnpm build && pnpm start
```

Integration docs: [packages/contracts/openapi/docusign-parity.yaml](./packages/contracts/openapi/docusign-parity.yaml) (canonical `/api/v1`). Legacy HR task routes: [docs/openapi.yaml](./docs/openapi.yaml). Verify audit chain: `pnpm audit:verify`.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@hrsign.local` | `Admin@123456` |
| HR | `hr@hrsign.local` | `Hr@123456` |
| Department leader | `leader@hrsign.local` | `Leader@123456` |
| Employee | `employee@hrsign.local` | `Employee@123456` |

Seed data is framed as **Yunqi Information Technology (Shanghai)** with an English roster (Kai Lin, Avery Chen, …) — no “[Demo]” labels in the UI. Seal PNGs in the repo are still synthetic artwork (never commit a real company seal).

Walkthrough and feature matrix: **[docs/DEMO.md](./docs/DEMO.md)**. After seed, leader sees pending task **Offer letter — Wanqing Zhou · Product Manager**.

## Usage walkthrough

**Upload & publish a template** — `Templates` → upload a blank PDF → drag fields onto the page → save (draft versions only are editable) → **Publish**.

**Initiate a task** — `Tasks` → new task → choose the published template → fill the dynamic fields → add approvers/seal holders/signers (external people just need a name + email) → set expiry → submit.

```bash
# The server renders values into a new PDF version, e.g.
# storage key: documents/<docId>/v1-FILLED.pdf   (sha256 recorded)
```

**Approve → seal → sign** — approvers act in order; the seal button is only honoured after full approval; external signers receive `http://localhost:3000/sign/external/<token>`.

**Verify quality gates locally**
```bash
pnpm lint
pnpm typecheck
pnpm test               # 98 unit tests (state machines + i18n)
pnpm test:coverage
pnpm build

node scripts/e2e-smoke.mjs            # 31-assertion HTTP smoke test (server must be running)
node scripts/check-i18n-keys.mjs      # en/zh-CN message key parity
pnpm contract:test                    # OpenAPI / matrix artifacts (+ optional live backends)
```

## Configuration reference

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection (host port 5433 in compose) | `postgresql://hrsign:***@localhost:5433/hrsign` |
| `MINIO_ENDPOINT/PORT/USE_SSL` | S3 endpoint | `localhost / 9000 / false` |
| `MINIO_ACCESS_KEY/SECRET_KEY/BUCKET` | Credentials + bucket | `minioadmin / *** / hrsign` |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Canonical app URL / JWT secret | **change in production** |
| `AUTH_TRUST_HOST` | Trust forwarded host (proxy) | `true` |
| `APP_URL` | Base URL used in notification links | `http://localhost:3000` |
| `WATERMARK_TEXT` | Global watermark text on signed versions | `HRSign INTERNAL` |
| `NEXT_PUBLIC_API_BASE` | Optional Envelope API override (Py/Go) | empty = Next `/api/v1` |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | Email sending; empty = SKIPPED | — |
| `OIDC_ISSUER/CLIENT_ID/CLIENT_SECRET` | Optional OIDC SSO | leave blank to disable |
| `DATABASE_URL_WORKER` | Optional separate URL for pg-boss | defaults to `DATABASE_URL` |

## Project layout

```
apps/web/               # Next.js UI + /api + /api/v1 Envelope API
apps/api-py/            # Python FastAPI Envelope API (standalone)
apps/api-go/            # Go Envelope API (standalone)
packages/contracts/     # OpenAPI, SQL, FEATURE_MATRIX, state machines
packages/sdk-ts/        # Thin TypeScript /v1 client
prisma/                 # schema + migrations + seed (used by apps/web)
scripts/                # contract:test, i18n, e2e, pdf worker
docs/                   # Requirements, architecture, agent skills
```

See [docs/architecture/code-map.md](./docs/architecture/code-map.md) and [docs/architecture/multi-backend.md](./docs/architecture/multi-backend.md). Product spec: [docs/requirements/product-spec.md](./docs/requirements/product-spec.md).

## Documentation for contributors

- [Contributing guide](./CONTRIBUTING.md) — dev setup, branch/commit conventions, PR workflow
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md) — vulnerability reporting
- [Changelog](./CHANGELOG.md)
- [docs/](./docs/README.md) — product requirements, architecture map, reusable engineering skills

## License

[Apache License 2.0](./LICENSE). Bundled **Noto Sans SC** is under the SIL Open Font License (OFL); see the font directory. **MinIO server is AGPL-3.0** — HRSign only calls it over the S3 protocol and you may substitute another S3-compatible store.
