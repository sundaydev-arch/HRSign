/**
 * EmailCodeVerifier (default Phase 1 implementation, spec 2 / 4 / 20.1).
 *
 * Purpose: verification via email code.
 *   - 6-digit numeric code, valid for 10 minutes (configurable)
 *   - Codes are stored hashed (spec 4: hash only, never plaintext, same
 *     strategy as SigningToken)
 *   - Attempt limit: 5 by default
 *   - Cooldown: no resend within 60 seconds
 *
 * Flow (spec 4 external signing):
 *   1. One-time link → email code (IdentityVerifier.startVerification)
 *   2. User enters the code → checkResult
 *   3. Verification passes → enter the signing page
 *   4. After signing completes → the token is invalidated (business layer)
 *
 * Note: this implementation only "generates, stores, and checks" the code;
 * "sending" it is the Notifier's job.
 */

import { createHash, randomBytes } from "node:crypto";

import type { IdentityVerifier } from "../types";
import type { Locale } from "../types";

// Prisma types can only be imported after `pnpm install`; structural typing is
// used here to avoid a hard dependency.
interface IdentityVerificationRepository {
  create(input: {
    type: "EMAIL_CODE";
    target: string;
    codeHash: string;
    attemptCount: number;
    maxAttempts: number;
    signingTokenId: string | null;
    status: "PENDING";
    expiresAt: Date;
    requestIp: string | null;
    requestUserAgent: string | null;
  }): Promise<{ id: string }>;
  findById(id: string): Promise<{
    id: string;
    target: string;
    codeHash: string;
    attemptCount: number;
    maxAttempts: number;
    status: "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED";
    expiresAt: Date;
  } | null>;
  markVerified(id: string): Promise<void>;
  markFailed(id: string, attemptCount: number): Promise<void>;
  /** Cooldown check: look up the creation time of the latest record for target. */
  findLatestByTarget(target: string): Promise<{ createdAt: Date } | null>;
}

export interface EmailCodeVerifierDeps {
  /** Code time-to-live in minutes; defaults to 10. */
  codeTtlMinutes?: number;
  /** Maximum number of attempts; defaults to 5. */
  maxAttempts?: number;
  /** Resend cooldown in seconds; defaults to 60. */
  cooldownSeconds?: number;
  /** Repository abstraction (implemented with Prisma in practice). */
  repository: IdentityVerificationRepository;
}

/** Generate a 6-digit numeric code (cryptographically secure randomness). */
export function generateCode(): string {
  // randomBytes(3) → 24 bits → 0..16777215; modulo 1000000 gives 6 digits.
  const n = randomBytes(3).readUIntBE(0, 3) % 1_000_000;
  return n.toString().padStart(6, "0");
}

/** sha256(plaintext). */
export function hashCode(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Constant-time comparison (guards against timing attacks). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * EmailCodeVerifier implementation.
 *
 * Note: this class does not send email (that is the Notifier's job); it only
 * generates, stores, and verifies codes.
 */
export class EmailCodeVerifier implements IdentityVerifier {
  private readonly codeTtlMinutes: number;
  private readonly maxAttempts: number;
  private readonly cooldownSeconds: number;
  private readonly repository: IdentityVerificationRepository;

  constructor(deps: EmailCodeVerifierDeps) {
    this.codeTtlMinutes = deps.codeTtlMinutes ?? 10;
    this.maxAttempts = deps.maxAttempts ?? 5;
    this.cooldownSeconds = deps.cooldownSeconds ?? 60;
    this.repository = deps.repository;
  }

  async startVerification(input: {
    target: string;
    signingTokenId: string | null;
    locale: Locale;
    ip: string | null;
    userAgent: string | null;
  }): Promise<{ verificationId: string; expiresAt: Date }> {
    // 1. Cooldown check (spec 4: prevent code spam).
    const latest = await this.repository.findLatestByTarget(input.target);
    if (latest) {
      const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
      if (elapsed < this.cooldownSeconds) {
        throw new EmailCodeCooldownError(
          this.cooldownSeconds - Math.floor(elapsed),
        );
      }
    }

    // 2. Generate the code and store only its hash (spec 4: hash only).
    const plaintext = generateCode();
    const codeHash = hashCode(plaintext);
    const expiresAt = new Date(
      Date.now() + this.codeTtlMinutes * 60 * 1000,
    );

    const record = await this.repository.create({
      type: "EMAIL_CODE",
      target: input.target,
      codeHash,
      attemptCount: 0,
      maxAttempts: this.maxAttempts,
      signingTokenId: input.signingTokenId,
      status: "PENDING",
      expiresAt,
      requestIp: input.ip,
      requestUserAgent: input.userAgent,
    });

    // 3. Return the verificationId; the plaintext code is delivered to the
    //    user by the caller via the Notifier (here through a process-level
    //    event hook). The caller is expected to listen and send the email.
    if (typeof (process as unknown as { emit?: (e: string, p: unknown) => void }).emit === "function") {
      (process as unknown as { emit: (e: string, p: unknown) => void }).emit("email-code:generated", {
        verificationId: record.id,
        target: input.target,
        plaintextCode: plaintext,
        locale: input.locale,
      });
    }

    return { verificationId: record.id, expiresAt };
  }

  async checkResult(input: {
    verificationId: string;
    code: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<{
    status: "VERIFIED" | "FAILED" | "EXPIRED";
    remainingAttempts: number;
  }> {
    const record = await this.repository.findById(input.verificationId);
    if (!record) {
      throw new Error(
        `EmailCodeVerifier.checkResult: verification record not found ${input.verificationId}`,
      );
    }

    // Already expired.
    if (Date.now() > record.expiresAt.getTime()) {
      return { status: "EXPIRED", remainingAttempts: 0 };
    }

    // Already in a terminal state (verified or failed).
    if (record.status === "VERIFIED") {
      return { status: "VERIFIED", remainingAttempts: 0 };
    }
    if (record.status === "FAILED") {
      return { status: "FAILED", remainingAttempts: 0 };
    }

    // Check the code (constant-time comparison).
    const expectedHash = hashCode(input.code);
    const matched = safeEqual(expectedHash, record.codeHash);

    if (matched) {
      await this.repository.markVerified(record.id);
      return { status: "VERIFIED", remainingAttempts: 0 };
    }

    // Mismatch: increment attemptCount.
    const newAttemptCount = record.attemptCount + 1;
    const remaining = Math.max(0, record.maxAttempts - newAttemptCount);

    if (newAttemptCount >= record.maxAttempts) {
      // Attempt limit exceeded → mark failed (spec 4: attempt limit).
      await this.repository.markFailed(record.id, newAttemptCount);
      return { status: "FAILED", remainingAttempts: 0 };
    }

    // Attempts remain.
    await this.repository.markFailed(record.id, newAttemptCount);
    return { status: "FAILED", remainingAttempts: remaining };
  }
}

/** Error raised when a code is resent during the cooldown window. */
export class EmailCodeCooldownError extends Error {
  readonly remainingSeconds: number;

  constructor(remainingSeconds: number) {
    super(`Verification code cooldown active, ${remainingSeconds} second(s) remaining`);
    this.name = "EmailCodeCooldownError";
    this.remainingSeconds = remainingSeconds;
  }
}
