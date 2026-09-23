import { prisma } from "@/lib/prisma";
import {
  SmsOtpVerifier,
  SmsOtpCooldownError,
} from "@/server/providers/identity/sms-otp";
import { sendSms } from "@/lib/envelope-delivery";
import type { IdentityVerifier } from "@/server/providers/types";

let verifier: IdentityVerifier | null = null;
let wired = false;

export function ensureSmsOtpVerifier(): void {
  if (wired && verifier) return;
  verifier = new SmsOtpVerifier({
    repository: {
      async create(input) {
        return prisma.identityVerification.create({ data: input });
      },
      async findById(id) {
        return prisma.identityVerification.findUnique({ where: { id } });
      },
      async markVerified(id) {
        await prisma.identityVerification.update({
          where: { id },
          data: { status: "VERIFIED", verifiedAt: new Date() },
        });
      },
      async markFailed(id, attemptCount) {
        const row = await prisma.identityVerification.findUnique({ where: { id } });
        const max = row?.maxAttempts ?? 5;
        await prisma.identityVerification.update({
          where: { id },
          data: {
            attemptCount,
            status: attemptCount >= max ? "FAILED" : "PENDING",
          },
        });
      },
      async findLatestByTarget(target) {
        return prisma.identityVerification.findFirst({
          where: { target, type: "SMS_OTP" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
      },
    },
  });

  process.on("sms-otp:generated", (payload: unknown) => {
    const p = payload as {
      target?: string;
      plaintextCode?: string;
      locale?: string;
    };
    if (!p.target || !p.plaintextCode) return;
    const body =
      p.locale === "en"
        ? `HRSign code: ${p.plaintextCode} (valid 10 min)`
        : `HRSign 验证码：${p.plaintextCode}（10 分钟内有效）`;
    void sendSms({ to: p.target, body, templateKey: "idv.sms_otp" });
  });

  wired = true;
}

export function getSmsOtpVerifier(): IdentityVerifier {
  ensureSmsOtpVerifier();
  if (!verifier) throw new Error("SmsOtpVerifier not wired");
  return verifier;
}

export { SmsOtpCooldownError };
