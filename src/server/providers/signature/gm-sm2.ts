/**
 * GmSm2Provider (reserved for Phase 2, spec 2 / 18).
 *
 * To be implemented in Phase 2: Chinese national-cryptography (GM) SM2
 * electronic signatures.
 *   - Integrate with a domestic CA (licensed by the OSCCA)
 *   - SM2 signature + SM3 hash + SM4 encryption
 *   - Intended for China regulatory-compliance scenarios
 *
 * Phase 1 ships a stub plus documentation only.
 */

import type { SignatureVerificationResult } from "@/schemas/signature";
import type { SignatureProvider, SignResult } from "../types";
import { NotImplementedError } from "../types";

function notImplemented(feature: string): Promise<never> {
  return Promise.reject(new NotImplementedError(feature));
}

export class GmSm2Provider implements SignatureProvider {
  // Phase 2 will add the { source, signer } / { documentVersion, signature }
  // parameters (see the SignatureProvider interface).
  sign(): Promise<SignResult> {
    return notImplemented("GmSm2Provider.sign");
  }

  verify(): Promise<SignatureVerificationResult> {
    return notImplemented("GmSm2Provider.verify");
  }
}
