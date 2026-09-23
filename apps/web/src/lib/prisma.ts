import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * In dev, HMR can keep a PrismaClient from before `prisma generate`.
 * Recreate if new model delegates are missing (e.g. ApprovalPolicy).
 */
function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  const hasApprovalPolicy =
    existing != null &&
    typeof (existing as PrismaClient & { approvalPolicy?: { findMany?: unknown } }).approvalPolicy
      ?.findMany === "function";
  if (hasApprovalPolicy) return existing!;

  const client = new PrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrisma();
