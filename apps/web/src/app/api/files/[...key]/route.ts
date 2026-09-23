import { ApiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isManagerRole } from "@/lib/rbac";
import { tokenAllowsTask } from "@/lib/signing-links";
import { getStorage } from "@/server/providers";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * MinIO file proxy stream: every file access goes through an authorization
 * check; direct storage links are never exposed.
 * Keys look like templates/{uuid}.pdf, documents/{docId}/v{n}-{stage}.pdf,
 * seals/{uuid}.png, signatures/{taskId}/{ts}.png.
 * External signers gain read-only access to their task's files via ?token=
 * (shortCode or legacy UUID; only its hash is stored for legacy tokens).
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  try {
    const keyPath = key.join("/");
    const token = req.nextUrl.searchParams.get("token");
    const download = req.nextUrl.searchParams.get("download") === "1";
    const seg = key[0];
    const user = await getSessionUser();

    let contentType = "application/octet-stream";

    if (seg === "templates") {
      if (!user) throw new ApiError(401, "UNAUTHENTICATED");
      if (!isManagerRole(user.role)) throw new ApiError(403, "TEMPLATE_FILE_ACCESS_DENIED");
      contentType = "application/pdf";
    } else if (seg === "documents" && key.length === 3) {
      const docId = key[1];
      const doc = await prisma.document.findUnique({
        where: { id: docId },
        include: { signingTask: { include: { signers: true } } },
      });
      if (!doc) throw new ApiError(404, "FILE_NOT_FOUND");
      const taskId = doc.signingTask?.id ?? null;
      const hasAccess =
        (!!user &&
          (isManagerRole(user.role) ||
            doc.createdBy === user.id ||
            (doc.signingTask?.signers.some((s) => s.userId === user.id) ?? false))) ||
        (!!token && !!taskId && (await tokenAllowsTask(token, taskId)));
      if (!hasAccess) throw new ApiError(403, "FILE_ACCESS_DENIED");
      contentType = "application/pdf";
    } else if (seg === "seals") {
      if (!user) throw new ApiError(401, "UNAUTHENTICATED");
      // Company seal originals: HR / SUPER_ADMIN only.
      if (!isManagerRole(user.role)) throw new ApiError(403, "SEAL_FILE_ACCESS_DENIED");
      contentType = "image/png";
    } else if (seg === "signatures" && key.length === 3) {
      const taskId = key[1];
      const task = await prisma.signingTask.findUnique({
        where: { id: taskId },
        include: { signers: true },
      });
      if (!task) throw new ApiError(404, "FILE_NOT_FOUND");
      const hasAccess =
        (!!user &&
          (isManagerRole(user.role) ||
            task.createdBy === user.id ||
            task.signers.some((s) => s.userId === user.id))) ||
        (!!token && (await tokenAllowsTask(token, task.id)));
      if (!hasAccess) throw new ApiError(403, "FILE_ACCESS_DENIED");
      contentType = "image/png";
    } else {
      throw new ApiError(404, "UNKNOWN_FILE_TYPE");
    }

    const data = await getStorage().get(keyPath);
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
    });
    if (download) {
      const filename = key[key.length - 1] ?? "file";
      headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    }
    return new NextResponse(new Uint8Array(data), { status: 200, headers });
  } catch (err) {
    return handleApiError(err);
  }
}
