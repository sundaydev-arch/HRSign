# 产品需求规格（HRSign v0.x）与实现状态对照

> 开源、自托管、**单租户**企业内部人事电子签署与盖章系统。
> 本文按规格 0–20 节整理**可执行规则**，并标注当前代码实现状态（✅ / 🟡 / ⬜ / 🔒）。
> 状态核对时间：2026-09；依据：仓库实际代码与构建产物（31 条路由、98 个单测）。

## 0. 定位与免责

- 适用文档：Offer、入职证明、离职证明、劳动合同、在职证明、收入证明
- 阶段 1 = 可视化盖章 + 手写签名图片，**仅用于内部流程留痕，不是《电子签名法》意义上的可靠电子签名**；UI 盖章/签名面板必须有明显免责提示（中/英各一份）
- 术语：企业印章 = **Seal**；个人签署 = **Signature**，代码/DB/UI 不得混用
- 阶段 2 合规签名经 SignatureProvider 接入，合规结论由使用者、CA、法务负责

状态：🟡 定位与术语已落地（模型/枚举已区分 Seal/Signature）；盖章面板的显著免责提示需逐页审计。

## 1. 技术栈（版本锁定，升级需单独 PR）

Next.js 15（App Router）+ React 19、TailwindCSS + shadcn/ui（唯一 UI 库）、Prisma + PostgreSQL 16、pdf-lib + @pdf-lib/fontkit（后端）、pdfjs-dist（前端预览，禁 PDF 脚本）、S3 兼容存储（默认 MinIO，StorageProvider 抽象）、Auth.js（OIDC 主 / 账号密码辅）、zod（外部输入/环境变量/Json 字段全校验）、pg-boss（任务队列）、next-intl（zh-CN 默认 / en，ICU MessageFormat；日期数字用 Intl API，不引日期库）、Vitest + Playwright、GitHub Actions CI、全 TS strict + `noUncheckedIndexedAccess`、禁 `any`。

状态：🟡 除 pg-boss（未安装）、Playwright（未安装）、GitHub Actions（无 workflow）、OIDC（未接通）外均已就位；实际版本 Next 15.1.6 / React 19。

## 2. 核心抽象接口（`src/server/providers/`，业务只依赖接口）

| 接口                                                  | 阶段 1 实现                                           | 阶段 2                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| SignatureProvider：sign/verify                        | ✅ ImageSealProvider                                  | 🔒 PadesProvider、GmSm2Provider（空实现+文档）                               |
| IdentityVerifier：startVerification/checkResult       | ✅ EmailCodeVerifier（哈希存码/冷却/次数）            | 🔒 人脸/实名仅接口，不存生物信息                                             |
| Notifier：send(channel, recipient, template, payload) | ✅ Email(SMTP)，i18n 模板                             | 🟡 企微/钉钉/飞书（企微仅有 [wecom.ts](../../src/server/providers/notify/wecom.ts) 占位） |
| StorageProvider：put/get/presignGet/delete/exists     | ✅ MinioStorageProvider（presign 已实现但暂无调用方） | 可换 S3/OSS/COS                                                              |

## 3. 领域模型与状态机（`prisma/schema.prisma`）

### 3.1 模板（发布后不可变）

- Template（容器：name/category/locale）→ TemplateVersion（DRAFT/PUBLISHED/ARCHIVED）；字段属于版本；PUBLISHED 禁改，改动建新版本；Document 记录 templateVersionId
- 字段类型：TEXT、DATE、SEAL、SIGNATURE（🔒 PERFORATION_SEAL 骑缝章仅预留枚举）
- 坐标统一结构 `{ page, x, y, width, height, rotation }`，单位 PDF point；schema 注释为左下原点（当前编辑器存左上原点语义，待坐标转换模块统一）；前端 pdf.js ↔ 后端 pdf-lib 转换须封装为**纯函数模块并配单测** ⬜
- 坐标/规则存 Json 列，读写经 zod（✅）

状态：✅ 模型与版本不可变规则已实现（字段仅 DRAFT 可编辑）；🟡 坐标转换纯函数与单测未做。

### 3.2 文档版本（多版本不覆盖）

- Document → DocumentVersion，stage：FILLED / WATERMARKED / SEALED / SIGNED；每版存 storageKey、sha256、createdBy
- 管线固定：填充 → 水印 → 盖章 → 个人签名 →（阶段2）加密签名 → 只读锁定；加密签名后禁改

