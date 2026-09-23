import { ApiError, handleApiError } from "@/lib/api";
import { createEnvelope, sendEnvelope, toEnvelopeDto } from "@/lib/envelopes";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Public: start an envelope from a PowerForm (self-serve). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    const body = (await req.json()) as { name?: string; email?: string };
    if (!body.name?.trim() || !body.email?.trim()) {
      throw new ApiError(400, "VALIDATION_FAILED");
    }

    const pf = await prisma.powerForm.findUnique({ where: { urlSlug: slug } });
    if (!pf || !pf.enabled) throw new ApiError(404, "POWERFORM_NOT_FOUND");

    const actor =
      (await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } })) ??
      (await prisma.user.findFirst({ where: { role: "HR" }, select: { id: true } }));
    if (!actor) throw new ApiError(503, "NO_ACTOR_USER");

    const template = await prisma.template.findUnique({ where: { id: pf.templateId } });
    const subject = template?.name
      ? `${template.name} — ${body.name.trim()}`
      : `${pf.name} — ${body.name.trim()}`;

    const env = await createEnvelope({
      subject,
      emailBlurb: `Started via PowerForm ${pf.name}`,
      createdBy: actor.id,
      documents: [
        {
          name: template?.name ? `${template.name}.pdf` : "Document.pdf",
          documentOrder: 1,
          pageCount: 1,
        },
      ],
      recipients: [
        {
          recipientType: "signer",
          routingOrder: 1,
          name: body.name.trim(),
          email: body.email.trim(),
        },
      ],
    });

    const { envelope, tokens } = await sendEnvelope(env.id);
    const dto = toEnvelopeDto(envelope, tokens);
    const accessUrl = dto.recipients[0]?.accessUrl;
    if (!accessUrl) throw new ApiError(500, "SIGN_LINK_MISSING");

    return NextResponse.json(
      { envelopeId: dto.id, accessUrl, powerFormId: pf.id },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
