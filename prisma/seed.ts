import { PrismaClient, type TemplateCategory, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DbLocale } from "../apps/web/src/i18n/config";
import { createSigningTask } from "../apps/web/src/lib/create-task";
import {
  createPresetPdf,
  defaultFieldsForPreset,
  pdfPageCount,
  presetCatalogName,
} from "../apps/web/src/lib/template-presets";

const prisma = new PrismaClient();

/** Local-only logins (no public DNS). English roster for Yunqi HQ demo. */
const SEED_USERS: Array<{
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
}> = [
  { email: "admin@hrsign.local", fullName: "Kai Lin", role: "SUPER_ADMIN", password: "Admin@123456" },
  { email: "hr@hrsign.local", fullName: "Avery Chen", role: "HR", password: "Hr@123456" },
  { email: "leader@hrsign.local", fullName: "Morgan Lee", role: "DEPT_LEADER", password: "Leader@123456" },
  { email: "employee@hrsign.local", fullName: "Riley Wang", role: "EMPLOYEE", password: "Employee@123456" },
];

const SEED_SEALS: Array<{ name: string; style: "ROUND_CHINESE" | "TEXT_INTERNATIONAL" | "NONE" }> = [
  { name: "Yunqi Company Seal", style: "TEXT_INTERNATIONAL" },
  { name: "Yunqi Contract Seal", style: "TEXT_INTERNATIONAL" },
  { name: "Yunqi HR Seal", style: "TEXT_INTERNATIONAL" },
];

/** Old demo titles — deleted on re-seed so lists stay clean. */
const LEGACY_TASK_TITLES = [
  "【演示】张三 · 录用通知签署",
  "[Demo] Alex Zhang — Offer letter signing",
  "录用通知 — 周婉清 · 产品经理",
];

const SEED_CATEGORIES: TemplateCategory[] = [
  "CONTRACT",
  "OFFER",
  "ENTRY",
  "RESIGN",
  "CERTIFICATE",
];

/** English-only seed for demos (Chinese presets remain available via “Create from HR preset”). */
const SEED_LOCALES: DbLocale[] = ["en"];

const CANDIDATE = {
  zh: {
    name: "周婉清",
    position: "产品经理",
    salary: "28000",
    startDate: "2026-10-08",
    email: "wanqing.zhou@outlook.com",
    taskTitle: "录用通知 — 周婉清 · 产品经理",
  },
  en: {
    name: "Wanqing Zhou",
    position: "Product Manager",
    salary: "28000",
    startDate: "2026-10-08",
    email: "wanqing.zhou@outlook.com",
    taskTitle: "Offer letter — Wanqing Zhou · Product Manager",
  },
} as const;

function loadSealPng(): Buffer | null {
  const candidates = [
    join(process.cwd(), "apps/web/public/brand/demo-seal.png"),
    join(process.cwd(), "public/brand/demo-seal.png"),
    join(__dirname, "../apps/web/public/brand/demo-seal.png"),
  ];
  for (const demoPath of candidates) {
    if (existsSync(demoPath)) return readFileSync(demoPath);
  }
  return null;
}

