import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

const ASSIGNABLE_ROLES: UserRole[] = ["SUPER_ADMIN", "HR", "DEPT_LEADER", "EMPLOYEE"];

export async function GET() {
  try {
    await requireApiUser(["SUPER_ADMIN"]);
    const users = await prisma.user.findMany({
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ users });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const operator = await requireApiUser(["SUPER_ADMIN"]);
    const body = (await req.json()) as {
      email?: string;
      fullName?: string;
      password?: string;
      role?: string;
    };
    const email = (body.email ?? "").trim().toLowerCase();
    const fullName = (body.fullName ?? "").trim();
    const password = body.password ?? "";
    const role = body.role as UserRole | undefined;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "USER_EMAIL_INVALID");
    if (!fullName) throw new ApiError(400, "USER_NAME_REQUIRED");
    if (password.length < 8) throw new ApiError(400, "PASSWORD_TOO_SHORT", { minLength: 8 });
    if (!role || !ASSIGNABLE_ROLES.includes(role)) throw new ApiError(400, "ROLE_INVALID");

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new ApiError(400, "EMAIL_ALREADY_REGISTERED");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, fullName, role, passwordHash },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });

    await recordAudit({
      userId: operator.id,
      action: "user.create",
      targetType: "user",
      targetId: user.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { email, role },
    });

    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