状态：🟡 多版本留存 ✅；实际只产生 FILLED 与 SIGNED 两版，**WATERMARKED/SEALED 中间版本未单独留痕**；锁定未实现。

### 3.3 两个独立状态机

- ApprovalStatus：DRAFT → PENDING → APPROVED | REJECTED | WITHDRAWN
- SigningStatus：NOT_STARTED → IN_PROGRESS → COMPLETED | DECLINED | EXPIRED | REVOKED
- Signer：PENDING → VIEWED → SIGNED | DECLINED；支持顺序签（order）/并行签；顺序签仅轮到者可操作
- 企业盖章要求 ApprovalStatus=APPROVED；转换集中在转换表，非法转换抛错，配完整单测

状态：✅ 三状态机 + 转换表 + 91 条单测全部就位（[state-machines](../../src/server/state-machines)）；⬜ 作废（REVOKED）无操作入口；VIEWED 状态暂无打点。

## 4. 外部签署人（无账号，非 RBAC 角色）

SigningToken 只存 sha256 哈希、带过期、可撤销；一次性链接 → 邮箱验证码 → 签署页；验证码次数限制 + 冷却；全程记录 IP/UA；签署后令牌失效；外部页为独立公开路由，只暴露该签署人有权文档。

状态：✅ 令牌哈希、过期、免登录页、签署后 usedAt 失效均已实现；🟡 邮箱验证码设施已建但外部签署流程当前直接凭 token 进入，验证码环节未串入主流程。

## 5. PDF 处理（只在后端，经队列异步）

中文必须嵌入字体（fontkit + Noto Sans SC 子集，字体随仓库 + OFL 许可）；文本溢出自动缩字号/多行可配；全局水印可配文案/透明度/角度；盖章/水印/填充都在加密签名之前；前端不改 PDF。

状态：🟡 中文字体嵌入 ✅（[font.ts](../../src/lib/pdf/font.ts)，NotoSansSC 在 public/fonts）、填充 ✅、盖章/水印 ✅、前端纯预览 ✅；**队列异步未实现，填充当前在 POST 请求内同步执行**；多行/自动缩小未配置化。

## 6. 认证与权限

Auth.js + OIDC（企微扫码可选预留）；RBAC 四角色：超级管理员 / HR / 部门负责人 / 普通员工；统一 `authorize(user, action, resource)`，前端只做展示控制；HR 全部模板单据、员工仅自己文档、部门负责人仅自己审批单据；权限矩阵必须有测试。

状态：🟡 Credentials 登录 + 后端 RBAC 矩阵（[rbac.ts](../../src/lib/rbac.ts)）已实现；OIDC ⬜；权限矩阵独立单测 ⬜（仅 e2e-smoke 反例覆盖）。

## 7. 异步任务（pg-boss）

任务：pdf-render、notify、expire-scan、retention-scan；全部幂等、可重试、有死信与管理页。

状态：⬜ pg-boss 未安装；当前过期靠 API 访问时惰性触发（expireDueTasks 内联多个路由）；无 worker、无死信、无任务管理页。

## 8. 审计与防篡改

AuditLog 只追加：prevHash + hash=sha256(prevHash + 规范化 JSON) 哈希链；DB 层禁 UPDATE/DELETE（触发器或权限）；记录操作人/时间/IP/设备/动作/资源/结果/文档 sha256；CLI `audit:verify` 校验整条链。

状态：🟡 哈希链写入已实现（[audit.ts](../../src/lib/audit.ts)，规范化 JSON 按键排序）；⬜ 禁改触发器、audit:verify CLI、并发行锁（当前极端并发可能断链，代码注释已声明）。

## 9. 数据保留与隐私

可配置保留年限（按分类）+ 法务冻结 legalHold；到期 retention-scan 软删除再彻底清除；敏感文档（收入证明/劳动合同）静态加密选项、下载动态水印（下载人+时间）；个人信息最小化，支持导出/删除请求；README 提示使用者自评估当地法规。

状态：⬜ schema 有 RetentionPolicy/legalHold 字段，应用层零实现；归档页文案仍写"永久归档"，与本节冲突（待改）。

## 10. 开放接口

