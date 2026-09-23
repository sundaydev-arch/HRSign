import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handleApiError } from "@/lib/api";
import { renderDocumentToPdf } from "@/lib/pdf/document-render";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { DocumentContentSchema } from "@/schemas/document-content";

/** Dry-run render TipTap JSON (body or saved draft) → PDF bytes for preview. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireApiUser(["HR", "SUPER_ADMIN"]);
    const template = await prisma.template.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND");
    const version = template.versions[0];
    if (!version) throw new ApiError(400, "TEMPLATE_VERSION_MISSING");
    if (version.editorMode !== "DOCUMENT") {
      throw new ApiError(400, "TEMPLATE_NOT_DOCUMENT_MODE");
    }

    const body = (await req.json().catch(() => ({}))) as { content?: unknown };
    const parsed = DocumentContentSchema.safeParse(body.content ?? version.contentJson);
    if (!parsed.success) throw new ApiError(400, "DOCUMENT_CONTENT_INVALID");

    const rendered = await renderDocumentToPdf(parsed.data);
    return new NextResponse(new Uint8Array(rendered.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="preview.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export const runtime = "nodejs";
