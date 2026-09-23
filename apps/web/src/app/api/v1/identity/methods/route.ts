import { IDV_METHODS } from "@/lib/envelopes";
import { handleApiError } from "@/lib/api";
import { requireV1Hr } from "@/lib/v1-authz";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireV1Hr();
    return NextResponse.json({
      methods: [...IDV_METHODS],
      plugins: [
        { id: "email_otp", status: "done", channel: "email" },
        { id: "sms_otp", status: "done", channel: "sms" },
        { id: "kba", status: "stub" },
        { id: "id_document", status: "stub" },
        { id: "face", status: "stub" },
      ],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
