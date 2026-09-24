import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/server/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for Docker / k8s / load balancers.
 * - ?probe=live → process up (always 200)
 * - ?probe=ready (default) → DB required; storage best-effort
 */
export async function GET(req: NextRequest) {
  const probe = req.nextUrl.searchParams.get("probe") ?? "ready";

  if (probe === "live") {
    return NextResponse.json({
      status: "ok",
      probe: "live",
      timestamp: new Date().toISOString(),
    });
  }

  const checks: {
    database: "ok" | "error";
    storage: "ok" | "error" | "skipped";
    detail?: string;
  } = {
    database: "error",
    storage: "skipped",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (err) {
    checks.detail = err instanceof Error ? err.message : "database unreachable";
  }

  try {
    const storage = getStorage();
    await storage.exists("__healthcheck__");
    checks.storage = "ok";
  } catch (err) {
    checks.storage = "error";
    if (!checks.detail) {
      checks.detail = err instanceof Error ? err.message : "storage unreachable";
    }
  }

  const ok = checks.database === "ok";
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      probe: "ready",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
