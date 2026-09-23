import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { ocrPdfToDocument } from "@/lib/pdf/ocr-document";
import { renderDocumentToPdf } from "@/lib/pdf/document-render";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { getStorage } from "@/server/providers";

/**
 * Convert an uploaded PDF template (PDF_OVERLAY) into DOCUMENT mode via best-effort OCR/text extract.
 */
export async function POST(
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
    if (version.status !== "DRAFT") throw new ApiError(400, "PUBLISHED_VERSION_NOT_EDITABLE");

    const pdfBytes = await getStorage().get(version.storageKey);
    const ocr = await ocrPdfToDocument(pdfBytes, template.name);
    if (ocr.source === "empty" || ocr.lineCount === 0) {
      throw new ApiError(400, "OCR_NO_TEXT");
    }

    const rendered = await renderDocumentToPdf(ocr.content);
    const storageKey = `templates/${randomUUID()}.pdf`;
    await getStorage().put({
      key: storageKey,
      data: rendered.pdfBytes,
      contentType: "application/pdf",
    });

    await prisma.templateVersion.update({
      where: { id: version.id },
      data: {
        editorMode: "DOCUMENT",
        contentJson: ocr.content as Prisma.InputJsonValue,
        storageKey,
        sha256: createHash("sha256").update(rendered.pdfBytes).digest("hex"),
        pageCount: rendered.pageCount,
      },
    });

    await recordAudit({
      userId: user.id,
      action: "template.update",
      targetType: "template",
      targetId: id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { ocr: true, source: ocr.source, lineCount: ocr.lineCount },
    });

    return NextResponse.json({
      ok: true,
      source: ocr.source,
      lineCount: ocr.lineCount,
      editorMode: "DOCUMENT",
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export const runtime = "nodejs";
