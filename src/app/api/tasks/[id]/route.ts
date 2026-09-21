import { ApiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isManagerRole, requireApiUser } from "@/lib/rbac";
import { expireDueTasks, getCurrentSigners } from "@/lib/tasks";
import { CoordinatesSchema } from "@/schemas/coordinates";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireApiUser();
    await expireDueTasks();

    const task = await prisma.signingTask.findUnique({
      where: { id },
      include: {
        document: {
          include: {
            versions: { orderBy: { version: "desc" } },
            templateVersion: { include: { fields: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } },
          },
        },
        signers: { orderBy: { order: "asc" }, include: { user: { select: { fullName: true, email: true } } } },
        approvalRecords: {
          orderBy: { createdAt: "desc" },
          include: { approver: { select: { fullName: true } } },
        },
        signatures: {
          orderBy: { createdAt: "desc" },
          include: {
            operator: { select: { fullName: true } },
            signer: { select: { externalFullName: true } },
            seal: { select: { name: true } },
          },
        },
      },
    });
    if (!task) throw new ApiError(404, "TASK_NOT_FOUND");

    const isSigner = task.signers.some((s) => s.userId === user.id);
    if (!isManagerRole(user.role) && task.createdBy !== user.id && !isSigner) {
      throw new ApiError(403, "TASK_ACCESS_DENIED");
    }

    const current = getCurrentSigners(task.flowType, task.signers);
    const mySigner = task.signers.find((s) => s.userId === user.id);
    const latestVersion = task.document.versions[0];

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        approvalStatus: task.approvalStatus,
        signingStatus: task.signingStatus,
        flowType: task.flowType,
        expiresAt: task.expiresAt,
        createdAt: task.createdAt,
        documentId: task.document.id,
        categoryName: task.document.category,
      },
      creator: (await prisma.user.findUnique({ where: { id: task.createdBy }, select: { fullName: true } }))?.fullName ?? "",
      fileUrl: latestVersion ? `/api/files/${latestVersion.storageKey}` : null,
      currentVersion: latestVersion?.version ?? 0,
      fields: task.document.templateVersion.fields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        page: CoordinatesSchema.parse(f.coordinates).page,
      })),
      signers: task.signers.map((s) => ({
        id: s.id,
        signRole: s.signRole,
        status: s.status,
        order: s.order,
        name: s.user?.fullName ?? s.externalFullName ?? null,
        email: s.user?.email ?? s.externalEmail ?? "",
        isExternal: !s.userId,
        comment: s.declinedReason,
        signedAt: s.signedAt,
      })),
      approvals: task.approvalRecords.map((a) => ({
        id: a.id,
        approverName: a.approver.fullName,
        action: a.action,
        comment: a.comment,
        createdAt: a.createdAt,
      })),
      signatures: task.signatures.map((sig) => ({
        id: sig.id,
        method: sig.method,
        sealName: sig.seal?.name ?? null,
        signerName: sig.operator?.fullName ?? sig.signer?.externalFullName ?? null,
        createdAt: sig.createdAt,
      })),
      me: {
        canApprove:
          task.approvalStatus === "PENDING" &&
          !!mySigner &&
          mySigner.signRole === "APPROVER" &&
          mySigner.status === "PENDING" &&
          current.some((s) => s.id === mySigner.id),
        canSign:
          task.approvalStatus === "APPROVED" &&
          task.signingStatus === "IN_PROGRESS" &&
          !!mySigner &&
          mySigner.signRole !== "APPROVER" &&
          mySigner.status === "PENDING" &&
          current.some((s) => s.id === mySigner.id),
        signRole: mySigner?.signRole ?? null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
