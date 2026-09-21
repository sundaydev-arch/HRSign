import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { NextResponse, type NextRequest } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    const seal = await prisma.seal.findUnique({ where: { id } });
    if (!seal) throw new ApiError(404, "SEAL_NOT_FOUND");

    const body = (await req.json()) as { name?: string; enabled?: boolean };
    const data: { name?: string; enabled?: boolean } = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) throw new ApiError(400, "SEAL_NAME_REQUIRED");
      data.name = name;
    }
    if (body.enabled !== undefined) data.enabled = !!body.enabled;

    const updated = await prisma.seal.update({ where: { id }, data });
    await recordAudit({
      userId: user.id,
      action: "seal.update",
      targetType: "seal",
      targetId: seal.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: data,
    });
    return NextResponse.json({ seal: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
