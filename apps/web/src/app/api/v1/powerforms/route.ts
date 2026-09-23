import { handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireApiKeyOrSession();
    const powerForms = await prisma.powerForm.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({
      powerForms: powerForms.map((p) => ({
        id: p.id,
        name: p.name,
        templateId: p.templateId,
        url: `/powerforms/${p.urlSlug}`,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireApiKeyOrSession();
    const body = (await req.json()) as { name?: string; templateId?: string };
    if (!body.name || !body.templateId) {
      return NextResponse.json({ error: { code: "VALIDATION_FAILED" } }, { status: 400 });
    }
    const slug = `pf-${Date.now().toString(36)}`;
    const row = await prisma.powerForm.create({
      data: { name: body.name, templateId: body.templateId, urlSlug: slug },
    });
    return NextResponse.json(
      { id: row.id, name: row.name, templateId: row.templateId, url: `/powerforms/${row.urlSlug}` },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
