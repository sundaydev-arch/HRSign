import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { getStorage } from "@/server/providers";

/**
 * Clone the latest template version into a new DRAFT (spec 3.1).
 * Copies PDF bytes + fields so published templates can be iterated.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    const template = await prisma.template.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: { fields: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
        },
      },
    });
    if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND");
    const latest = template.versions[0];
    if (!latest) throw new ApiError(400, "TEMPLATE_VERSION_MISSING");

    // Only spawn a new draft when the latest is locked (published/archived).
    if (latest.status === "DRAFT") {
      throw new ApiError(400, "DRAFT_VERSION_ALREADY_EXISTS");
    }

    const storage = getStorage();
    const bytes = await storage.get(latest.storageKey);
    const storageKey = `templates/${randomUUID()}.pdf`;
    await storage.put({ key: storageKey, data: bytes, contentType: "application/pdf" });
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const nextVersion = latest.version + 1;

    const created = await prisma.$transaction(async (tx) => {
      return tx.templateVersion.create({
        data: {
          templateId: id,
          version: nextVersion,
          status: "DRAFT",
          storageKey,
          sha256,
          pageCount: latest.pageCount,
          editorMode: latest.editorMode,
          contentJson: latest.contentJson ?? undefined,
          createdBy: user.id,
          fields: {
            create: latest.fields.map((f, index) => ({
              type: f.type,
              label: f.label,
              coordinates: f.coordinates as object,
              required: f.required,
              defaultValue: f.defaultValue,
              fontSize: f.fontSize,
              sortOrder: index,
            })),
          },
        },
        include: { fields: true },
      });
    });

    await recordAudit({
      userId: user.id,
      action: "template.version.create",
      targetType: "templateVersion",
      targetId: created.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { templateId: id, fromVersion: latest.version, version: nextVersion },
    });

    return NextResponse.json({ version: created, templateId: id });
  } catch (err) {
    return handleApiError(err);
  }
}

export const runtime = "nodejs";
