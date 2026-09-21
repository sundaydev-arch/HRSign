import { z } from "zod";

/**
 * Audit log detail (spec 8 / 20.8).
 *
 * - AuditLog.detail stores an "action code + parameters", never localized text
 * - Hash chain: hash = sha256(prevHash + canonical_json(all fields))
 * - canonical_json normalization (key sorting, UTC ISO timestamps) is the
 *   responsibility of the audit-log module
 */
export const AuditDetailSchema = z.record(z.string(), z.unknown());

export type AuditDetail = z.infer<typeof AuditDetailSchema>;

/**
 * Canonical input for hashing a full AuditLog row (excludes the hash itself;
 * prevHash participates in the hash as an external input).
 */
export const AuditLogHashInputSchema = z.object({
  userId: z.string().nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  result: z.string(),
  documentSha256: z.string().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  detail: AuditDetailSchema.nullable(),
  /** ISO 8601 UTC. */
  createdAt: z.string(),
});

export type AuditLogHashInput = z.infer<typeof AuditLogHashInputSchema>;
