import { ApiError, handleApiError } from "@/lib/api";
import { consumeCredentialToken } from "@/lib/auth-credentials";
import { prisma } from "@/lib/prisma";
import { rateLimitChecked } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Set password via invite or reset token. */
export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitChecked({
      key: `auth:set-password:${getClientIp(req)}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", { retryAfter: rl.retryAfterSeconds });

    const body = (await req.json()) as {
      token?: string;
      password?: string;
      purpose?: "INVITE" | "PASSWORD_RESET";
    };
    const plaintext = (body.token ?? "").trim();
    const password = body.password ?? "";
    const purpose = body.purpose === "INVITE" ? "INVITE" : "PASSWORD_RESET";

    if (!plaintext) throw new ApiError(400, "AUTH_TOKEN_INVALID");
    if (password.length < 8) throw new ApiError(400, "PASSWORD_TOO_SHORT", { minLength: 8 });

    let consumed: { userId: string; email: string; fullName: string };
    try {
      consumed = await consumeCredentialToken({ plaintext, purpose });
    } catch {
      throw new ApiError(400, "AUTH_TOKEN_INVALID");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: consumed.userId },
      data: { passwordHash },
    });

    await recordAudit({
      userId: consumed.userId,
      action: purpose === "INVITE" ? "auth.invite.accept" : "auth.password.reset",
      targetType: "user",
      targetId: consumed.userId,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent") ?? "unknown",
    });

    return NextResponse.json({ ok: true, email: consumed.email });
  } catch (err) {
    return handleApiError(err);
  }
}
