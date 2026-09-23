import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma, TemplateCategory, TemplateVersionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { countDocumentFields } from "@/lib/document-fields";
import { renderDocumentToPdf } from "@/lib/pdf/document-render";
import { getStorage } from "@/server/providers";
import { DocumentContentSchema } from "@/schemas/document-content";

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

    // DOCUMENT mode: TipTap JSON → A4 PDF + TemplateField rows on publish
    let documentPublish:
      | {
          storageKey: string;
          sha256: string;
          pageCount: number;
          fields: Array<{
            type: "TEXT" | "DATE" | "SEAL" | "SIGNATURE";
            label: string;
            required: boolean;
            coordinates: object;
            fontSize: number;
            sortOrder: number;
          }>;
        }
      | null = null;

    if (
      versionStatus === "PUBLISHED" &&
      latestVersion &&
      latestVersion.editorMode === "DOCUMENT"
    ) {
      const parsed = DocumentContentSchema.safeParse(latestVersion.contentJson);
      if (!parsed.success) throw new ApiError(400, "DOCUMENT_CONTENT_INVALID");
      if (countDocumentFields(parsed.data) === 0) {
        throw new ApiError(400, "DOCUMENT_FIELDS_REQUIRED");
      }
      const rendered = await renderDocumentToPdf(parsed.data);
      const storageKey = `templates/${randomUUID()}.pdf`;
      await getStorage().put({
        key: storageKey,
        data: rendered.pdfBytes,
        contentType: "application/pdf",
      });
      documentPublish = {
        storageKey,
        sha256: createHash("sha256").update(rendered.pdfBytes).digest("hex"),
        pageCount: rendered.pageCount,
        fields: rendered.fields.map((f) => ({
          type: f.type as "TEXT" | "DATE" | "SEAL" | "SIGNATURE",
          label: f.label,
          required: f.required,
          coordinates: {
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            rotation: 0,
          },
          fontSize: f.fontSize,
          sortOrder: f.sortOrder,
        })),
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(templateData).length > 0) {
        await tx.template.update({
          where: { id },
          data: templateData,
        });
      }
      if (versionStatus && latestVersion) {
        if (versionStatus === "PUBLISHED") {
          await tx.templateVersion.updateMany({
            where: {
              templateId: id,
              status: "PUBLISHED",
              id: { not: latestVersion.id },
            },
            data: { status: "ARCHIVED", archivedAt: new Date() },
          });
        }

        if (documentPublish) {
          await tx.templateField.deleteMany({
            where: { templateVersionId: latestVersion.id },
          });
          // Do not reuse TipTap fieldId as TemplateField.id — atoms keep stable
          // editor ids across versions, which would collide with archived rows.
          await tx.templateField.createMany({
            data: documentPublish.fields.map((f) => ({
              templateVersionId: latestVersion.id,
              type: f.type,
              label: f.label,
              coordinates: f.coordinates as Prisma.InputJsonValue,
              required: f.required,
              fontSize: f.fontSize,
              sortOrder: f.sortOrder,
            })),
          });
        }

        await tx.templateVersion.update({
          where: { id: latestVersion.id },
          data: {
            status: versionStatus,
            ...(documentPublish
              ? {
                  storageKey: documentPublish.storageKey,
                  sha256: documentPublish.sha256,
                  pageCount: documentPublish.pageCount,
                }
              : {}),
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
      detail: {
        ...templateData,
        status: versionStatus ?? undefined,
        documentPublish: Boolean(documentPublish),
      },
    });
    return NextResponse.json({ template: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Delete unused templates; otherwise archive all versions (history kept). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    const template = await prisma.template.findUnique({
      where: { id },
      include: { versions: { select: { id: true } } },
    });
    if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND");

    const versionIds = template.versions.map((v) => v.id);
    const docCount =
      versionIds.length === 0
        ? 0
        : await prisma.document.count({
            where: { templateVersionId: { in: versionIds } },
          });

    if (docCount === 0) {
      await prisma.template.delete({ where: { id } });
      await recordAudit({
        userId: user.id,
        action: "template.delete",
        targetType: "template",
        targetId: id,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        detail: { hard: true },
      });
      return NextResponse.json({ ok: true, hard: true });
    }

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
      detail: { hard: false, reason: "has_documents" },
    });
    return NextResponse.json({ ok: true, hard: false });
  } catch (err) {
    return handleApiError(err);
  }
}

export const runtime = "nodejs";
