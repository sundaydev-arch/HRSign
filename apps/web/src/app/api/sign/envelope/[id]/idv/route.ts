import { ApiError, handleApiError } from "@/lib/api";
import { startRecipientIdv, verifyRecipientIdv } from "@/lib/idv";
import {
  EmailCodeCooldownError,
} from "@/server/providers";
import { SmsOtpCooldownError } from "@/server/identity/sms-wire";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Public IDV challenge / verify for hosted envelope signing (token-gated). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: envelopeId } = await ctx.params;
    const body = (await req.json()) as {
      action?: "start" | "verify";
      recipientId?: string;
      token?: string;
      method?: string;
      verificationId?: string;
      code?: string;
      locale?: "zh_CN" | "en";
    };
    if (!body.recipientId || !body.token) throw new ApiError(401, "SIGN_LINK_INVALID");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent");

    if (body.action === "verify") {
      if (!body.verificationId || !body.code) throw new ApiError(400, "VALIDATION_FAILED");
      const result = await verifyRecipientIdv({
        envelopeId,
        recipientId: body.recipientId,
        token: body.token,
        verificationId: body.verificationId,
        code: body.code,
        method: body.method,
        ip,
        userAgent: ua,
      });
      return NextResponse.json(result);
    }

    const started = await startRecipientIdv({
      envelopeId,
      recipientId: body.recipientId,
      token: body.token,
      method: body.method,
      locale: body.locale,
      ip,
      userAgent: ua,
    });
    return NextResponse.json(started, { status: 201 });
  } catch (err) {
    if (err instanceof EmailCodeCooldownError) {
      return NextResponse.json(
        {
          error: {
            code: "SMS_OTP_COOLDOWN",
            params: { retryAfterSeconds: err.remainingSeconds },
          },
        },
        { status: 429 },
      );
    }
    if (err instanceof SmsOtpCooldownError) {
      return NextResponse.json(
        {
          error: {
            code: "SMS_OTP_COOLDOWN",
            params: { retryAfterSeconds: err.retryAfterSeconds },
          },
        },
        { status: 429 },
      );
    }
    return handleApiError(err);
  }
}
