# Product specification (HRSign v0.x) and implementation status

> Open-source, self-hosted, **single-tenant** internal HR e-sign and sealing system.
> This document collects **executable rules** from spec sections 0–20 and marks current implementation status (✅ / 🟡 / ⬜ / 🔒).
> Status checked: 2026-09; based on actual repo code and build artifacts (31 routes, 98 unit tests).

## 0. Positioning and disclaimer

- Applicable documents: offer letters, onboarding certificates, resignation certificates, employment contracts, employment certificates, income certificates
- Stage 1 = visual sealing + handwritten signature images, **for internal process evidence only, not a reliable electronic signature under the Electronic Signature Law**; UI seal/signature panels must show a clear disclaimer (Chinese and English copies)
- Terminology: company stamp = **Seal**; personal signing = **Signature**; code/DB/UI must not mix them
- Stage-2 compliance signatures plug in via SignatureProvider; compliance conclusions are the user's, CA's, and legal team's responsibility

Status: 🟡 Positioning and terminology landed (models/enums distinguish Seal/Signature); prominent disclaimer on seal panels still needs a page-by-page audit.

## 1. Tech stack (versions locked; upgrades need a separate PR)

Next.js 15 (App Router) + React 19, TailwindCSS + shadcn/ui (only UI library), Prisma + PostgreSQL 16, pdf-lib + @pdf-lib/fontkit (backend), pdfjs-dist (frontend preview, PDF scripts forbidden), S3-compatible storage (default MinIO, StorageProvider abstraction), Auth.js (OIDC primary / username-password secondary), zod (validate all external input / env / Json fields), pg-boss (job queue), next-intl (zh-CN default / en, ICU MessageFormat; dates and numbers via Intl API, no date library), Vitest + Playwright, GitHub Actions CI, full TS strict + `noUncheckedIndexedAccess`, no `any`.

Status: 🟡 Everything in place except pg-boss (not installed), Playwright (not installed), GitHub Actions (no workflow), OIDC (not wired); actual versions Next 15.1.6 / React 19.

## 2. Core abstract interfaces (`src/server/providers/`; business depends only on interfaces)

| Interface | Stage 1 implementation | Stage 2 |
| ----------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| SignatureProvider: sign/verify | ✅ ImageSealProvider | 🔒 PadesProvider, GmSm2Provider (empty + docs) |
| IdentityVerifier: startVerification/checkResult | ✅ EmailCodeVerifier (hashed codes / cooldown / attempts) | 🔒 Face/real-name interfaces only; no biometric storage |
| Notifier: send(channel, recipient, template, payload) | ✅ Email(SMTP), i18n templates | 🟡 WeCom/DingTalk/Feishu (WeCom is only a stub in [wecom.ts](../../src/server/providers/notify/wecom.ts)) |
| StorageProvider: put/get/presignGet/delete/exists | ✅ MinioStorageProvider (presign implemented, no callers yet) | Swappable S3/OSS/COS |

## 3. Domain model and state machines (`prisma/schema.prisma`)

### 3.1 Templates (immutable after publish)

- Template (container: name/category/locale) → TemplateVersion (DRAFT/PUBLISHED/ARCHIVED); fields belong to a version; PUBLISHED cannot be edited; changes create a new version; Document records templateVersionId
- Field types: TEXT, DATE, SEAL, SIGNATURE (🔒 PERFORATION_SEAL reserved enum only)
- Coordinates share `{ page, x, y, width, height, rotation }`, PDF points; schema comments say bottom-left origin (editor currently stores top-left origin; unify with a conversion module); pdf.js ↔ pdf-lib conversion must be a **pure-function module with unit tests** ⬜
- Coordinates/rules live in Json columns, read/write via zod (✅)

Status: ✅ Model and version-immutability rules implemented (fields editable only on DRAFT); 🟡 coordinate conversion pure functions and tests not done.

### 3.2 Document versions (never overwrite)

