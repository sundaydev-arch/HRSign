import { TAB_TYPES } from "@/lib/envelopes";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ types: [...TAB_TYPES] });
}
