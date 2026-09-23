import { describe, expect, it } from "vitest";
import { isAppLocale, pickLocaleFromAcceptLanguage } from "../config";

describe("pickLocaleFromAcceptLanguage", () => {
  it("matches zh-CN exactly", () => {
    expect(pickLocaleFromAcceptLanguage("zh-CN,zh;q=0.9")).toBe("zh-CN");
  });

  it("orders by q value and returns en when English has higher priority", () => {
    expect(pickLocaleFromAcceptLanguage("en;q=0.9,zh;q=0.8")).toBe("en");
  });

  it("normalizes Chinese variants to zh-CN", () => {
    expect(pickLocaleFromAcceptLanguage("zh-TW")).toBe("zh-CN");
  });

  it("returns undefined when no language matches", () => {
    expect(pickLocaleFromAcceptLanguage("de-DE,fr;q=0.8")).toBeUndefined();
  });

  it("ignores languages with q=0", () => {
    expect(pickLocaleFromAcceptLanguage("en;q=0")).toBeUndefined();
  });

  it("returns undefined for an empty header", () => {
    expect(pickLocaleFromAcceptLanguage(null)).toBeUndefined();
  });
});

describe("isAppLocale", () => {
  it("recognizes supported locales", () => {
    expect(isAppLocale("zh-CN")).toBe(true);
    expect(isAppLocale("en")).toBe(true);
    expect(isAppLocale("fr")).toBe(false);
  });
});
