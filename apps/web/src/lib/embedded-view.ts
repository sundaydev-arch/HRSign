import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api";
import { getEnvelopeOrThrow } from "@/lib/envelopes";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "node:crypto";

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function embedSecret() {
  return process.env.EMBED_SIGNING_SECRET || process.env.NEXTAUTH_SECRET || "hrsign-dev-embed";
}

/** Compact HMAC token: envelopeId.recipientId.exp.sig */
export function mintEmbedToken(input: {
  envelopeId: string;
  recipientId: string;
  ttlSeconds?: number;
}) {
  const exp = Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 15 * 60);
  const payload = `${input.envelopeId}.${input.recipientId}.${exp}`;
  const sig = createHmac("sha256", embedSecret()).update(payload).digest("base64url");
  return { token: `${payload}.${sig}`, expiresAt: new Date(exp * 1000) };
}

export function verifyEmbedToken(token: string): {
  envelopeId: string;
  recipientId: string;
} {
  const parts = token.split(".");
  if (parts.length !== 4) throw new ApiError(401, "SIGN_LINK_INVALID");
  const [envelopeId, recipientId, expStr, sig] = parts;
  if (!envelopeId || !recipientId || !expStr || !sig) throw new ApiError(401, "SIGN_LINK_INVALID");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
    throw new ApiError(401, "SIGN_LINK_INVALID");
  }
  const payload = `${envelopeId}.${recipientId}.${expStr}`;
  const expected = createHmac("sha256", embedSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError(401, "SIGN_LINK_INVALID");
  }
  return { envelopeId, recipientId };
}

export async function createRecipientEmbeddedView(input: {
  envelopeId: string;
  recipientId: string;
  returnUrl: string;
  frameAncestors?: string[];
}) {
  const env = await getEnvelopeOrThrow(input.envelopeId);
  if (env.status === "created" || env.status === "voided" || env.status === "completed") {
    // allow sent/delivered/signed; also created for draft preview embeds
  }
  const recipient = env.recipients.find((r) => r.id === input.recipientId);
  if (!recipient) throw new ApiError(404, "RECIPIENT_NOT_FOUND");

  const { token, expiresAt } = mintEmbedToken({
    envelopeId: input.envelopeId,
    recipientId: input.recipientId,
  });

  // Also refresh access token hash so `t=` and `embed=` both work on hosted page
  const raw = randomBytes(24).toString("base64url");
  await prisma.envelopeRecipient.update({
    where: { id: recipient.id },
    data: { accessTokenHash: hashToken(raw) },
  });

  const base = input.returnUrl.replace(/\/$/, "");
  const url = `${base}/sign/envelope/${input.envelopeId}?r=${recipient.id}&t=${raw}&embed=${token}`;

  await prisma.envelopeEvent.create({
    data: {
      envelopeId: input.envelopeId,
      action: "embedded_view_created",
      actorEmail: recipient.email,
      meta: { recipientId: recipient.id, frameAncestors: input.frameAncestors ?? [] },
    },
  });

  return {
    url,
    expiresAt: expiresAt.toISOString(),
    token,
    frameAncestors: input.frameAncestors ?? [],
  };
}
