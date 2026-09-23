import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { FieldType, TemplateCategory } from "@prisma/client";
import { A4 } from "@/lib/blank-pdf";
import { loadChineseFont, CJK_EMBED_OPTIONS } from "@/lib/pdf/font";
import type { Coordinates } from "@/schemas/coordinates";

export type PresetKind = TemplateCategory;

export interface PresetFieldDef {
  type: FieldType;
  label: string;
  required: boolean;
  coordinates: Coordinates;
  sortOrder: number;
  fontSize?: number;
}

const COMPANY = "Yunqi Information Technology (Shanghai) Co., Ltd.";
const MARGIN = 52;
const ink = rgb(0.12, 0.12, 0.14);
const muted = rgb(0.42, 0.4, 0.38);
const rule = rgb(0.78, 0.76, 0.72);

function pdfY(top: number, size = 11): number {
  return A4.height - top - size;
}

function line(page: PDFPage, yTop: number) {
  const y = pdfY(yTop, 0);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4.width - MARGIN, y },
    thickness: 0.6,
    color: rule,
  });
}

function text(
  page: PDFPage,
  font: PDFFont,
  content: string,
  top: number,
  opts?: { size?: number; color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number },
) {
  const size = opts?.size ?? 10.5;
  page.drawText(content, {
    x: opts?.x ?? MARGIN,
    y: pdfY(top, size),
    size,
    font,
    color: opts?.color ?? ink,
    maxWidth: opts?.maxWidth ?? A4.width - MARGIN * 2,
    lineHeight: size + 4,
  });
}

function header(page: PDFPage, font: PDFFont, bold: PDFFont, title: string, subtitle: string) {
  text(page, font, COMPANY, 46, { size: 10, color: muted });
  text(page, font, "88 Zhangjiang Rd, Pudong, Shanghai · Tel: +86 21-5888-0168", 62, {
    size: 8,
    color: muted,
  });
  line(page, 78);
  text(page, bold, title, 108, { size: 18 });
  text(page, font, subtitle, 132, { size: 9, color: muted });
}

function wrapLines(font: PDFFont, content: string, size: number, maxWidth: number): string[] {
  const words = content.split(/(\s+)/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur + w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && cur.trim()) {
      lines.push(cur.trimEnd());
      cur = w.trimStart();
    } else {
      cur = next;
    }
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines;
}

function paragraph(
  page: PDFPage,
  font: PDFFont,
  content: string,
  startTop: number,
  size = 10.5,
): number {
  const maxWidth = A4.width - MARGIN * 2;
  const lines = wrapLines(font, content, size, maxWidth);
  let top = startTop;
  for (const ln of lines) {
    text(page, font, ln, top, { size });
    top += size + 5;
  }
  return top + 6;
}

async function withFonts() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontBytes = await loadChineseFont();
  const font = await doc.embedFont(fontBytes, CJK_EMBED_OPTIONS);
  return { doc, font, bold: font };
}

async function buildContractPdf(): Promise<Buffer> {
  const { doc, font, bold } = await withFonts();
  const page1 = doc.addPage([A4.width, A4.height]);
  header(page1, font, bold, "Employment Contract", "Ref: HR-LC-2026-0418 · Prepared by Human Resources");

  let y = 160;
  text(page1, bold, "1. Parties", y, { size: 12 });
  y += 26;
  text(page1, font, "Employer (Party A): " + COMPANY, y);
  y += 20;
  text(page1, font, "Legal representative: Wang Mingyuan    USCC: 91310115MA1K8F2R3X", y, { size: 10 });
  y += 22;
  text(page1, font, "Employee (Party B): ____________________    ID / Passport: ____________________", y);
  y += 22;
  text(page1, font, "Phone: ____________________    Address: ____________________", y);
  y += 28;

  text(page1, bold, "2. Term and position", y, { size: 12 });
  y += 24;
  y = paragraph(
    page1,
    font,
    "This is a fixed-term employment contract from __________ to __________, including a probation of ____ months. Party B will serve as ____________________. Primary workplace: Pudong, Shanghai (subject to mutual change).",
    y,
  );

  text(page1, bold, "3. Working hours and pay", y, { size: 12 });
  y += 24;
  y = paragraph(
    page1,
    font,
    "Standard hours apply (8 hours/day, 40 hours/week). Monthly salary: RMB ________ during probation and RMB ________ after confirmation, paid by the 15th of each month. Overtime, leave, and social insurance follow applicable law.",
    y,
  );

  text(page1, bold, "4. Policies and confidentiality", y, { size: 12 });
  y += 24;
  y = paragraph(
    page1,
    font,
    "Party A provides lawful working conditions and safety training. Party B must follow company policies, protect confidential information, and avoid conflicts of interest.",
    y,
  );

  const page2 = doc.addPage([A4.width, A4.height]);
  header(page2, font, bold, "Employment Contract (cont.)", "Signature page");
  y = 160;
  text(page2, bold, "5. Termination", y, { size: 12 });
  y += 24;
  y = paragraph(
    page2,
    font,
    "Either party may terminate by mutual written agreement. Party B may resign with 30 days' written notice (3 days during probation). Statutory severance, if any, follows the Labor Contract Law.",
    y,
  );

  text(page2, bold, "6. Disputes", y, { size: 12 });
  y += 24;
  y = paragraph(
    page2,
    font,
    "Disputes shall first be negotiated; failing that, submitted to labor arbitration and, if needed, to a competent people's court.",
    y,
  );

  text(page2, bold, "7. Miscellaneous", y, { size: 12 });
  y += 24;
  y = paragraph(
    page2,
    font,
    "This contract is executed in two originals, one for each party, and takes effect upon signature and company seal. Uncovered matters follow applicable law and written addenda.",
    y,
  );

  y += 20;
  text(page2, bold, "Signatures", y, { size: 12 });
  y += 36;
  text(page2, font, "Party A (seal):", y);
  text(page2, font, "Party B (signature):", y, { x: A4.width / 2 + 8 });
  y += 110;
  text(page2, font, "Date: ____ / ____ / ________", y);
  text(page2, font, "Date: ____ / ____ / ________", y, { x: A4.width / 2 + 8 });

  return Buffer.from(await doc.save());
}

