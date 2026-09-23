import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { FieldType, TemplateCategory } from "@prisma/client";
import { A4 } from "@/lib/blank-pdf";
import { loadChineseFont, CJK_EMBED_OPTIONS } from "@/lib/pdf/font";
import type { Coordinates } from "@/schemas/coordinates";

import type { DbLocale } from "@/i18n/config";
import {
  createEnglishPresetPdf,
  defaultEnglishFieldsForPreset,
  EN_PRESET_NAMES,
} from "@/lib/template-presets-en";

export type PresetKind = TemplateCategory;


export interface PresetFieldDef {
  type: FieldType;
  label: string;
  required: boolean;
  coordinates: Coordinates;
  sortOrder: number;
  fontSize?: number;
}

const COMPANY = "示例科技（上海）有限公司";
const MARGIN = 52;
const ink = rgb(0.12, 0.12, 0.14);
const muted = rgb(0.42, 0.4, 0.38);
const rule = rgb(0.78, 0.76, 0.72);

/** Editor / fill use top-left origin; pdf-lib uses bottom-left. */
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
  text(page, font, "地址：上海市浦东新区世纪大道 1 号 · 电话：021-5888-0000", 62, {
    size: 8,
    color: muted,
  });
  line(page, 78);
  text(page, bold, title, 108, { size: 18 });
  text(page, font, subtitle, 132, { size: 9, color: muted });
}

