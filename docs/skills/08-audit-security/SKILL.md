---
name: audit-security
description: Use when a new write needs an audit, when returning API errors, when handling passwords/tokens/uploads, or when doing a security self-review. Hash chain is append-only; action code + params; IP/UA capture; error codes; upload checks; company seals never sent to clients.
---

# Skill 08: Audit log and security baseline

## When to use

- Any write operation (create/approve/sign/publish/delete/change permissions/login)
- Designing a new error response
- Handling credentials, tokens, verification codes, uploads, downloads
- Security self-check or review

## Key files

- Hash-chain audit: [src/lib/audit.ts](../../../src/lib/audit.ts) (`recordAudit(AuditEntry)`, canonicalJson, prevHash chain)
- Audit detail schema: [src/schemas/audit-detail.ts](../../../src/schemas/audit-detail.ts)
- API errors and request forensics: [src/lib/api.ts](../../../src/lib/api.ts) (`ApiError`, `handleApiError`, `getClientIp`, `getUserAgent`)
- Password/session: [src/auth.ts](../../../src/auth.ts) (bcrypt.compare, never store plaintext)
- Tokens/codes: [providers/identity/email-code.ts](../../../src/server/providers/identity/email-code.ts), SigningToken routes
- File egress: [api/files/[...key]/route.ts](../../../src/app/api/files/[...key]/route.ts)

## Hard rules

### Audit

1. Every critical write, success or failure, calls `recordAudit`: action (**action code**, e.g. `task.approve`, `auth.login`, `template.publish`), targetType/targetId, result, ip, userAgent; document operations include documentSha256.
2. **detail stores params, not copy**: via AuditDetail zod schema; never put UI Chinese/English sentences, passwords, token plaintext, or verification codes in it.
3. Audit is **append-only**; the application must not update/delete AuditLog; the hash-chain payload depends on canonicalJson (sorted keys); keep that normalization when changing detail shape.
4. recordAudit failure must not roll back/block the main business (current design), but failures must be observable (logs).
5. Security events (failed login, permission denied, code brute-force) also get failure audits.

### Error responses

6. APIs `throw new ApiError(status, semantic message)` and `handleApiError` is the single sink; the target shape is **error code + params** (`VALIDATION_ERROR` / `AUTH_INVALID_CREDENTIALS` / `SEAL_APPROVAL_REQUIRED`); the frontend renders via i18n. Transition still has Chinese messages; **new code should define error-code constants and not spread more Chinese strings**.
7. Do not leak stacks/SQL/internal addresses to the client; unknown errors are a generic 500; details stay in server logs.

### Credentials and access

8. Passwords use bcrypt only (hash on register/change, compare on login); never log, never return, never put in URLs.
9. Tokens and codes stored hashed only; compare secrets with constant-time compare (timingSafeEqual, see email-code); send-code is anti-enumeration (unknown emails still succeed).
10. **Official seal images are read only on the backend**; no list/detail API may return a directly accessible seal URL to unrelated roles; stamping loads the image by sealId on the server.
11. Downloads go only through `/api/files/[...key]`, authorized by prefix (session ownership or token hash); used external tokens stay read-only and cannot sign again.
12. PDF upload: enforce size cap + **magic bytes (`%PDF-`)**, and reject documents with JavaScript / embedded files / Launch actions / encryption (currently size + parse only; magic/dangerous structure is outstanding P0 — new upload entry points must implement this, do not copy the old loose checks). Image uploads at least check magic (PNG/JPEG).
13. User input in redirects/links/SQL: redirects only to in-site allowlisted paths; queries always Prisma-parameterized (no string-built SQL); React escapes by default; no `dangerouslySetInnerHTML`.

### Current security gaps (prefer filling these when you touch the area; do not open a large refactor branch)

No CSP/security headers, no rate limit, no Origin check (CSRF defense in depth), no dependency scanning, no DB triggers on the audit table, no env zod at startup. When touching login/send-code/upload, add the matching rate limit or check in the smallest way and document it.

## Standard steps (add audit to a write)

```ts
const ip = getClientIp(req);
const userAgent = getUserAgent(req);
try {
  // …business transaction
  await recordAudit({
    userId: user.id,
    action: "task.approve",
    targetType: "SigningTask",
    targetId: id,
    result: "success",
    ip,
    userAgent,
    documentSha256: version?.sha256 ?? null,
    detail: { fromStatus: "PENDING", toStatus: "APPROVED" },
  });
} catch (err) {
  await recordAudit({
    userId: user.id,
    action: "task.approve",
    targetType: "SigningTask",
    targetId: id,
    result: "failure",
    ip,
    userAgent,
    detail: { reason: "…" },
  });
  throw err;
}
```

## Do not

- ❌ Store localized sentences or secrets in AuditLog
- ❌ Log, query, or return verification codes / plaintext tokens
- ❌ Add unauthenticated file/export paths
- ❌ After catch, send err.message (English stack-like) to the client

## Done when

- [ ] Writes have success/failure audit + IP/UA
- [ ] detail passes zod, no copy, no secrets
- [ ] Errors go through ApiError/handleApiError; uploads have magic and dangerous-structure checks
- [ ] New APIs rechecked for auth and data scope
