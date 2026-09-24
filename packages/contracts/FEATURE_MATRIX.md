# Feature matrix — DocuSign parity (open source)

Status codes: `done` | `partial` | `stub` | `planned`

Every row must eventually be **done** in **all three** backends (Next / Python / Go).

## Phase 0 — Platform

| Capability | Next | Python | Go |
|------------|------|--------|-----|
| Health | done | done | done |
| OpenAPI serve | done | done | done |
| Envelope schema | done | done | done |
| Account / Org model | partial | partial | partial |
| Connect webhooks | partial | partial | partial |

## Phase 1 — eSign Core

| Capability | Next | Python | Go |
|------------|------|--------|-----|
| Envelope CRUD + send/void | done | done | done |
| Multi-document | done | done | done |
| Recipients (signer/cc/…) | done | done | done |
| Tabs (sign/initial/text/…) | partial | partial | partial |
| PowerForms | partial | partial | partial |
| Bulk send | partial | partial | partial |
| Embedded signing JWT | partial | partial | partial |
| Certificate of Completion | partial | partial | partial |
| Hosted recipient sign | partial | partial | partial |
| Brands | partial | partial | partial |
| Comments | partial | partial | partial |
| Conditional tabs | partial | partial | partial |

## Phase 2 — Identity & Delivery

| Capability | Next | Python | Go |
|------------|------|--------|-----|
| Email delivery | done | stub | stub |
| SMS OTP / delivery | partial | stub | stub |
| IDV plugins | partial | partial | partial |
| In-person / witness | partial | partial | partial |

## Phase 3 — Platform products

| Capability | Next | Python | Go |
|------------|------|--------|-----|
| Clickwrap | partial | partial | partial |
| Rooms | partial | partial | partial |
| CLM | partial | partial | partial |
| Notary | partial | partial | partial |

## Phase 4 — Admin & Trust

| Capability | Next | Python | Go |
|------------|------|--------|-----|
| Multi-tenant accounts | partial | partial | partial |
| Evidence pack export | partial | partial | partial |
| CA / PAdES providers | partial | partial | partial |
| Official SDKs | partial | planned | planned |

> **Storage note:** Python (`apps/api-py`) and Go (`apps/api-go`) are **independent** implementations of the same OpenAPI contract. They do not call Next. Set `HRSIGN_DATABASE_URL` (same Postgres as Prisma) to persist Envelope list/create/get against the shared schema; otherwise they use in-memory maps. Next remains the durable Prisma reference for the full product surface.

**How to run contract smoke:** `pnpm contract:test` (artifacts). With live servers: `PY_URL=… GO_URL=… pnpm contract:test`. Architecture: [`docs/architecture/multi-backend.md`](../../docs/architecture/multi-backend.md).
