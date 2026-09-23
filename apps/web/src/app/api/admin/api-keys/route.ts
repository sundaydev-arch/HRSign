import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { generateApiKey, requireApiKeyOrSession, actorUserId } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { rateLimitChecked } from "@/lib/rate-limit";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiKeyOrSession(["SUPER_ADMIN"]);
    const rl = rateLimitChecked({
      key: `api-keys:list:${getClientIp(req)}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", { retryAfter: rl.retryAfterSeconds });

    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        createdBy: true,
      },
    });
    void actor;
    return NextResponse.json({ keys });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiKeyOrSession(["SUPER_ADMIN"]);
    const rl = rateLimitChecked({
      key: `api-keys:create:${getClientIp(req)}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", { retryAfter: rl.retryAfterSeconds });

    const body = (await req.json()) as {
      name?: string;
      scopes?: string[];
      expiresAt?: string | null;
      rateLimitPerMinute?: number | null;
    };
    const name = (body.name ?? "").trim();
    if (!name) throw new ApiError(400, "API_KEY_NAME_REQUIRED");

    const { plaintext, keyHash, keyPrefix } = generateApiKey();
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new ApiError(400, "API_KEY_EXPIRES_INVALID");
    }

    const row = await prisma.apiKey.create({
      data: {
        name,
        keyHash,
        keyPrefix,
        scopes: Array.isArray(body.scopes) ? body.scopes : ["tasks:write", "tasks:read"],
        rateLimitPerMinute: body.rateLimitPerMinute ?? null,
        expiresAt,
        createdBy: actorUserId(actor),
      },
    });

    await recordAudit({
      userId: actorUserId(actor),
      action: "api_key.create",
      targetType: "api_key",
      targetId: row.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { name, keyPrefix },
    });

    return NextResponse.json({
      key: {
        id: row.id,
        name: row.name,
        keyPrefix: row.keyPrefix,
        scopes: row.scopes,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      },
      // Shown once — never stored or returned again.
      plaintext,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
