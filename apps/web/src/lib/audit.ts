import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "./prisma";

export interface AuditEntry {
  userId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  result?: "success" | "failure";
  documentSha256?: string | null;
  ip?: string;
  userAgent?: string;
  detail?: Record<string, unknown>;
}

/** Canonical JSON: sort object keys lexicographically so hashes are reproducible (spec 8). */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(obj).sort()) {
        sorted[k] = obj[k];
      }
      return sorted;
    }
    return val;
  });
}

/** Hash chain: hash = sha256(prevHash + canonical JSON) (spec 8). */
function computeAuditHash(prevHash: string | null, payload: Record<string, unknown>): string {
  return createHash("sha256").update(`${prevHash ?? ""}${canonicalJson(payload)}`).digest("hex");
}

/**
 * Append an audit log entry with hash chaining (append-only).
 * Audit failures must not block the main business flow; under concurrency a
 * unique-constraint collision is caught and logged.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Read the chain tail, newest first (single-tenant MVP accepts a broken
      // chain under extreme concurrency; audit:verify can detect it).
      const last = await tx.auditLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: { hash: true },
      });
      const prevHash = last?.hash ?? null;
      const payload: Record<string, unknown> = {
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        userId: entry.userId ?? null,
        result: entry.result ?? "success",
        documentSha256: entry.documentSha256 ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        detail: entry.detail ?? null,
      };
      const hash = computeAuditHash(prevHash, payload);
      await tx.auditLog.create({
        data: {
          prevHash,
          hash,
          userId: entry.userId ?? null,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          result: entry.result ?? "success",
          documentSha256: entry.documentSha256 ?? null,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
          detail: entry.detail === undefined ? undefined : (entry.detail as Prisma.InputJsonValue),
        },
      });
    });
  } catch (err) {
    console.error("[audit] failed to record audit log:", err);
  }
}
