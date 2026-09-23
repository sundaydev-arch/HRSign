import { prisma } from "@/lib/prisma";
import { getStorage } from "@/server/providers";
import { recordAudit } from "@/lib/audit";

/**
 * Soft-delete documents past retention (unless legal hold), then hard-delete
 * previously soft-deleted rows older than a grace period.
 */
export async function runRetentionScan(): Promise<{ softDeleted: number; hardDeleted: number }> {
  const policies = await prisma.retentionPolicy.findMany({ where: { enabled: true } });
  let softDeleted = 0;
  let hardDeleted = 0;
  const now = new Date();

  for (const policy of policies) {
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - policy.retentionYears);

    const due = await prisma.document.findMany({
      where: {
        category: policy.category,
        deletedAt: null,
        legalHold: false,
        createdAt: { lt: cutoff },
      },
      take: 100,
      select: { id: true, title: true },
    });

    for (const doc of due) {
      if (policy.action === "SOFT_DELETE" || policy.action === "HARD_DELETE") {
        await prisma.document.update({
          where: { id: doc.id },
          data: { deletedAt: now },
        });
        softDeleted += 1;
        await recordAudit({
          action: "retention.soft_delete",
          targetType: "document",
          targetId: doc.id,
          detail: { policyId: policy.id, title: doc.title },
        });
      }
    }
  }

  // Hard-delete soft-deleted docs older than 30 days (skip legal hold).
  const hardCutoff = new Date(now);
  hardCutoff.setDate(hardCutoff.getDate() - 30);
  const softRows = await prisma.document.findMany({
    where: {
      deletedAt: { not: null, lt: hardCutoff },
      legalHold: false,
    },
    take: 50,
    include: { versions: true },
  });

  for (const doc of softRows) {
    const storage = getStorage();
    for (const v of doc.versions) {
      try {
        await storage.delete(v.storageKey);
      } catch {
        /* best-effort */
      }
    }
    await prisma.document.delete({ where: { id: doc.id } });
    hardDeleted += 1;
    await recordAudit({
      action: "retention.hard_delete",
      targetType: "document",
      targetId: doc.id,
      detail: { title: doc.title },
    });
  }

  return { softDeleted, hardDeleted };
}
