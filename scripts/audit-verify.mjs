#!/usr/bin/env node
/**
 * Walk the audit log hash chain and report breaks.
 * Usage: pnpm audit:verify
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

function canonicalJson(value) {
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const obj = val;
      const sorted = {};
      for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
      return sorted;
    }
    return val;
  });
}

function computeHash(prevHash, payload) {
  return createHash("sha256").update(`${prevHash ?? ""}${canonicalJson(payload)}`).digest("hex");
}

async function main() {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      prevHash: true,
      hash: true,
      action: true,
      targetType: true,
      targetId: true,
      userId: true,
      result: true,
      documentSha256: true,
      ip: true,
      userAgent: true,
      detail: true,
      createdAt: true,
    },
  });

  let ok = 0;
  let broken = 0;
  let expectedPrev = null;

  for (const row of rows) {
    const payload = {
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId ?? null,
      userId: row.userId ?? null,
      result: row.result ?? "success",
      documentSha256: row.documentSha256 ?? null,
      ip: row.ip ?? null,
      userAgent: row.userAgent ?? null,
      detail: row.detail ?? null,
    };
    const expected = computeHash(expectedPrev, payload);
    const prevOk = row.prevHash === expectedPrev;
    const hashOk = row.hash === expected;
    if (prevOk && hashOk) {
      ok += 1;
    } else {
      broken += 1;
      console.error(
        `[break] id=${row.id} at=${row.createdAt.toISOString()} action=${row.action}` +
        ` prevOk=${prevOk} hashOk=${hashOk}`,
      );
    }
    expectedPrev = row.hash;
  }

  console.log(`Checked ${rows.length} audit entries: ${ok} ok, ${broken} broken`);
  await prisma.$disconnect();
  process.exit(broken > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
