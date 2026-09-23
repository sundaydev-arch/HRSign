import { NextResponse, type NextRequest } from "next/server";
import type { TemplateCategory } from "@prisma/client";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    const policy = await prisma.approvalPolicy.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
        ...(body.approverUserIds !== undefined
          ? { approverUserIds: body.approverUserIds }
          : {}),
        ...(body.required !== undefined ? { required: body.required } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      },
    });
    return NextResponse.json({ policy });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireApiUser(["SUPER_ADMIN"]);
    await prisma.approvalPolicy.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export const runtime = "nodejs";
