import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma, TemplateCategory, TemplateEditorMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { createBlankA4Pdf } from "@/lib/blank-pdf";
import { documentContentForCreate } from "@/lib/document-presets";
import { assertSafePdfUpload } from "@/lib/pdf-safety";
import { renderDocumentToPdf } from "@/lib/pdf/document-render";
import { getRequestDbLocale, templateLocaleWhere } from "@/i18n/request-locale";
import { getStorage } from "@/server/providers";
import type { DocumentContent } from "@/schemas/document-content";

const MAX_TEMPLATE_SIZE = 20 * 1024 * 1024;
const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "OFFER",
  "ENTRY",
  "CONTRACT",
  "RESIGN",
  "CERTIFICATE",
];

async function persistTemplate(input: {
  userId: string;
  name: string;
  category: TemplateCategory;
  locale?: "zh_CN" | "en";
  buffer: Buffer;
  pageCount: number;
  ip: string;
  userAgent: string;
  source: "upload" | "blank" | "preset";
  editorMode: TemplateEditorMode;
  contentJson?: DocumentContent;
}) {
  const storageKey = `templates/${randomUUID()}.pdf`;
  await getStorage().put({
    key: storageKey,
    data: input.buffer,
    contentType: "application/pdf",
  });
  const sha256 = createHash("sha256").update(input.buffer).digest("hex");

  const template = await prisma.template.create({
    data: {
      name: input.name,
      category: input.category,
      locale: input.locale ?? "zh_CN",
      createdBy: input.userId,
      versions: {
        create: {
          version: 1,
          status: "DRAFT",
          storageKey,
          sha256,
          pageCount: input.pageCount,
          editorMode: input.editorMode,
          contentJson: (input.contentJson ?? undefined) as Prisma.InputJsonValue | undefined,
          createdBy: input.userId,
        },
      },
    },
    include: { versions: { include: { fields: true } } },
  });

  await recordAudit({
    userId: input.userId,
    action: "template.create",
    targetType: "template",
    targetId: template.id,
    ip: input.ip,
    userAgent: input.userAgent,
    detail: {
      name: input.name,
      category: input.category,
      pageCount: input.pageCount,
      source: input.source,
      editorMode: input.editorMode,
    },
  });

  return template;
}

export async function GET() {
  try {
    await requireApiUser(["HR", "SUPER_ADMIN"]);
    const locale = await getRequestDbLocale();
    const templates = await prisma.template.findMany({
      where: templateLocaleWhere(locale),
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
                editorMode: latest.editorMode,
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
    const contentType = req.headers.get("content-type") ?? "";
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    // Online blank / preset create (JSON) → DOCUMENT editor mode
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as {
        name?: string;
        category?: string;
        pageCount?: number;
        preset?: string;
      };
      const name = String(body.name ?? "").trim();
      const presetKind = body.preset ? String(body.preset) : "";
      const categoryRaw = presetKind || String(body.category ?? "");
      if (!name) throw new ApiError(400, "TEMPLATE_NAME_REQUIRED");
      if (!TEMPLATE_CATEGORIES.includes(categoryRaw as TemplateCategory)) {
        throw new ApiError(400, "TEMPLATE_CATEGORY_INVALID");
      }
      const category = categoryRaw as TemplateCategory;
      const locale = await getRequestDbLocale();
      const isPreset =
        Boolean(presetKind) && TEMPLATE_CATEGORIES.includes(presetKind as TemplateCategory);

      const contentJson = documentContentForCreate(name, {
        category,
        locale,
        preset: isPreset,
      });
      const rendered = await renderDocumentToPdf(contentJson);
      const template = await persistTemplate({
        userId: user.id,
        name,
        category,
        locale,
        buffer: rendered.pdfBytes,
        pageCount: rendered.pageCount,
        ip,
        userAgent,
        source: isPreset ? "preset" : "blank",
        editorMode: "DOCUMENT",
        contentJson,
      });
      return NextResponse.json({ template });
    }

    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim();
    const category = String(form.get("category") ?? "");
    const file = form.get("file");

    if (!name) throw new ApiError(400, "TEMPLATE_NAME_REQUIRED");
    if (!TEMPLATE_CATEGORIES.includes(category as TemplateCategory)) {
      throw new ApiError(400, "TEMPLATE_CATEGORY_INVALID");
    }
    if (!(file instanceof File)) throw new ApiError(400, "TEMPLATE_PDF_REQUIRED");
    if (file.size === 0 || file.size > MAX_TEMPLATE_SIZE) {
      throw new ApiError(400, "TEMPLATE_PDF_TOO_LARGE", { maxMb: 20 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    assertSafePdfUpload(buffer);
    const pdf = await PDFDocument.load(buffer);
    const pageCount = pdf.getPageCount();
    const locale = await getRequestDbLocale();
    const template = await persistTemplate({
      userId: user.id,
      name,
      category: category as TemplateCategory,
      locale,
      buffer,
      pageCount,
      ip,
      userAgent,
      source: "upload",
      editorMode: "PDF_OVERLAY",
    });
    return NextResponse.json({ template });
  } catch (err) {
    return handleApiError(err);
  }
}

export const runtime = "nodejs";
