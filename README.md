# HRSign — HR e-Sign Workflow

[English](#english) ｜ [中文](#中文)

**HRSign** is an open-source, self-hosted, **single-tenant** electronic signing and company-seal workflow system purpose-built for **internal HR documents**: offer letters, employment contracts, onboarding/offboarding certificates, employment certificates, and income certificates.

It provides visual PDF template authoring, approval workflows, image-based company seals, handwritten signatures, passwordless external signing, tamper-evident audit logs, and role-based access control.

> ⚠️ **Legal disclaimer:** Phase 1 delivers *visual seals + handwritten signature images* for internal process traceability only. It is **not** a "reliable electronic signature" under PRC e-signature law and carries no legal-validity guarantee. Phase 2 will plug in compliant providers (CA / PAdES / SM2) behind the existing `SignatureProvider` interface. Legal conclusions are the responsibility of the operator, the CA, and legal counsel.

---

<a id="english"></a>
# English

## What is HRSign?

HRSign turns a blank PDF into a controlled, auditable signing workflow:

1. **HR uploads a PDF template** and visually places text / date / seal / signature fields.
2. **A signing task is initiated** from a published version: dynamic form values are rendered server-side into a new immutable PDF version; approvers, seal holders, and signers (internal employees or external people with no account) are assigned in sequential or parallel order.
3. **Approval** is required before any company seal may be applied — enforced on the backend by the state machine, not just hidden in the UI.
4. **Signing**: internal users stamp an approved seal or draw a handwritten signature; external signers open a one-time, hashed email link and sign without an account.
5. **Archive**: every PDF version is stored separately (never overwritten) with SHA-256 hashes, and every action is appended to a hash-chained audit log.

## Target audience & use cases

- **Audience:** HR / operations / IT teams of companies that want to keep employee documents and signing data **on their own infrastructure**, without per-envelope SaaS fees.
- **Typical deployments:** intranet HR document flow, internal approvals with company seals, candidate/employee remote signing via email links.
- **Not a fit (yet):** legally-compliant qualified electronic signatures requiring CA certificates (Phase 2), multi-tenant SaaS, or customer-facing mass e-contracting.

## Positioning — how it differs

| | HRSign | Commercial e-sign SaaS (DocuSign, Fadada, eSignbao) | Generic PDF tools |
|---|---|---|---|
| Hosting | **Self-hosted, single-tenant, data stays in your VPC** | Vendor cloud | Local files |
| Cost | Open-source (Apache-2.0), no per-document fee | Per-seat / per-envelope | License / free |
| Focus | **HR document workflows + approval-before-seal** | General-purpose contracting | Manual editing |
| Extensibility | Provider interfaces for storage/identity/signature/notification | Vendor-defined | None |
| Audit | Hash-chained append-only log, multi-version retention | Vendor-held evidence | None |

## Feature status (Phase 1 / MVP)

**Implemented**

- Template management with a visual PDF field editor (pdf.js; drag, resize, paging) and immutable versioning: DRAFT → PUBLISHED → ARCHIVED
- Signing task initiation with dynamic forms; sequential and parallel flows; configurable expiry
- Two independent state machines — approval (`DRAFT/PENDING/APPROVED/REJECTED/WITHDRAWN`) and signing (`NOT_STARTED/IN_PROGRESS/COMPLETED/DECLINED/EXPIRED/REVOKED`) — with a single transition table and 90+ unit tests
- Backend-only PDF pipeline (pdf-lib): field filling with embedded **Noto Sans SC** subset, image seal stamping, global watermark; every stage is a new immutable file version with SHA-256
- Handwritten signature pad; company seal management (demo seals only — never ship a real company seal)
- External passwordless signing via one-time **hashed** tokens (revocable, expiring, single-use for signing) plus an email verification-code provider with cooldown and attempt limits
- RBAC: super admin / HR / department leader / employee; backend-enforced data scoping
- Append-only audit log with `SHA-256` hash chaining
- S3-compatible storage abstraction (MinIO by default; presigned URLs supported)
- Email (SMTP) notifications with i18n templates; pluggable Notifier interface
- Bilingual UI infrastructure: `zh-CN` / `en` via next-intl (Accept-Language + switcher + cookie; ICU MessageFormat)

**Roadmap** (see [docs/requirements/product-spec.md](./docs/requirements/product-spec.md) for authoritative status)

- pg-boss async jobs (PDF render, notify, expiry/retention scans), API Keys + HMAC webhooks + OpenAPI, batch (CSV/JSON) initiation
- Retention policies & legal holds; system settings page; OIDC SSO; compliant PAdES / SM2 signatures (Phase 2 interfaces already stubbed)
- Security hardening: CSP/security headers, rate limiting, malicious-PDF structure checks; CI pipeline; Prisma migration baseline

## Tech stack & requirements

- **Runtime:** Node.js **20 LTS+** (Node 18.18+ minimum), **pnpm 9**
- **Framework:** Next.js 15.1 (App Router) + React 19, TypeScript strict (`noUncheckedIndexedAccess`, no `any`)
- **UI:** Tailwind CSS + shadcn/ui only
- **Data:** PostgreSQL 16 + Prisma 6
- **Storage:** MinIO (S3-compatible; replaceable via `StorageProvider`)
- **PDF:** pdf-lib + @pdf-lib/fontkit (server), pdfjs-dist (client preview, scripts disabled)
- **Auth:** Auth.js (NextAuth v5 beta), credentials now; OIDC planned
- **Validation:** zod at every system boundary (API, forms, env, Prisma `Json` columns)
- **i18n:** next-intl; dates/numbers via `Intl` only
- **Tests:** Vitest (98 tests); Playwright planned

## Quick start

### Prerequisites by OS

You need **Node.js 20+**, **pnpm 9**, **Docker** (for PostgreSQL + MinIO), and `git`.

**macOS (Homebrew):**
```bash
brew install node@20 pnpm docker --cask docker
brew services start docker  # or open Docker Desktop manually
```

**Windows (winget / PowerShell):**
```powershell
winget install OpenJS.NodeJS.LTS
npm install -g pnpm@9
winget install Docker.DockerDesktop   # then start Docker Desktop once
```

**Linux (Debian/Ubuntu):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm@9
# Docker Engine: https://docs.docker.com/engine/install/ubuntu/
```

Verify:
```bash
node -v   # v20.x or higher
pnpm -v   # 9.x
docker -v
```

### 1. Get the code & install

```bash
git clone https://github.com/<your-org>/hrsign.git
cd hrsign
pnpm install          # also copies the pdf.js worker into public/
```

### 2. Start infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL 16 on host port **5433** and MinIO on **9000** (console **9001**, `minioadmin / minioadmin123`), and creates the `hrsign` bucket automatically.

### 3. Configure environment

```bash
cp .env.example .env
```

For local development the defaults work as-is. Before any non-local deployment, at minimum change `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`), database credentials, and MinIO keys. SMTP is optional — notifications are marked SKIPPED when unset.

### 4. Database & run

```bash
pnpm db:generate       # generate Prisma client
pnpm db:migrate        # create/upgrade schema
pnpm db:seed           # demo accounts + demo data

pnpm dev               # http://localhost:3000
# production:
pnpm build && pnpm start
```

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@hrsign.local` | `Admin@123456` |
| HR | `hr@hrsign.local` | `Hr@123456` |
| Department leader | `leader@hrsign.local` | `Leader@123456` |
| Employee | `employee@hrsign.local` | `Employee@123456` |

> Demo seals are clearly marked `DEMO SEAL`. Never place a real company seal in the repository.

## Usage walkthrough

**Upload & publish a template** — `Templates` → upload a blank PDF → drag fields onto the page → save (draft versions only are editable) → **Publish**.

**Initiate a task** — `Tasks` → new task → choose the published template → fill the dynamic fields → add approvers/seal holders/signers (external people just need a name + email) → set expiry → submit.

```bash
# The server renders values into a new PDF version, e.g.
# storage key: documents/<docId>/v1-FILLED.pdf   (sha256 recorded)
```

**Approve → seal → sign** — approvers act in order; the seal button is only honoured after full approval; external signers receive `http://localhost:3000/sign/external/<token>`.

**Verify quality gates locally**
```bash
pnpm lint
pnpm typecheck
pnpm test               # 98 unit tests (state machines + i18n)
pnpm test:coverage
pnpm build

node scripts/e2e-smoke.mjs            # 31-assertion HTTP smoke test (server must be running)
node scripts/check-i18n-keys.mjs      # en/zh-CN message key parity
```

## Configuration reference

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection (host port 5433 in compose) | `postgresql://hrsign:***@localhost:5433/hrsign` |
| `MINIO_ENDPOINT/PORT/USE_SSL` | S3 endpoint | `localhost / 9000 / false` |
| `MINIO_ACCESS_KEY/SECRET_KEY/BUCKET` | Credentials + bucket | `minioadmin / *** / hrsign` |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Canonical app URL / JWT secret | **change in production** |
| `AUTH_TRUST_HOST` | Trust forwarded host (proxy) | `true` |
| `APP_URL` | Base URL used in notification links | `http://localhost:3000` |
| `WATERMARK_TEXT` | Global watermark text on signed versions | `HRSign INTERNAL` |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | Email sending; empty = SKIPPED | — |

## Project layout

```
prisma/                 # schema (20+ models), seed
scripts/                # i18n key parity, pdf worker copy, e2e smoke
messages/               # next-intl message catalogs (zh-CN.json, en.json)
docs/                   # Requirements, code map, agent skills (knowledge base)
src/
  app/
    (auth)/login        # Login page
    (dashboard)/        # templates, tasks, archive, seals, audit-logs, admin/users
    api/                # Route handlers (the only trust boundary)
    sign/external/      # Public passwordless signing page
  components/           # ui/ (shadcn), pdf/, tasks/, sign/, layout/
  lib/                  # signing core, rbac, audit, notify, pdf engine, minio
  schemas/              # zod schemas paired with every Prisma Json column
  server/providers/     # Signature / Identity / Notifier / Storage interfaces + impls
  server/state-machines/# approval, signing, signer transition tables (+tests)
  auth.ts, auth.config.ts, middleware.ts
```

See [docs/architecture/code-map.md](./docs/architecture/code-map.md) for the full map and [docs/requirements/product-spec.md](./docs/requirements/product-spec.md) for the complete specification.

## Documentation for contributors

- [Contributing guide](./CONTRIBUTING.md) — dev setup, branch/commit conventions, PR workflow
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md) — vulnerability reporting
- [Changelog](./CHANGELOG.md)
- [docs/](./docs/README.md) — product requirements, architecture map, reusable engineering skills

