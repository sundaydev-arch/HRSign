---
name: schema-zod
description: Use when changing Prisma models/enums, reading or writing any Json column, or adding validation for external input (API bodies / forms / env). Requires a paired zod schema per Json column, forbids raw type assertions, and defines how coordinates/rules are unpacked and how immutable versioned models may change.
---

# Skill 01: Schema and Zod conventions

## When to use

- Add/change Prisma models, fields, or enums ([prisma/schema.prisma](../../../prisma/schema.prisma))
- Read or write any `Json` / `Json?` column
- Add validation for API bodies, forms, third-party responses, or environment variables

## Hard rules

1. **Every Json column must have a matching-responsibility zod schema under [src/schemas/](../../../src/schemas), exported from [schemas/index.ts](../../../src/schemas/index.ts).** Current mapping:

   | Prisma column | zod schema |
   |---|---|
   | TemplateField.coordinates | CoordinatesSchema |
   | TemplateField.validationRules | template-field.ts |
   | TemplateField.labelI18n | label-i18n.ts |
   | TemplateVersion.watermarkConfig | watermark.ts |
   | Document.fieldValues | field-values.ts |
   | AuditLog.detail | audit-detail.ts |
   | WebhookDelivery.payload | webhook-payload.ts |
   | NotificationLog.templateParams / NotificationTemplate.defaultParams | notification.ts |
   | Signature.verificationResult | signature.ts |

2. **Reading Json must parse; never `f.coordinates as XxxType`.** Trusted data uses `.parse()`; external or possibly dirty data uses `.safeParse()` with an explicit failure path (see [TemplateEditor.tsx](../../../src/components/pdf/TemplateEditor.tsx) skipping dirty fields on init).
3. When writing Json, Prisma input types use `Prisma.InputJsonValue`; do not cast to `any`.
4. After adding an enum value, sync: (1) `Record<Enum, string>` in labels.ts (or i18n messages) (2) every `Record<Enum, …>` mapping (TypeScript will error on missing keys; fill them; do not bypass with `as`). Reserved enums still need mapping values (e.g. FieldType PERFORATION_SEAL).
5. **Template versions are immutable**: status/pageCount/storageKey/fields belong to TemplateVersion; field edits are allowed only on DRAFT versions (see [fields/route.ts](../../../src/app/api/templates/[id]/fields/route.ts)); changing a PUBLISHED version = create a new version; there is no in-place edit.
6. All external input goes through zod: parse API bodies as `unknown`, then parse; do not trust frontend types.
7. Do not ship implicit `db push` schema drift as a formal delivery; new fields get defaults or are nullable so historical rows stay valid.

## Standard steps

1. Change schema.prisma → `pnpm prisma generate` (and `prisma migrate dev --name xxx` when needed; migrations need team confirmation)
2. For Json columns: create/update `src/schemas/xxx.ts` and export from index.ts
3. Switch every read/write site to schema parse (grep the field name)
4. Fill enum mappings; `pnpm exec tsc --noEmit` must be 0 errors

## Do not

- ❌ Use `JSON.parse` then treat the result as a typed shape
- ❌ Hand-write Json shapes in frontend components instead of referencing zod
- ❌ Add "patch fields" onto an already PUBLISHED version
- ❌ Casually change column types (e.g. `@db.Text`) without documenting impact

## Done when

- [ ] New Json columns have a paired zod schema exported from index.ts
- [ ] No new `as any` / direct assertions on Json
- [ ] tsc 0 errors; enum Record mappings have no missing keys
- [ ] Delivery notes list changed files, rationale, and test points
