import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { issueCredentialToken } from "@/lib/auth-credentials";

const ASSIGNABLE_ROLES: UserRole[] = ["SUPER_ADMIN", "HR", "DEPT_LEADER", "EMPLOYEE"];

export async function GET() {
  try {
    await requireApiUser(["SUPER_ADMIN"]);
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        passwordHash: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      users: users.map(({ passwordHash, ...u }) => ({
        ...u,
        hasPassword: Boolean(passwordHash),
      })),
    });
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
      name?: string;
      password?: string;
      role?: string;
      invite?: boolean;
    };
    const email = (body.email ?? "").trim().toLowerCase();
    const fullName = (body.fullName ?? body.name ?? "").trim();
    const password = body.password ?? "";
    const invite = body.invite === true;
    const role = body.role as UserRole | undefined;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "USER_EMAIL_INVALID");
    if (!fullName) throw new ApiError(400, "USER_NAME_REQUIRED");
    if (!role || !ASSIGNABLE_ROLES.includes(role)) throw new ApiError(400, "ROLE_INVALID");
    if (!invite && password.length < 8) {
      throw new ApiError(400, "PASSWORD_TOO_SHORT", { minLength: 8 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new ApiError(400, "EMAIL_ALREADY_REGISTERED");

    const passwordHash = invite ? null : await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, fullName, role, passwordHash },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });

    if (invite) {
      try {
        await issueCredentialToken({
          userId: user.id,
          purpose: "INVITE",
          email: user.email,
          fullName: user.fullName,
        });
      } catch (err) {
        console.error("[admin/users] invite email failed", err);
      }
    }

    await recordAudit({
      userId: operator.id,
      action: invite ? "user.invite" : "user.create",
      targetType: "user",
      targetId: user.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { email, role, invite },
    });

    return NextResponse.json({ user, invited: invite });
  } catch (err) {
    return handleApiError(err);
  }
}
