import type { DocumentContent } from "@/schemas/document-content";

/** Count templateField nodes in a TipTap doc (for publish guards / UI). */
export function countDocumentFields(doc: DocumentContent): number {
  let n = 0;
  const walk = (nodes: unknown[] | undefined) => {
    if (!nodes) return;
    for (const raw of nodes) {
      if (!raw || typeof raw !== "object") continue;
      const node = raw as { type?: string; content?: unknown[] };
      if (node.type === "templateField") n += 1;
      walk(node.content);
    }
  };
  walk(doc.content as unknown[] | undefined);
  return n;
}
