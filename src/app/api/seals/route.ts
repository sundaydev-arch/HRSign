import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { getStorage } from "@/server/providers";
import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";

const MAX_SEAL_SIZE = 5 * 1024 * 1024;

export async function GET() {
  try {
    await requireApiUser();
    const seals = await prisma.seal.findMany({
      include: { creator: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ seals });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim();
    const file = form.get("file");

    if (!name) throw new ApiError(400, "SEAL_NAME_REQUIRED");
    if (!(file instanceof File)) throw new ApiError(400, "SEAL_IMAGE_REQUIRED");
    if (file.size === 0 || file.size > MAX_SEAL_SIZE) {
      throw new ApiError(400, "SEAL_IMAGE_TOO_LARGE", { maxMb: 5 });
    }
    const type = file.type || "";
    if (type !== "image/png") throw new ApiError(400, "SEAL_MUST_BE_PNG");

    const buffer = Buffer.from(await file.arrayBuffer());
    // PNG magic-number validation.
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      throw new ApiError(400, "SEAL_IMAGE_INVALID");
    }

    const storageKey = `seals/${randomUUID()}.png`;
    await getStorage().put({ key: storageKey, data: buffer, contentType: "image/png" });
    // spec 20.6: seal style and size (PDF points); width defaults to 120pt and
    // height follows the image aspect ratio.
    const styleParam = String(form.get("style") ?? "");
    const style = ["ROUND_CHINESE", "TEXT_INTERNATIONAL", "NONE"].includes(styleParam)
      ? (styleParam as "ROUND_CHINESE" | "TEXT_INTERNATIONAL" | "NONE")
      : "ROUND_CHINESE";

    const seal = await prisma.seal.create({
      data: {
        name,
        style,
        storageKey,
        sha256: createHash("sha256").update(buffer).digest("hex"),
        width: 120,
        height: 120,
        createdBy: user.id,
      },
    });

    await recordAudit({
      userId: user.id,
      action: "seal.create",
      targetType: "seal",
      targetId: seal.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { name },
    });

    return NextResponse.json({ seal });
  } catch (err) {
    return handleApiError(err);
  }
}
