/**
 * SmsOtpVerifier — Phase 2 IdentityVerifier for SMS one-time codes.
 *
 * Same hash / attempt / cooldown rules as EmailCodeVerifier.
 * Delivery is left to the Notifier / sendSms helper (dev: log + NotificationLog).
 */

import { createHash, randomBytes } from "node:crypto";
import type { IdentityVerifier, Locale } from "../types";

interface SmsVerificationRepository {
  create(input: {
    type: "SMS_OTP";
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
  findLatestByTarget(target: string): Promise<{ createdAt: Date } | null>;
}

export interface SmsOtpVerifierDeps {
  codeTtlMinutes?: number;
  maxAttempts?: number;
  cooldownSeconds?: number;
  repository: SmsVerificationRepository;
}

function generateCode(): string {
  const n = randomBytes(3).readUIntBE(0, 3) % 1_000_000;
  return n.toString().padStart(6, "0");
}

function hashCode(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export class SmsOtpCooldownError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("SMS_OTP_COOLDOWN");
    this.name = "SmsOtpCooldownError";
  }
}

export class SmsOtpVerifier implements IdentityVerifier {
  private readonly codeTtlMinutes: number;
  private readonly maxAttempts: number;
  private readonly cooldownSeconds: number;
  private readonly repository: SmsVerificationRepository;

  constructor(deps: SmsOtpVerifierDeps) {
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
    const latest = await this.repository.findLatestByTarget(input.target);
    if (latest) {
      const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
      if (elapsed < this.cooldownSeconds) {
        throw new SmsOtpCooldownError(Math.ceil(this.cooldownSeconds - elapsed));
      }
    }

    const plaintext = generateCode();
    const expiresAt = new Date(Date.now() + this.codeTtlMinutes * 60_000);
    const row = await this.repository.create({
      type: "SMS_OTP",
      target: input.target,
      codeHash: hashCode(plaintext),
      attemptCount: 0,
      maxAttempts: this.maxAttempts,
      signingTokenId: input.signingTokenId,
      status: "PENDING",
      expiresAt,
      requestIp: input.ip,
      requestUserAgent: input.userAgent,
    });

    if (typeof (process as unknown as { emit?: (e: string, p: unknown) => void }).emit === "function") {
      (process as unknown as { emit: (e: string, p: unknown) => void }).emit("sms-otp:generated", {
        verificationId: row.id,
        target: input.target,
        plaintextCode: plaintext,
        locale: input.locale,
      });
    }

    return { verificationId: row.id, expiresAt };
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
    const row = await this.repository.findById(input.verificationId);
    if (!row) return { status: "FAILED", remainingAttempts: 0 };
    if (row.status === "VERIFIED") return { status: "VERIFIED", remainingAttempts: 0 };
    if (row.status === "FAILED" || row.expiresAt.getTime() < Date.now()) {
      return { status: "EXPIRED", remainingAttempts: 0 };
    }

    const ok = safeEqual(row.codeHash, hashCode(input.code.trim()));
    if (ok) {
      await this.repository.markVerified(row.id);
      return { status: "VERIFIED", remainingAttempts: 0 };
    }

    const next = row.attemptCount + 1;
    await this.repository.markFailed(row.id, next);
    return {
      status: next >= row.maxAttempts ? "FAILED" : "FAILED",
      remainingAttempts: Math.max(0, row.maxAttempts - next),
    };
  }
}