- Document → DocumentVersion, stage: FILLED / WATERMARKED / SEALED / SIGNED; each version stores storageKey, sha256, createdBy
- Pipeline is fixed: fill → watermark → stamp → personal signature → (stage 2) cryptographic signature → read-only lock; no edits after crypto signature

Status: 🟡 Multi-version retention ✅; actually only FILLED and SIGNED versions are produced, **WATERMARKED/SEALED intermediate versions are not stored**; lock not implemented.

### 3.3 Two independent state machines

- ApprovalStatus: DRAFT → PENDING → APPROVED | REJECTED | WITHDRAWN
- SigningStatus: NOT_STARTED → IN_PROGRESS → COMPLETED | DECLINED | EXPIRED | REVOKED
- Signer: PENDING → VIEWED → SIGNED | DECLINED; sequential (order) / parallel; sequential allows only the current turn
- Company seal requires ApprovalStatus=APPROVED; transitions live in tables; illegal transitions throw; full unit tests

Status: ✅ Three machines + tables + 91 tests in place ([state-machines](../../src/server/state-machines)); ⬜ REVOKED has no action entry; VIEWED has no instrumentation yet.

## 4. External signers (no account, not an RBAC role)

SigningToken stores only sha256, has expiry, is revocable; one-time link → email code → sign page; code attempt limits + cooldown; IP/UA recorded throughout; token invalid after sign; external page is a separate public route exposing only that signer's documents.

Status: ✅ Token hash, expiry, login-free page, usedAt after sign all implemented; 🟡 email-code infrastructure exists but the external flow currently enters by token alone; the code step is not wired into the main path.

## 5. PDF processing (backend only, async via queue)

CJK must embed fonts (fontkit + Noto Sans SC subset, font in-repo + OFL); text overflow can auto-shrink / wrap when configured; global watermark copy/opacity/angle configurable; stamp/watermark/fill all before crypto signature; frontend does not mutate PDFs.

Status: 🟡 CJK font embed ✅ ([font.ts](../../src/lib/pdf/font.ts), NotoSansSC in public/fonts), fill ✅, stamp/watermark ✅, frontend preview-only ✅; **async queue not implemented; fill currently runs synchronously inside POST**; wrap/auto-shrink not configurized.

## 6. Auth and permissions

Auth.js + OIDC (WeCom QR optional, reserved); four RBAC roles: super admin / HR / department leader / employee; unified `authorize(user, action, resource)`; frontend is display control only; HR sees all templates/docs; employees only their own; leaders only docs they approve; permission matrix must have tests.

Status: 🟡 Credentials login + backend RBAC matrix ([rbac.ts](../../src/lib/rbac.ts)) implemented; OIDC ⬜; dedicated permission-matrix unit tests ⬜ (only e2e-smoke counterexamples).

## 7. Async jobs (pg-boss)

Jobs: pdf-render, notify, expire-scan, retention-scan; all idempotent, retryable, with dead-letter and an admin page.

Status: ⬜ pg-boss not installed; expiry is lazy on API access (expireDueTasks inlined in several routes); no worker, no dead-letter, no job admin page.

## 8. Audit and tamper resistance

AuditLog append-only: prevHash + hash=sha256(prevHash + canonical JSON) chain; DB layer forbids UPDATE/DELETE (trigger or grants); records actor/time/IP/device/action/resource/result/document sha256; CLI `audit:verify` checks the whole chain.

Status: 🟡 Hash-chain writes implemented ([audit.ts](../../src/lib/audit.ts), canonical JSON key-sorted); ⬜ forbid-update trigger, audit:verify CLI, concurrency lock (extreme concurrency may break the chain; already noted in code comments).

## 9. Retention and privacy

Configurable retention years (by category) + legalHold; on expiry retention-scan soft-deletes then hard-deletes; sensitive docs (income certificates/employment contracts) optional at-rest encryption, download dynamic watermark (downloader + time); minimize PII; support export/delete requests; README tells operators to self-assess local law.

Status: ⬜ schema has RetentionPolicy/legalHold fields, application layer is unused; archive page copy still says "permanent archive", which conflicts with this section (to change).

