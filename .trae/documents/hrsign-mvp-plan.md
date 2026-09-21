# HRSign 人事电子签章系统 — 阶段1 MVP 实施计划

## Context

全新绿地项目（目录为空），按用户固定技术栈一次性交付完整 MVP：Next.js 14 App Router + TS 严格类型 + Tailwind + shadcn/ui + Prisma/PostgreSQL + pdf-lib（后端填充/盖章）+ pdf.js（前端预览）+ MinIO。包含 8 个页面、11+ 数据模型、PDF 填充引擎、审批流、图片签章/手写签名、RBAC、归档与审计。已确认：Docker Compose 提供 PG+MinIO；NextAuth v5 credentials 登录；MVP 仅邮件通知（企微留插槽）；预留 PAdES 合规签名代码插槽（阶段2 不实现）。

## 已验证的关键技术结论

1. **pdf.js worker**：复制 `pdfjs-dist/build/pdf.worker.min.mjs` 到 `public/`，`workerSrc='/pdf.worker.min.mjs'`（比 import.meta.url 稳）。组件 `'use client'` + 页面侧 `dynamic(..., { ssr:false })`；`next.config` 中 `resolve.alias.canvas = false`。
2. **NextAuth v5**：拆分配置 —— `src/auth.config.ts`（edge 安全，无 Prisma）+ `src/auth.ts`（Node 侧，Credentials authorize 内用 Prisma+bcrypt，JWT strategy）。middleware 只引 edge 配置做 cookie 校验。
3. **pdf-lib 中文**：`registerFontkit(fontkit)` + `embedFont` 嵌入 NotoSansSC-Regular.otf（curl 下载，OFL 协议，约 8MB）；水印 `drawText({ rotate: degrees(45) })` 支持；不用 subset（CJK 有损坏前科），生成结果需抽检。

## 目录结构（约定）

```
src/
  app/(auth)/login/                 # 登录页
  app/(dashboard)/                  # 企业后台布局（侧边栏）：templates / tasks / archive / audit-logs / seals / admin/users
  app/sign/external/[token]/        # 外部签署人免登录签署页
  app/api/...                       # 路由处理器（全部 Node runtime）
  components/ui/                    # shadcn 生成
  components/pdf/                   # PdfViewer(pdf.js)、SignaturePad(Canvas)、TemplateEditor
  lib/minio.ts lib/auth.ts lib/rbac.ts lib/audit.ts lib/notify/{email,wecom}.ts
  lib/pdf/{font.ts,fill.ts,stamp.ts,signer/}   # signer/index.ts 为 PAdES 插槽接口
prisma/{schema.pragma,seed.ts}
docker-compose.yml  public/pdf.worker.min.mjs  src/assets/fonts/NotoSansSC-Regular.otf
```

## Prisma 数据模型（含枚举）

- **User**：id/email/passwordHash/name/role(ENUM: SUPER_ADMIN,HR,DEPT_LEADER,EMPLOYEE,EXTERNAL)/isActive
- **Template**：name/category(ENUM: OFFER,ENTRY,CONTRACT,RESIGN,CERTIFICATE)/fileKey/pageCount/status(DRAFT,PUBLISHED,DISABLED)/createdBy
- **TemplateField**：templateId/type(ENUM: TEXT,DATE,TEXTAREA,COMPANY_SEAL,PERSONAL_SIGNATURE)/label/page/x/y/w/h/required/placeholder/sortOrder/config(Json)
- **Seal**：name/imageKey/enabled/createdBy
- **Document**：templateId/taskId/title/category/currentVersion/createdBy
- **DocumentVersion**：documentId/version/fileKey/action(GENERATED,SIGNED)/createdBy —— 每次生成/盖章都新版本，不覆盖
- **SignTask**：documentId/title/flowType(SEQUENTIAL,PARALLEL)/status(DRAFT,PENDING_APPROVAL,PENDING_SIGN,COMPLETED,REJECTED,EXPIRED)/expiresAt/createdBy
- **Signer**：taskId/userId?/externalName?/externalEmail?/externalToken?/signRole(APPROVER,COMPANY_SIGNER,PERSONAL_SIGNER)/order/status(WAITING,SIGNED,REJECTED,SKIPPED)/comment/signedAt
- **ApprovalRecord**：taskId/approverId/action(APPROVE,REJECT)/comment
- **SignatureRecord**：taskId/signerId/fieldId/type(COMPANY_SEAL,HANDWRITE)/fileKey/page/x/y/w/h/ip/userAgent
- **AuditLog**：userId?/action/targetType/targetId/ip/userAgent/detail(Json)
- **Notification**：channel(EMAIL,WECOM)/to/subject/body/status(PENDING,SENT,FAILED,SKIPPED)/taskId —— WECOM 通道为插槽，MVP 只走 EMAIL

