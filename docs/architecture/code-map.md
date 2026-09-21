# 代码与资源地图（Code Map）

> 用途：快速定位"某功能在哪改、数据从哪来到哪去"。所有路径相对仓库根，链接可点击。
> 约定：页面（Server/Client Component）→ API Route → lib 领域逻辑 → Prisma/Provider，是本项目统一的分层流向。

## 1. 运行时分层总览

```
浏览器
 ├─ (dashboard)/* 内部页面  ── middleware.ts 边缘会话校验（auth.config.ts，不含 Prisma）
 ├─ (auth)/login           ── 已登录自动跳转 /tasks
 └─ /sign/external/[token] ── 公开免登录（matcher 白名单）
        │  fetch（src/lib/client.ts 封装）
        ▼
Next.js Route Handlers（src/app/api/**）  ← 系统边界：zod 校验 + requireApiUser/ApiError + recordAudit
        │
        ▼
领域逻辑层  src/lib/*（signing/tasks/audit/rbac/notify/pdf…）
        │
        ├─ Prisma（src/lib/prisma.ts）──────── PostgreSQL 16
        └─ Providers（src/server/providers）── MinIO(S3) / SMTP / 阶段2签名
```

关键边界规则：**API 层是唯一信任边界**；页面/组件不直接访问 Prisma（除 Server Component 读只读数据，如模板编辑页）；PDF 修改只能出现在 lib/pdf 与 providers/signature。

## 2. 前端资源

### 2.1 页面（src/app）

| 路由                     | 文件                                                                                     | 类型          | 职责                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- | ------------- | --------------------------------------- |
| `/login`                 | [(auth)/login/page.tsx](<../../src/app/(auth)/login/page.tsx>)                           | Client        | 账号密码登录（next-auth/react signIn）  |
| 布局                     | [(auth)/layout.tsx](<../../src/app/(auth)/layout.tsx>)                                   | Server        | 认证页居中外壳、语言切换、已登录重定向  |
| `/tasks`                 | [tasks/page.tsx](<../../src/app/(dashboard)/tasks/page.tsx>)                             | Client        | 任务中心（待审批/待签署/我发起/全部）   |
| `/tasks/new`             | [tasks/new/page.tsx](<../../src/app/(dashboard)/tasks/new/page.tsx>)                     | Server        | 取最新 PUBLISHED 模板版本，渲染发起表单 |
| `/tasks/[id]`            | [tasks/[id]/page.tsx](<../../src/app/(dashboard)/tasks/[id]/page.tsx>)                   | Server        | 任务详情外壳（Next 15 async params）    |
| `/templates`             | [templates/page.tsx](<../../src/app/(dashboard)/templates/page.tsx>)                     | Client        | 模板列表、上传、发布/归档               |
| `/templates/[id]/edit`   | [templates/[id]/edit/page.tsx](<../../src/app/(dashboard)/templates/[id]/edit/page.tsx>) | Server        | 可视化字段编辑器载体                    |
| `/archive`               | [archive/page.tsx](<../../src/app/(dashboard)/archive/page.tsx>)                         | Client        | 归档文档、版本历史弹层、下载            |
| `/seals`                 | [seals/page.tsx](<../../src/app/(dashboard)/seals/page.tsx>)                             | Client        | 印章上传/启停/重命名                    |
| `/audit-logs`            | [audit-logs/page.tsx](<../../src/app/(dashboard)/audit-logs/page.tsx>)                   | Client        | 哈希链审计日志查看                      |
| `/admin/users`           | [admin/users/page.tsx](<../../src/app/(dashboard)/admin/users/page.tsx>)                 | Client        | 用户与角色管理                          |
| `/sign/external/[token]` | [sign/external/[token]/page.tsx](../../src/app/sign/external/[token]/page.tsx)           | Server→Client | 外部免登录签署页                        |
| 仪表盘外壳               | [(dashboard)/layout.tsx](<../../src/app/(dashboard)/layout.tsx>)                         | —             | 侧边栏 + 顶栏                           |
| 根布局/全局样式          | [layout.tsx](../../src/app/layout.tsx) / [globals.css](../../src/app/globals.css)        | Server        | next-intl Provider、字体、主题 token    |

### 2.2 业务组件（src/components）

