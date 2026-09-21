import type { AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isAppLocale,
  loadMessages,
  pickLocaleFromAcceptLanguage,
} from "./config";

// Locale resolution order: switcher cookie → Accept-Language → default zh-CN.
// Persisting the logged-in user's User.locale into the cookie is scheduled for
// the database-migration batch.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const cookieMatched =
    cookieLocale !== undefined && isAppLocale(cookieLocale) ? cookieLocale : undefined;
  const acceptLanguage = headerStore.get("accept-language");

  const locale = cookieMatched ?? pickLocaleFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
  return { locale, messages: (await loadMessages(locale)) as AbstractIntlMessages };
});