## License

[Apache License 2.0](./LICENSE). Bundled **Noto Sans SC** is under the SIL Open Font License (OFL); see the font directory. **MinIO server is AGPL-3.0** — HRSign only calls it over the S3 protocol and you may substitute another S3-compatible store.

---

<a id="中文"></a>
# 中文

## 项目简介

HRSign 是一个开源、自托管、**单租户**的企业人事电子签署与盖章系统，面向 Offer、劳动合同、入职/离职证明、在职/收入证明等**内部人事文档**，提供 PDF 可视化模板、审批流、图片盖章、手写签名、外部免登录签署、哈希链审计与角色权限控制。

> ⚠️ **免责声明：** 阶段 1 为"可视化盖章 + 手写签名图片"，仅用于内部流程留痕，**不是**《电子签名法》意义上的可靠电子签名，不承诺法律效力。阶段 2 将通过 `SignatureProvider` 接口接入 CA / PAdES / 国密 SM2 等合规签名；合规结论由使用者、CA 与法务负责。

## 适用对象与场景

- **对象：** 希望把员工文档与签署数据保留在**自有基础设施**内、不按份付费的企业 HR / 运营 / IT 团队。
- **场景：** 内网人事文档流转、企业印章用印审批、候选人/员工邮件链接远程签署。
- **暂不适用：** 需 CA 证书的合规可靠电子签名（阶段 2）、多租户 SaaS、面向客户的大规模电子合同。

