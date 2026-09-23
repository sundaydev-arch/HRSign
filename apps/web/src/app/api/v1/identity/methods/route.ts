import { IDV_METHODS } from "@/lib/envelopes";
import { handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireApiKeyOrSession();
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
