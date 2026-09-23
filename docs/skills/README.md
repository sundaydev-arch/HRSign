# Shared Agent Skills

These are **generic engineering skills** for this repo’s stack (Next.js App Router, Prisma, zod, shadcn, i18n, PDF pipeline). They describe *how to change code*, not product roadmap, demo scripts, or one-off plans.

Keep them that way:
- Prefer stack/convention rules over feature names or temporary milestones
- Cite real paths in this repo; avoid marketing/copy-paste from plans
- Compose skills (e.g. a form change may use 01 + 05 + 06)
- Do not turn skills into release checklists or persona walkthroughs

| # | Skill | Trigger |
|---|---|---|
| 01 | [Schema and Zod conventions](./01-schema-zod/SKILL.md) | Change Prisma models/enums, read/write Json columns, validate external input |
| 02 | [Dual state machines](./02-state-machines/SKILL.md) | Any approval / signing / signer status change, sequential-sign round |
| 03 | [PDF processing pipeline](./03-pdf-pipeline/SKILL.md) | Template fields, fill, coordinates, stamps, watermarks, signatures, fonts |
| 04 | [Auth, RBAC, and external tokens](./04-auth-rbac/SKILL.md) | Login, role checks, login-free links, file access control |
| 05 | [Internationalization (i18n)](./05-i18n/SKILL.md) | UI copy, dates/numbers/currency, message files |
| 06 | [shadcn forms and UI patterns](./06-shadcn-forms/SKILL.md) | New/updated forms, page layout, loading/error/empty states |
| 07 | [Provider extension](./07-providers/SKILL.md) | New signature / verification / notify / storage channel |
| 08 | [Audit log and security baseline](./08-audit-security/SKILL.md) | Write audits, return errors, security-sensitive changes |
| 09 | [API route conventions](./09-api-conventions/SKILL.md) | New Route Handlers, Next 15 async params, file routes |

## How to use

1. After receiving a task, pick one or more skills by trigger scenario
2. Before changing code, read the source files the skill cites and confirm current behavior
3. Follow the standard steps; after finishing, check the completion checklist
4. If a special case conflicts with a skill rule, document the reason in a code comment and in the delivery notes

## Global invariants (shared by all skills)

TypeScript strict with no `any` (boundaries use `unknown` + type guards) | comments must be English, identifiers English | kebab-case file names | minimal change | no new dependencies / no env or compose edits without approval (**exception**: TipTap packages for DOCUMENT-mode template editing — see skill 03) | PDF mutated only on the backend | files never overwritten | copy never hardcoded | errors return error codes, not localized text | prefer installed shadcn components over custom markup.
