import { createHash, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSessionUser, type SessionUser } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";

const API_KEY_PREFIX = "hrs_";

/** Generate a plaintext API key (shown once) and its SHA-256 hash for storage. */
export function generateApiKey(): { plaintext: string; keyHash: string; keyPrefix: string } {
  const secret = randomBytes(32).toString("base64url");
  const plaintext = `${API_KEY_PREFIX}${secret}`;
  const keyHash = createHash("sha256").update(plaintext).digest("hex");
  const keyPrefix = plaintext.slice(0, 12);
  return { plaintext, keyHash, keyPrefix };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export interface ApiKeyActor {
  kind: "apiKey";
  apiKeyId: string;
  name: string;
  scopes: string[];
  /** Synthetic user id of the key creator for audit attribution. */
  userId: string;
  role: "SUPER_ADMIN";
}

export type AuthActor = (SessionUser & { kind: "session" }) | ApiKeyActor;

function sessionAsActor(user: SessionUser): AuthActor {
  return { ...user, kind: "session" };
}

/**
 * Require a session user OR a valid Bearer API key.
 * When `roles` is set, session users must match.
 * API keys must have a matching scope (roles mapped to scopes, or `*`).
 * Empty scopes are never treated as SUPER_ADMIN.
 */
export async function requireApiKeyOrSession(roles?: UserRole[]): Promise<AuthActor> {
  const h = await headers();
  const authHeader = h.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token.startsWith(API_KEY_PREFIX)) {
      const keyHash = hashApiKey(token);
      const row = await prisma.apiKey.findUnique({ where: { keyHash } });
      if (!row || row.revokedAt || (row.expiresAt && row.expiresAt <= new Date())) {
        throw new ApiError(401, "UNAUTHENTICATED");
      }
      const scopes = row.scopes ?? [];
      if (scopes.length === 0) {
        throw new ApiError(403, "API_KEY_NO_SCOPES");
      }
      // Non-empty scopes authorize the key; `*` or role names are preferred.
      // Capability scopes (e.g. tasks:write) also satisfy HR/SUPER_ADMIN routes.
      if (roles && roles.length > 0) {
        const allowed =
          scopes.includes("*") ||
          roles.some((r) => scopes.includes(r) || scopes.includes(r.toLowerCase())) ||
          (roles.some((r) => r === "HR" || r === "SUPER_ADMIN") &&
            scopes.some((s) => s.startsWith("tasks:") || s.startsWith("admin:") || s === "write"));
        if (!allowed) throw new ApiError(403, "FORBIDDEN");
      }
      await prisma.apiKey.update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      });
      return {
        kind: "apiKey",
        apiKeyId: row.id,
        name: row.name,
        scopes,
        userId: row.createdBy,
        role: "SUPER_ADMIN",
      };
    }
  }

  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "UNAUTHENTICATED");
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN");
  }
  return sessionAsActor(user);
}

export function actorUserId(actor: AuthActor): string {
  return actor.kind === "apiKey" ? actor.userId : actor.id;
}

/** HMAC-SHA256 hex digest of the payload body. */
export function signWebhookPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function generateWebhookSecret(): {
  plaintext: string;
  secretHash: string;
  secretPrefix: string;
} {
  const plaintext = `whsec_${randomBytes(32).toString("base64url")}`;
  const secretHash = createHash("sha256").update(plaintext).digest("hex");
  const secretPrefix = plaintext.slice(0, 12);
  return { plaintext, secretHash, secretPrefix };
}

export function verifyTimingSafe(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
