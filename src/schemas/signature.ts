import { z } from "zod";

/**
 * Signature verification result (spec 2 SignatureProvider.verify).
 *
 * - Phase 1: image seal/signature; valid=true only means the file has not been
 *   replaced (no legal-validity guarantee)
 * - Phase 2: PAdES / GM_SM2 return real verification information
 * - Stored in the Signature.verificationResult Json column
 */
export const SignatureVerificationResultSchema = z.object({
  valid: z.boolean(),
  /** Signature method (matches Signature.method). */
  method: z.string(),
  /** Verification time, ISO 8601 UTC. */
  verifiedAt: z.string(),
  /** Phase 1: file sha256 comparison; Phase 2: certificate, timestamp, etc. */
  details: z.record(z.string(), z.unknown()).optional(),
  /** Error code when verification fails (the frontend renders it by locale). */
  errorCode: z.string().optional(),
});

export type SignatureVerificationResult = z.infer<
  typeof SignatureVerificationResultSchema
>;