function wrapLines(font: PDFFont, content: string, size: number, maxWidth: number): string[] {
  const chars = [...content];
  const lines: string[] = [];
  let cur = "";
  for (const ch of chars) {
    const next = cur + ch;
    if (font.widthOfTextAtSize(next, size) > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
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
  header(page1, font, bold, "劳动合同", "编号：HR-LC-2026-DEMO · 示范文本（仅供系统演示）");

  let y = 160;
  text(page1, bold, "第一条  合同双方", y, { size: 12 });
  y += 26;
  text(page1, font, "甲方（用人单位）：" + COMPANY, y);
  y += 20;
  text(page1, font, "法定代表人：王明远　　统一社会信用代码：91310000MA1KDEMO9X", y, { size: 10 });
  y += 22;
  text(page1, font, "乙方（劳动者）：____________________　　身份证号：____________________", y);
  y += 22;
  text(page1, font, "联系电话：____________________　　户籍地址：____________________", y);
  y += 28;

  text(page1, bold, "第二条  合同期限与岗位", y, { size: 12 });
  y += 24;
  y = paragraph(
    page1,
    font,
    "本合同为固定期限劳动合同。合同期限自____年____月____日起至____年____月____日止，其中试用期____个月。乙方从事____________________岗位，工作地点为上海市浦东新区，也可根据经营需要协商变更。",
    y,
  );

  text(page1, bold, "第三条  工作时间与报酬", y, { size: 12 });
  y += 24;
  y = paragraph(
    page1,
    font,
    "乙方实行标准工时制，每日工作八小时、每周四十小时。甲方按月支付工资，试用期月薪人民币________元，转正后月薪人民币________元，于每月十五日前发放。加班、休假、社会保险与公积金按国家及本市规定执行。",
    y,
  );

  text(page1, bold, "第四条  劳动保护与规章制度", y, { size: 12 });
  y += 24;
  y = paragraph(
    page1,
    font,
    "甲方依法为乙方提供劳动安全卫生条件，并对乙方进行安全生产教育。乙方应遵守甲方依法制定的规章制度，保守商业秘密，不得从事与甲方利益相冲突的活动。",
    y,
  );

  const page2 = doc.addPage([A4.width, A4.height]);
  header(page2, font, bold, "劳动合同（续）", "签署页");
  y = 160;
  text(page2, bold, "第五条  合同解除与终止", y, { size: 12 });
  y += 24;
  y = paragraph(
    page2,
    font,
    "双方协商一致可解除本合同。乙方提前三十日以书面形式通知甲方，可以解除劳动合同；试用期内提前三日通知即可。甲方解除或终止劳动合同，依法支付经济补偿的，按《劳动合同法》执行。",
    y,
  );

  text(page2, bold, "第六条  争议解决", y, { size: 12 });
  y += 24;
  y = paragraph(
    page2,
    font,
    "因履行本合同发生争议，双方应协商解决；协商不成的，可向有管辖权的劳动争议仲裁委员会申请仲裁；对仲裁裁决不服的，可依法向人民法院提起诉讼。",
    y,
  );

  text(page2, bold, "第七条  其他", y, { size: 12 });
  y += 24;
  y = paragraph(
    page2,
    font,
    "本合同一式两份，甲乙双方各执一份，自双方签字（盖章）之日起生效。未尽事宜，按国家法律法规及双方书面补充协议执行。",
    y,
  );

  y += 20;
  text(page2, bold, "签署栏", y, { size: 12 });
  y += 36;
  text(page2, font, "甲方（盖章）：", y);
  text(page2, font, "乙方（签字）：", y, { x: A4.width / 2 + 8 });
  y += 110;
  text(page2, font, "签署日期：____年____月____日", y);
  text(page2, font, "签署日期：____年____月____日", y, { x: A4.width / 2 + 8 });

  return Buffer.from(await doc.save());
}

async function buildOfferPdf(): Promise<Buffer> {
  const { doc, font, bold } = await withFonts();
  const page = doc.addPage([A4.width, A4.height]);
  header(page, font, bold, "录用通知书", "Offer Letter · 人力资源部签发");

  let y = 160;
  y = paragraph(page, font, "尊敬的 ____________________ ：", y, 11);
  y = paragraph(
    page,
    font,
    `感谢您应聘${COMPANY}。经面试评估，我们荣幸地通知您：公司决定录用您担任下列职位，具体条件如下。`,
    y,
  );

  text(page, bold, "一、职位信息", y, { size: 12 });
  y += 24;
  text(page, font, "录用岗位：____________________", y);
  y += 22;
  text(page, font, "所属部门：____________________　　汇报对象：____________________", y);
  y += 22;
  text(page, font, "拟定入职日期：____年____月____日　　工作地点：上海市浦东新区", y);
  y += 28;

  text(page, bold, "二、薪酬与福利（税前）", y, { size: 12 });
  y += 24;
  text(page, font, "月基本工资：人民币 ________ 元", y);
  y += 22;
  text(page, font, "试用期：____ 个月；试用期工资按转正工资的 80% 计发（不低于当地最低标准）。", y);
  y += 22;
  y = paragraph(
    page,
    font,
    "公司依法缴纳五险一金，并提供补充商业保险、带薪年假、餐补及年度体检等福利，细则以入职后劳动合同及员工手册为准。",
    y,
  );

  text(page, bold, "三、接受与回执", y, { size: 12 });
  y += 24;
  y = paragraph(
    page,
    font,
    "请您于收到本通知后五个工作日内签字确认并回传。逾期未回复，本公司有权视为放弃。正式劳动关系以双方签署的劳动合同为准；本通知不构成劳动合同本身。",
    y,
  );

  y += 16;
  text(page, font, "人力资源部（盖章）", y);
  text(page, font, "候选人签字确认", y, { x: A4.width / 2 + 8 });
  y += 100;
  text(page, font, "日期：____年____月____日", y);
  text(page, font, "日期：____年____月____日", y, { x: A4.width / 2 + 8 });

  return Buffer.from(await doc.save());
}

async function buildEntryPdf(): Promise<Buffer> {
  const { doc, font, bold } = await withFonts();
  const page = doc.addPage([A4.width, A4.height]);
  header(page, font, bold, "入职登记表", "员工信息采集 · 仅供人事建档");

  let y = 158;
  text(page, bold, "一、基本信息", y, { size: 12 });
  y += 26;
  text(page, font, "姓名：____________________　　性别：____　　出生日期：____________", y);
  y += 22;
  text(page, font, "身份证号：____________________　　手机：____________________", y);
  y += 22;
  text(page, font, "电子邮箱：____________________　　紧急联系人/电话：____________________", y);
  y += 22;
  text(page, font, "现居住地址：________________________________________________", y);
  y += 28;

  text(page, bold, "二、入职信息", y, { size: 12 });
  y += 26;
  text(page, font, "工号：____________________　　部门：____________________", y);
  y += 22;
  text(page, font, "岗位：____________________　　入职日期：____年____月____日", y);
  y += 22;
  text(page, font, "直属上级：____________________　　办公地点：____________________", y);
  y += 28;

  text(page, bold, "三、声明与确认", y, { size: 12 });
  y += 24;
  y = paragraph(
    page,
    font,
    "本人确认以上信息真实、准确、完整，已知悉并同意遵守公司员工手册、信息安全与保密制度。如有虚假，愿承担相应责任。",
    y,
  );

  y += 20;
  text(page, font, "人事专员（盖章/签字）", y);
  text(page, font, "员工本人签字", y, { x: A4.width / 2 + 8 });
  y += 100;
  text(page, font, "日期：____年____月____日", y);
  text(page, font, "日期：____年____月____日", y, { x: A4.width / 2 + 8 });

  return Buffer.from(await doc.save());
}

async function buildResignPdf(): Promise<Buffer> {
  const { doc, font, bold } = await withFonts();
  const page = doc.addPage([A4.width, A4.height]);
  header(page, font, bold, "离职证明", "证明文件 · 加盖公章有效");

  let y = 160;
  y = paragraph(
    page,
    font,
    `兹证明 ____________________（身份证号：____________________）原系${COMPANY}员工，任职于____________________部门____________________岗位。`,
    y,
    11,
  );
  y = paragraph(
    page,
    font,
    "该员工于 ____年____月____日办理完毕离职手续，双方劳动关系自该日起依法解除/终止。在职期间无尚未结清的薪酬、保密与竞业限制义务另依书面约定执行。",
    y,
  );
  y = paragraph(
    page,
    font,
    "特此证明。本证明仅用于就业、签证或相关事务办理，复印无效，涂改无效。",
    y,
  );

  y += 24;
  text(page, font, "离职原因（可选）：____________________", y);
  y += 40;
  text(page, font, COMPANY, y);
  y += 22;
  text(page, font, "（公章）", y);
  y += 90;
  text(page, font, "开具日期：____年____月____日", y);

  return Buffer.from(await doc.save());
}

async function buildCertificatePdf(): Promise<Buffer> {
  const { doc, font, bold } = await withFonts();
  const page = doc.addPage([A4.width, A4.height]);
  header(page, font, bold, "在职证明", "Employment Certificate");

  let y = 160;
  y = paragraph(
    page,
    font,
    `兹证明 ____________________（身份证号：____________________）自 ____年____月____日起在我公司____________________部门担任____________________职务，目前仍在职。`,
    y,
    11,
  );
  y = paragraph(
    page,
    font,
    "该员工遵守公司规章制度，工作表现良好。本证明应本人申请开具，仅供办理签证、贷款、子女入学等合理用途，不作为收入担保或法律承诺。",
    y,
  );
  y = paragraph(page, font, "如需核实，请联系人力资源部：hr@demo.hrsign.local / 021-5888-0000。", y);

  y += 36;
  text(page, font, COMPANY, y);
  y += 22;
  text(page, font, "人力资源部（公章）", y);
  y += 100;
  text(page, font, "开具日期：____年____月____日", y);

  return Buffer.from(await doc.save());
}

const BUILDERS: Record<PresetKind, () => Promise<Buffer>> = {
  CONTRACT: buildContractPdf,
  OFFER: buildOfferPdf,
  ENTRY: buildEntryPdf,
  RESIGN: buildResignPdf,
  CERTIFICATE: buildCertificatePdf,
};

export async function createPresetPdf(
  kind: PresetKind,
  locale: DbLocale = "zh_CN",
): Promise<Buffer> {
  if (locale === "en") return createEnglishPresetPdf(kind);
  return BUILDERS[kind]();
}

/**
 * Field boxes use top-left origin (editor / fillTemplate).
 * Positions align to blank underline areas in the Chinese preset PDFs.
 */
export function defaultFieldsForPreset(
  kind: PresetKind,
  locale: DbLocale = "zh_CN",
): PresetFieldDef[] {
  if (locale === "en") return defaultEnglishFieldsForPreset(kind);
  const sealSig = (page: number, sealLabel: string, sigLabel: string): PresetFieldDef[] => [
    {
      type: "SEAL",
      label: sealLabel,
      required: true,
      coordinates: { page, x: MARGIN, y: page === 2 ? 620 : 640, width: 110, height: 110, rotation: 0 },
      sortOrder: 90,
    },
    {
      type: "SIGNATURE",
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
        label: "乙方姓名",
        required: true,
        coordinates: { page: 1, x: 140, y: 206, width: 120, height: 22, rotation: 0 },
        sortOrder: 1,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "身份证号",
        required: true,
        coordinates: { page: 1, x: 360, y: 206, width: 160, height: 22, rotation: 0 },
        sortOrder: 2,
        fontSize: 11,
      },
      {
        type: "DATE",
        label: "合同起始日",
        required: true,
        coordinates: { page: 1, x: 200, y: 278, width: 120, height: 22, rotation: 0 },
        sortOrder: 3,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "岗位名称",
        required: true,
        coordinates: { page: 1, x: 200, y: 318, width: 160, height: 22, rotation: 0 },
        sortOrder: 4,
        fontSize: 11,
      },
      ...sealSig(2, "甲方公章", "乙方签字"),
    ],
    OFFER: [
      {
        type: "TEXT",
        label: "候选人姓名",
        required: true,
        coordinates: { page: 1, x: 120, y: 160, width: 140, height: 22, rotation: 0 },
        sortOrder: 1,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "录用岗位",
        required: true,
        coordinates: { page: 1, x: 120, y: 268, width: 180, height: 22, rotation: 0 },
        sortOrder: 2,
        fontSize: 11,
      },
      {
        type: "DATE",
        label: "入职日期",
        required: true,
        coordinates: { page: 1, x: 140, y: 312, width: 120, height: 22, rotation: 0 },
        sortOrder: 3,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "月薪（元）",
        required: true,
        coordinates: { page: 1, x: 160, y: 378, width: 100, height: 22, rotation: 0 },
        sortOrder: 4,
        fontSize: 11,
      },
      ...sealSig(1, "人事章", "候选人签字"),
    ],
    ENTRY: [
      {
        type: "TEXT",
        label: "姓名",
        required: true,
        coordinates: { page: 1, x: 90, y: 184, width: 100, height: 22, rotation: 0 },
        sortOrder: 1,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "身份证号",
        required: true,
        coordinates: { page: 1, x: 120, y: 206, width: 180, height: 22, rotation: 0 },
        sortOrder: 2,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "部门",
        required: true,
        coordinates: { page: 1, x: 200, y: 278, width: 120, height: 22, rotation: 0 },
        sortOrder: 3,
        fontSize: 11,
      },
      {
        type: "DATE",
        label: "入职日期",
        required: true,
        coordinates: { page: 1, x: 280, y: 300, width: 120, height: 22, rotation: 0 },
        sortOrder: 4,
        fontSize: 11,
      },
      ...sealSig(1, "人事章", "员工签字"),
    ],
    RESIGN: [
      {
        type: "TEXT",
        label: "员工姓名",
        required: true,
        coordinates: { page: 1, x: 100, y: 160, width: 120, height: 22, rotation: 0 },
        sortOrder: 1,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "身份证号",
        required: true,
        coordinates: { page: 1, x: 280, y: 160, width: 160, height: 22, rotation: 0 },
        sortOrder: 2,
        fontSize: 11,
      },
      {
        type: "DATE",
        label: "离职日期",
        required: true,
        coordinates: { page: 1, x: 140, y: 210, width: 120, height: 22, rotation: 0 },
        sortOrder: 3,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "离职原因",
        required: false,
        coordinates: { page: 1, x: 140, y: 320, width: 200, height: 22, rotation: 0 },
        sortOrder: 4,
        fontSize: 11,
      },
      {
        type: "SEAL",
        label: "公司公章",
        required: true,
        coordinates: { page: 1, x: MARGIN, y: 420, width: 120, height: 120, rotation: 0 },
        sortOrder: 90,
      },
      {
        type: "DATE",
        label: "开具日期",
        required: true,
        coordinates: { page: 1, x: 120, y: 560, width: 120, height: 22, rotation: 0 },
        sortOrder: 91,
        fontSize: 11,
      },
    ],
    CERTIFICATE: [
      {
        type: "TEXT",
        label: "员工姓名",
        required: true,
        coordinates: { page: 1, x: 100, y: 160, width: 120, height: 22, rotation: 0 },
        sortOrder: 1,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "身份证号",
        required: true,
        coordinates: { page: 1, x: 280, y: 160, width: 160, height: 22, rotation: 0 },
        sortOrder: 2,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "部门",
        required: true,
        coordinates: { page: 1, x: 200, y: 188, width: 120, height: 22, rotation: 0 },
        sortOrder: 3,
        fontSize: 11,
      },
      {
        type: "TEXT",
        label: "职务",
        required: true,
        coordinates: { page: 1, x: 360, y: 188, width: 120, height: 22, rotation: 0 },
        sortOrder: 4,
        fontSize: 11,
      },
      {
        type: "DATE",
        label: "入职日期",
        required: true,
        coordinates: { page: 1, x: 140, y: 172, width: 120, height: 22, rotation: 0 },
        sortOrder: 5,
        fontSize: 11,
      },
      {
        type: "SEAL",
        label: "公司公章",
        required: true,
        coordinates: { page: 1, x: MARGIN, y: 420, width: 120, height: 120, rotation: 0 },
        sortOrder: 90,
      },
      {
        type: "DATE",
        label: "开具日期",
        required: true,
        coordinates: { page: 1, x: 120, y: 560, width: 120, height: 22, rotation: 0 },
        sortOrder: 91,
        fontSize: 11,
      },
    ],
  };

  return byKind[kind].map((f, i) => ({ ...f, sortOrder: f.sortOrder || i + 1 }));
}

export const ZH_PRESET_NAMES: Record<TemplateCategory, string> = {
  CONTRACT: "2026 标准劳动合同",
  OFFER: "录用通知书",
  ENTRY: "入职登记表",
  RESIGN: "离职证明",
  CERTIFICATE: "在职证明",
};

export function presetCatalogName(category: TemplateCategory, locale: DbLocale): string {
  return locale === "en" ? EN_PRESET_NAMES[category] : ZH_PRESET_NAMES[category];
}

