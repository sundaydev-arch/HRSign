import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import {
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALE_COOKIE,
  pickLocaleFromAcceptLanguage,
  toDbLocale,
  type DbLocale,
} from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Resolve UI locale for list filtering.
 * Priority: cookie → session User.locale → Accept-Language → default.
 */
export async function getRequestDbLocale(): Promise<DbLocale> {
  const jar = await cookies();
  const raw = jar.get(LOCALE_COOKIE)?.value;
  if (raw && isAppLocale(raw)) return toDbLocale(raw);

  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { locale: true },
      });
      if (user?.locale === "en" || user?.locale === "zh_CN") {
        return user.locale;
      }
    }
  } catch {
    // auth() may fail outside request context; fall through
  }

  const hdrs = await headers();
  const fromAccept = pickLocaleFromAcceptLanguage(hdrs.get("accept-language"));
  if (fromAccept) return toDbLocale(fromAccept);

  return toDbLocale(DEFAULT_LOCALE);
}

/** Resolve locale for API-key callers (query / Accept-Language / default). */
export function resolveLocaleFromRequest(req: {
  nextUrl?: { searchParams: URLSearchParams };
  headers: Headers;
}): DbLocale {
  const q = req.nextUrl?.searchParams.get("locale")?.trim();
  if (q && isAppLocale(q)) return toDbLocale(q);
  if (q === "zh_CN" || q === "en") return q;
  const fromAccept = pickLocaleFromAcceptLanguage(req.headers.get("accept-language"));
  if (fromAccept) return toDbLocale(fromAccept);
  return toDbLocale(DEFAULT_LOCALE);
}

/**
 * Template locale filter: match UI locale or BILINGUAL templates.
 * Use on Template / nested templateVersion.template relations.
 */
export function templateLocaleWhere(uiLocale: DbLocale): Prisma.TemplateWhereInput {
  return { locale: { in: [uiLocale, "BILINGUAL"] } };
}