| 组件                       | 文件                                                                      | 说明                                                      |
| -------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| TaskList                   | [tasks/TaskList.tsx](../../src/components/tasks/TaskList.tsx)             | 双状态 Badge（审批+签署）列表                             |
| TaskDetail                 | [tasks/TaskDetail.tsx](../../src/components/tasks/TaskDetail.tsx)         | 审批/盖章/手写签名操作面板                                |
| TaskCreateForm             | [tasks/TaskCreateForm.tsx](../../src/components/tasks/TaskCreateForm.tsx) | 动态字段表单 + 内外部签署人配置                           |
| TemplateEditor             | [pdf/TemplateEditor.tsx](../../src/components/pdf/TemplateEditor.tsx)     | pdf.js 画布、拖拽/缩放字段、坐标经 CoordinatesSchema 解包 |
| PdfViewer                  | [pdf/PdfViewer.tsx](../../src/components/pdf/PdfViewer.tsx)               | 只读 PDF 预览（禁用脚本）                                 |
| SignaturePad               | [pdf/SignaturePad.tsx](../../src/components/pdf/SignaturePad.tsx)         | 手写签名板（canvas，输出 dataURL）                        |
| ExternalSign               | [sign/ExternalSign.tsx](../../src/components/sign/ExternalSign.tsx)       | 外部签署完整交互                                          |
| Sidebar / LanguageSwitcher | [layout/](../../src/components/layout)                                    | 导航与语言切换                                            |
| UI 基础件                  | [components/ui/](../../src/components/ui)                                 | shadcn 23 个组件（含 form.tsx = react-hook-form 集成）    |

### 2.3 前端基础设施

- API 客户端：[src/lib/client.ts](../../src/lib/client.ts)（`api()` fetch 封装，错误抛 Error message）
- 展示文案映射：[src/lib/labels.ts](../../src/lib/labels.ts)（状态枚举→中文标签/Variant；**长期应迁入 i18n 消息**）
- i18n：[src/i18n/config.ts](../../src/i18n/config.ts)（locale、cookie、Accept-Language 解析）、[request.ts](../../src/i18n/request.ts)；消息 [messages/zh-CN.json](../../messages/zh-CN.json) / [en.json](../../messages/en.json)
- 静态资源：[public/fonts/NotoSansSC-Regular.otf](../../public/fonts)（PDF 嵌入字体 + OFL）、`public/pdf.worker.min.mjs`（构建前由 [copy-pdf-worker.mjs](../../scripts/copy-pdf-worker.mjs) 复制）

## 3. 后端资源

### 3.1 API 路由（src/app/api，全部 Node runtime 按需声明）

