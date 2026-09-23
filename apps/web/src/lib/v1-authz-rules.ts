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

/**
 * Prisma filter for envelope list/get.
 * SUPER_ADMIN and API keys see all; HR sees envelopes they created.
 */
export function envelopeAccessWhere(actor: AuthActor): Prisma.EnvelopeWhereInput {
  if (isUnscopedActor(actor)) return {};
  return { createdBy: actorId(actor) };
}

/** Throw FORBIDDEN when the actor cannot access this envelope. */
export function assertEnvelopeAccess(
  actor: AuthActor,
  envelope: { createdBy: string },
): void {
  if (isUnscopedActor(actor)) return;
  if (envelope.createdBy !== actorId(actor)) {
    throw new ApiError(403, "FORBIDDEN");
  }
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
