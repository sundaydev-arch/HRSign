import { handleApiError } from "@/lib/api";
import { isPadesConfigured, padesProviderStatus } from "@/lib/pades-config";
import { requireV1Hr } from "@/lib/v1-authz";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Catalog of SignatureProvider / CA adapters available in this build. */
export async function GET() {
  try {
    await requireV1Hr();
    const padesConfigured = isPadesConfigured();
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
          status: padesProviderStatus(),
          configured: padesConfigured,
          legalNote:
            "Operator PEM PKCS#7 (PAdES-B-B style). Not LTV / not PRC 可靠电子签名 unless your CA attests.",
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
