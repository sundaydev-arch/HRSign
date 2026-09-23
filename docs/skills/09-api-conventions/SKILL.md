---
name: api-conventions
description: Use when adding or changing any Route Handler, dynamic page params/searchParams, unified response and error shape, paginated lists, or file-download headers. try/catch sink, Next 15 Promise params, zod at the boundary, list filter auth and pagination direction.
---

# Skill 09: API route conventions

## When to use

- New GET/POST/PUT/PATCH/DELETE under `src/app/api/**`
- New dynamic route pages (params) or pages with query params (searchParams)
- Defining response shape, pagination, downloads

## Hard rules

### File location and signatures
1. Routes live at `src/app/api/<resource>/route.ts`, dynamic segment `[id]`; one file groups methods on the same path. Multi-segment names are kebab-case.
2. **Next.js 15: dynamic params are a Promise** and must be awaited:
   ```ts
   export async function PATCH(
     req: NextRequest,
     { params }: { params: Promise<{ id: string }> },
   ) {
     const { id } = await params;
   ```
   Pages likewise: `params: Promise<{ id: string }>`, `searchParams: Promise<{ templateId?: string }>`; catch-all is `Promise<{ key: string[] }>`.
3. Routes that run on Node (Prisma/bcrypt/Buffer/pdf-lib) must not accidentally `export const runtime = "edge"`; Edge session logic lives only in middleware/auth.config.

### Boundary handling
4. Every handler uses this skeleton:
   ```ts
   export async function POST(req: NextRequest, ctx) {
     const { id } = await ctx.params;
     try {
       const user = await requireApiUser(["HR"]);   // auth (skill 04)
       const body = Schema.parse(await req.json()); // zod boundary (skill 01)
       // …business (multi-table writes in a transaction)
       await recordAudit({ ... });                  // audit (skill 08)
       return NextResponse.json({ ... });
     } catch (err) {
       return handleApiError(err);
     }
   }
   ```
5. Body is `unknown` first (`await req.json()`) then zod parse; never `req.json() as XxxBody`. Query params get their own existence/enum checks.
6. Keep project response conventions: lists `{ items or a plural key: [...] }` matching frontend `api<T>()`; details return the object; writes return the new primary id (e.g. `{ taskId }`). Do not mix wrapper keys.
7. **Lists must authorize-filter + paginate**: `where` includes data scope (HR all / self-related); new lists need take/cursor or pageSize (some existing lists have no cap — tech debt, do not copy).
8. Time fields serialize to ISO strings via JSON; the frontend displays with Intl (skill 05); the backend does not pre-format localized strings.
9. Before returning Json columns the frontend needs (coordinates, etc.), unpack to a flat/renderable shape (see tasks/[id] CoordinatesSchema.parse on fields).

### File downloads
10. All files exit only via [files/[...key]/route.ts]; set correct Content-Type (PDF always `application/pdf`, images by extension), `Content-Disposition` (preview inline / download attachment; filenames RFC 5987 encoded); never leak MinIO internal URLs/credentials to the client.

### Client
11. Frontend always uses `api(path, init)` from [src/lib/client.ts](../../../src/lib/client.ts); do not scatter fetch with duplicated credentials/error parsing.

## Standard steps (new resource API)

1. Define zod schema (input) and TS return type
2. Create route.ts using the skeleton in rule 4; await dynamic params
3. Auth → validate → transactional business → audit → unified response
4. Frontend `api()` wiring; tsc 0 errors; e2e-smoke or manual happy/sad paths

## Do not

- ❌ Write `{ params }: { params: { id: string } }` (Next 15 build fails)
- ❌ Skip try/catch and leak raw stacks
- ❌ Unauthenticated write routes or unscoped lists
- ❌ New findMany with no table-wide cap
- ❌ Inline state-machine jumps or PDF mutation details in the route (skills 02/03)

## Done when

- [ ] params/searchParams awaited; tsc and `pnpm build` pass
- [ ] Auth, zod, try/catch, and audit are all present
- [ ] Lists have scope filters; new lists have a pagination cap
- [ ] Delivery notes list files/rationale/test points
