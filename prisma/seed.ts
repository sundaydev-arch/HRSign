import { PrismaClient, type TemplateCategory, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DbLocale } from "../src/i18n/config";
import { createSigningTask } from "../src/lib/create-task";
import {
  createPresetPdf,
  defaultFieldsForPreset,
  presetCatalogName,
} from "../src/lib/template-presets";

const prisma = new PrismaClient();

const SEED_USERS: Array<{
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
}> = [
  { email: "admin@hrsign.local", fullName: "System Admin", role: "SUPER_ADMIN", password: "Admin@123456" },
  { email: "hr@hrsign.local", fullName: "Chen Siyuan", role: "HR", password: "Hr@123456" },
  { email: "leader@hrsign.local", fullName: "Li Wei", role: "DEPT_LEADER", password: "Leader@123456" },
  { email: "employee@hrsign.local", fullName: "Wang Xiaoming", role: "EMPLOYEE", password: "Employee@123456" },
];

const SEED_SEALS: Array<{ name: string; style: "ROUND_CHINESE" | "TEXT_INTERNATIONAL" | "NONE" }> = [
  { name: "Company Seal", style: "ROUND_CHINESE" },
  { name: "Contract Seal", style: "ROUND_CHINESE" },
  { name: "HR Seal", style: "TEXT_INTERNATIONAL" },
];

const SEED_CATEGORIES: TemplateCategory[] = [
  "CONTRACT",
  "OFFER",
  "ENTRY",
  "RESIGN",
  "CERTIFICATE",
];

const SEED_LOCALES: DbLocale[] = ["zh_CN", "en"];

function loadSealPng(): Buffer | null {
  const demoPath = join(process.cwd(), "apps/web/public/brand/demo-seal.png");
  if (existsSync(demoPath)) return readFileSync(demoPath);
  return null;
}

async function upsertPublishedTemplate(
  hrId: string,
  storage: Awaited<ReturnType<typeof import("../src/server/providers").getStorage>>,
  category: TemplateCategory,
  locale: DbLocale,
) {
  const name = presetCatalogName(category, locale);
  const existing = await prisma.template.findFirst({
    where: { name, createdBy: hrId, locale },
    include: { versions: { select: { id: true, storageKey: true }, orderBy: { version: "desc" }, take: 1 } },
  });

  const buffer = await createPresetPdf(category, locale);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const pdf = await (await import("pdf-lib")).PDFDocument.load(buffer);
  const pageCount = pdf.getPageCount();
  const presetFields = defaultFieldsForPreset(category, locale);

  if (existing?.versions[0]) {
    const version = existing.versions[0];
    const storageKey = `templates/${randomUUID()}.pdf`;
    await storage.put({ key: storageKey, data: buffer, contentType: "application/pdf" });
    await prisma.template.update({ where: { id: existing.id }, data: { locale } });
    await prisma.templateVersion.update({
      where: { id: version.id },
      data: {
        storageKey,
        sha256,
        pageCount,
        status: "PUBLISHED",
        publishedAt: new Date(),
        archivedAt: null,
      },
    });
    await prisma.templateField.deleteMany({ where: { templateVersionId: version.id } });
    await prisma.templateField.createMany({
      data: presetFields.map((f) => ({
        templateVersionId: version.id,
        type: f.type,
        label: f.label,
        coordinates: f.coordinates as object,
        required: f.required,
        fontSize: f.fontSize ?? 11,
        sortOrder: f.sortOrder,
      })),
    });
    console.log(`seed refreshed template: ${name} (${locale}, ${pageCount}p)`);
    return existing;
  }

  const storageKey = `templates/${randomUUID()}.pdf`;
  await storage.put({ key: storageKey, data: buffer, contentType: "application/pdf" });

  const template = await prisma.template.create({
    data: {
      name,
      category,
      locale,
      createdBy: hrId,
      versions: {
        create: {
          version: 1,
          status: "PUBLISHED",
          storageKey,
          sha256,
          pageCount,
          createdBy: hrId,
          publishedAt: new Date(),
          fields: {
            create: presetFields.map((f) => ({
              type: f.type,
              label: f.label,
              coordinates: f.coordinates as object,
              required: f.required,
              fontSize: f.fontSize ?? 11,
              sortOrder: f.sortOrder,
            })),
          },
        },
      },
    },
  });
  console.log(`seeded published template: ${template.name} (${locale}, ${pageCount}p)`);
  return template;
}

