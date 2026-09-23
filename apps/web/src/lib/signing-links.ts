import { prisma } from "@/lib/prisma";
import { generateShortCode, hashToken } from "@/lib/tokens";
import { env } from "@/lib/env";
import type { Prisma } from "@prisma/client";

const DEFAULT_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Issue (or re-issue) an active signing short-link for an external signer. */
export async function issueSigningShortLink(opts: {
  signerId: string;
  expiresAt?: Date | null;
  ip?: string;
  userAgent?: string;
  revokePrevious?: boolean;
}): Promise<{ shortCode: string; url: string }> {
  if (opts.revokePrevious) {
    await prisma.signingToken.updateMany({
      where: { signerId: opts.signerId, revokedAt: null, usedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const expiresAt = opts.expiresAt ?? new Date(Date.now() + DEFAULT_LINK_TTL_MS);

  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = generateShortCode(10);
    const tokenHash = hashToken(shortCode);
    try {
      await prisma.signingToken.create({
        data: {
          signerId: opts.signerId,
          tokenHash,
          shortCode,
          expiresAt,
          issuedIp: opts.ip,
          issuedUserAgent: opts.userAgent,
        },
      });
      return { shortCode, url: `${env.APP_URL}/s/${shortCode}` };
    } catch {
      // unique collision — retry
    }
  }
  throw new Error("SHORT_CODE_GENERATE_FAILED");
}

export async function getActiveSigningUrl(signerId: string): Promise<string | null> {
  const row = await prisma.signingToken.findFirst({
    where: {
      signerId,
      revokedAt: null,
      usedAt: null,
      expiresAt: { gt: new Date() },
      shortCode: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row?.shortCode) return null;
  return `${env.APP_URL}/s/${row.shortCode}`;
}

/**
 * Resolve a public signing code (shortCode) or legacy UUID plaintext.
 * `allowUsed` enables read-only access after the link was consumed.
 */
export async function resolveSigningToken<I extends Prisma.SigningTokenInclude>(
  plaintext: string,
  opts: { allowUsed?: boolean; include: I },
) {
  const tokenHash = hashToken(plaintext);
  const row = await prisma.signingToken.findFirst({
    where: { OR: [{ shortCode: plaintext }, { tokenHash }] },
    include: opts.include,
  });
  if (!row) return null;
  if (row.revokedAt || row.expiresAt <= new Date()) return null;
  if (row.usedAt && !opts.allowUsed) return null;
  return row;
}

/** File-route helper: token still valid for a task (used tokens OK for read). */
export async function tokenAllowsTask(token: string, taskId: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const row = await prisma.signingToken.findFirst({
    where: {
      OR: [{ shortCode: token }, { tokenHash }],
      revokedAt: null,
      expiresAt: { gt: new Date() },
      signer: { taskId },
    },
  });
  return row !== null;
}
