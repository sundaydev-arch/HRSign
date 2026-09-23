import { ApiError, handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { requireV1Hr } from "@/lib/v1-authz";
import { createBrand, getAccountOrThrow } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ accountId: string }> },
) {
  try {
    await requireV1Hr();
    const { accountId } = await ctx.params;
    await getAccountOrThrow(accountId);
    const brands = await prisma.brand.findMany({ where: { accountId } });
    return NextResponse.json({
      brands: brands.map((b) => ({
        brandId: b.id,
        brandName: b.brandName,
        primaryColor: b.primaryColor,
        logoKey: b.logoKey,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ accountId: string }> },
) {
  try {
    await requireApiKeyOrSession(["SUPER_ADMIN", "HR"]);
    const { accountId } = await ctx.params;
    const body = (await req.json()) as { brandName?: string; primaryColor?: string };
    if (!body.brandName?.trim()) throw new ApiError(400, "VALIDATION_FAILED");
    const brand = await createBrand({
      accountId,
      brandName: body.brandName,
      primaryColor: body.primaryColor,
    });
    return NextResponse.json(
      {
        brandId: brand.id,
        brandName: brand.brandName,
        primaryColor: brand.primaryColor,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
