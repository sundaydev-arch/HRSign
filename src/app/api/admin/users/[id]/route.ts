import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";

const ASSIGNABLE_ROLES: UserRole[] = ["SUPER_ADMIN", "HR", "DEPT_LEADER", "EMPLOYEE"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const operator = await requireApiUser(["SUPER_ADMIN"]);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new ApiError(404, "USER_NOT_FOUND");

    const body = (await req.json()) as {
      role?: string;
      isActive?: boolean;
      password?: string;
    };
    const data: { role?: UserRole; isActive?: boolean; passwordHash?: string } = {};

    if (body.role !== undefined) {
      if (!ASSIGNABLE_ROLES.includes(body.role as UserRole)) throw new ApiError(400, "ROLE_INVALID");
      if (target.id === operator.id && body.role !== "SUPER_ADMIN") {
        throw new ApiError(400, "CANNOT_DEMOTE_OWN_SUPER_ADMIN");
      }
      data.role = body.role as UserRole;
    }
    if (body.isActive !== undefined) {
      if (target.id === operator.id && !body.isActive) {
        throw new ApiError(400, "CANNOT_DISABLE_OWN_ACCOUNT");
      }
      data.isActive = !!body.isActive;
    }
    if (body.password !== undefined) {
      if (body.password.length < 8) throw new ApiError(400, "PASSWORD_TOO_SHORT", { minLength: 8 });
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }
    if (Object.keys(data).length === 0) throw new ApiError(400, "NO_UPDATE_DATA");

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });

    await recordAudit({
      userId: operator.id,
      action: "user.update",
      targetType: "user",
      targetId: user.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { role: data.role, isActive: data.isActive, passwordReset: !!data.passwordHash },
    });

    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
