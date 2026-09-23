import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export function toAccountDto(
  row: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
    members?: Array<{
      id: string;
      userId: string;
      role: string;
      user?: { email: string; fullName: string };
    }>;
    brands?: Array<{ id: string; brandName: string; primaryColor: string; logoKey: string | null }>;
    _count?: { envelopes: number; members: number; brands: number };
  },
) {
  return {
    accountId: row.id,
    name: row.name,
    slug: row.slug,
    memberCount: row._count?.members ?? row.members?.length,
    envelopeCount: row._count?.envelopes,
    brandCount: row._count?.brands ?? row.brands?.length,
    members: row.members?.map((m) => ({
      memberId: m.id,
      userId: m.userId,
      role: m.role,
      email: m.user?.email,
      name: m.user?.fullName,
    })),
    brands: row.brands?.map((b) => ({
      brandId: b.id,
      brandName: b.brandName,
      primaryColor: b.primaryColor,
      logoKey: b.logoKey,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `acct-${Date.now().toString(36)}`
  );
}

export async function createAccount(input: {
  name: string;
  slug?: string;
  ownerUserId: string;
}) {
  if (!input.name.trim()) throw new ApiError(400, "VALIDATION_FAILED");
  let slug = input.slug?.trim() || slugify(input.name);
  const clash = await prisma.account.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;

  return prisma.account.create({
    data: {
      name: input.name.trim(),
      slug,
      members: {
        create: { userId: input.ownerUserId, role: "admin" },
      },
    },
    include: {
      members: { include: { user: { select: { email: true, fullName: true } } } },
      brands: true,
      _count: { select: { envelopes: true, members: true, brands: true } },
    },
  });
}

export async function ensureDefaultAccount(ownerUserId: string) {
  const existing = await prisma.account.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return createAccount({ name: "Default Account", slug: "default", ownerUserId });
}

export async function getAccountOrThrow(accountId: string) {
  const row = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      members: { include: { user: { select: { email: true, fullName: true } } } },
      brands: true,
      _count: { select: { envelopes: true, members: true, brands: true } },
    },
  });
  if (!row) throw new ApiError(404, "ACCOUNT_NOT_FOUND");
  return row;
}

export async function addAccountMember(input: {
  accountId: string;
  email: string;
  role?: string;
}) {
  await getAccountOrThrow(input.accountId);
  const user = await prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  if (!user) throw new ApiError(404, "USER_NOT_FOUND");
  try {
    return await prisma.accountMember.create({
      data: {
        accountId: input.accountId,
        userId: user.id,
        role: input.role ?? "sender",
      },
      include: { user: { select: { email: true, fullName: true } } },
    });
  } catch {
    throw new ApiError(409, "ACCOUNT_MEMBER_EXISTS");
  }
}

export async function createBrand(input: {
  accountId: string;
  brandName: string;
  primaryColor?: string;
}) {
  await getAccountOrThrow(input.accountId);
  if (!input.brandName.trim()) throw new ApiError(400, "VALIDATION_FAILED");
  return prisma.brand.create({
    data: {
      accountId: input.accountId,
      brandName: input.brandName.trim(),
      primaryColor: input.primaryColor?.trim() || "#1a1a1a",
    },
  });
}
