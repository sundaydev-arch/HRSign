import { randomUUID } from "node:crypto";
import type { TemplateCategory } from "@prisma/client";
import type { DbLocale } from "@/i18n/config";
import { defaultFieldsForPreset } from "@/lib/template-presets";
import {
  emptyDocumentContent,
  type DocumentContent,
  type DocumentFieldAttrs,
} from "@/schemas/document-content";

/**
 * Build a TipTap starter doc for blank/preset templates (DOCUMENT editor mode).
 * Preset fields become inline templateField atoms rather than PDF overlay boxes.
 * Server-only (uses node:crypto) — do not import from client components.
 */
export function documentContentForCreate(
  name: string,
  options?: { category?: TemplateCategory; locale?: DbLocale; preset?: boolean },
): DocumentContent {
  if (!options?.preset || !options.category) {
    return emptyDocumentContent(name);
  }

  const locale = options.locale ?? "zh_CN";
  const fields = defaultFieldsForPreset(options.category, locale);
  const fieldNodes = fields.map((f) => ({
    type: "templateField" as const,
    attrs: {
      fieldId: randomUUID(),
      type: f.type as DocumentFieldAttrs["type"],
      label: f.label,
      required: f.required,
    },
  }));

  const intro =
    locale === "en"
      ? "Edit this document directly. Signing placeholders appear as chips — publish exports an A4 PDF."
      : "直接在此编辑文档内容。签署位显示为芯片；发布时导出为 A4 PDF。";

  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: name }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: intro }],
      },
      {
        type: "paragraph",
        content: fieldNodes.length > 0 ? fieldNodes : [],
      },
    ],
  };
}

export { countDocumentFields } from "@/lib/document-fields";
