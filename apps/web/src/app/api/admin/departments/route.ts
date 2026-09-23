import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";

export async function GET() {
  try {
    await requireApiUser(["SUPER_ADMIN", "HR"]);
    const departments = await prisma.department.findMany({
      include: {
        leader: { select: { id: true, fullName: true, email: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ departments });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireApiUser(["SUPER_ADMIN"]);
    const body = (await req.json()) as { name?: string; leaderUserId?: string | null };
    const name = String(body.name ?? "").trim();
    if (!name) throw new ApiError(400, "VALIDATION_FAILED");
    const department = await prisma.department.create({
      data: { name, leaderUserId: body.leaderUserId ?? null },
    });
    return NextResponse.json({ department });
  } catch (err) {
    return handleApiError(err);
  }
}

export const runtime = "nodejs";
