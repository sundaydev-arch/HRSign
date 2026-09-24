import { headers } from "next/headers";
import { requireApiKeyOrSession, type AuthActor } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import {
  V1_ADMIN_ROLES,
  V1_HR_ROLES,
  assertEnvelopeAccess,
  assertV1Roles,
  envelopeAccessWhere,
  actorId,
  type EnvelopeAccessOpts,
} from "@/lib/v1-authz-rules";

export {
  V1_ADMIN_ROLES,
  V1_HR_ROLES,
  assertEnvelopeAccess,
  assertV1Roles,
  envelopeAccessWhere,
  actorId,
};

/** Session or API key must be HR / SUPER_ADMIN (or key scopes that satisfy those roles). */
export async function requireV1Hr(): Promise<AuthActor> {
  return requireApiKeyOrSession(V1_HR_ROLES);
}

export async function requireV1Admin(): Promise<AuthActor> {
  return requireApiKeyOrSession(V1_ADMIN_ROLES);
}

export async function requireV1Permission(action: string): Promise<AuthActor> {
  const actor = await requireApiKeyOrSession();
  await requirePermission(actor, action);
  return actor;
}

/** Resolve soft-tenant account context from header + membership. */
export async function resolveAccountScope(actor: AuthActor): Promise<EnvelopeAccessOpts> {
  const h = await headers();
  const accountId = h.get("x-account-id")?.trim() || null;
  if (actor.kind === "apiKey" || actor.role === "SUPER_ADMIN") {
    return { accountId, memberAccountIds: undefined };
  }
  const memberships = await prisma.accountMember.findMany({
    where: { userId: actorId(actor) },
    select: { accountId: true },
  });
  const memberAccountIds = memberships.map((m) => m.accountId);
  if (accountId && !memberAccountIds.includes(accountId)) {
    const { ApiError } = await import("@/lib/api");
    throw new ApiError(403, "FORBIDDEN");
  }
  return { accountId, memberAccountIds };
}
