import { requireApiKeyOrSession, type AuthActor } from "@/lib/api-auth";
import {
  V1_ADMIN_ROLES,
  V1_HR_ROLES,
  assertEnvelopeAccess,
  assertV1Roles,
  envelopeAccessWhere,
} from "@/lib/v1-authz-rules";

export {
  V1_ADMIN_ROLES,
  V1_HR_ROLES,
  assertEnvelopeAccess,
  assertV1Roles,
  envelopeAccessWhere,
};

/** Session or API key must be HR / SUPER_ADMIN (or key scopes that satisfy those roles). */
export async function requireV1Hr(): Promise<AuthActor> {
  return requireApiKeyOrSession(V1_HR_ROLES);
}

export async function requireV1Admin(): Promise<AuthActor> {
  return requireApiKeyOrSession(V1_ADMIN_ROLES);
}
