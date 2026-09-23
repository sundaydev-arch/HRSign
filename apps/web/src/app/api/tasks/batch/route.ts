import { ApiError, handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import { createSigningTask } from "@/lib/create-task";
import { rateLimitChecked } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api";
import { BatchCreateTasksSchema } from "@/schemas/create-task";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Batch initiate signing tasks from a JSON array.
 * Each item reuses the same validation as POST /api/tasks.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiKeyOrSession(["HR", "SUPER_ADMIN"]);
    const rl = rateLimitChecked({
      key: `tasks:batch:${getClientIp(req)}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", { retryAfter: rl.retryAfterSeconds });

    const raw = await req.json().catch(() => null);
    const parsed = BatchCreateTasksSchema.safeParse(raw);
    if (!parsed.success) {
      if (!raw || !Array.isArray((raw as { tasks?: unknown }).tasks)) {
        throw new ApiError(400, "BATCH_TASKS_REQUIRED");
      }
      const len = (raw as { tasks: unknown[] }).tasks.length;
      if (len > 100) throw new ApiError(400, "BATCH_TOO_LARGE", { max: 100 });
      const issue = parsed.error.issues[0];
      const path = issue?.path?.join(".") ?? "";
      throw new ApiError(400, "BATCH_VALIDATION_FAILED", {
        path,
        message: issue?.message ?? "invalid",
      });
    }

    const results: Array<{
      index: number;
      ok: boolean;
      taskId?: string;
      documentId?: string;
      error?: string;
    }> = [];

    for (let i = 0; i < parsed.data.tasks.length; i++) {
      const item = parsed.data.tasks[i]!;
      try {
        const created = await createSigningTask({
          body: item,
          userId: actorUserId(actor),
          ip: getClientIp(req),
          userAgent: req.headers.get("user-agent") ?? "unknown",
        });
        results.push({ index: i, ok: true, taskId: created.taskId, documentId: created.documentId });
      } catch (err) {
        const code = err instanceof ApiError ? err.code : "INTERNAL_ERROR";
        results.push({ index: i, ok: false, error: code });
      }
    }

    return NextResponse.json({
      created: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
