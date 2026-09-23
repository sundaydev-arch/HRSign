---
name: shadcn-forms
description: Use when creating or changing form pages, dialog forms, list/detail/empty/error layouts, button loading feedback, or responsive pages. Prefer installed shadcn/ui components; react-hook-form+zod is the only form pattern; defines Form composition, one primary button per page, and desktop enterprise layout.
---

# Skill 06: shadcn forms and UI patterns

## When to use

- New forms (login / invite / password reset / initiate task / settings, etc.)
- Input inside Dialog / Sheet / Popover
- Unified loading, empty, error, and submit feedback
- Page layout and responsive tweaks
- Any UI that could use an existing shadcn primitive instead of raw HTML

## Prefer components over custom markup

Use an installed component from [`src/components/ui`](../../../src/components/ui) before inventing styled `div`/`button`/`hr` markup.

| Need | Use |
|---|---|
| Actions | `Button` |
| Forms | `Form` + `Input` / `Textarea` / `Select` / `Checkbox` / `RadioGroup` / `Calendar` + `Popover` |
| Overlays | `Dialog`, `AlertDialog`, `Sheet`, `DropdownMenu`, `Popover`, `Tooltip` |
| Feedback | `Alert`, `Badge`, `Skeleton`, `sonner` toast |
| Structure | `Card`, `Tabs`, `Table`, `Separator`, `ScrollArea`, `Avatar`, dashboard `CreatePanel` / `ListPanel` / `Surface` |
| File pick | `FileDropzone` (project wrapper) |
| Date fields | `DatePicker` (Popover + Calendar; never bare `type="date"` for filters) |

**Destructive confirms** → `AlertDialog` (never `window.confirm`).  
**Mobile nav drawer** → `Sheet`.  
**Callouts / readonly hints** → `Alert`.  
**Dividers** → `Separator`.

## Allowed components (shadcn + project wrappers)

Installed under `components/ui`: button, input, textarea, label, form, select, radio-group, checkbox, calendar, date-picker, card, dialog, alert-dialog, sheet, alert, popover, dropdown-menu, tabs, table, badge, avatar, separator, scroll-area, tooltip, skeleton, sonner, file-dropzone.

**Do not introduce other UI libraries.** Adding a new shadcn component requires an explicit note and approval.

## Hard rules

### Forms
1. Sole form pattern: **react-hook-form + `@hookform/resolvers/zod` + project zod schema**, composed with shadcn `<Form>/<FormField>/<FormItem>/<FormLabel>/<FormControl>/<FormMessage>` ([ui/form.tsx](../../../src/components/ui/form.tsx)). Do not collect each field with useState and toast validation errors.
2. Field-level errors only in `FormMessage`; submit-level errors (bad credentials, HTTP 500) use sonner `toast.error`.
3. Semantic inputs: `type="email"`, `autoComplete` (email/current-password/new-password/one-time-code/name), `inputMode`, `aria-invalid`/`aria-describedby` via FormItem.
4. While submitting: button `disabled` + spinning Loader2 + i18n `submitting` copy; prevent double submit.
5. Password fields offer show/hide (Eye/EyeOff), toggling type between password and text.
6. Send-code buttons: cooldown from backend error codes; disabled during cooldown.

### Layout and feedback
7. Enterprise desktop layout: left nav + content; forms max-w-3xl / login max-w-sm / lists full width; mobile responsive with `px-4` floor.
8. **One primary button per page** (default variant); secondary outline/ghost; row actions = primary + `DropdownMenu` (⋯), not a long ghost row.
9. Status is triple-redundant: color + icon + copy (`*_VARIANTS` in labels.ts).
10. List four states: `Skeleton` loading, empty (icon + copy + optional CTA), retryable error, then table.
11. Theme tokens only (`primary` / `muted` / `border` / `destructive`); no scattered brand hex colors.
12. Destructive actions use `AlertDialog`.
13. A11y: keyboard reachable, `focus-visible:ring-*`, labeled controls, icon buttons have `aria-label` / `Tooltip`.

## Standard steps (new form)

1. Define a zod schema in `src/schemas/` or shared with the API route
2. `useForm({ resolver: zodResolver(schema), defaultValues })`
3. FormField render prop hosts FormItem/Label/Control/Message
4. onSubmit sets submitting, calls `api()`, on success router push/refresh, on failure toast by error code
5. All copy via `useTranslations`

## Do not

- ❌ One useState per input plus manual empty checks
- ❌ Validation errors only in toast
- ❌ Submit button with no loading / double-clickable
- ❌ Ant Design / MUI or homemade overlay widgets when Sheet/Dialog exist
- ❌ Hardcoded locale strings (see skill 05)
- ❌ Raw `<button>` / `<hr>` / confirm() when Button / Separator / AlertDialog exist

## Done when

- [ ] zod resolver wired; field errors in FormMessage
- [ ] loading / disabled / anti-double-submit complete
- [ ] Uses installed shadcn primitives where applicable
- [ ] 375px mobile width checked; no horizontal overflow
- [ ] Tab order reasonable; focus visible