## 10. Open APIs

REST + zod-generated OpenAPI; API Key auth; batch initiate (CSV/JSON) for HR systems; Webhook (HMAC): task created / approval result / sign complete / declined / expired.

Status: ⬜ models exist (ApiKey/Webhook/WebhookDelivery); no routes, no pages, no OpenAPI, no batch API.

## 11. Deploy and config

docker-compose one-shot app/worker/postgres/minio (dev includes mailpit); env vars validated with zod, missing vars fail startup; .env.example; health checks, migrate commands, backup/restore notes; Helm optional; note MinIO server AGPL-3.0, S3 protocol only.

Status: ✅ docker-compose app/worker/mailpit profiles, Dockerfile, env zod (`src/lib/env.ts`), `/api/health`, migrate baseline + deploy docs, backup notes; ⬜ Helm (out of scope).

## 12. Security

Uploaded PDFs checked for magic bytes/size cap; reject files with JavaScript, embedded files, Launch actions; short-lived presigned URLs; official seal originals read only on the backend; rate limits, CSRF, security headers and CSP, dependency scanning (CI); SECURITY.md.

Status: ✅ file size + magic/dangerous-structure checks, in-process rate limits, CSP/security headers in next.config, SECURITY.md, GitHub CI; 🟡 Origin/CSRF and dependency scanning still light.

## 13. Mandatory engineering rules

(1) Frontend only shadcn+Tailwind, enterprise desktop layout; (2) full TS strong types, no any, all system boundaries zod, no direct Json assertions; (3) PDF logic only on the backend; (4) seal requires prior approval; (5) files never overwritten across versions; (6) all copy i18n, both languages submitted together, missing keys fail CI; (7) no unapproved dependencies.

Status: (1)✅ (2)✅ (3)✅ (4)✅ (5)✅ (6)🟡 (only login is on next-intl; many pages/components still hardcode Chinese; key-check script exists but no CI) (7)✅.

## 14. Page inventory (12 items)

| #   | Page | Status |
| --- | ---------------------------------------- | -------------------------------------------------------- |
| 1   | Login (OIDC/account) and access control | ✅ Credentials + optional OIDC; invite / forgot / reset password ✅ |
| 2   | Template list + visual editor (versions/publish) | ✅ |
| 3   | Initiate signing (dynamic form + bulk import) | 🟡 Dynamic form ✅, JSON batch API ✅, CSV UI ⬜ |
| 4   | Pending approval / pending sign task center | ✅ |
| 5   | PDF preview + handwriting + seal panel | 🟡 Features ✅; Type / Upload signature methods ⬜ (spec 20.6) |
| 6   | External sign page (token + verification code) | ✅ Token + email code gate before sign |
| 7   | Archive (retention + legal hold) | ✅ List/versions/download, legal hold, retention-scan job |
| 8   | Audit log page (including chain-verify status) | 🟡 List ✅, CLI `pnpm audit:verify` ✅, UI chain status ⬜ |
| 9   | Seal admin | ✅ |
| 10  | User and role admin | ✅ |
| 11  | System settings (notify/storage/retention/watermark/display) | ✅ Watermark/retention in DB; SMTP/OIDC env-backed |
| 12  | API Key and Webhook admin | ✅ Secret shown once; delivery failures visible; retry queue ⬜ |

## 15. Database models (Prisma)

User, Role/Permission, Template, TemplateVersion, TemplateField, Document, DocumentVersion, SigningTask, Signer, SigningToken, Signature, ApprovalFlow, ApprovalRecord, Seal, AuditLog, RetentionPolicy, ApiKey, Webhook, WebhookDelivery, NotificationLog (also IdentityVerification, NotificationTemplate, User display-settings fields, etc.). Every Json column has a paired zod schema (✅ see [src/schemas/index.ts](../../src/schemas/index.ts)).

Status: ✅ Models + Prisma migration baseline; ApiKey/Webhook/RetentionPolicy wired in app layer; ApprovalFlow still unused.

