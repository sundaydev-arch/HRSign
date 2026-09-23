# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- DocuSign-parity Envelope API on three backends (Next `/api/v1`, Python FastAPI, Go) behind `packages/contracts`
- Hosted recipient sign, conditional tabs, Connect configurations, bulk send, embedded views
- Dashboard UI for PowerForms / Clickwrap / Notary / Rooms / CLM / Bulk Send / Accounts
- Shared layout helpers `CreatePanel` / `ListPanel` and `copyText` clipboard util
- Architecture guide: `docs/architecture/multi-backend.md`; refreshed monorepo `code-map.md`

### Changed
- README / README.zh-CN project layout updated for `apps/*` + `packages/*` monorepo
- Root `.env` must be linked into `apps/web/.env` for Next env validation
- FEATURE_MATRIX rows for Connect, hosted sign, and conditional tabs elevated to `partial` on Py/Go

### Changed (earlier)
- All API error responses are now locale-independent machine codes with interpolation parameters: `{ "error": { "code": "FIELD_TYPE_INVALID", "params": { "index": 2 } } }`; the catalog lives in `src/lib/api.ts` (`ErrorCode`) and the frontend throws `ApiClientError(code, params)` for localized rendering
- Consolidated the parallel `lib/*` and `server/providers/*` abstraction layers: storage, signing, and email transports now resolve exclusively through `getStorage()` / `getSignatureProvider()` / `sendEmail` from `@/server/providers`; task-event email composition moved to `src/server/notifications/task-events.ts`
- `SignatureProvider.sign()` now accepts multiple placements per action (single PDF render pass) plus an optional watermark, and returns the new version plus per-placement signature data; evidence images are keyed `signatures/{taskId}/{timestamp}.png`
- Storage `put()` enforces the non-overwrite rule by default and throws `ObjectAlreadyExistsError` for existing keys
- Code comments, JSDoc, state-machine error messages, and unit-test descriptions across `src/schemas`, `src/lib`, `src/server`, `src/app/api`, and auth/i18n infrastructure are now English; Chinese UI copy is migrated to the i18n layer
- Task lifecycle emails (created / approved / rejected / completed) are now bilingual: copy is selected per recipient from the recipient's `User.locale`, falling back to the default locale for external signers without an account

### Removed
- Dead module augmentation `src/types/next-auth.d.ts` (ineffective under the pnpm strict layout)
- Legacy `src/lib/minio.ts`, `src/lib/notify/*`, and `src/lib/pdf/signer/*` (folded into the provider layer)

### Security
- Content-Security-Policy and standard security response headers (Next)
- Rate limiting on login, verification-code, and external-signing endpoints
- Uploaded PDF hardening: magic-number checks and rejection of JavaScript / embedded files / Launch actions
- GitHub Actions CI gate (lint, typecheck, tests, i18n key parity, build)

## [0.2.0] - 2026-09

### Added
- Visual PDF template editor (pdf.js drag/resize/paging) with immutable template versioning: `DRAFT → PUBLISHED → ARCHIVED`
- Signing task initiation from published template versions with dynamic forms, sequential and parallel flows, configurable expiry
- Two independent state machines (approval and signing) plus per-signer state with a centralized transition table and 90+ unit tests
- Backend-only PDF pipeline (pdf-lib): form filling with embedded Noto Sans SC subset, image-company-seal stamping, global watermark; each stage stored as a new immutable version with SHA-256
- Handwritten signature pad; seal administration (demo seals only)
- External passwordless signing via hashed, expiring, revocable one-time tokens; email verification-code provider (cooldown + attempt limits)
- Role-based access control: super admin / HR / department leader / employee, enforced on the backend with data scoping
- Append-only audit log with SHA-256 hash chaining
- S3-compatible storage provider (MinIO default; presigned-URL support) with versioned, non-overwriting keys
- SMTP email notifications with i18n templates and a pluggable Notifier interface (WeCom/DingTalk/Lark slots reserved)
- Bilingual UI infrastructure (`zh-CN` / `en`) via next-intl: Accept-Language detection, language switcher, cookie preference, ICU MessageFormat
- Open-source project documentation: bilingual README, Apache-2.0 license, contributing guide, code of conduct, security policy, issue/PR templates, requirements and architecture docs under `docs/`
- 31-assertion end-to-end smoke script and i18n message-key parity script

### Notes
- Pre-1.0 early history was squashed; this changelog starts at 0.2.0.
- Phase 1 signatures are visual seals/handwritten images for internal traceability only; they are not legally qualified electronic signatures.

[Unreleased]: https://github.com/<your-org>/hrsign/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/<your-org>/hrsign/releases/tag/v0.2.0