async function upsertPublishedTemplate(
  hrId: string,
  storage: Awaited<ReturnType<typeof import("../apps/web/src/server/providers").getStorage>>,
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
  const pageCount = await pdfPageCount(buffer);
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

function fillOfferValues(
  fields: Array<{ id: string; type: string; label: string; required: boolean }>,
  locale: DbLocale,
): Record<string, string> {
  const c = locale === "en" ? CANDIDATE.en : CANDIDATE.zh;
  const values: Record<string, string> = {};
  for (const f of fields) {
    if (f.type !== "TEXT" && f.type !== "DATE") continue;
    const label = f.label.toLowerCase();
    if (
      label.includes("姓名") ||
      label.includes("候选人") ||
      label.includes("candidate") ||
      label.includes("employee name") ||
      label.includes("full name")
    ) {
      values[f.id] = c.name;
    } else if (label.includes("岗位") || label.includes("position") || label.includes("title")) {
      values[f.id] = c.position;
    } else if (label.includes("入职") || label.includes("start") || f.type === "DATE") {
      values[f.id] = c.startDate;
    } else if (label.includes("薪") || label.includes("salary") || label.includes("月薪")) {
      values[f.id] = c.salary;
    } else if (label.includes("部门") || label.includes("department")) {
      values[f.id] = locale === "en" ? "Product" : "产品部";
    } else if (f.required) {
      values[f.id] = "Yunqi HQ";
    }
  }
  return values;
}

async function seedOfferTask(opts: {
  hrId: string;
  leaderId: string;
  employeeId: string;
  offerTemplateId: string;
  locale: DbLocale;
}) {
  const c = opts.locale === "en" ? CANDIDATE.en : CANDIDATE.zh;
  const title = c.taskTitle;

  for (const legacy of LEGACY_TASK_TITLES) {
    const hit = await prisma.signingTask.findFirst({ where: { title: legacy } });
    if (hit) {
      await prisma.signingTask.delete({ where: { id: hit.id } });
      console.log(`removed legacy task: ${legacy}`);
    }
  }

  const existing = await prisma.signingTask.findFirst({ where: { title } });
  if (existing) {
    await prisma.signingTask.delete({ where: { id: existing.id } });
    console.log(`reset offer task: ${title}`);
  }

  const version = await prisma.templateVersion.findFirst({
    where: { templateId: opts.offerTemplateId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
    include: { fields: true },
  });
  if (!version) {
    console.warn("no published offer version — skip offer task");
    return;
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  const { taskId } = await createSigningTask({
    userId: opts.hrId,
    ip: "127.0.0.1",
    userAgent: "prisma-seed/yunqi",
    body: {
      templateId: opts.offerTemplateId,
      title,
      flowType: "SEQUENTIAL",
      expiresAt: expiresAt.toISOString(),
      formValues: fillOfferValues(version.fields, opts.locale),
      signers: [
        { signRole: "APPROVER", userId: opts.leaderId },
        { signRole: "COMPANY_SEAL", userId: opts.employeeId },
        {
          signRole: "PERSONAL_SIGNATURE",
          externalFullName: c.name,
          externalEmail: c.email,
        },
      ],
    },
  });
  console.log(`seeded offer task: ${title} (${taskId})`);
}

async function seedStorageAssets(adminId: string, hrId: string, leaderId: string, employeeId: string) {
  let storage: Awaited<ReturnType<typeof import("../apps/web/src/server/providers").getStorage>>;
  try {
    const { getStorage } = await import("../apps/web/src/server/providers");
    storage = getStorage();
    await storage.exists("__seed_probe__");
  } catch (err) {
    console.warn(
      "MinIO/storage unavailable — skipping seals/templates/tasks:",
      err instanceof Error ? err.message : err,
    );
    return;
  }

  const png = loadSealPng();
  if (!png) {
    console.warn("demo-seal.png not found — skipping seal/template asset seed");
    return;
  }

  const legacySealNames = [
    "演示公章",
    "公司公章",
    "合同专用章",
    "人事专用章",
    "云启科技公章",
    "云启合同专用章",
    "云启人事专用章",
    "Company Seal",
    "Contract Seal",
    "HR Seal",
    "E2E test seal",
  ];
  const legacySeals = await prisma.seal.findMany({
    where: { name: { in: legacySealNames } },
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

  // Strip E2E / placeholder tasks so the inbox looks like a live HR desk.
  const junkTasks = await prisma.signingTask.findMany({
    where: {
      OR: [
        { title: { contains: "E2E" } },
        { title: { contains: "张三" } },
        { title: { contains: "Jane Doe" } },
        { title: { contains: "批量导入示例" } },
        { title: { contains: "Batch import sample" } },
      ],
    },
    select: { id: true, title: true },
  });
  for (const t of junkTasks) {
    await prisma.signingTask.delete({ where: { id: t.id } });
    console.log(`removed junk task: ${t.title}`);
  }

  for (const spec of SEED_SEALS) {
    const existing = await prisma.seal.findFirst({ where: { name: spec.name, createdBy: adminId } });
    if (existing) {
      await prisma.seal.update({ where: { id: existing.id }, data: { enabled: true } });
      console.log(`seed seal exists: ${spec.name}`);
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
      `archived ${archived.count} extra published version(s):`,
      extras.map((t) => t.name).join(", "),
    );
  }

  for (const locale of SEED_LOCALES) {
    const offerId = offerByLocale[locale];
    if (offerId) {
      await seedOfferTask({
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

    // Prefer English department names for the demo roster
    for (const [from, to] of [
      ["产品研发中心", "Product Engineering"],
      ["人力资源部", "Human Resources"],
      ["Engineering", "Product Engineering"],
    ] as const) {
      const row = await prisma.department.findUnique({ where: { name: from } });
      if (row) {
        const clash = await prisma.department.findUnique({ where: { name: to } });
        if (!clash) {
          await prisma.department.update({ where: { id: row.id }, data: { name: to } });
        }
      }
    }

    const eng = await prisma.department.upsert({
      where: { name: "Product Engineering" },
      update: { leaderUserId: leader.id },
      create: { name: "Product Engineering", leaderUserId: leader.id },
    });
    const hrDept = await prisma.department.upsert({
      where: { name: "Human Resources" },
      update: { leaderUserId: hr.id },
      create: { name: "Human Resources", leaderUserId: hr.id },
    });
    await prisma.user.update({ where: { id: leader.id }, data: { departmentId: eng.id } });
    await prisma.user.update({ where: { id: employee.id }, data: { departmentId: eng.id } });
    await prisma.user.update({ where: { id: hr.id }, data: { departmentId: hrDept.id } });

    await prisma.approvalPolicy.updateMany({
      where: { OR: [{ name: "录用通知审批" }, { name: "Default offer approval" }] },
      data: { name: "Offer letter approval" },
    });
    const policyCount = await prisma.approvalPolicy.count();
    if (policyCount === 0) {
      await prisma.approvalPolicy.create({
        data: {
          name: "Offer letter approval",
          category: "OFFER",
          departmentId: eng.id,
          approverUserIds: [leader.id],
          required: true,
          enabled: true,
        },
      });
    }
    console.log("seeded departments + approval policy");
  }

  const retentionLabels: Record<TemplateCategory, string> = {
    OFFER: "Offer documents retention",
    ENTRY: "Onboarding records retention",
    CONTRACT: "Employment contract retention",
    RESIGN: "Resignation certificate retention",
    CERTIFICATE: "Employment certificate retention",
  };
  const categories: TemplateCategory[] = ["OFFER", "ENTRY", "CONTRACT", "RESIGN", "CERTIFICATE"];
  for (const category of categories) {
    await prisma.retentionPolicy.upsert({
      where: { category },
      update: { name: retentionLabels[category] },
      create: {
        name: retentionLabels[category],
        category,
        retentionYears: category === "CONTRACT" ? 10 : 5,
        action: "SOFT_DELETE",
        enabled: true,
      },
    });
  }
  console.log("seeded retention policies");

  // Platform IAM + default Yunqi account
  const { seedPermissionMatrix } = await import("../apps/web/src/lib/permissions");
  await seedPermissionMatrix();
  console.log("seeded permission matrix");

  if (admin && hr) {
    const acct = await prisma.account.upsert({
      where: { slug: "yunqi" },
      update: { name: "Yunqi Information Technology (Shanghai) Co., Ltd." },
      create: { name: "Yunqi Information Technology (Shanghai) Co., Ltd.", slug: "yunqi" },
    });
    for (const [userId, role] of [
      [admin.id, "admin"],
      [hr.id, "admin"],
      ...(leader ? [[leader.id, "sender"] as const] : []),
      ...(employee ? [[employee.id, "viewer"] as const] : []),
    ] as Array<[string, string]>) {
      await prisma.accountMember.upsert({
        where: { accountId_userId: { accountId: acct.id, userId } },
        update: { role },
        create: { accountId: acct.id, userId, role },
      });
    }
    console.log(`seeded account: ${acct.slug}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