## 16. Testing

Unit: state-machine transitions ✅, coordinate conversion ⬜, permission matrix ⬜, hash chain CLI ✅, token validation ⬜; CJK-fill PDF snapshot ⬜; Playwright E2E ⬜ (e2e-smoke.mjs exists); CI lint/typecheck/test/i18n/build ✅.

Current: Vitest 98 cases (state machines 91 + i18n 7).

## 17. Open-source governance

LICENSE (default Apache-2.0), THIRD_PARTY_LICENSES (CI-generated + license compatibility), README (disclaimer/quick start/architecture/extension guide), CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CHANGELOG, Issue/PR templates, DEMO seals clearly labeled with no real official seals.

Status: 🟡 README + .env.example only; LICENSE and the rest ⬜.

## 18. Development stages

- Stage 0 (foundation): repo layout/compose/env validation/Auth.js/Prisma migrations/CI — ✅
- Stage 1 (MVP): template editor → fill engine → state machines → image stamp/handwriting → permissions/audit/archive → external sign → API/Webhook — ✅
- Stage 2: keep interfaces and folders only; PadesProvider/GmSm2Provider/face empty + docs — 🔒 followed as specified

## 19. Working method

One milestone at a time; design notes before code; emit full file paths; first milestone is Prisma schema + zod + two state machines (with transition-table tests) + four Provider interfaces and stage-1 skeleton — ✅ delivered.

## 20. Multilingual and localized UI

- **20.1** zh-CN/en, Accept-Language plus top-bar switch, preference in User.locale, cookie when logged out (cookie name `HR_SIGN_LOCALE`); ICU MessageFormat; backend errors return codes only; external pages/email/notify bilingual, language priority "signer preference → initiator choice → browser language". Status: 🟡 infrastructure and language switch ✅, message catalogs expanded; bilingual email templates 🟡
- **20.2** UI language separate from document language: Template.locale (zh-CN/en/bilingual) ✅ model added; PDF fonts chosen by content 🟡 (Noto Sans SC only)
- **20.3** Typography: specified font stack, Chinese line-height 1.65–1.75, no italic/tracking on Chinese, English length budget 30–50%, CSS logical properties, density toggle (tables compact by default). Status: ⬜ density toggle not done, logical properties not used everywhere
- **20.4** Dates/times/numbers/currency all via Intl; UTC storage; 12/24h and week-start configurable; Calendar gets locale; Chinese uppercase RMB amounts (壹万贰仟元整) generated on the backend + unit tests. Status: 🟡 formatDateTime wrapper exists; uppercase amounts ⬜
- **20.5** fullName as the primary field (givenName/familyName/legalNameLatin optional); phones E.164 with default country +86; ID-type enum; address in domestic vs international modes; rules centralized in zod. Status: 🟡 User fields exist; forms/validation not landed
- **20.6** Three signature methods (Draw handwriting / Type typed / Upload image), domestic default Draw; seal style from template field (ROUND_CHINESE/TEXT_INTERNATIONAL/NONE); PERFORATION_SEAL reserved; panel always shows bilingual disclaimer. Status: 🟡 Draw only; Seal.style enum ✅
- **20.7** Left nav + top bar (language/theme/user menu) + breadcrumbs; table actions column fixed right, bulk bar on top; status "color + icon + text" triple expression; light/dark follow system and toggleable; WCAG 2.2 AA; privacy-consent copy configurable. Status: 🟡 nav/language switch ✅; dark/density/breadcrumbs/a11y audit ⬜
- **20.8** AuditLog stores action code + params only, locale-agnostic ✅
- **20.9** CI checks both message files have the same keys (script [check-i18n-keys.mjs](../../scripts/check-i18n-keys.mjs) ✅, GitHub Actions ✅); pseudo-locale en-XA ⬜; Playwright bilingual run + screenshot/overflow ⬜; uppercase amounts / time zone / E.164 / logical-property lint unit tests ⬜