## 与同类方案的区别

| | HRSign | 商业电子签 SaaS（法大大/e签宝/DocuSign） | 通用 PDF 工具 |
|---|---|---|---|
| 部署 | **自托管单租户，数据不出内网** | 厂商云 | 本地文件 |
| 成本 | 开源 Apache-2.0，无按份费用 | 按账号/份计费 | 授权/免费 |
| 焦点 | **人事流程 + 先审批后用印** | 通用签约 | 手工编辑 |
| 扩展 | 存储/核验/签名/通知四类 Provider 接口 | 厂商定义 | 无 |
| 审计 | 哈希链只追加日志 + 多版本留存 | 厂商存证 | 无 |

## 功能状态（阶段 1 / MVP）

**已实现**

- 模板管理 + PDF 可视化字段编辑器（pdf.js 拖拽/缩放/翻页），版本不可变：草稿 → 已发布 → 已归档
- 动态表单发起签署任务；顺序签 / 并行签；过期时间可配
- 审批与签署两个独立状态机，转换集中于转换表，配套 90+ 单测；企业盖章必须审批通过，后端强校验
- PDF 处理只在后端（pdf-lib）：字段填充（嵌入 Noto Sans SC 子集）、图片盖章、全局水印；每次产物为不可覆盖的新版本并记录 SHA-256
- 手写签名板；印章后台管理（仅 DEMO SEAL，禁止入库真实公章）
- 外部免登录签署：一次性**哈希**令牌（可撤销、有过期、签署后失效）+ 邮箱验证码（冷却/次数限制）
- RBAC 四角色（超管/HR/部门负责人/员工），数据范围后端过滤
- 只追加的 SHA-256 哈希链审计日志
- S3 兼容存储抽象（默认 MinIO，支持预签名）
- SMTP 邮件通知（i18n 模板），通知渠道可插拔
- zh-CN / en 双语基础设施（next-intl：Accept-Language + 切换 + cookie，ICU MessageFormat）

