import { NextResponse, type NextRequest } from "next/server";
import type { TemplateCategory, TemplateVersionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "OFFER",
  "ENTRY",
  "CONTRACT",
  "RESIGN",
  "CERTIFICATE",
];
const VERSION_STATUSES: TemplateVersionStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireApiUser(["HR", "SUPER_ADMIN"]);
    const template = await prisma.template.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: "desc" },
          include: {
            fields: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
          },
        },
      },
    });
    if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND");
    return NextResponse.json({ template });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    const body = (await req.json()) as {
      name?: string;
      category?: string;
      status?: string;
    };
    const template = await prisma.template.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND");
    const latestVersion = template.versions[0];

    const templateData: { name?: string; category?: TemplateCategory } = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) throw new ApiError(400, "TEMPLATE_NAME_REQUIRED");
      templateData.name = name;
    }
    if (body.category !== undefined) {
      if (!TEMPLATE_CATEGORIES.includes(body.category as TemplateCategory)) {
        throw new ApiError(400, "TEMPLATE_CATEGORY_INVALID");
      }
      templateData.category = body.category as TemplateCategory;
    }

    // spec 3.1: status lives on TemplateVersion (DRAFT → PUBLISHED → ARCHIVED)
    // and becomes immutable after publication.
    let versionStatus: TemplateVersionStatus | null = null;
    if (body.status !== undefined) {
      if (!VERSION_STATUSES.includes(body.status as TemplateVersionStatus)) {
        throw new ApiError(400, "TEMPLATE_STATUS_INVALID");
      }
      versionStatus = body.status as TemplateVersionStatus;
      if (!latestVersion) throw new ApiError(400, "TEMPLATE_VERSION_MISSING");
      if (
        latestVersion.status === "PUBLISHED" &&
        versionStatus !== "ARCHIVED"
      ) {
        throw new ApiError(400, "PUBLISHED_STATUS_LOCKED");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(templateData).length > 0) {
        await tx.template.update({
          where: { id },
          data: templateData,
        });
      }
      if (versionStatus && latestVersion) {
        await tx.templateVersion.update({
          where: { id: latestVersion.id },
          data: {
            status: versionStatus,
            ...(versionStatus === "PUBLISHED"
              ? { publishedAt: new Date() }
              : {}),
            ...(versionStatus === "ARCHIVED" ? { archivedAt: new Date() } : {}),
          },
        });
      }
      return tx.template.findUnique({
        where: { id },
        include: {
          versions: { orderBy: { version: "desc" }, include: { fields: true } },
        },
      });
    });

    await recordAudit({
      userId: user.id,
      action: "template.update",
      targetType: "template",
      targetId: id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { ...templateData, status: versionStatus ?? undefined },
    });
    return NextResponse.json({ template: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Archive every version of the template (no physical deletion, keeping history traceable). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND");
    await prisma.templateVersion.updateMany({
      where: { templateId: id, status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    await recordAudit({
      userId: user.id,
      action: "template.archive",
      targetType: "template",
      targetId: id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
