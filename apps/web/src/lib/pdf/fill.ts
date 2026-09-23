import fontkit from "@pdf-lib/fontkit";
import type { FieldType } from "@prisma/client";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { loadChineseFont } from "./font";

/** Field types that participate in text fill (spec 3.1: there is no TEXTAREA field type). */
export const FILLABLE_TYPES: FieldType[] = ["TEXT", "DATE"];

export interface FillField {
  id: string;
  type: FieldType;
  label: string;
  page: number; // 1-based
  /**
   * Editor coordinates: origin at the top-left corner of the page, in PDF
   * points; converted to a bottom-left origin when writing into the PDF.
   */
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  placeholder?: string | null;
}

export interface FillInput {
  templateBytes: Buffer;
  fields: FillField[];
  values: Record<string, string>;
}

const TEXT_COLOR = rgb(0.13, 0.15, 0.19);

/** Convert top-left-origin coordinates to pdf-lib's bottom-left origin. */
export function toPdfY(pageHeight: number, yTop: number, boxHeight: number): number {
  return pageHeight - yTop - boxHeight;
}

/**
 * PDF fill engine: writes form values back into the PDF at the template field
 * coordinates. Takes the raw template bytes and returns brand-new PDF bytes
 * without modifying the template source file.
 */
export async function fillTemplate(input: FillInput): Promise<Buffer> {
  const { templateBytes, fields, values } = input;
  const pdf = await PDFDocument.load(templateBytes);
  pdf.registerFontkit(fontkit);

  const fontBytes = await loadChineseFont();
  // Do not subset: fontkit corrupts characters when subsetting some CJK fonts.
  const font = await pdf.embedFont(fontBytes);

  const valueFields = fields.filter((f) => FILLABLE_TYPES.includes(f.type));
  for (const field of valueFields) {
    const pageIndex = field.page - 1;
    if (pageIndex < 0 || pageIndex >= pdf.getPageCount()) continue;
    const page = pdf.getPage(pageIndex);
    const text = formatValue(field, values[field.id]);
    if (!text) continue;

    const padding = 2;
    const boxX = field.x + padding;
    const maxWidth = Math.max(8, field.width - padding * 2);
    const boxPdfY = toPdfY(page.getHeight(), field.y, field.height);
    const firstLineY = boxPdfY + field.height - field.fontSize - padding;

    // spec 5: shrink the font size when a text field overflows (6pt minimum).
    const drawSize = shrinkToFit(text, font, field.fontSize, maxWidth);
    page.drawText(text, {
      x: boxX,
      y: firstLineY,
      size: drawSize,
      font,
      color: TEXT_COLOR,
    });
  }

  return Buffer.from(await pdf.save());
}

function formatValue(field: FillField, raw: string | undefined): string {
  if (raw == null || raw === "") return field.placeholder ?? "";
  if (field.type === "DATE") return formatDate(raw);
  return raw;
}

export function formatDate(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Progressively shrink the font size when the text exceeds the width; 6pt minimum. */
function shrinkToFit(text: string, font: PDFFont, size: number, maxWidth: number): number {
  let drawSize = size;
  while (font.widthOfTextAtSize(text, drawSize) > maxWidth && drawSize > 6) {
    drawSize -= 0.5;
  }
  return drawSize;
}

/** Wrap by display width, character by character (CJK has no spaces to split on). */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let current = "";
    for (const char of paragraph) {
      const next = current + char;
      if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(current);
        current = char === " " ? "" : char;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