**路线图**（权威状态见 [docs/requirements/product-spec.md](./docs/requirements/product-spec.md)）

- pg-boss 异步任务、API Key + HMAC Webhook + OpenAPI、CSV/JSON 批量发起
- 保留策略与法务冻结、系统设置页、OIDC 单点登录、PAdES / 国密 SM2（阶段 2，接口已留空实现）
- 安全加固：CSP/安全头、限流、恶意 PDF 结构校验；CI 流水线；Prisma 迁移基线

## 技术栈与环境要求

Node.js **20 LTS+**（最低 18.18）、**pnpm 9**、Docker（PostgreSQL + MinIO）、git。
Next.js 15.1（App Router）+ React 19、TS strict（noUncheckedIndexedAccess、禁 any）、Tailwind + shadcn/ui 唯一 UI 库、PostgreSQL 16 + Prisma 6、MinIO、pdf-lib（后端）/ pdfjs-dist（前端）、Auth.js、zod、next-intl、Vitest。

## 快速开始

**macOS：** `brew install node@20 pnpm`（Docker 用 Docker Desktop）
**Windows：** `winget install OpenJS.NodeJS.LTS` 后 `npm i -g pnpm@9`，安装 Docker Desktop
**Linux：** 通过 NodeSource 装 Node 20，`npm i -g pnpm@9`，另装 Docker Engine

```bash
git clone https://github.com/<your-org>/hrsign.git
cd hrsign
pnpm install            # 会自动复制 pdf.js worker 到 public/
docker compose up -d    # PostgreSQL:5433, MinIO:9000/9001
cp .env.example .env    # 本地默认配置可直接用；生产必须改密钥
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev                # http://localhost:3000
```

**演示账号**：`admin@hrsign.local / Admin@123456`、`hr@hrsign.local / Hr@123456`、`leader@hrsign.local / Leader@123456`、`employee@hrsign.local / Employee@123456`

## 使用流程

1. **模板**：模板管理 → 上传空白 PDF → 拖拽字段 → 保存（仅草稿可改）→ 发布
2. **发起**：签署任务 → 新建 → 选已发布模板 → 填动态字段 → 添加审批人/盖章人/签署人（外部仅需姓名+邮箱）→ 设过期时间
3. **审批→盖章→签署**：按顺序审批；全部通过后盖章才被后端接受；外部签署人收到 `/sign/external/<token>` 链接
4. **归档**：版本历史可预览/下载；全程哈希链审计

**质量门禁与脚本**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
node scripts/e2e-smoke.mjs            # 31 项断言全链路冒烟（需服务已启动）
node scripts/check-i18n-keys.mjs      # 中英文消息 key 一致性
```

环境变量、目录结构与文档链接同英文版（见上方 Configuration reference / Project layout）。

## 贡献与许可

[贡献指南](./CONTRIBUTING.md) ｜ [行为准则](./CODE_OF_CONDUCT.md) ｜ [安全策略](./SECURITY.md) ｜ [变更日志](./CHANGELOG.md) ｜ [知识库 docs/](./docs/README.md)

许可：[Apache-2.0](./LICENSE)。内嵌 Noto Sans SC 为 OFL 许可；MinIO 服务端为 AGPL-3.0，本项目仅通过 S3 协议调用，可替换为其他 S3 兼容存储。