async function buildOfferPdf(): Promise<Buffer> {
  const { doc, font, bold } = await withFonts();
  const page = doc.addPage([A4.width, A4.height]);
  header(page, font, bold, "Offer Letter", "Issued by Human Resources");

  let y = 160;
  y = paragraph(page, font, "Dear ____________________,", y, 11);
  y = paragraph(
    page,
    font,
    `Thank you for interviewing with ${COMPANY}. We are pleased to offer you the following position subject to the terms below.`,
    y,
  );

  text(page, bold, "1. Role", y, { size: 12 });
  y += 24;
  text(page, font, "Position: ____________________", y);
  y += 22;
  text(page, font, "Department: ____________________    Reports to: ____________________", y);
  y += 22;
  text(page, font, "Start date: ____ / ____ / ________    Location: Pudong, Shanghai", y);
  y += 28;

  text(page, bold, "2. Compensation (pre-tax)", y, { size: 12 });
  y += 24;
  text(page, font, "Monthly base salary: RMB ________", y);
  y += 22;
  text(page, font, "Probation: ____ months at 80% of base pay (not below local minimum wage).", y);
  y += 22;
  y = paragraph(
    page,
    font,
    "Statutory benefits, supplemental insurance, paid leave, meal allowance, and annual checkup apply per the employment contract and employee handbook.",
    y,
  );

  text(page, bold, "3. Acceptance", y, { size: 12 });
  y += 24;
  y = paragraph(
    page,
    font,
    "Please sign and return within five business days. This letter is not the employment contract; the employment relationship begins only after both parties sign the formal contract.",
    y,
  );

  y += 16;
  text(page, font, "HR Department (seal)", y);
  text(page, font, "Candidate signature", y, { x: A4.width / 2 + 8 });
  y += 100;
  text(page, font, "Date: ____ / ____ / ________", y);
  text(page, font, "Date: ____ / ____ / ________", y, { x: A4.width / 2 + 8 });

  return Buffer.from(await doc.save());
}

async function buildEntryPdf(): Promise<Buffer> {
  const { doc, font, bold } = await withFonts();
  const page = doc.addPage([A4.width, A4.height]);
  header(page, font, bold, "Onboarding Form", "Employee profile for HR records");

  let y = 158;
  text(page, bold, "1. Personal information", y, { size: 12 });
  y += 26;
  text(page, font, "Full name: ____________________    Gender: ____    DOB: ____________", y);
  y += 22;
  text(page, font, "ID / Passport: ____________________    Mobile: ____________________", y);
  y += 22;
  text(page, font, "Email: ____________________    Emergency contact: ____________________", y);
  y += 22;
  text(page, font, "Current address: ________________________________________________", y);
  y += 28;

  text(page, bold, "2. Employment details", y, { size: 12 });
  y += 26;
  text(page, font, "Employee ID: ____________________    Department: ____________________", y);
  y += 22;
  text(page, font, "Position: ____________________    Start date: ____ / ____ / ________", y);
  y += 22;
  text(page, font, "Manager: ____________________    Office: ____________________", y);
  y += 28;

  text(page, bold, "3. Declaration", y, { size: 12 });
  y += 24;
  y = paragraph(
    page,
    font,
    "I confirm the information above is true and complete, and I agree to follow the employee handbook, information security, and confidentiality policies.",
    y,
  );

  y += 20;
  text(page, font, "HR specialist (seal / sign)", y);
  text(page, font, "Employee signature", y, { x: A4.width / 2 + 8 });
  y += 100;
  text(page, font, "Date: ____ / ____ / ________", y);
  text(page, font, "Date: ____ / ____ / ________", y, { x: A4.width / 2 + 8 });

  return Buffer.from(await doc.save());
}

