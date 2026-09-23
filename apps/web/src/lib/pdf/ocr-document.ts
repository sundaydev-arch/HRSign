/**
 * Best-effort PDF → TipTap JSON (2B).
 * 1) pdf.js text layer extraction
 * 2) optional tesseract.js OCR when little text found
 */

import { createRequire } from "node:module";
import { emptyDocumentContent, type DocumentContent } from "@/schemas/document-content";

const require = createRequire(import.meta.url);

export type OcrResult = {
  content: DocumentContent;
  source: "text-layer" | "ocr" | "empty";
  lineCount: number;
};

async function extractTextLayer(pdfBytes: Buffer): Promise<string[]> {
  // Use pdfjs legacy build in Node
  const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs") as typeof import("pdfjs-dist");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const text = await page.getTextContent();
    let buf = "";
    for (const item of text.items) {
      if ("str" in item && item.str) {
        buf += item.str;
        if ("hasEOL" in item && item.hasEOL) {
          lines.push(buf.trim());
          buf = "";
        }
      }
    }
    if (buf.trim()) lines.push(buf.trim());
  }
  return lines.filter(Boolean);
}

async function ocrPdfPages(pdfBytes: Buffer, maxPages = 3): Promise<string[]> {
  if (process.env.OCR_SKIP_TESSERACT === "1") return [];
  try {
    // Node has no canvas rasterization — avoid downloading tessdata in unit/CI.
    // Keep the hook for environments that polyfill canvas later.
    void pdfBytes;
    void maxPages;
    return [];
  } catch {
    return [];
  }
}

function linesToDoc(title: string, lines: string[]): DocumentContent {
  const content: DocumentContent["content"] = [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: title }],
    },
  ];
  for (const line of lines) {
    content!.push({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    });
  }
  if (lines.length === 0) {
    content!.push({ type: "paragraph", content: [] });
  }
  return { type: "doc", content };
}

/** Convert PDF bytes to TipTap JSON (best-effort). */
export async function ocrPdfToDocument(
  pdfBytes: Buffer,
  title = "Imported document",
): Promise<OcrResult> {
  let lines: string[] = [];
  let source: OcrResult["source"] = "empty";
  try {
    lines = await extractTextLayer(pdfBytes);
    if (lines.join("").trim().length >= 40) {
      source = "text-layer";
    } else {
      const ocrLines = await ocrPdfPages(pdfBytes);
      if (ocrLines.length > 0) {
        lines = ocrLines;
        source = "ocr";
      } else if (lines.length > 0) {
        source = "text-layer";
      }
    }
  } catch {
    lines = [];
    source = "empty";
  }

  if (lines.length === 0) {
    return { content: emptyDocumentContent(title), source: "empty", lineCount: 0 };
  }
  return { content: linesToDoc(title, lines), source, lineCount: lines.length };
}
