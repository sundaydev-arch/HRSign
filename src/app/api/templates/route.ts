import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createHash, randomUUID } from "node:crypto";
import type { TemplateCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { getStorage } from "@/server/providers";

const MAX_TEMPLATE_SIZE = 20 * 1024 * 1024;
const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "OFFER",
  "ENTRY",
  "CONTRACT",
  "RESIGN",
  "CERTIFICATE",
];

export async function GET() {
  try {
    await requireApiUser(["HR", "SUPER_ADMIN"]);
    const templates = await prisma.template.findMany({
      include: {
        versions: {
          orderBy: { version: "desc" },
          include: { _count: { select: { fields: true } } },
        },
        creator: { select: { fullName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({
      templates: templates.map((t) => {
        const latest = t.versions[0];
        return {
          id: t.id,
          name: t.name,
          category: t.category,
          locale: t.locale,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          creatorName: t.creator.fullName,
          latestVersion: latest
            ? {
                id: latest.id,
                version: latest.version,
                status: latest.status,
                pageCount: latest.pageCount,
                fieldCount: latest._count.fields,
                publishedAt: latest.publishedAt,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim();
    const category = String(form.get("category") ?? "");
    const file = form.get("file");

    if (!name) throw new ApiError(400, "TEMPLATE_NAME_REQUIRED");
    if (!TEMPLATE_CATEGORIES.includes(category as TemplateCategory)) {
      throw new ApiError(400, "TEMPLATE_CATEGORY_INVALID");
    }
    if (!(file instanceof File))
      throw new ApiError(400, "TEMPLATE_PDF_REQUIRED");
    if (file.size === 0 || file.size > MAX_TEMPLATE_SIZE) {
      throw new ApiError(400, "TEMPLATE_PDF_TOO_LARGE", { maxMb: 20 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let pageCount = 0;
    try {
      const pdf = await PDFDocument.load(buffer);
      pageCount = pdf.getPageCount();
      if (pageCount === 0) throw new Error("empty pdf");
    } catch {
      throw new ApiError(400, "TEMPLATE_PDF_INVALID");
    }

    // spec 2: the storage key carries version semantics; overwriting is forbidden.
    const storageKey = `templates/${randomUUID()}.pdf`;
    await getStorage().put({
      key: storageKey,
      data: buffer,
      contentType: "application/pdf",
    });
    const sha256 = createHash("sha256").update(buffer).digest("hex");

    // spec 3.1: Template is a pure container; the file and its fields belong to
    // a TemplateVersion (initial v1 draft).
    const template = await prisma.template.create({
      data: {
        name,
        category: category as TemplateCategory,
        createdBy: user.id,
        versions: {
          create: {
            version: 1,
            status: "DRAFT",
            storageKey,
            sha256,
            pageCount,
            createdBy: user.id,
          },
        },
      },
      include: { versions: true },
    });

    await recordAudit({
      userId: user.id,
      action: "template.create",
      targetType: "template",
      targetId: template.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { name, category, pageCount },
    });

    return NextResponse.json({ template });
  } catch (err) {
    return handleApiError(err);
  }
}

// Only HR/super admins may access template endpoints; the route runs on the
// Node runtime (PDF parsing).
export const runtime = "nodejs";
