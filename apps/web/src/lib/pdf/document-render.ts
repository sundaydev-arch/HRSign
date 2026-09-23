import fontkit from "@pdf-lib/fontkit";
import type { FieldType } from "@prisma/client";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { A4 } from "@/lib/blank-pdf";
import { CJK_EMBED_OPTIONS, loadChineseFont } from "@/lib/pdf/font";
import type { DocumentContent, DocumentFieldAttrs } from "@/schemas/document-content";

const MARGIN = 56;
const LINE_GAP = 4;
const TEXT_COLOR = rgb(0.12, 0.14, 0.18);
const PLACEHOLDER_COLOR = rgb(0.45, 0.48, 0.55);

export interface RenderedTemplateField {
  type: FieldType;
  label: string;
  required: boolean;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  sortOrder: number;
  /** Stable id from TipTap field node (becomes TemplateField.id when saved). */
  fieldId: string;
}

export interface DocumentRenderResult {
  pdfBytes: Buffer;
  pageCount: number;
  fields: RenderedTemplateField[];
}

type TipTapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: Array<{ type: string }>;
};

/**
 * Render a TipTap JSON document to a multi-page A4 PDF and collect field boxes
 * (top-left origin, PDF points) for TemplateField.coordinates.
 */
export async function renderDocumentToPdf(doc: DocumentContent): Promise<DocumentRenderResult> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await loadChineseFont();
  const font = await pdf.embedFont(fontBytes, CJK_EMBED_OPTIONS);

  let page = pdf.addPage([A4.width, A4.height]);
  let cursorY = A4.height - MARGIN;
  const maxWidth = A4.width - MARGIN * 2;
  const fields: RenderedTemplateField[] = [];
  let sortOrder = 0;

  const ensureSpace = (need: number) => {
    if (cursorY - need < MARGIN) {
      page = pdf.addPage([A4.width, A4.height]);
      cursorY = A4.height - MARGIN;
    }
  };

  const drawWrapped = (
    text: string,
    size: number,
    options?: { bold?: boolean; color?: ReturnType<typeof rgb> },
  ) => {
    const color = options?.color ?? TEXT_COLOR;
    const paragraphs = text.split("\n");
    for (const para of paragraphs) {
      const lines = wrapLines(para || " ", font, size, maxWidth);
      for (const line of lines) {
        ensureSpace(size + LINE_GAP);
        page.drawText(line, {
          x: MARGIN,
          y: cursorY - size,
          size,
          font,
          color,
        });
        cursorY -= size + LINE_GAP;
      }
    }
  };

  const walkBlock = (node: TipTapNode) => {
    if (!node.type) return;
    if (node.type === "heading") {
      const level = Number(node.attrs?.level ?? 1);
      const size = level === 1 ? 22 : level === 2 ? 16 : 14;
      ensureSpace(size + 12);
      cursorY -= 8;
      drawWrapped(plainText(node), size);
      cursorY -= 6;
      return;
    }
    if (node.type === "paragraph") {
      renderInlineLine(node, 12);
      cursorY -= 6;
      return;
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      const items = node.content ?? [];
      items.forEach((item, index) => {
        const prefix = node.type === "orderedList" ? `${index + 1}. ` : "• ";
        const text = prefix + plainText(item);
        drawWrapped(text, 12);
      });
      cursorY -= 4;
      return;
    }
    if (node.type === "blockquote") {
      for (const child of node.content ?? []) walkBlock(child);
      return;
    }
    if (node.type === "horizontalRule") {
      ensureSpace(16);
      page.drawLine({
        start: { x: MARGIN, y: cursorY },
        end: { x: A4.width - MARGIN, y: cursorY },
        thickness: 0.6,
        color: rgb(0.75, 0.76, 0.78),
      });
      cursorY -= 16;
      return;
    }
    if (node.type === "table") {
      const rows = node.content ?? [];
      const colCount = Math.max(
        1,
        ...rows.map((r) => (r.content ?? []).length),
      );
      const colW = maxWidth / colCount;
      const cellPad = 4;
      const fontSize = 10;
      for (const row of rows) {
        const cells = row.content ?? [];
        const texts = Array.from({ length: colCount }, (_, i) => plainText(cells[i] ?? {}));
        const lineHeights = texts.map((txt) => {
          const lines = wrapLines(txt || " ", font, fontSize, colW - cellPad * 2);
          return lines.length * (fontSize + 2) + cellPad * 2;
        });
        const rowH = Math.max(20, ...lineHeights);
        ensureSpace(rowH + 2);
        const top = cursorY;
        for (let i = 0; i < colCount; i++) {
          const x = MARGIN + i * colW;
          page.drawRectangle({
            x,
            y: top - rowH,
            width: colW,
            height: rowH,
            borderColor: rgb(0.78, 0.8, 0.82),
            borderWidth: 0.5,
          });
          const lines = wrapLines(texts[i] || " ", font, fontSize, colW - cellPad * 2);
          let ty = top - cellPad - fontSize;
          for (const line of lines) {
            page.drawText(line, {
              x: x + cellPad,
              y: ty,
              size: fontSize,
              font,
              color: TEXT_COLOR,
            });
            ty -= fontSize + 2;
          }
        }
        cursorY -= rowH;
      }
      cursorY -= 8;
    }
  };

  const renderInlineLine = (node: TipTapNode, size: number) => {
    // Mixed text + field chips on one "line" of blocks — lay out left-to-right with wrap.
    let x = MARGIN;
    const children = node.content ?? [];
    if (children.length === 0) {
      ensureSpace(size + LINE_GAP);
      cursorY -= size + LINE_GAP;
      return;
    }

    const flushNewLine = () => {
      cursorY -= size + LINE_GAP + 2;
      x = MARGIN;
      ensureSpace(size + LINE_GAP);
    };

    ensureSpace(size + LINE_GAP);

    for (const child of children) {
      if (child.type === "text" && child.text) {
        const words = splitForWrap(child.text);
        for (const word of words) {
          const w = font.widthOfTextAtSize(word, size);
          if (x + w > A4.width - MARGIN && x > MARGIN) flushNewLine();
          page.drawText(word, {
            x,
            y: cursorY - size,
            size,
            font,
            color: TEXT_COLOR,
          });
          x += w;
        }
        continue;
      }
      if (child.type === "templateField") {
        const attrs = child.attrs as DocumentFieldAttrs | undefined;
        if (!attrs?.fieldId || !attrs.label || !attrs.type) continue;
        const boxW =
          attrs.type === "SEAL" || attrs.type === "SIGNATURE"
            ? Math.min(120, maxWidth)
            : Math.min(160, Math.max(72, font.widthOfTextAtSize(attrs.label, size) + 24));
        const boxH = attrs.type === "SEAL" || attrs.type === "SIGNATURE" ? 56 : size + 10;
        if (x + boxW > A4.width - MARGIN && x > MARGIN) flushNewLine();
        ensureSpace(boxH + 4);
        const topY = A4.height - cursorY;
        // Field box: light underline / rect as placeholder
        const pdfY = cursorY - boxH;
        page.drawRectangle({
          x,
          y: pdfY,
          width: boxW,
          height: boxH,
          borderColor: rgb(0.7, 0.72, 0.76),
          borderWidth: 0.75,
          color: rgb(0.97, 0.97, 0.98),
        });
        page.drawText(attrs.label, {
          x: x + 6,
          y: pdfY + (boxH - size) / 2,
          size: Math.min(size, 11),
          font,
          color: PLACEHOLDER_COLOR,
        });
        fields.push({
          fieldId: attrs.fieldId,
          type: attrs.type,
          label: attrs.label,
          required: attrs.required !== false,
          page: pdf.getPageCount(),
          x,
          y: topY,
          width: boxW,
          height: boxH,
          fontSize: size,
          sortOrder: sortOrder++,
        });
        x += boxW + 8;
      }
      if (child.type === "hardBreak") flushNewLine();
    }
    cursorY -= size + LINE_GAP;
  };

  for (const block of (doc.content as TipTapNode[] | undefined) ?? []) {
    walkBlock(block);
  }

  if (pdf.getPageCount() === 0) {
    pdf.addPage([A4.width, A4.height]);
  }

  return {
    pdfBytes: Buffer.from(await pdf.save()),
    pageCount: pdf.getPageCount(),
    fields,
  };
}

function plainText(node: TipTapNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "templateField") {
    const label = (node.attrs as DocumentFieldAttrs | undefined)?.label;
    return label ? `【${label}】` : "";
  }
  return (node.content ?? []).map(plainText).join("");
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    const next = current + ch;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = ch;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function splitForWrap(text: string): string[] {
  // Keep CJK characters as individual wrap units; keep latin words together.
  const out: string[] = [];
  let buf = "";
  for (const ch of text) {
    if (/[\u4e00-\u9fff]/.test(ch)) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      out.push(ch);
    } else if (/\s/.test(ch)) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      out.push(ch);
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}
