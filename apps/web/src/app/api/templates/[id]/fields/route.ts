import { NextResponse, type NextRequest } from "next/server";
import type { FieldType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

// spec 3.1: field types (TEXTAREA removed; SEAL = company seal field,
// SIGNATURE = personal signature field).
const FIELD_TYPES: FieldType[] = ["TEXT", "DATE", "SEAL", "SIGNATURE"];

interface FieldInput {
  type: string;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  placeholder?: string;
  fontSize: number;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    // Fields belong to a TemplateVersion: take the latest one. Per spec 3.1 it
    // is immutable after publication; only drafts may be edited.
    const template = await prisma.template.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND");
    const version = template.versions[0];
    if (!version) throw new ApiError(400, "TEMPLATE_VERSION_MISSING");
    if (version.status !== "DRAFT") {
      throw new ApiError(400, "PUBLISHED_VERSION_NOT_EDITABLE");
    }

    const body = (await req.json()) as { fields?: unknown };
    if (!Array.isArray(body.fields)) throw new ApiError(400, "FIELDS_INVALID");

    const normalized: Prisma.TemplateFieldCreateManyInput[] = [];
    for (let index = 0; index < body.fields.length; index++) {
      const raw = body.fields[index] as Partial<FieldInput>;
      if (!raw.type || !FIELD_TYPES.includes(raw.type as FieldType)) {
        throw new ApiError(400, "FIELD_TYPE_INVALID", { index: index + 1 });
      }
      const label = String(raw.label ?? "").trim();
      if (!label)
        throw new ApiError(400, "FIELD_LABEL_REQUIRED", { index: index + 1 });
      const page = Number(raw.page);
      if (!Number.isInteger(page) || page < 1 || page > version.pageCount) {
        throw new ApiError(400, "FIELD_PAGE_OUT_OF_RANGE", { label });
      }
      const x = Number(raw.x);
      const y = Number(raw.y);
      const width = Number(raw.width);
      const height = Number(raw.height);
      if (
        ![x, y, width, height].every((n) => Number.isFinite(n) && n >= 0) ||
        width <= 0 ||
        height <= 0
      ) {
        throw new ApiError(400, "FIELD_GEOMETRY_INVALID", { label });
      }
      const fontSize = Math.min(
        24,
        Math.max(6, Math.round(Number(raw.fontSize) || 12)),
      );
      normalized.push({
        templateVersionId: version.id,
        type: raw.type as FieldType,
        label,
        // spec 3.1: coordinates are stored in a unified Json structure
        // (editor semantics use the top-left corner as the origin).
        coordinates: { page, x, y, width, height, rotation: 0 },
        required: !!raw.required,
        defaultValue: raw.placeholder ? String(raw.placeholder) : null,
        fontSize,
        sortOrder: index,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.templateField.deleteMany({
        where: { templateVersionId: version.id },
      });
      if (normalized.length > 0) {
        await tx.templateField.createMany({ data: normalized });
      }
    });

    await recordAudit({
      userId: user.id,
      action: "template.fields.update",
      targetType: "templateVersion",
      targetId: version.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { count: normalized.length, templateId: template.id },
    });

    return NextResponse.json({ ok: true, count: normalized.length });
  } catch (err) {
    return handleApiError(err);
  }
}
