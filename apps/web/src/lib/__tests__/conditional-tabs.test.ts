import { describe, expect, it } from "vitest";
import { filterVisibleTabs, isTabVisible } from "@/lib/conditional-tabs";

describe("conditional tabs", () => {
  const tabs = [
    { id: "a", value: "yes", conditional: null },
    { id: "b", value: null, conditional: { showIf: { tabId: "a", equals: "yes" } } },
    { id: "c", value: null, conditional: { showIf: { tabId: "a", equals: "no" } } },
    { id: "d", value: null, conditional: { showIf: { tabId: "a", notEmpty: true } } },
  ];

  it("shows tab when equals matches", () => {
    expect(isTabVisible(tabs[1]!, tabs)).toBe(true);
    expect(isTabVisible(tabs[2]!, tabs)).toBe(false);
  });

  it("filters visible set", () => {
    const visible = filterVisibleTabs(tabs).map((t) => t.id);
    expect(visible).toEqual(["a", "b", "d"]);
  });
});