REST + zod 生成 OpenAPI；API Key 鉴权；批量发起（CSV/JSON）对接 HR 系统；Webhook（HMAC）：任务创建/审批结果/签署完成/拒签/过期。

状态：⬜ 模型已建（ApiKey/Webhook/WebhookDelivery），无路由、无页面、无 OpenAPI、无批量接口。

## 11. 部署与配置

docker-compose 一键起 app/worker/postgres/minio（开发含 mailpit）；环境变量 zod 校验，缺失即启动失败；.env.example；健康检查、迁移命令、备份恢复说明；Helm 可选；说明 MinIO 服务端 AGPL-3.0、仅 S3 协议调用。

状态：🟡 docker-compose 仅 postgres+minio 两服务；.env.example 有；⬜ env zod 校验、health 端点、worker/mailpit、备份文档、Helm。

## 12. 安全

上传 PDF 校验魔数/大小上限，拒绝含 JavaScript、内嵌文件、Launch 动作的文件；预签名 URL 短有效期；公章原图仅后端读取；速率限制、CSRF、安全响应头与 CSP、依赖漏洞扫描（CI）；SECURITY.md。

状态：🟡 文件大小上限 ✅、预签名工具 ✅（未使用）、公章不经前端 ✅；⬜ 魔数/危险结构校验、限流、CSP/安全头、Origin 校验、依赖扫描、SECURITY.md 均缺。

## 13. 强制开发规范

① 前端只允许 shadcn+Tailwind，企业后台桌面布局；② 全 TS 强类型无 any，系统边界全 zod，禁对 Json 直接断言；③ PDF 逻辑只在后端；④ 盖章前置审批；⑤ 文件多版本不覆盖；⑥ 文案全 i18n，两语言同步提交，缺 key CI 失败；⑦ 不擅自引依赖。

状态：①✅ ②✅ ③✅ ④✅ ⑤✅ ⑥🟡（仅登录页接入 next-intl，其余页面/组件大量硬编码中文；key 检查脚本有但无 CI）⑦✅。

## 14. 页面清单（12 项）

| #   | 页面                                     | 状态                                                     |
| --- | ---------------------------------------- | -------------------------------------------------------- |
| 1   | 登录（OIDC/账号）与权限控制              | 🟡 仅账号密码；注册/找回密码待补                         |
| 2   | 模板列表 + 可视化编辑器（版本管理/发布） | ✅（发布/归档；新建版本入口未做）                        |
| 3   | 发起签署（动态表单 + 批量导入）          | 🟡 动态表单 ✅，批量导入 ⬜                              |
| 4   | 待审批 / 待签署任务中心                  | ✅                                                       |
| 5   | PDF 预览 + 手写签名 + 盖章面板           | 🟡 功能 ✅，免责提示/Type/Upload 三方式待补（spec 20.6） |
| 6   | 外部签署页（令牌+验证码）                | 🟡 令牌 ✅，验证码未串入                                 |
| 7   | 归档管理（保留策略+法务冻结）            | 🟡 列表/版本/下载 ✅，保留与冻结 ⬜                      |
| 8   | 审计日志页（含链校验状态）               | 🟡 列表 ✅，链校验状态 ⬜                                |
| 9   | 印章后台管理                             | ✅                                                       |
| 10  | 用户与角色管理                           | ✅                                                       |
| 11  | 系统设置（通知/存储/保留/水印/显示设置） | ⬜                                                       |
| 12  | API Key 与 Webhook 管理                  | ⬜                                                       |

## 15. 数据库模型（Prisma）

User、Role/Permission、Template、TemplateVersion、TemplateField、Document、DocumentVersion、SigningTask、Signer、SigningToken、Signature、ApprovalFlow、ApprovalRecord、Seal、AuditLog、RetentionPolicy、ApiKey、Webhook、WebhookDelivery、NotificationLog（另含 IdentityVerification、NotificationTemplate、User 显示设置字段等）。所有 Json 列配对 zod schema（✅ 见 [src/schemas/index.ts](../../src/schemas/index.ts)）。

状态：🟡 模型齐全；⬜ 无 Prisma migrations 目录（当前 db push 工作流），部分模型（ApiKey/Webhook/RetentionPolicy/ApprovalFlow）应用层未使用。

## 16. 测试

