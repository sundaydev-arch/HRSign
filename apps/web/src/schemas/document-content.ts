import { z } from "zod";

/** TipTap field atom attrs (inline signing placeholder). */
export const DocumentFieldAttrsSchema = z.object({
  fieldId: z.string().min(1),
  type: z.enum(["TEXT", "DATE", "SEAL", "SIGNATURE"]),
  label: z.string().min(1),
  required: z.boolean().default(true),
});

export type DocumentFieldAttrs = z.infer<typeof DocumentFieldAttrsSchema>;

/**
 * TipTap JSON document (loose structure + field nodes).
 * We validate presence of a doc root; deep ProseMirror schema is enforced in the editor.
 */
export const DocumentContentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.record(z.unknown())).optional(),
});

export type DocumentContent = z.infer<typeof DocumentContentSchema>;

export function emptyDocumentContent(title?: string): DocumentContent {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: title ? [{ type: "text", text: title }] : [],
      },
      {
        type: "paragraph",
        content: [],
      },
    ],
  };
}