## 核心引擎设计

- **填充引擎 `lib/pdf/fill.ts`**：输入模板 PDF bytes + 字段配置 + 表单值 → pdf-lib 加载、嵌入 NotoSansSC、按字段坐标 `drawText`（TEXT 自动换行截断、DATE 格式化 YYYY-MM-DD）→ 存 MinIO `documents/{docId}/v1.pdf` → 建 Document+Version(action=GENERATED)。原模板永不被修改。
- **盖章引擎 `lib/pdf/stamp.ts`**：embedPng 公司章/手写签名图，按 SignatureRecord 坐标叠加 → 新版本 v(n+1)（action=SIGNED）。全局水印：每页斜 45° 半透明文字（取自环境变量配置）。审批通过前禁止调用（见 RBAC 规则）。
- **PAdES 插槽 `lib/pdf/signer/index.ts`**：定义 `PdfSigner` 接口（sign(bytes, payload): Promise<bytes>），当前实现 `ImageSigner`；阶段2 只需新增 `PadesSigner implements PdfSigner` 并在配置处切换。
- **通知 `lib/notify/email.ts`**：nodemailer，SMTP 未配置时写入 Notification(SKIPPED) 不阻塞业务；`wecom.ts` 留空实现接口。触发点：任务创建→通知审批人；审批通过→通知下一签署人（顺序签）或全部签署人（并行签）；驳回→通知发起人；完成→通知发起人。
- **过期**：惰性求值——读取任务时若 `expiresAt < now && status=PENDING_*` 则置 EXPIRED 并审计。
- **审计 `lib/audit.ts`**：每个变更 API 调用 `recordAudit({ user, action, targetType, targetId, ip, ua, detail })`，ip 取 `x-forwarded-for`。

## RBAC 规则（lib/rbac.ts）

- SUPER_ADMIN：全部；HR：全部模板/任务/文档；DEPT_LEADER：仅自己审批的单据可见可审；EMPLOYEE：仅查看自己为签署人/发起人的文档；EXTERNAL：仅凭 token 访问对应签署页。
- 企业盖章前置校验：签章 API 内强校验任务状态必须为 `PENDING_SIGN`（即审批已通过），且签署人身份匹配 `COMPANY_SIGNER`。

## API 路由清单

| 路由                            | 方法             | 说明                                              |
| ------------------------------- | ---------------- | ------------------------------------------------- |
| /api/auth/[...nextauth]         | —                | NextAuth v5                                       |
| /api/templates                  | GET/POST         | 列表/新建（PDF 上传 formData→MinIO）              |
| /api/templates/[id]             | GET/PATCH/DELETE | 详情(含字段)/更新/停用                            |
| /api/templates/[id]/fields      | PUT              | 保存编辑器字段 JSON                               |
| /api/files/[...key]             | GET              | MinIO 代理流（带权限校验，pdf.js/dowload 用）     |
| /api/tasks                      | GET/POST         | 任务列表(按角色过滤)/发起(动态表单→填充→建任务)   |
| /api/tasks/[id]                 | GET              | 详情（字段+签署人+记录，外部 token 换取只读数据） |
| /api/tasks/[id]/approve、reject | POST             | 审批（顺序签推进 next step）                      |
| /api/tasks/[id]/sign            | POST             | 签署（签名图上传→stamp→新版本→状态推进/完成）     |
| /api/signatures/pad             | POST             | 手写 Canvas PNG 上传（登记者）                    |
| /api/seals                      | GET/POST/PATCH   | 印章列表/上传透明 PNG/启停                        |
| /api/audit-logs                 | GET              | 审计查询（SUPER_ADMIN/HR，支持过滤分页）          |
| /api/admin/users                | GET/POST/PATCH   | 用户管理（SUPER_ADMIN）                           |