单测：状态机转换 ✅、坐标转换 ⬜、权限矩阵 ⬜、哈希链 ⬜、令牌校验 ⬜；中文填充 PDF 快照测试 ⬜；Playwright E2E（模板发布→发起→审批→盖章→签署→归档；外部签署）⬜（有 [e2e-smoke.mjs](../../scripts/e2e-smoke.mjs) 脚本，31 断言，非 Playwright）；CI 必过 lint/类型/测试 ⬜。

现状：Vitest 98 例（状态机 91 + i18n 7）。

## 17. 开源治理

LICENSE（默认 Apache-2.0）、THIRD_PARTY_LICENSES（CI 生成+许可证兼容检查）、README（免责/快速开始/架构图/扩展指南）、CONTRIBUTING、SECURITY、CODE_OF_CONDUCT、CHANGELOG、Issue/PR 模板、DEMO 印章明显标注且无真实公章。

状态：🟡 仅 README + .env.example；LICENSE 等其余文件 ⬜。

## 18. 开发阶段

- 阶段 0（地基）：仓库结构/compose/环境校验/Auth.js/Prisma 迁移/CI —— 🟡（迁移与 CI 缺）
- 阶段 1（MVP）：模板编辑器→填充引擎→状态机→图片盖章手写→权限审计归档→外部签署→API/Webhook —— 🟡（最后两项未做）
- 阶段 2：仅保接口与目录，PadesProvider/GmSm2Provider/人脸空实现+文档 —— 🔒 已按此执行

## 19. 工作方式

每次一个里程碑；先设计说明再代码；输出完整文件路径；第一个里程碑为 Prisma schema + zod + 两状态机（含转换表单测）+ 四 Provider 接口与阶段 1 骨架 —— ✅ 已交付。

## 20. 多语言与本地化 UI

- **20.1** zh-CN/en，Accept-Language 判定 + 顶栏切换，偏好存 User.locale，未登录存 cookie（cookie 名 `HR_SIGN_LOCALE`）；ICU MessageFormat；后端错误只回错误码；外部页/邮件/通知双语，语言优先级"签署人偏好→发起人指定→浏览器语言"。状态：🟡 基础设施与语言切换 ✅，消息覆盖极低；邮件模板双语 🟡
- **20.2** UI 语言与文档语言分离：Template.locale（zh-CN/en/bilingual）✅ 模型已加；PDF 字体按内容选择 🟡（仅 Noto Sans SC）
- **20.3** 排版：规定字体栈、中文行高 1.65–1.75、禁中文斜体/tracking、英文留长 30–50%、CSS 逻辑属性、密度切换（表格默认紧凑）。状态：⬜ 密度切换未做，逻辑属性未全面使用
- **20.4** 日期/时间/数字/金额全走 Intl；UTC 存储；12/24 小时制与周起始日可配；Calendar 传 locale；人民币大写金额（壹万贰仟元整）后端生成+单测。状态：🟡 formatDateTime 已封装；大写金额 ⬜
- **20.5** fullName 单字段为主（givenName/familyName/legalNameLatin 可选）；电话 E.164 + 区号默认 +86；证件类型枚举；地址中外两种模式；规则集中在 zod。状态：🟡 User 字段已备，表单/校验未落地
- **20.6** 签名三方式（Draw 手写 / Type 键入 / Upload 图片），国内默认手写；印章样式由模板字段决定（ROUND_CHINESE/TEXT_INTERNATIONAL/NONE）；PERFORATION_SEAL 预留；面板始终显示双语免责。状态：🟡 仅手写 Draw；Seal.style 枚举 ✅
- **20.7** 左导航+顶栏（语言/主题/用户菜单）+面包屑；表格操作列固定右侧、批量条顶部；状态"颜色+图标+文字"三重表达；浅色/深色主题跟随系统可切；WCAG 2.2 AA；隐私同意文案可配置。状态：🟡 导航/语言切换 ✅；深色/密度/面包屑/无障碍审计 ⬜
- **20.8** AuditLog 只存动作码+参数，与语言无关 ✅
- **20.9** CI 校验两份消息 key 一致（脚本 [check-i18n-keys.mjs](../../scripts/check-i18n-keys.mjs) ✅，CI ⬜）；伪本地化 en-XA ⬜；Playwright 双语跑 + 截图/溢出检测 ⬜；大写金额/时区/E.164/逻辑属性 lint 单测 ⬜
