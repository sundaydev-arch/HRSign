import enMessages from "../../messages/en.json";
import zhCNMessages from "../../messages/zh-CN.json";

export const LOCALES = ["zh-CN", "en"] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "zh-CN";

export const LOCALE_COOKIE = "HR_SIGN_LOCALE";

const MESSAGES: Record<AppLocale, unknown> = {
  "zh-CN": zhCNMessages,
  en: enMessages,
};

export function isAppLocale(value: string): value is AppLocale {
  return (LOCALES as readonly string[]).includes(value);
}

export async function loadMessages(locale: AppLocale): Promise<unknown> {
  return MESSAGES[locale];
}

// Parse the Accept-Language header and return a supported locale.
// Only zh-CN and en are supported; all Chinese variants (zh-TW/zh-HK/...)
// are folded into zh-CN.
export function pickLocaleFromAcceptLanguage(header: string | null): AppLocale | undefined {
  if (!header) return undefined;
  const candidates = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1] ?? "1") : 1;
      return { tag: (tag ?? "").trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((candidate) => candidate.tag !== "" && candidate.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const candidate of candidates) {
    if (candidate.tag.startsWith("zh")) return "zh-CN";
    if (candidate.tag.startsWith("en")) return "en";
  }
  return undefined;
}

// UI locales use the BCP-47 hyphen form ("zh-CN"), while the Prisma enums
// UserLocale / TemplateLocale use the underscore form ("zh_CN").
// Always convert at the persistence boundary; never assume the two spellings
// are interchangeable.
const DB_LOCALE_BY_APP_LOCALE = {
  "zh-CN": "zh_CN",
  en: "en",
} as const satisfies Record<AppLocale, string>;

const APP_LOCALE_BY_DB_LOCALE: Record<string, AppLocale> = {
  zh_CN: "zh-CN",
  en: "en",
};

export type DbLocale = "zh_CN" | "en";

export function toDbLocale(locale: AppLocale): DbLocale {
  return DB_LOCALE_BY_APP_LOCALE[locale] as DbLocale;
}

export function toAppLocale(dbLocale: string): AppLocale {
  return APP_LOCALE_BY_DB_LOCALE[dbLocale] ?? DEFAULT_LOCALE;
}
