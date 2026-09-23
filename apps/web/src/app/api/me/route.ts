import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Current user profile (self-service). */
export async function GET() {
  try {
    const user = await requireApiUser();
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneE164: true,
        role: true,
        locale: true,
      },
    });
    if (!row) throw new ApiError(404, "USER_NOT_FOUND");
    return NextResponse.json({ user: row });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Update display name / phone for the signed-in user. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await req.json()) as { fullName?: string; phoneE164?: string | null };
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    if (!fullName) throw new ApiError(400, "USER_NAME_REQUIRED");

    let phoneE164: string | null | undefined = undefined;
    if (body.phoneE164 !== undefined) {
      const raw = (body.phoneE164 ?? "").trim();
      if (!raw) {
        phoneE164 = null;
      } else if (!/^\+[1-9]\d{6,14}$/.test(raw)) {
        throw new ApiError(400, "PHONE_INVALID");
      } else {
        phoneE164 = raw;
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        fullName,
        ...(phoneE164 !== undefined ? { phoneE164 } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneE164: true,
        role: true,
      },
    });

    await recordAudit({
      userId: user.id,
      action: "user.update",
      targetType: "user",
      targetId: user.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { self: true, fullName: updated.fullName },
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
