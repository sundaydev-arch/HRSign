import type { Signer, SignerStatus, SigningTask } from "@prisma/client";
import { prisma } from "./prisma";

export type TaskWithSigners = SigningTask & { signers: Signer[] };

/**
 * Signers expected to act now: all pending signers for a parallel flow;
 * only the lowest-order pending signers for a sequential flow.
 */
export function getCurrentSigners<T extends { id: string; status: SignerStatus; order: number }>(
  flowType: SigningTask["flowType"],
  signers: T[],
): T[] {
  const pending = signers.filter((s) => s.status === "PENDING");
  if (flowType === "PARALLEL" || pending.length === 0) return pending;
  const minOrder = Math.min(...pending.map((s) => s.order));
  return pending.filter((s) => s.order === minOrder);
}

/**
 * Lazy expiry: mark due unfinished tasks as EXPIRED (spec 3.3 signing
 * state-machine transition NOT_STARTED/IN_PROGRESS → EXPIRED).
 */
export async function expireDueTasks(): Promise<void> {
  await prisma.signingTask.updateMany({
    where: {
      signingStatus: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      expiresAt: { lt: new Date() },
    },
    data: { signingStatus: "EXPIRED" },
  });
}
