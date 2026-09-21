/**
 * PadesProvider (reserved for Phase 2, spec 2 / 18).
 *
 * To be implemented in Phase 2: PAdES (PAdES-B-LT-LTA) compliant electronic
 * signatures.
 *   - Integrate with CA digital certificates
 *   - Embed timestamps (TSA)
 *   - Long-term validation (LTV)
 *
 * Phase 1 ships a stub plus documentation only and stays out of the core
 * flows (spec 18). Once users integrate compliant signatures, legal liability
 * rests with the operator, the CA, and their legal counsel.
 */

import type { SignatureVerificationResult } from "@/schemas/signature";
import type { SignatureProvider, SignResult } from "../types";
import { NotImplementedError } from "../types";

function notImplemented(feature: string): Promise<never> {
  return Promise.reject(new NotImplementedError(feature));
}

export class PadesProvider implements SignatureProvider {
  // Phase 2 will add the { source, signer } / { documentVersion, signature }
  // parameters (see the SignatureProvider interface).
  sign(): Promise<SignResult> {
    return notImplemented("PadesProvider.sign");
  }

  verify(): Promise<SignatureVerificationResult> {
    return notImplemented("PadesProvider.verify");
  }
}
