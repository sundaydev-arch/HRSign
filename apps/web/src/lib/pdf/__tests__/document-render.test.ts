import { describe, expect, it } from "vitest";
import { renderDocumentToPdf } from "@/lib/pdf/document-render";
import { emptyDocumentContent } from "@/schemas/document-content";

describe("renderDocumentToPdf", () => {
  it("renders TipTap JSON to A4 PDF with field boxes", async () => {
    const doc = emptyDocumentContent("Smoke Test");
    doc.content?.push({
      type: "paragraph",
      content: [
        { type: "text", text: "Hello " },
        {
          type: "templateField",
          attrs: { fieldId: "f1", type: "TEXT", label: "Name", required: true },
        },
        {
          type: "templateField",
          attrs: { fieldId: "f2", type: "SEAL", label: "Seal", required: true },
        },
      ],
    });

    const result = await renderDocumentToPdf(doc);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(result.pdfBytes.length).toBeGreaterThan(1000);
    expect(result.fields).toHaveLength(2);
    expect(result.fields[0]?.label).toBe("Name");
    expect(result.fields[1]?.type).toBe("SEAL");
    expect(result.fields[0]?.page).toBe(1);
  });
});