async function buildResignPdf(): Promise<Buffer> {
  const { doc, font, bold } = await withFonts();
  const page = doc.addPage([A4.width, A4.height]);
  header(page, font, bold, "Resignation Certificate", "Valid with company seal");

  let y = 160;
  y = paragraph(
    page,
    font,
    `This certifies that ____________________ (ID: ____________________) was employed by ${COMPANY} in the ____________________ department as ____________________.`,
    y,
    11,
  );
  y = paragraph(
    page,
    font,
    "Employment ended on ____ / ____ / ________ after completion of exit procedures. Any confidentiality or non-compete obligations continue per written agreements.",
    y,
  );
  y = paragraph(
    page,
    font,
    "This certificate is issued for employment, visa, or related purposes. Copies or alterations are void.",
    y,
  );

  y += 24;
  text(page, font, "Reason (optional): ____________________", y);
  y += 40;
  text(page, font, COMPANY, y);
  y += 22;
  text(page, font, "(Company seal)", y);
  y += 90;
  text(page, font, "Issue date: ____ / ____ / ________", y);

  return Buffer.from(await doc.save());
}

async function buildCertificatePdf(): Promise<Buffer> {
  const { doc, font, bold } = await withFonts();
  const page = doc.addPage([A4.width, A4.height]);
  header(page, font, bold, "Employment Certificate", "Proof of current employment");

  let y = 160;
  y = paragraph(
    page,
    font,
    `This certifies that ____________________ (ID: ____________________) has been employed by our company since ____ / ____ / ________ in the ____________________ department as ____________________, and remains employed.`,
    y,
    11,
  );
  y = paragraph(
    page,
    font,
    "This letter is issued at the employee's request for visa, loan, school enrollment, or similar purposes and is not a guarantee of income or a legal commitment.",
    y,
  );
  y = paragraph(page, font, "Verification: hr@yunqi-tech.cn / +86 21-5888-0168.", y);

  y += 36;
  text(page, font, COMPANY, y);
  y += 22;
  text(page, font, "Human Resources (company seal)", y);
  y += 100;
  text(page, font, "Issue date: ____ / ____ / ________", y);

  return Buffer.from(await doc.save());
}

const BUILDERS: Record<PresetKind, () => Promise<Buffer>> = {
  CONTRACT: buildContractPdf,
  OFFER: buildOfferPdf,
  ENTRY: buildEntryPdf,
  RESIGN: buildResignPdf,
  CERTIFICATE: buildCertificatePdf,
};

export async function createEnglishPresetPdf(kind: PresetKind): Promise<Buffer> {
  return BUILDERS[kind]();
}