## 页面清单 → 实现

1. **/login**：shadcn Card + Form，Credentials signIn；middleware 全局守卫。
2. **/templates 列表 + 上传**：Table（分类 Badge、状态、页数）、上传 Dialog（PDF 校验）。
3. **/templates/[id]/edit 可视化编辑器（核心）**：左侧字段面板（文本/日期/企业章/个人签），中部 pdf.js Canvas 渲染 + 绝对定位 overlay 字段框（Pointer Events 自实现拖拽/缩放，不引第三方拖拽库），右侧属性面板（label/必填/字号/placeholder），多页切换，保存 PUT fields。
4. **/tasks/new 动态表单发起页**：按模板字段自动生成 react-hook-form+zod 表单（TEXT→Input、TEXTAREA→Textarea、DATE→日期选择、签章域显示为提示卡片）；配置签署人（添加顺序=顺序签序号，可切并行）、过期时间、通知邮箱（外部签署人）。
5. **/tasks 任务中心**：Tabs（待我审批/待我签署/我发起的/全部-HR），状态 Badge、过期倒计时。
6. **/tasks/[id] 详情签署页**：PdfViewer 预览 + 待办动作（审批通过/驳回；签署：选择企业印章面板 或 SignaturePad 手写签名）+ 时间线（审批/签署记录）。
7. **/sign/external/[token]**：免登录，仅预览+手写签署（其 Signer 记录校验 token+邮箱）。
8. **/archive 归档**：按角色过滤的文档 Table + 预览 Dialog（PdfViewer）+ 下载；版本记录展开。
9. **/audit-logs**：Table + 用户/操作类型/日期过滤。
10. **/seals 印章管理**：上传透明 PNG、预览、启停。
11. **/admin/users 用户管理**：创建用户、分配角色、停用。

## 实施步骤（按依赖顺序）

1. **基建**：create-next-app(TS 严格/tailwind/eslint) → shadcn init + 所需组件 → docker-compose.yml（postgres:16 + minio + mc 初始化桶）→ .env(.example) → prisma schema + migrate + seed（默认管理员/HR/领导/员工账号）→ `lib/minio.ts` → 下载 NotoSansSC 字体 + pdf worker 复制脚本(postinstall) → next.config（canvas alias）。
2. **认证与框架**：auth.config.ts/auth.ts/middleware.ts/split config → 登录页 → (dashboard) 侧边栏布局（按角色渲染菜单）→ rbac.ts/audit.ts。
3. **模板管理**：模板 API + 列表页 + 上传。
4. **模板编辑器**：PdfViewer 组件 → TemplateEditor（拖拽/属性/保存）。
5. **填充引擎与发起**：fill.ts → /api/tasks POST → 动态表单发起页。
6. **审批与签署**：任务中心 → 详情页 → approve/reject → SignaturePad + 印章面板 → sign API(stamp.ts、版本推进、完成态) → 外部签署页 → 邮件通知接线。
7. **归档/审计/印章/用户管理**：归档页(预览+下载+版本) → 审计页 → 印章管理页 → 用户管理页。
8. **收尾**：全链路自测、ESLint 通过、README 运行说明（含 .env.example、docker 命令、种子账号表）。

## 验证方案

1. `docker compose up -d` 起 PG+MinIO；`npx prisma migrate dev`；`npm run db:seed`；`npm run dev`。
2. E2E 手工场景：管理员登录 → 上传空白 PDF 模板 → 编辑器拖入「姓名(文本)/日期/企业章/个人签名」字段并保存 → HR 用该模板发起任务（填表单，配置领导审批+本人企业章签署+外部候选人邮箱）→ 领导账号审批通过 → 企业章签署人盖章（检查 PDF 新版本已盖章+斜纹水印，原模板未动）→ 外部邮箱链接手写签署 → 任务 COMPLETED → 归档页预览/下载最终版 → 审计页可查全程记录 → EMPLOYEE 账号确认只能看到自己的文档。
3. 校验 PDF 中文渲染无空白（.notdef 抽检）、印章/签名坐标与编辑器所见一致。
