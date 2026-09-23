import { NextResponse, type NextRequest } from "next/server";
import type { TemplateCategory } from "@prisma/client";
import { ApiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";

export async function GET() {
  try {
    await requireApiUser(["SUPER_ADMIN", "HR"]);
    const policies = await prisma.approvalPolicy.findMany({
      include: { department: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ policies });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireApiUser(["SUPER_ADMIN"]);
    const body = (await req.json()) as {
      name?: string;
      category?: TemplateCategory | null;
      departmentId?: string | null;
      approverUserIds?: string[];
      required?: boolean;
      enabled?: boolean;
    };
    const name = String(body.name ?? "").trim();
    if (!name) throw new ApiError(400, "VALIDATION_FAILED");
    const policy = await prisma.approvalPolicy.create({
      data: {
        name,
        category: body.category ?? null,
        departmentId: body.departmentId ?? null,
        approverUserIds: body.approverUserIds ?? [],
        required: body.required !== false,
        enabled: body.enabled !== false,
      },
    });
    return NextResponse.json({ policy });
  } catch (err) {
    return handleApiError(err);
  }
}

export const runtime = "nodejs";
