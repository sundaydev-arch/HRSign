/**
 * Phase 2 IdentityVerifier stubs (spec 2 / 18).
 *
 * Face verification and real-name verification are reserved at the interface
 * layer only; they are not part of the core implementation and no biometric
 * data is stored.
 */

import type { IdentityVerifier } from "../types";
import { NotImplementedError } from "../types";

function notImplemented(feature: string): Promise<never> {
  return Promise.reject(new NotImplementedError(feature));
}

export class FaceVerifier implements IdentityVerifier {
  // Phase 2 will add the input parameters (see the IdentityVerifier interface).
  startVerification(): Promise<{ verificationId: string; expiresAt: Date }> {
    return notImplemented("FaceVerifier.startVerification");
  }
  checkResult(): Promise<{
    status: "VERIFIED" | "FAILED" | "EXPIRED";
    remainingAttempts: number;
  }> {
    return notImplemented("FaceVerifier.checkResult");
  }
}

export class RealNameVerifier implements IdentityVerifier {
  // Phase 2 will add the input parameters (see the IdentityVerifier interface).
  startVerification(): Promise<{ verificationId: string; expiresAt: Date }> {
    return notImplemented("RealNameVerifier.startVerification");
  }
  checkResult(): Promise<{
    status: "VERIFIED" | "FAILED" | "EXPIRED";
    remainingAttempts: number;
  }> {
    return notImplemented("RealNameVerifier.checkResult");
  }
}
