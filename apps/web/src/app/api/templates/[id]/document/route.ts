import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { DocumentContentSchema } from "@/schemas/document-content";

/**
 * Autosave TipTap JSON for DOCUMENT-mode draft versions.
 * PDF + TemplateField sync happens on publish (PATCH status=PUBLISHED).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
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
    if (version.editorMode !== "DOCUMENT") {
      throw new ApiError(400, "TEMPLATE_NOT_DOCUMENT_MODE");
    }

    const body = (await req.json()) as { content?: unknown };
    const parsed = DocumentContentSchema.safeParse(body.content);
    if (!parsed.success) throw new ApiError(400, "DOCUMENT_CONTENT_INVALID");

    await prisma.templateVersion.update({
      where: { id: version.id },
      data: { contentJson: parsed.data as Prisma.InputJsonValue },
    });

    await recordAudit({
      userId: user.id,
      action: "template.document.update",
      targetType: "templateVersion",
      targetId: version.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { templateId: id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export const runtime = "nodejs";
