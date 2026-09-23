---
name: i18n
description: Use when adding or changing any user-visible copy (pages, components, email, notifications, error display), date/time/number/currency formatting, language switching, or message files. Forbids hardcoded copy and string concatenation; requires ICU MessageFormat, identical keys in both languages, and UI locale separate from document locale.
---

# Skill 05: Internationalization (next-intl, zh-CN / en)

## When to use

- Any user-visible text in pages/components
- New email/notification templates
- Displaying dates, times, numbers, currency, or countdown seconds
- New namespaces or message keys

## Key files

- Locale detection/constants/cookie: [src/i18n/config.ts](../../../src/i18n/config.ts) (`LOCALES`, `DEFAULT_LOCALE=zh-CN`, cookie `HR_SIGN_LOCALE`, Accept-Language merge: all zh* → zh-CN)
- Server-side messages: [src/i18n/request.ts](../../../src/i18n/request.ts); Provider in the root layout
- Message files: [messages/zh-CN.json](../../../messages/zh-CN.json), [messages/en.json](../../../messages/en.json)
- Key consistency check: [scripts/check-i18n-keys.mjs](../../../scripts/check-i18n-keys.mjs)
- Enum label transition: [src/lib/labels.ts](../../../src/lib/labels.ts) (**currently hardcoded Chinese; do not add more; migrate into messages**)

## Hard rules

1. **No hardcoded UI copy, no string concatenation.** Server Components use `getTranslations`; Client Components use `useTranslations`.
2. **Variables / plurals / select always use ICU MessageFormat.** Examples already in the repo:
   - Variable: `"welcome": "欢迎，{name}"`
   - select: `"role": "{role, select, SUPER_ADMIN {超级管理员} HR {HR 专员} … other {未知角色}}"`
   - Plural (Chinese has no plural forms; English must spell them out): `"items": "{count, plural, =0 {No items} one {# item} other {# items}}"`
   - Cooldown seconds use variables; do not concatenate `"Resend (" + s + "s)"` on the client
3. **Both message files must have identical keys**; run `node scripts/check-i18n-keys.mjs` before submit (CI should gate on this; currently missing).
4. Namespaces follow feature modules (existing: app / localeSwitch / nav / auth.login); new pages get their own namespace, e.g. `tasks.detail.*`, `auth.register.*`.
5. **Dates/times/numbers/currency use only Intl APIs** (`Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat`); no handwritten format strings; no new date libraries. Store times in UTC; display in the user's time zone. Existing `formatDateTime` is a transition wrapper; evolve toward Intl with locale/timeZone.
6. **UI language ≠ document language**: PDF language comes from `Template.locale` (zh-CN/en/bilingual), independent of the operator's UI locale.
7. **Backend never returns localized copy**: APIs return error code + params (e.g. `{ code: "AUTH_INVALID_CREDENTIALS" }`); the frontend renders in the current locale. AuditLog stores action code + params only (locale-agnostic).
8. Email/notification templates are locale-specific; language priority: signer preference → initiator choice → browser language.
9. Typography: Chinese line-height 1.65–1.75; no italic/letter-spacing on Chinese; buttons/headers must not be fixed-width (English is 30–50% longer); prefer CSS logical properties (ms-/me-/ps-/pe-).

## Standard steps (add a string)

1. Add the key + ICU copy in the matching namespace in zh-CN.json
2. **Add the same key to en.json** (real translation, not leftover Chinese)
3. Component `const t = useTranslations("ns")`; `<span>{t("key", { var })}</span>`
4. Run the key-check script; switch to en manually and check for overflow / missing translations

## Do not

- ❌ Chinese (or any locale) literals in JSX (including toast, placeholder, title)
- ❌ Ternaries in components to pick Chinese vs English
- ❌ `throw new ApiError(400, "邮箱格式不正确")` as the final shape (acceptable only in transition; the target is an error-code dictionary)
- ❌ Adding dayjs/moment or similar date libraries

## Done when

- [ ] Both message files have matching keys (script passes)
- [ ] No new hardcoded copy; variables go through ICU
- [ ] en layout checked by hand; dates/numbers use Intl
- [ ] New backend errors return only error codes