| 路由                                  | 方法             | 文件                                                                             | 职责                                                                                      |
| ------------------------------------- | ---------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/api/tasks`                          | GET/POST         | [route.ts](../../src/app/api/tasks/route.ts)                                     | 任务列表（按 tab 鉴权过滤）；发起任务（建 Document+v1 填充 PDF+Signer+外部令牌+通知）     |
| `/api/tasks/[id]`                     | GET              | [route.ts](../../src/app/api/tasks/[id]/route.ts)                                | 任务详情聚合（双状态/版本/签署人/审批记录/签名，字段坐标解包）                            |
| `/api/tasks/[id]/approve`             | POST             | [approve/route.ts](../../src/app/api/tasks/[id]/approve/route.ts)                | 审批通过（事务：Signer→SIGNED、ApprovalRecord、最后一人触发 APPROVED+IN_PROGRESS）        |
| `/api/tasks/[id]/reject`              | POST             | [reject/route.ts](../../src/app/api/tasks/[id]/reject/route.ts)                  | 驳回（DECLINED + declinedReason，任务 REJECTED）                                          |
| `/api/tasks/[id]/sign`                | POST             | [sign/route.ts](../../src/app/api/tasks/[id]/sign/route.ts)                      | 内部登录签 或 token 签（findSignerByToken 哈希校验），executeSign                         |
| `/api/sign/external/[token]`          | GET/POST         | [route.ts](../../src/app/api/sign/external/[token]/route.ts)                     | 外部只读数据/免登录签署；成功后令牌 usedAt                                                |
| `/api/files/[...key]`                 | GET              | [route.ts](../../src/app/api/files/[...key]/route.ts)                            | 唯一文件出口：按前缀（templates/documents/seals/signatures）鉴权，支持 `?token=` 外部只读 |
| `/api/templates`                      | GET/POST         | [route.ts](../../src/app/api/templates/route.ts)                                 | 列表映射形状；上传（pdf-lib 数页、sha256、建 Template+v1 DRAFT）                          |
| `/api/templates/[id]`                 | GET/PATCH/DELETE | [route.ts](../../src/app/api/templates/[id]/route.ts)                            | 改名/分类；版本状态（发布/归档）；DELETE=全版本归档                                       |
| `/api/templates/[id]/fields`          | PUT              | [fields/route.ts](../../src/app/api/templates/[id]/fields/route.ts)              | 仅 DRAFT 版本可整存字段（deleteMany+createMany，坐标包 Json）                             |
| `/api/documents`                      | GET              | [route.ts](../../src/app/api/documents/route.ts)                                 | 归档列表（HR 全量/其他人本人相关）                                                        |
| `/api/seals`、`/api/seals/[id]`       | GET/POST/PATCH   | [seals/](../../src/app/api/seals)                                                | 印章 CRUD（style/sha256/尺寸）                                                            |
| `/api/users`、`/api/admin/users/[id]` | GET/PATCH        | [users/](../../src/app/api/users)、[admin/users/](../../src/app/api/admin/users) | 用户列表 / 超管改角色状态                                                                 |
| `/api/audit-logs`                     | GET              | [route.ts](../../src/app/api/audit-logs/route.ts)                                | 审计分页查询                                                                              |
| `/api/auth/[...nextauth]`             | ALL              | [route.ts](../../src/app/api/auth/[...nextauth]/route.ts)                        | NextAuth 处理器                                                                           |

### 3.2 领域逻辑（src/lib）

| 模块          | 文件                                       | 职责                                                                                                                                        |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 签署核心      | [signing.ts](../../src/lib/signing.ts)     | `executeSign` + `loadTaskForSign`，内外部签署共用；通过 `getSignatureProvider()` 生成新版本与签名记录，通过 `getStorage()` 取印章；水印参数 |
| 任务状态辅助  | [tasks.ts](../../src/lib/tasks.ts)         | `getCurrentSigners`（顺序签轮次判定）、惰性过期                                                                                             |
| 权限          | [rbac.ts](../../src/lib/rbac.ts)           | SessionUser、ROLE_OPTIONS、`requireApiUser/requirePageUser`、`isManagerRole`                                                                |
| 审计          | [audit.ts](../../src/lib/audit.ts)         | 规范化 JSON + 哈希链只追加写入                                                                                                              |
| API 工具      | [api.ts](../../src/lib/api.ts)             | `ApiError(错误码语义)`、handleApiError、getClientIp/getUserAgent                                                                            |
| PDF 填充      | [pdf/fill.ts](../../src/lib/pdf/fill.ts)   | FillField 扁平化字段、FILLABLE_TYPES、溢出处理                                                                                              |
| PDF 字体      | [pdf/font.ts](../../src/lib/pdf/font.ts)   | Noto Sans SC 嵌入（fontkit）                                                                                                                |
| PDF 盖章/水印 | [pdf/stamp.ts](../../src/lib/pdf/stamp.ts) | `stampPdf` 图片章 + StampOptions（纯引擎，无存储/Provider 依赖）                                                                            |
| DB            | [prisma.ts](../../src/lib/prisma.ts)       | PrismaClient 单例                                                                                                                           |
| 标签          | [labels.ts](../../src/lib/labels.ts)       | 枚举中文标签与 Badge variant                                                                                                                |

### 3.3 Provider 层（src/server/providers，业务只依赖 ../types 接口）

- 注册表/工厂：[index.ts](../../src/server/providers/index.ts)（register/getXxx、registerStage1Defaults、阶段2注册）
- 接口定义：[types.ts](../../src/server/providers/types.ts)
- 签名：[signature/image-seal.ts](../../src/server/providers/signature/image-seal.ts)（阶段1）、[pades.ts](../../src/server/providers/signature/pades.ts) / [gm-sm2.ts](../../src/server/providers/signature/gm-sm2.ts)（🔒 空实现）
- 身份核验：[identity/email-code.ts](../../src/server/providers/identity/email-code.ts)（生成/哈希/冷却/次数/常数时间比较）、[identity/index.ts](../../src/server/providers/identity/index.ts)（🔒 人脸/实名空类）
- 通知：[notify/email.ts](../../src/server/providers/notify/email.ts)（`EmailNotifier` + `sendEmail` SMTP 传输，未配置 SMTP 时 SKIPPED 落库）、[notify/wecom.ts](../../src/server/providers/notify/wecom.ts)（企微占位）
- 存储：[storage/minio.ts](../../src/server/providers/storage/minio.ts)（put/get/presignGet 60–3600s 钳制/delete/exists，put 默认禁覆盖）
- 任务事件编排：[../notifications/task-events.ts](../../src/server/notifications/task-events.ts)（created/approved/rejected/completed 邮件组装；可查 Prisma，通过 `sendEmail` 发送，不属于 Provider 抽象）

> 历史上的 `lib/minio.ts`、`lib/notify/*`、`lib/pdf/signer/*` 已合并进 Provider 层（0.2.0），业务代码统一从 `@/server/providers` 取工厂，不再直连 S3 客户端或自建签名插槽。

### 3.4 状态机（src/server/state-machines，纯函数可单测）

[approval.ts](../../src/server/state-machines/approval.ts)、[signing.ts](../../src/server/state-machines/signing.ts)、[signer.ts](../../src/server/state-machines/signer.ts) + `__tests__/`，外加 i18n locale 单测，共 4 个测试文件 98 例。**改任何状态流转先改转换表**，禁止在路由里写临时状态判断。

### 3.5 zod schemas（src/schemas，Prisma Json 列的唯一合法读写口）

[coordinates.ts](../../src/schemas/coordinates.ts)、[template-field.ts](../../src/schemas/template-field.ts)、[field-values.ts](../../src/schemas/field-values.ts)、[watermark.ts](../../src/schemas/watermark.ts)、[audit-detail.ts](../../src/schemas/audit-detail.ts)、[webhook-payload.ts](../../src/schemas/webhook-payload.ts)、[notification.ts](../../src/schemas/notification.ts)、[signature.ts](../../src/schemas/signature.ts)、[label-i18n.ts](../../src/schemas/label-i18n.ts)，统一出口 [index.ts](../../src/schemas/index.ts)。

## 4. 数据层

- Schema 全量：[prisma/schema.prisma](../../prisma/schema.prisma)（20+ 模型；Json 列均有对应 zod；枚举含 UserRole/ApprovalStatus/SigningStatus/SignerStatus/SignerRole/FieldType/DocumentVersionStage/SignatureMethod/SealStyle 等）
- 种子：[prisma/seed.ts](../../prisma/seed.ts)（4 个演示角色账号 + DEMO 数据）
- 当前迁移工作流：db push（**无 migrations 目录，待基线化**）

## 5. 核心数据流

### 5.1 发起 → 填充

`POST /api/tasks` → zod 校验 → 查最新 PUBLISHED TemplateVersion（含 fields）→ 创建 Document/SigningTask → `fillTemplate()` 同步生成 v1（stage=FILLED，key=`documents/{docId}/v1-FILLED.pdf`，算 sha256）→ 建 Signer（顺序 order）→ 外部签署人建 SigningToken（仅存哈希，明文经 Map 传通知层）→ 通知 → 返回 taskId。

### 5.2 审批 → 盖章 → 签署

approve/reject 在单事务内改 Signer + 写 ApprovalRecord（fromStatus/toStatus/ip/ua）→ 最后审批人把任务置 APPROVED+IN_PROGRESS；sign 路由校验"轮到我/状态合法"→ `executeSign` 经 ImageSealProvider 读源版本 bytes、stampPdf、写新 DocumentVersion（不覆盖）+ Signature 记录 → 全部签署完置 COMPLETED。

### 5.3 外部免登录

邮件链接 `/sign/external/{plainToken}` → 页面 GET 带 token → 后端 sha256(token) 查 SigningToken（查 revoked/used/expires）→ join 出仅该签署人可见数据 → 文件经 `/api/files/...?token=` 同哈希校验只读 → POST 签署成功后写 usedAt。**已用令牌仍可只读查看，防重复签署靠 Signer 状态机。**

## 6. 配置与工程文件

| 文件                                                                                                                                 | 作用                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [.env.example](../../.env.example)                                                                                                   | 环境变量样板（DB/MinIO/SMTP/AUTH_SECRET/WATERMARK_TEXT…）                                                                                                   |
| [docker-compose.yml](../../docker-compose.yml)                                                                                       | postgres:16（宿主 5433）+ minio（9000/9001）+ 建桶 init                                                                                                     |
| [next.config.mjs](../../next.config.mjs) / [tailwind.config.ts](../../tailwind.config.ts) / [components.json](../../components.json) | Next / Tailwind / shadcn 配置                                                                                                                               |
| [tsconfig.json](../../tsconfig.json) / [.eslintrc.json](../../.eslintrc.json) / [vitest.config.ts](../../vitest.config.ts)           | strict + noUncheckedIndexedAccess / next 规则 / 单测                                                                                                        |
| [middleware.ts](../../src/middleware.ts)                                                                                             | 会话保护 matcher（白名单：login、api/auth、api/sign/external、api/files、sign/external、静态资源）                                                          |
| scripts/                                                                                                                             | [e2e-smoke.mjs](../../scripts/e2e-smoke.mjs)（31 断言冒烟）、[check-i18n-keys.mjs](../../scripts/check-i18n-keys.mjs)（两语言 key 一致性）、copy-pdf-worker |

## 7. 已知架构债（改动前必读）

1. PDF 填充在请求线程内同步执行（队列未落地）——见需求文档第 7 节
2. 文件全量经 Next 路由代理，presignGet 已实现未启用
3. 无 CI、无 Prisma migration、无安全头/限流
4. 大量 UI 硬编码中文，labels.ts 为过渡方案
5. DocumentVersion 实际只落 FILLED/SIGNED，中间 stage 未留痕
6. 根 README 部分描述已过时（写 Next 14 / 13 模型 / npm 命令），以本图与 package.json、schema.prisma 为准
