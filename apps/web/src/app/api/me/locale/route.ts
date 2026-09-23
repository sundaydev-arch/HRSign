import { ApiError, handleApiError } from "@/lib/api";
import { isAppLocale, toDbLocale, type AppLocale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Persist UI locale to User.locale so outbound email matches the switcher. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await req.json()) as { locale?: string };
    if (!body.locale || !isAppLocale(body.locale)) {
      throw new ApiError(400, "LOCALE_INVALID");
    }
    const locale = body.locale as AppLocale;
    await prisma.user.update({
      where: { id: user.id },
      data: { locale: toDbLocale(locale) },
    });
    return NextResponse.json({ ok: true, locale });
  } catch (err) {
    return handleApiError(err);
  }
}
