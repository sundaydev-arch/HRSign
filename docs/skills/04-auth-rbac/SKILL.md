---
name: auth-rbac
description: Use for login sessions, role checks, user admin, login-free SigningToken, file access auth, and middleware allowlists. Splits Edge vs Node config, uses a single backend auth entry, stores only token hashes, and keeps used tokens read-only.
---

# Skill 04: Auth, RBAC, and external tokens

## When to use

- Add a protected page/API or role restriction
- Change login/register/password reset or an OIDC provider
- Change external signing links, verification codes, or `?token=` file access
- Adjust the middleware allowlist

## File map

| Concern | File |
|---|---|
| Edge security config (no Prisma) | [src/auth.config.ts](../../../src/auth.config.ts) |
| NextAuth instance (Credentials + JWT callbacks) | [src/auth.ts](../../../src/auth.ts) |
| Edge session guard + allowlist | [src/middleware.ts](../../../src/middleware.ts) |
| SessionUser / auth entry / roles | [src/lib/rbac.ts](../../../src/lib/rbac.ts) |
| External token validation | [sign/external/[token]/route.ts](../../../src/app/api/sign/external/[token]/route.ts), [tasks/[id]/sign/route.ts](../../../src/app/api/tasks/[id]/sign/route.ts) |
| Email verification codes | [providers/identity/email-code.ts](../../../src/server/providers/identity/email-code.ts) |
| File egress auth | [api/files/[...key]/route.ts](../../../src/app/api/files/[...key]/route.ts) |

## Hard rules

### Session and RBAC
1. **auth.config.ts must not import Prisma/bcrypt/Node APIs** (it runs in Edge middleware); DB logic lives in auth.ts.
2. Backend auth has two entries only: APIs use `requireApiUser(roles?)` (throws 401/403 ApiError); pages use `requirePageUser(roles?)` (unauthenticated → /login, insufficient role → /tasks). **Do not invent a second session check in business routes.**
3. Roles: SUPER_ADMIN / HR / DEPT_LEADER / EMPLOYEE (no EXTERNAL role — external signers are not users). `isManagerRole` is HR/super-admin only. Data scope: HR/SUPER_ADMIN see all; **DEPT_LEADER** sees tasks where `creator.departmentId` matches their department (or they are a signer); employees only their own — filter in query `where`, not by hiding UI. Departments: `Department` + `User.departmentId`; approval auto-inject via `ApprovalPolicy`.
4. Frontend components are display control only; every write must be authorized on the backend.
5. Custom fields (role, etc.) are written onto the token in JWT callbacks; reads use boundary assertions/guards (see auth.ts `(user as { role?: UserRole }).role` and ROLE_OPTIONS backfill); no `any`.
6. NextAuth v5 beta + pnpm's strict layout means `declare module "@auth/core/types"` augmentation does not take effect; do not rely on it for types.

### External signing tokens
7. SigningToken **stores only sha256(plaintext)**; plaintext exists only at creation (passed to notify via externalTokenMap to build the link; resend falling back to an internal link is a known limitation).
8. Four checks: hash hit, no revokedAt, no usedAt (for the sign action), not past expiresAt; verification codes go through EmailCodeVerifier (hashed code, cooldown, attempt limits, constant-time compare).
9. **Used tokens still allow read-only GET/file view** (users keep the document); repeat-sign is blocked by the Signer state machine (reject after SIGNED). Write usedAt immediately after a successful sign POST.
10. File routes authorize by key prefix: templates/seals require session + manager role; documents/signatures require session ownership or `?token=` hash check; never add a "download by ID only" route.
11. New public routes must be added to the middleware matcher allowlist, kept as narrow as possible (exact path prefixes).

## Standard steps (new protected API)

```ts
export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    // …zod validate + business
  } catch (err) {
    return handleApiError(err); // see skill 09
  }
}
```

## Do not

- ❌ Import Prisma in auth.config.ts/middleware
- ❌ Store token/code plaintext or log it
- ❌ Let "whether the email exists" change public-endpoint responses (anti-enumeration: send-code always returns success)
- ❌ Control write access only by button visibility

## Done when

- [ ] New APIs have backend role checks; list APIs have data-scope `where`
- [ ] Public paths were evaluated and added/excluded from the allowlist
- [ ] Tokens/codes are not logged or returned in plaintext
- [ ] tsc passes; permission counterexamples verified in e2e or manual tests
