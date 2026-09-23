/**
 * Conditional tabs — DocuSign-style show-if rules.
 * Rule shape stored on EnvelopeTab.conditional:
 *   { showIf: { tabId: string, equals?: string, notEmpty?: boolean } }
 */
export type ConditionalRule = {
  showIf?: {
    tabId: string;
    equals?: string;
    notEmpty?: boolean;
  };
};

export function isTabVisible(
  tab: { id: string; conditional?: unknown; value?: string | null },
  allTabs: Array<{ id: string; value?: string | null; conditional?: unknown }>,
): boolean {
  const rule = (tab.conditional ?? null) as ConditionalRule | null;
  if (!rule?.showIf?.tabId) return true;
  const dep = allTabs.find((t) => t.id === rule.showIf!.tabId);
  const val = (dep?.value ?? "").toString();
  if (rule.showIf.notEmpty) return val.trim().length > 0;
  if (rule.showIf.equals !== undefined) return val === rule.showIf.equals;
  return true;
}

export function filterVisibleTabs<T extends { id: string; conditional?: unknown; value?: string | null }>(
  tabs: T[],
): T[] {
  return tabs.filter((t) => isTabVisible(t, tabs));
}
