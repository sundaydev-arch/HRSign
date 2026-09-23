import { ApiError, handleApiError } from "@/lib/api";
import { issueCredentialToken } from "@/lib/auth-credentials";
import { prisma } from "@/lib/prisma";
import { rateLimitChecked } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Request password reset — always 200 (anti-enumeration). */
export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitChecked({
      key: `auth:forgot:${getClientIp(req)}`,
      limit: 5,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", { retryAfter: rl.retryAfterSeconds });

    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    if (!email) throw new ApiError(400, "USER_EMAIL_INVALID");

    const user = await prisma.user.findUnique({ where: { email } });
    // Only credential users with a password (or invite-pending) get reset mail.
    if (user?.isActive && !user.oidcSubject) {
      try {
        await issueCredentialToken({
          userId: user.id,
          purpose: "PASSWORD_RESET",
          email: user.email,
          fullName: user.fullName,
        });
      } catch (err) {
        console.error("[auth/forgot] send failed", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