export function defaultEnglishFieldsForPreset(kind: PresetKind): PresetFieldDef[] {
  const sealSig = (page: number, sealLabel: string, sigLabel: string): PresetFieldDef[] => [
    {
      type: "SEAL" as FieldType,
      label: sealLabel,
      required: true,
      coordinates: { page, x: MARGIN, y: page === 2 ? 620 : 640, width: 110, height: 110, rotation: 0 },
      sortOrder: 90,
    },
    {
      type: "SIGNATURE" as FieldType,
      label: sigLabel,
      required: true,
      coordinates: {
        page,
        x: A4.width / 2 + 8,
        y: page === 2 ? 640 : 660,
        width: 150,
        height: 64,
        rotation: 0,
      },
      sortOrder: 91,
    },
  ];

  const byKind: Record<PresetKind, PresetFieldDef[]> = {
    CONTRACT: [
      {
        type: "TEXT",
        label: "Employee name",
        required: true,
        coordinates: { page: 1, x: 140, y: 206, width: 120, height: 22, rotation: 0 },
        sortOrder: 1,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "ID / Passport",
        required: true,
        coordinates: { page: 1, x: 360, y: 206, width: 160, height: 22, rotation: 0 },
        sortOrder: 2,
        fontSize: 11,
      },
      {
        type: "DATE",
        label: "Contract start",
        required: true,
        coordinates: { page: 1, x: 200, y: 278, width: 120, height: 22, rotation: 0 },
        sortOrder: 3,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "Position",
        required: true,
        coordinates: { page: 1, x: 200, y: 318, width: 160, height: 22, rotation: 0 },
        sortOrder: 4,
        fontSize: 11,
      },
      ...sealSig(2, "Company seal", "Employee signature"),
    ],
    OFFER: [
      {
        type: "TEXT",
        label: "Candidate name",
        required: true,
        coordinates: { page: 1, x: 120, y: 160, width: 140, height: 22, rotation: 0 },
        sortOrder: 1,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "Position",
        required: true,
        coordinates: { page: 1, x: 120, y: 268, width: 180, height: 22, rotation: 0 },
        sortOrder: 2,
        fontSize: 11,
      },
      {
        type: "DATE",
        label: "Start date",
        required: true,
        coordinates: { page: 1, x: 140, y: 312, width: 120, height: 22, rotation: 0 },
        sortOrder: 3,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "Monthly salary (RMB)",
        required: true,
        coordinates: { page: 1, x: 160, y: 378, width: 100, height: 22, rotation: 0 },
        sortOrder: 4,
        fontSize: 11,
      },
      ...sealSig(1, "HR seal", "Candidate signature"),
    ],
    ENTRY: [
      {
        type: "TEXT",
        label: "Full name",
        required: true,
        coordinates: { page: 1, x: 90, y: 184, width: 100, height: 22, rotation: 0 },
        sortOrder: 1,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "ID / Passport",
        required: true,
        coordinates: { page: 1, x: 120, y: 206, width: 180, height: 22, rotation: 0 },
        sortOrder: 2,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "Department",
        required: true,
        coordinates: { page: 1, x: 200, y: 278, width: 120, height: 22, rotation: 0 },
        sortOrder: 3,
        fontSize: 11,
      },
      {
        type: "DATE",
        label: "Start date",
        required: true,
        coordinates: { page: 1, x: 280, y: 300, width: 120, height: 22, rotation: 0 },
        sortOrder: 4,
        fontSize: 11,
      },
      ...sealSig(1, "HR seal", "Employee signature"),
    ],
    RESIGN: [
      {
        type: "TEXT",
        label: "Employee name",
        required: true,
        coordinates: { page: 1, x: 100, y: 160, width: 120, height: 22, rotation: 0 },
        sortOrder: 1,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "ID / Passport",
        required: true,
        coordinates: { page: 1, x: 280, y: 160, width: 160, height: 22, rotation: 0 },
        sortOrder: 2,
        fontSize: 11,
      },
      {
        type: "DATE",
        label: "Last day",
        required: true,
        coordinates: { page: 1, x: 140, y: 210, width: 120, height: 22, rotation: 0 },
        sortOrder: 3,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "Reason",
        required: false,
        coordinates: { page: 1, x: 140, y: 320, width: 200, height: 22, rotation: 0 },
        sortOrder: 4,
        fontSize: 11,
      },
      {
        type: "SEAL",
        label: "Company seal",
        required: true,
        coordinates: { page: 1, x: MARGIN, y: 420, width: 120, height: 120, rotation: 0 },
        sortOrder: 90,
      },
      {
        type: "DATE",
        label: "Issue date",
        required: true,
        coordinates: { page: 1, x: 120, y: 560, width: 120, height: 22, rotation: 0 },
        sortOrder: 91,
        fontSize: 11,
      },
    ],
    CERTIFICATE: [
      {
        type: "TEXT",
        label: "Employee name",
        required: true,
        coordinates: { page: 1, x: 100, y: 160, width: 120, height: 22, rotation: 0 },
        sortOrder: 1,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "ID / Passport",
        required: true,
        coordinates: { page: 1, x: 280, y: 160, width: 160, height: 22, rotation: 0 },
        sortOrder: 2,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "Department",
        required: true,
        coordinates: { page: 1, x: 200, y: 188, width: 120, height: 22, rotation: 0 },
        sortOrder: 3,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "Title",
        required: true,
        coordinates: { page: 1, x: 360, y: 188, width: 120, height: 22, rotation: 0 },
        sortOrder: 4,
        fontSize: 11,
      },
      {
        type: "DATE",
        label: "Start date",
        required: true,
        coordinates: { page: 1, x: 140, y: 172, width: 120, height: 22, rotation: 0 },
        sortOrder: 5,
        fontSize: 11,
      },
      {
        type: "SEAL",
        label: "Company seal",
        required: true,
        coordinates: { page: 1, x: MARGIN, y: 420, width: 120, height: 120, rotation: 0 },
        sortOrder: 90,
      },
      {
        type: "DATE",
        label: "Issue date",
        required: true,
        coordinates: { page: 1, x: 120, y: 560, width: 120, height: 22, rotation: 0 },
        sortOrder: 91,
        fontSize: 11,
      },
    ],
  };

  return byKind[kind].map((f, i) => ({ ...f, sortOrder: f.sortOrder || i + 1 }));
}

export const EN_PRESET_NAMES: Record<TemplateCategory, string> = {
  CONTRACT: "2026 Standard Employment Contract",
  OFFER: "Offer Letter",
  ENTRY: "Onboarding Form",
  RESIGN: "Resignation Certificate",
  CERTIFICATE: "Employment Certificate",
};
