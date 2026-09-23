import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { rateLimitChecked } from "@/lib/rate-limit";
import { resolveSigningToken } from "@/lib/signing-links";
import { expireDueTasks } from "@/lib/tasks";
import {
  EmailCodeCooldownError,
  ensureIdentityVerifier,
  getIdentityVerifier,
} from "@/server/identity/wire";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

async function requireActiveToken(plaintext: string) {
  const tokenRow = await resolveSigningToken(plaintext, {
    allowUsed: false,
    include: { signer: true },
  });
  if (!tokenRow) throw new ApiError(404, "SIGN_LINK_INVALID");
  return tokenRow;
}

/** Start email-code verification for an external signing link. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const rl = rateLimitChecked({
      key: `external:verify-start:${getClientIp(req)}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", { retryAfter: rl.retryAfterSeconds });

    await expireDueTasks();
    ensureIdentityVerifier();
    const tokenRow = await requireActiveToken(token);
    const email = tokenRow.signer.externalEmail;
    if (!email) throw new ApiError(400, "SIGNER_INFO_INCOMPLETE", { index: 0 });

    const body = (await req.json().catch(() => ({}))) as { locale?: string };
    const locale =
      body.locale === "en" || body.locale === "en_US" ? "en" : "zh_CN";

    try {
      const result = await getIdentityVerifier().startVerification({
        target: email,
        signingTokenId: tokenRow.id,
        locale,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
      });
      return NextResponse.json({
        verificationId: result.verificationId,
        expiresAt: result.expiresAt,
        emailHint: email.replace(/(^.).+(@.*$)/, "$1***$2"),
      });
    } catch (err) {
      if (err instanceof EmailCodeCooldownError) {
        throw new ApiError(429, "EMAIL_CODE_COOLDOWN", { seconds: err.remainingSeconds });
      }
      throw err;
    }
  } catch (err) {
    return handleApiError(err);
  }
}

/** Check email verification code. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const rl = rateLimitChecked({
      key: `external:verify-check:${getClientIp(req)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", { retryAfter: rl.retryAfterSeconds });

    ensureIdentityVerifier();
    await requireActiveToken(token);

    const body = (await req.json()) as { verificationId?: string; code?: string };
    if (!body.verificationId || !body.code) {
      throw new ApiError(400, "EMAIL_CODE_REQUIRED");
    }

    const result = await getIdentityVerifier().checkResult({
      verificationId: body.verificationId,
      code: body.code.trim(),
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
