import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { executeDecline } from "@/lib/signing";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { expireDueTasks, getCurrentSigners } from "@/lib/tasks";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireApiUser();
    await expireDueTasks();

    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const reason = body.reason?.trim() || null;

    const task = await prisma.signingTask.findUnique({
      where: { id },
      include: { signers: true },
    });
    if (!task) throw new ApiError(404, "TASK_NOT_FOUND");

    const me = task.signers.find(
      (s) =>
        s.userId === user.id &&
        s.signRole === "PERSONAL_SIGNATURE" &&
        s.status === "PENDING",
    );
    if (!me) throw new ApiError(403, "NOT_TASK_SIGNER");
    if (!getCurrentSigners(task.flowType, task.signers).some((s) => s.id === me.id)) {
      throw new ApiError(403, "NOT_YOUR_TURN");
    }

    await executeDecline({
      task,
      signer: me,
      operatorId: user.id,
      reason,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