async function seedDemoTask(opts: {
  hrId: string;
  leaderId: string;
  employeeId: string;
  offerTemplateId: string;
  locale: DbLocale;
}) {
  const title =
    opts.locale === "en"
      ? "[Demo] Alex Zhang — Offer letter signing"
      : "【演示】张三 · 录用通知签署";
  const existing = await prisma.signingTask.findFirst({ where: { title } });
  if (existing) {
    await prisma.signingTask.delete({ where: { id: existing.id } });
    console.log(`seed demo task reset: ${title}`);
  }

  const version = await prisma.templateVersion.findFirst({
    where: { templateId: opts.offerTemplateId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
    include: { fields: true },
  });
  if (!version) {
    console.warn("no published offer version — skip demo task");
    return;
  }

  const demoValues: Record<string, string> = {};
  for (const f of version.fields) {
    if (f.type !== "TEXT" && f.type !== "DATE") continue;
    const label = f.label.toLowerCase();
    if (
      label.includes("姓名") ||
      label.includes("候选人") ||
      label.includes("candidate") ||
      label.includes("employee name") ||
      label.includes("full name")
    ) {
      demoValues[f.id] = opts.locale === "en" ? "Alex Zhang" : "张三";
    } else if (label.includes("岗位") || label.includes("position")) {
      demoValues[f.id] = opts.locale === "en" ? "Product Manager" : "产品经理";
    } else if (label.includes("入职") || label.includes("start") || f.type === "DATE") {
      demoValues[f.id] = "2026-10-08";
    } else if (label.includes("薪") || label.includes("salary") || label.includes("月薪")) {
      demoValues[f.id] = "28000";
    } else if (f.required) {
      demoValues[f.id] = opts.locale === "en" ? "Demo" : "演示";
    }
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  const { taskId } = await createSigningTask({
    userId: opts.hrId,
    ip: "127.0.0.1",
    userAgent: "prisma-seed",
    body: {
      templateId: opts.offerTemplateId,
      title,
      flowType: "SEQUENTIAL",
      expiresAt: expiresAt.toISOString(),
      formValues: demoValues,
      signers: [
        { signRole: "APPROVER", userId: opts.leaderId },
        { signRole: "COMPANY_SEAL", userId: opts.employeeId },
        {
          signRole: "PERSONAL_SIGNATURE",
          externalFullName: opts.locale === "en" ? "Alex Zhang" : "张三",
          externalEmail: "alex.zhang.demo@example.com",
        },
      ],
    },
  });
  console.log(`seeded demo task: ${title} (${taskId})`);
}

async function seedStorageAssets(adminId: string, hrId: string, leaderId: string, employeeId: string) {
  let storage: Awaited<ReturnType<typeof import("../src/server/providers").getStorage>>;
  try {
    const { getStorage } = await import("../src/server/providers");
    storage = getStorage();
    await storage.exists("__seed_probe__");
  } catch (err) {
    console.warn(
      "MinIO/storage unavailable — skipping demo seals/templates/task:",
      err instanceof Error ? err.message : err,
    );
    return;
  }

  const png = loadSealPng();
  if (!png) {
    console.warn("demo-seal.png not found — skipping seal/template asset seed");
    return;
  }

  // Retire Chinese-named demo seals so English UI stays Latin-only.
  const legacySeals = await prisma.seal.findMany({
    where: { name: { in: ["演示公章", "公司公章", "合同专用章", "人事专用章"] } },
    include: { _count: { select: { signatures: true } } },
  });
  for (const seal of legacySeals) {
    if (seal._count.signatures === 0) {
      await prisma.seal.delete({ where: { id: seal.id } });
      console.log(`removed legacy seal: ${seal.name}`);
    } else {
      await prisma.seal.update({ where: { id: seal.id }, data: { enabled: false } });
      console.log(`disabled legacy seal (in use): ${seal.name}`);
    }
  }

  for (const spec of SEED_SEALS) {
    const existing = await prisma.seal.findFirst({ where: { name: spec.name, createdBy: adminId } });
    if (existing) {
      await prisma.seal.update({ where: { id: existing.id }, data: { enabled: true } });
      console.log(`seed seal skipped (exists): ${spec.name}`);
      continue;
    }
    const storageKey = `seals/${randomUUID()}.png`;
    await storage.put({ key: storageKey, data: png, contentType: "image/png" });
    await prisma.seal.create({
      data: {
        name: spec.name,
        style: spec.style,
        storageKey,
        sha256: createHash("sha256").update(png).digest("hex"),
        width: 120,
        height: 120,
        createdBy: adminId,
      },
    });
    console.log(`seeded seal: ${spec.name}`);
  }

  const keepNames = new Set<string>();
  const offerByLocale: Partial<Record<DbLocale, string>> = {};

  for (const locale of SEED_LOCALES) {
    for (const category of SEED_CATEGORIES) {
      const template = await upsertPublishedTemplate(hrId, storage, category, locale);
      keepNames.add(template.name);
      if (category === "OFFER") offerByLocale[locale] = template.id;
    }
  }

  const extras = await prisma.template.findMany({
    where: { name: { notIn: [...keepNames] }, versions: { some: { status: "PUBLISHED" } } },
    select: { id: true, name: true },
  });
  if (extras.length) {
    const archived = await prisma.templateVersion.updateMany({
      where: { templateId: { in: extras.map((t) => t.id) }, status: "PUBLISHED" },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    console.log(
      `archived ${archived.count} non-demo published version(s):`,
      extras.map((t) => t.name).join(", "),
    );
  }

  for (const locale of SEED_LOCALES) {
    const offerId = offerByLocale[locale];
    if (offerId) {
      await seedDemoTask({
        hrId,
        leaderId,
        employeeId,
        offerTemplateId: offerId,
        locale,
      });
    }
  }
}

async function main() {
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role, isActive: true, passwordHash },
      create: { email: u.email, fullName: u.fullName, role: u.role, passwordHash },
    });
    console.log(`seeded user: ${u.email} (${u.role}) — ${u.fullName}`);
  }

  const admin = await prisma.user.findUnique({ where: { email: "admin@hrsign.local" } });
  const hr = await prisma.user.findUnique({ where: { email: "hr@hrsign.local" } });
  const leader = await prisma.user.findUnique({ where: { email: "leader@hrsign.local" } });
  const employee = await prisma.user.findUnique({ where: { email: "employee@hrsign.local" } });
  if (admin && hr && leader && employee) {
    await seedStorageAssets(admin.id, hr.id, leader.id, employee.id);

    const eng = await prisma.department.upsert({
      where: { name: "Engineering" },
      update: { leaderUserId: leader.id },
      create: { name: "Engineering", leaderUserId: leader.id },
    });
    const hrDept = await prisma.department.upsert({
      where: { name: "Human Resources" },
      update: { leaderUserId: hr.id },
      create: { name: "Human Resources", leaderUserId: hr.id },
    });
    await prisma.user.update({ where: { id: leader.id }, data: { departmentId: eng.id } });
    await prisma.user.update({ where: { id: employee.id }, data: { departmentId: eng.id } });
    await prisma.user.update({ where: { id: hr.id }, data: { departmentId: hrDept.id } });

    const policyCount = await prisma.approvalPolicy.count();
    if (policyCount === 0) {
      await prisma.approvalPolicy.create({
        data: {
          name: "Default offer approval",
          category: "OFFER",
          departmentId: eng.id,
          approverUserIds: [leader.id],
          required: true,
          enabled: true,
        },
      });
    }
    console.log("seeded departments + sample approval policy");
  }

  const categories: TemplateCategory[] = ["OFFER", "ENTRY", "CONTRACT", "RESIGN", "CERTIFICATE"];
  for (const category of categories) {
    await prisma.retentionPolicy.upsert({
      where: { category },
      update: { name: `${category} default retention` },
      create: {
        name: `${category} default retention`,
        category,
        retentionYears: category === "CONTRACT" ? 10 : 5,
        action: "SOFT_DELETE",
        enabled: true,
      },
    });
  }
  console.log("seeded retention policies for all template categories");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
