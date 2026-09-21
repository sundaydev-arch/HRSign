---
name: hr-schema-zod
description: 修改 Prisma 模型/枚举、读写任何 Json 列、为外部输入（API 入参/表单/环境变量）加校验时使用。规定"每列 Json 必配 zod、禁止直接类型断言、坐标/规则的解包方式、版本不可变模型的改法"。
---

# 技能 01：Schema 与 Zod 约定

## 何时使用

- 新增/修改 Prisma 模型、字段、枚举（[prisma/schema.prisma](../../../prisma/schema.prisma)）
- 读取或写入任何 `Json` / `Json?` 列
- 给 API 入参、表单、第三方返回、环境变量加校验

## 硬规则

1. **每个 Json 列必须在 [src/schemas/](../../../src/schemas) 有同名职责的 zod schema，并从 [schemas/index.ts](../../../src/schemas/index.ts) 导出。** 当前映射：

   | Prisma 列 | zod schema |
   |---|---|
   | TemplateField.coordinates | CoordinatesSchema |
   | TemplateField.validationRules | template-field.ts |
   | TemplateField.labelI18n | label-i18n.ts |
   | TemplateVersion.watermarkConfig | watermark.ts |
   | Document.fieldValues | field-values.ts |
   | AuditLog.detail | audit-detail.ts |
   | WebhookDelivery.payload | webhook-payload.ts |
   | NotificationLog.templateParams / NotificationTemplate.defaultParams | notification.ts |
   | Signature.verificationResult | signature.ts |

2. **读 Json 必须 parse，禁止 `f.coordinates as XxxType`**。信任数据用 `.parse()`；外部/可能脏的数据用 `.safeParse()` 并显式处理失败（参考 [TemplateEditor.tsx](../../../src/components/pdf/TemplateEditor.tsx) 初始化时 safeParse 跳过脏字段）。
3. 写 Json 时 Prisma 入参类型用 `Prisma.InputJsonValue`，不要强转 `any`。
4. 新增枚举值后必须同步：① labels.ts 的 `Record<Enum, string>`（或 i18n 消息）② 所有 `Record<Enum, …>` 映射（TS 会因缺键报错，逐个补齐，禁止用 `as` 绕过）。预留枚举也要给映射值（如 FieldType 的 PERFORATION_SEAL）。
5. **模板版本不可变**：status/pageCount/storageKey/fields 归属 TemplateVersion；改字段只允许在 DRAFT 版本（参考 [fields/route.ts](../../../src/app/api/templates/[id]/fields/route.ts)）；PUBLISHED 的改动 = 新建版本，不提供"原地改"。
6. 外部输入一律 zod：API body 解析成 `unknown` 再 parse，不相信前端类型。
7. 不允许 `db push` 式隐式结构变更进入正式交付；新增字段给默认值或可空，避免历史数据问题。

## 标准步骤

1. 改 schema.prisma → `pnpm prisma generate`（必要时 `prisma migrate dev --name xxx`，迁移需与团队确认）
2. Json 列：新建/更新 `src/schemas/xxx.ts` 并在 index.ts 导出
3. 所有读写点改用 schema parse（grep 该字段名找全）
4. 补枚举映射；`pnpm exec tsc --noEmit` 必须 0 错

## 禁忌

- ❌ `JSON.parse` 后直接当类型用
- ❌ 在前端组件里手写 Json 结构形状而不引用 zod
- ❌ 给已 PUBLISHED 版本加"补丁字段"
- ❌ 用 `@db.Text` 等随意更改列类型而不说明影响

## 完成检查

- [ ] 新 Json 列有配对 zod 且 index.ts 已导出
- [ ] 无新增 `as any` / 对 Json 的直接断言
- [ ] tsc 0 错；枚举 Record 映射无缺键
- [ ] 标注修改文件、原因、测试要点
