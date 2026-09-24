import { ApiError } from "@/lib/api";
import type { AuthActor } from "@/lib/api-auth";
import type { Prisma, UserRole } from "@prisma/client";

/** DocuSign-parity / product surfaces — matches dashboard layouts. */
export const V1_HR_ROLES: UserRole[] = ["SUPER_ADMIN", "HR"];

/** Platform admin surfaces (Connect, etc.). */
export const V1_ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN"];

export function actorId(actor: AuthActor): string {
  return actor.kind === "apiKey" ? actor.userId : actor.id;
}

function isUnscopedActor(actor: AuthActor): boolean {
  return actor.kind === "apiKey" || actor.role === "SUPER_ADMIN";
}

export type EnvelopeAccessOpts = {
  /** Soft multi-tenant: filter by account when provided. */
  accountId?: string | null;
  /** Account IDs the actor is a member of (session users). */
  memberAccountIds?: string[];
};

/**
 * Prisma filter for envelope list/get.
 * SUPER_ADMIN and API keys see all (optionally narrowed by accountId).
 * HR sees envelopes they created OR in accounts they belong to.
 */
export function envelopeAccessWhere(
  actor: AuthActor,
  opts: EnvelopeAccessOpts = {},
): Prisma.EnvelopeWhereInput {
  const accountClause: Prisma.EnvelopeWhereInput | undefined = opts.accountId
    ? { accountId: opts.accountId }
    : undefined;

  if (isUnscopedActor(actor)) {
    return accountClause ?? {};
  }

  const ownership: Prisma.EnvelopeWhereInput = {
    OR: [
      { createdBy: actorId(actor) },
      ...(opts.memberAccountIds?.length
        ? [{ accountId: { in: opts.memberAccountIds } }]
        : []),
    ],
  };

  if (accountClause) {
    return { AND: [ownership, accountClause] };
  }
  return ownership;
}

/** Throw FORBIDDEN when the actor cannot access this envelope. */
export function assertEnvelopeAccess(
  actor: AuthActor,
  envelope: { createdBy: string; accountId?: string | null },
  opts: EnvelopeAccessOpts = {},
): void {
  if (isUnscopedActor(actor)) {
    if (opts.accountId && envelope.accountId && envelope.accountId !== opts.accountId) {
      throw new ApiError(403, "FORBIDDEN");
    }
    return;
  }
  if (envelope.createdBy === actorId(actor)) return;
  if (
    envelope.accountId &&
    opts.memberAccountIds?.includes(envelope.accountId)
  ) {
    return;
  }
  throw new ApiError(403, "FORBIDDEN");
}

/**
 * Assert role membership for an already-authenticated actor.
 */
export function assertV1Roles(actor: AuthActor, roles: UserRole[]): void {
  if (actor.kind === "apiKey") {
    const scopes = actor.scopes;
    if (scopes.includes("*")) return;
    const allowed =
      roles.some((r) => scopes.includes(r) || scopes.includes(r.toLowerCase())) ||
      (roles.some((r) => r === "HR" || r === "SUPER_ADMIN") &&
        scopes.some((s) => s.startsWith("tasks:") || s.startsWith("admin:") || s === "write"));
    if (!allowed) throw new ApiError(403, "FORBIDDEN");
    return;
  }
  if (!roles.includes(actor.role)) throw new ApiError(403, "FORBIDDEN");
}
