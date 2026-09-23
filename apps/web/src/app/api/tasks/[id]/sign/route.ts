import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { executeSign, loadTaskForSign, type SignMode } from "@/lib/signing";
import type { Signer } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

interface SignBody {
  mode?: string; // COMPANY_SEAL | HANDWRITE
  sealId?: string;
  imageDataUrl?: string;
  comment?: string;
  token?: string; // External signer's plaintext token (only its hash is stored, spec 4).
}

/** Resolve an external signer from the plaintext token (hash, expiry, revocation and usage checks). */
async function findSignerByToken(plaintext: string, taskId: string): Promise<Signer> {
  const tokenHash = createHash("sha256").update(plaintext).digest("hex");
  const tokenRow = await prisma.signingToken.findUnique({
    where: { tokenHash },
    include: { signer: true },
  });
  if (!tokenRow || tokenRow.revokedAt || tokenRow.usedAt || tokenRow.expiresAt <= new Date()) {
    throw new ApiError(403, "SIGN_LINK_INVALID");
  }
  if (tokenRow.signer.taskId !== taskId) {
    throw new ApiError(403, "SIGN_LINK_INVALID");
  }
  return tokenRow.signer;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await req.json()) as SignBody;
    if (body.mode !== "COMPANY_SEAL" && body.mode !== "HANDWRITE") {
      throw new ApiError(400, "SIGNING_METHOD_INVALID");
    }
    const mode: SignMode = body.mode;

    // Resolve signer and operator: external callers use the token, internal
    // callers use the session.
    let signer: Signer;
    let operatorId: string | null;

    if (body.token) {
      signer = await findSignerByToken(body.token, id);
      operatorId = null;
    } else {
      const user = await requireApiUser();
      const signerRow = await prisma.signer.findFirst({
        where: { taskId: id, userId: user.id },
      });
      if (!signerRow) throw new ApiError(403, "NOT_TASK_SIGNER");
      signer = signerRow;
      operatorId = user.id;
    }

    const task = await loadTaskForSign(id);
    if (!task) throw new ApiError(404, "TASK_NOT_FOUND");

    const result = await executeSign({
      task,
      signer,
      operatorId,
      mode,
      sealId: body.sealId,
      imageDataUrl: body.imageDataUrl,
      comment: body.comment,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
