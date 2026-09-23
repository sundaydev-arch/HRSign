import { ApiError } from "@/lib/api";
import { assertRecipientToken, getEnvelopeOrThrow } from "@/lib/envelopes";
import { prisma } from "@/lib/prisma";
import { ensureIdentityVerifier, getIdentityVerifier } from "@/server/identity/wire";
import { ensureSmsOtpVerifier, getSmsOtpVerifier } from "@/server/identity/sms-wire";
import type { Locale } from "@/server/providers/types";

export type IdvMethod = "none" | "email_otp" | "sms_otp" | "kba" | "id_document" | "face";

export async function startRecipientIdv(input: {
  envelopeId: string;
  recipientId: string;
  token: string;
  method?: string;
  locale?: Locale;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await assertRecipientToken(input.envelopeId, input.recipientId, input.token);
  const env = await getEnvelopeOrThrow(input.envelopeId);
  const recipient = env.recipients.find((r) => r.id === input.recipientId);
  if (!recipient) throw new ApiError(404, "RECIPIENT_NOT_FOUND");

  const method = (input.method || recipient.idvMethod || "none") as IdvMethod;
  if (method === "none") {
    await prisma.envelopeRecipient.update({
      where: { id: recipient.id },
      data: { idvStatus: "skipped", idvMethod: "none" },
    });
    return { method, verificationId: null, expiresAt: null, status: "skipped" as const };
  }

  if (method === "kba" || method === "id_document" || method === "face") {
    throw new ApiError(501, "IDV_METHOD_NOT_IMPLEMENTED");
  }

  if (method === "email_otp") {
    ensureIdentityVerifier();
    const started = await getIdentityVerifier().startVerification({
      target: recipient.email,
      signingTokenId: null,
      locale: input.locale ?? "zh_CN",
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
    await prisma.envelopeEvent.create({
      data: {
        envelopeId: input.envelopeId,
        action: "idv_started",
        actorEmail: recipient.email,
        meta: { recipientId: recipient.id, method, verificationId: started.verificationId },
      },
    });
    return {
      method,
      verificationId: started.verificationId,
      expiresAt: started.expiresAt.toISOString(),
      status: "pending" as const,
      targetHint: maskEmail(recipient.email),
    };
  }

  if (method === "sms_otp") {
    if (!recipient.phoneE164) throw new ApiError(400, "PHONE_REQUIRED");
    ensureSmsOtpVerifier();
    const started = await getSmsOtpVerifier().startVerification({
      target: recipient.phoneE164,
      signingTokenId: null,
      locale: input.locale ?? "zh_CN",
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
    await prisma.envelopeEvent.create({
      data: {
        envelopeId: input.envelopeId,
        action: "idv_started",
        actorEmail: recipient.email,
        meta: { recipientId: recipient.id, method, verificationId: started.verificationId },
      },
    });
    return {
      method,
      verificationId: started.verificationId,
      expiresAt: started.expiresAt.toISOString(),
      status: "pending" as const,
      targetHint: maskPhone(recipient.phoneE164),
    };
  }

  throw new ApiError(400, "IDV_METHOD_INVALID");
}

export async function verifyRecipientIdv(input: {
  envelopeId: string;
  recipientId: string;
  token: string;
  verificationId: string;
  code: string;
  method?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await assertRecipientToken(input.envelopeId, input.recipientId, input.token);
  const env = await getEnvelopeOrThrow(input.envelopeId);
  const recipient = env.recipients.find((r) => r.id === input.recipientId);
  if (!recipient) throw new ApiError(404, "RECIPIENT_NOT_FOUND");

  const method = (input.method || recipient.idvMethod || "email_otp") as IdvMethod;
  let result: { status: "VERIFIED" | "FAILED" | "EXPIRED"; remainingAttempts: number };

  if (method === "sms_otp") {
    ensureSmsOtpVerifier();
    result = await getSmsOtpVerifier().checkResult({
      verificationId: input.verificationId,
      code: input.code,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  } else if (method === "email_otp") {
    ensureIdentityVerifier();
    result = await getIdentityVerifier().checkResult({
      verificationId: input.verificationId,
      code: input.code,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  } else {
    throw new ApiError(400, "IDV_METHOD_INVALID");
  }

  if (result.status === "VERIFIED") {
    await prisma.envelopeRecipient.update({
      where: { id: recipient.id },
      data: { idvStatus: "verified", idvMethod: method },
    });
    await prisma.envelopeEvent.create({
      data: {
        envelopeId: input.envelopeId,
        action: "idv_verified",
        actorEmail: recipient.email,
        meta: { recipientId: recipient.id, method },
      },
    });
  }

  return {
    status: result.status.toLowerCase(),
    remainingAttempts: result.remainingAttempts,
    idvStatus: result.status === "VERIFIED" ? "verified" : recipient.idvStatus,
  };
}

function maskEmail(email: string): string {
  const parts = email.split("@");
  const u = parts[0] ?? "";
  const d = parts[1];
  if (!d) return "***";
  const show = u.slice(0, Math.min(2, u.length));
  return `${show}***@${d}`;
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return "****";
  return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
}
