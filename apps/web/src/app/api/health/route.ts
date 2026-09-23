import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/server/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for Docker / k8s / load balancers.
 * Returns 200 when DB responds; storage check is best-effort (503 if both fail).
 */
export async function GET() {
  const checks: { database: "ok" | "error"; storage: "ok" | "error" | "skipped"; detail?: string } = {
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
    // Probe with a non-destructive exists check on a sentinel key.
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
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
