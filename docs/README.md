# HRSign Knowledge Base

This directory is the project knowledge base for **all agents and new contributors**: requirements, architecture index, and reusable skills.
The repository-root [README.md](../README.md) ([中文](../README.zh-CN.md)) is for operators (quick start / deploy). This directory is for people and agents who **develop and change code inside this repo**.

## Directory map

| Category | Document | Purpose |
|---|---|---|
| Demo | [DEMO.md](./DEMO.md) | Demo accounts, starter templates, 5-minute script, full feature matrix |
| Requirements | [requirements/product-spec.md](./requirements/product-spec.md) | Full product spec (sections 0–20) + per-item implementation status |
| Architecture | [architecture/code-map.md](./architecture/code-map.md) | Frontend / backend / data-layer code and asset index, plus data flows |
| Architecture | [architecture/multi-backend.md](./architecture/multi-backend.md) | Next / Python / Go Envelope API parity (no cross-calls) |
| Contracts | [packages/contracts](../packages/contracts) | OpenAPI, SQL, FEATURE_MATRIX |
| Skills | [skills/README.md](./skills/README.md) | Index of 9 **generic** stack skills (how to change code, not product roadmap) |

## Skills index

| # | Skill | When to use |
|---|---|---|
| 01 | [Schema and Zod conventions](./skills/01-schema-zod/SKILL.md) | Change Prisma models, read/write Json columns, add validation |
| 02 | [Dual state machines](./skills/02-state-machines/SKILL.md) | Change approval / signing / signer status transitions |
| 03 | [PDF processing pipeline](./skills/03-pdf-pipeline/SKILL.md) | Template fill, coordinates, stamps, watermarks, signatures, CJK fonts |
| 04 | [Auth, RBAC, and external tokens](./skills/04-auth-rbac/SKILL.md) | Login, permissions, login-free signing links |
| 05 | [Internationalization (i18n)](./skills/05-i18n/SKILL.md) | Any UI copy, date/number formatting, message-file changes |
| 06 | [shadcn forms and UI patterns](./skills/06-shadcn-forms/SKILL.md) | New forms/pages, loading/error states, responsiveness |
| 07 | [Provider extension](./skills/07-providers/SKILL.md) | Plug in a new signature / verification / notify / storage implementation |
| 08 | [Audit log and security baseline](./skills/08-audit-security/SKILL.md) | Write audits, error codes, security-related changes |
| 09 | [API route conventions](./skills/09-api-conventions/SKILL.md) | Add/change Route Handlers and file-download routes |

## Hard project rules (all agents must follow)

1. **Minimal change**; read context before editing; do not overturn the existing architecture; TypeScript strict, no `any`
2. **Every Prisma Json column read/write must go through its paired zod schema** (see skill 01)
3. **Any PDF mutation happens only on the backend**; the frontend only previews, drags, and captures input
4. **Company sealing requires approval already granted**; the backend state machine enforces this
5. **Keep multiple file versions; never overwrite**; storageKey includes version semantics
6. **Do not hardcode UI copy**; use next-intl; keys in both message files must match
7. **Backend errors return only an error code + params**; AuditLog stores only "action code + params", never localized text
8. Do not introduce new dependencies or change `.env` / `package.json` / `docker-compose` without stating the need and getting approval
9. Code identifiers in English; comments must be English; file names kebab-case
10. Stage-2 compliance features (PAdES / national crypto / face) stay as interfaces and empty implementations; do not build them early

## Status markers

Implementation status in the requirements doc uses:

- ✅ Implemented　　🟡 Partial / gap　　⬜ Not implemented　　🔒 Reserved for stage 2
