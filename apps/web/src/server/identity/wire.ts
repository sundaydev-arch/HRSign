import { prisma } from "@/lib/prisma";
import {
  EmailCodeVerifier,
  registerIdentityVerifier,
  getIdentityVerifier,
  EmailCodeCooldownError,
  sendEmail,
} from "@/server/providers";

let wired = false;

/** Lazily register EmailCodeVerifier backed by Prisma. */
export function ensureIdentityVerifier(): void {
  if (wired) return;
  const verifier = new EmailCodeVerifier({
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
          where: { target },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
      },
    },
  });
  registerIdentityVerifier(verifier);

  // Deliver plaintext codes via email when generated.
  process.on("email-code:generated", (payload: unknown) => {
    const p = payload as {
      target?: string;
      plaintextCode?: string;
      locale?: string;
    };
    if (!p.target || !p.plaintextCode) return;
    const subject =
      p.locale === "en"
        ? "Your HRSign verification code"
        : "您的 HRSign 验证码";
    const html =
      p.locale === "en"
        ? `<p>Your verification code is <strong>${p.plaintextCode}</strong>. It expires in 10 minutes.</p>`
        : `<p>您的验证码是 <strong>${p.plaintextCode}</strong>，10 分钟内有效。</p>`;
    void sendEmail({ to: p.target, subject, html });
  });

  wired = true;
}

export { getIdentityVerifier, EmailCodeCooldownError };
