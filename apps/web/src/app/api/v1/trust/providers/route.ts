import { handleApiError } from "@/lib/api";
import { requireV1Hr } from "@/lib/v1-authz";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Catalog of SignatureProvider / CA adapters available in this build. */
export async function GET() {
  try {
    await requireV1Hr();
    const padesConfigured = Boolean(
      process.env.PADES_CERT_PEM || process.env.PADES_CERT_PATH,
    );
    const sm2Configured = Boolean(process.env.GM_SM2_ENABLED === "1");

    return NextResponse.json({
      providers: [
        {
          id: "IMAGE_SEAL",
          kind: "visual",
          status: "done",
          legalNote: "Visual seal only — not a qualified e-signature",
        },
        {
          id: "HANDWRITE",
          kind: "visual",
          status: "done",
          legalNote: "Handwritten image only — not a qualified e-signature",
        },
        {
          id: "PADES",
          kind: "cms_pkcs7",
          status: padesConfigured ? "partial" : "stub",
          configured: padesConfigured,
          legalNote: "Demo PKCS#7 / self-signed unless production CA PEMs are configured",
        },
        {
          id: "GM_SM2",
          kind: "national_crypto",
          status: sm2Configured ? "partial" : "stub",
          configured: sm2Configured,
          legalNote: "Requires GM/T stack; interface reserved",
        },
      ],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
