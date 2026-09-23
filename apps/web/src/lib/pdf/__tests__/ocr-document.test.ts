import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { ocrPdfToDocument } from "@/lib/pdf/ocr-document";

describe("ocrPdfToDocument", () => {
  it("returns empty when PDF has no extractable text", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]);
    const bytes = Buffer.from(await pdf.save());
    // Skip tesseract network fetch in unit tests
    process.env.OCR_SKIP_TESSERACT = "1";
    const result = await ocrPdfToDocument(bytes, "Blank");
    expect(result.source).toBe("empty");
    expect(result.lineCount).toBe(0);
  }, 15_000);
});
