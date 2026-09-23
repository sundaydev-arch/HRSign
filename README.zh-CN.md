# HRSign — 人事电子签章工作流

[English](./README.md) ｜ [中文](./README.zh-CN.md)

**HRSign** 是一个开源、自托管、**单租户**的企业人事电子签署与盖章系统，面向 Offer、劳动合同、入职/离职证明、在职/收入证明等**内部人事文档**，提供 PDF 可视化模板、审批流、图片盖章、手写签名、外部免登录签署、哈希链审计与角色权限控制。

> ⚠️ **免责声明：** 阶段 1 为「可视化盖章 + 手写签名图片」，仅用于内部流程留痕，**不是**《电子签名法》意义上的可靠电子签名，不承诺法律效力。阶段 2 将通过 `SignatureProvider` 接口接入 CA / PAdES / 国密 SM2 等合规签名；合规结论由使用者、CA 与法务负责。

## 多后端（开源）

**交付顺序（锁定）：** 先 Next.js → 再 Python → 再 Go。  
Py/Go **独立实现**同一 OpenAPI，**永不调用** Next。契约见 [`packages/contracts`](./packages/contracts)。

| 后端 | 路径 | 角色 |
|------|------|------|
| **Next.js** | [`apps/web`](./apps/web) | UI + 持久化 `/api/v1`（Prisma）— 主实现 |
| **Python** | [`apps/api-py`](./apps/api-py) | FastAPI 契约端口（当前内存实现） |
| **Go** | [`apps/api-go`](./apps/api-go) | Go 契约端口（当前内存实现） |

能力矩阵：[FEATURE_MATRIX.md](./packages/contracts/FEATURE_MATRIX.md)。  
架构说明：[docs/architecture/multi-backend.md](./docs/architecture/multi-backend.md)。

```bash
# 可选：让前端指向兄弟后端
# NEXT_PUBLIC_API_BASE=http://localhost:8000/v1
pnpm contract:test
```

## 项目简介

HRSign 把一份空白 PDF 变成可控、可审计的签署流程：

1. **HR 上传 PDF 模板**，可视化放置文本 / 日期 / 印章 / 签名域。
2. **基于已发布版本发起签署任务**：动态表单值在服务端渲染为新的不可变 PDF 版本；按顺序或并行分配审批人、盖章人与签署人（内部员工或无账号的外部人员）。
3. **审批通过后才能用印** —— 由后端状态机强制校验，不只是前端隐藏按钮。
4. **签署**：内部用户盖章或手写签名；外部签署人打开一次性哈希邮件链接，免登录签署。
5. **归档**：每个 PDF 版本单独存储（永不覆盖）并记录 SHA-256；每次操作追加到哈希链审计日志。

## 适用对象与场景

- **对象：** 希望把员工文档与签署数据保留在**自有基础设施**内、不按份付费的企业 HR / 运营 / IT 团队。
- **场景：** 内网人事文档流转、企业印章用印审批、候选人/员工邮件链接远程签署。
- **暂不适用：** 需 CA 证书的合规可靠电子签名（阶段 2）、多租户 SaaS、面向客户的大规模电子合同。

## 与同类方案的区别

|      | HRSign                                      | 商业电子签 SaaS（法大大 / e签宝 / DocuSign） | 通用 PDF 工具 |
| ---- | ------------------------------------------- | -------------------------------------------- | ------------- |
| 部署 | **自托管单租户，数据不出内网**              | 厂商云                                       | 本地文件      |
| 成本 | 开源 Apache-2.0，无按份费用                 | 按账号 / 份计费                              | 授权 / 免费   |
| 焦点 | **人事流程 + 先审批后用印**                 | 通用签约                                     | 手工编辑      |
| 扩展 | 存储 / 核验 / 签名 / 通知四类 Provider 接口 | 厂商定义                                     | 无            |
| 审计 | 哈希链只追加日志 + 多版本留存               | 厂商存证                                     | 无            |

## 功能状态（阶段 1 / MVP）

**已实现**

- 模板管理 + PDF 可视化字段编辑器（pdf.js 拖拽 / 缩放 / 翻页），版本不可变：草稿 → 已发布 → 已归档
- 动态表单发起签署任务；顺序签 / 并行签；过期时间可配
- 审批与签署两个独立状态机，转换集中于转换表，配套 90+ 单测；企业盖章必须审批通过，后端强校验
- PDF 处理只在后端（pdf-lib）：字段填充（嵌入 Noto Sans SC 子集）、图片盖章、全局水印；每次产物为不可覆盖的新版本并记录 SHA-256
- 手写签名板；印章后台管理（仓库内为合成图样，禁止入库真实公章）
- 外部免登录签署：一次性**哈希**令牌 + 签署前邮箱验证码
- RBAC 四角色（超管 / HR / 部门负责人 / 员工），数据范围后端过滤
- 只追加的 SHA-256 哈希链审计日志（`pnpm audit:verify`）
- S3 兼容存储抽象（默认 MinIO，支持预签名）
- SMTP 邮件通知（i18n 模板），通知渠道可插拔
- zh-CN / en 双语基础设施（next-intl）
- Docker 一键部署（`Dockerfile` + compose `app`/`worker`/`mailpit`）、`/api/health`、zod 环境校验、Prisma 迁移基线
- API Key + HMAC Webhook + OpenAPI + 批量发起；管理端密钥 / Webhook / 设置页
- pg-boss Worker（通知重试、过期扫描、保留扫描）；归档法律保留开关
- 可选 OIDC SSO；CSP/安全头；进程内限流；PDF 上传启发式检查；GitHub Actions CI

**路线图**（权威状态见 [docs/requirements/product-spec.md](./docs/requirements/product-spec.md)）

- 合规 PAdES / 国密 SM2（阶段 2，接口已留空实现）
- 多租户 SaaS / Helm

## 技术栈与环境要求

- **运行时：** Node.js **20 LTS+**（最低 18.18）、**pnpm 9**
- **框架：** Next.js 15.1（App Router）+ React 19，TypeScript strict（`noUncheckedIndexedAccess`，禁 `any`）
- **UI：** 仅 Tailwind CSS + shadcn/ui
- **数据：** PostgreSQL 16 + Prisma 6
- **存储：** MinIO（S3 兼容，可通过 `StorageProvider` 替换）
- **PDF：** pdf-lib + @pdf-lib/fontkit（服务端），pdfjs-dist（客户端预览，禁用脚本）
- **认证：** Auth.js（NextAuth v5 beta），当前为账号密码，OIDC 规划中
- **校验：** 系统边界统一用 zod（API、表单、环境变量、Prisma `Json` 列）
- **i18n：** next-intl；日期 / 数字仅用 `Intl`
- **测试：** Vitest（98 例）；Playwright 规划中

另需 Docker（PostgreSQL + MinIO）与 git。

## 快速开始

### 按系统准备环境

需要 **Node.js 20+**、**pnpm 9**、**Docker**（PostgreSQL + MinIO）和 `git`。

**macOS（Homebrew）：**

```bash
brew install node@20 pnpm docker --cask docker
brew services start docker  # 或手动打开 Docker Desktop
```

**Windows（winget / PowerShell）：**

```powershell
winget install OpenJS.NodeJS.LTS
npm install -g pnpm@9
winget install Docker.DockerDesktop   # 安装后先启动一次 Docker Desktop
```

**Linux（Debian / Ubuntu）：**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm@9
# Docker Engine: https://docs.docker.com/engine/install/ubuntu/
```

验证：

```bash
node -v   # v20.x 或更高
pnpm -v   # 9.x
docker -v
```

### 1. 获取代码并安装

```bash
git clone https://github.com/<your-org>/hrsign.git
cd hrsign
pnpm install            # 会自动复制 pdf.js worker 到 public/
```

### 2. 启动基础设施

```bash
docker compose up -d
```

启动 PostgreSQL 16（宿主端口 **5433**）与 MinIO（**9000**，控制台 **9001**，`minioadmin / minioadmin123`），并自动创建 `hrsign` 桶。

### 3. 配置环境变量

```bash
cp .env.example .env
# Next 只从 apps/web 加载环境变量，需链接一次：
ln -sf ../../.env apps/web/.env
```

本地开发可直接使用默认值。非本地部署前至少更换 `NEXTAUTH_SECRET`（可用 `openssl rand -base64 32` 生成）、数据库凭据与 MinIO 密钥。SMTP 可选 —— 未配置时通知标记为 SKIPPED，不阻塞业务。

### 4. 数据库与启动

```bash
pnpm db:generate       # 生成 Prisma Client
pnpm db:migrate        # 创建 / 升级 schema
pnpm db:seed           # 演示账号与演示数据

pnpm dev               # http://localhost:3000
# 生产：
pnpm build && pnpm start
```

### 演示账号

| 角色       | 邮箱                    | 密码              |
| ---------- | ----------------------- | ----------------- |
| 超级管理员 | `admin@hrsign.local`    | `Admin@123456`    |
| HR         | `hr@hrsign.local`       | `Hr@123456`       |
| 部门负责人 | `leader@hrsign.local`   | `Leader@123456`   |
| 员工       | `employee@hrsign.local` | `Employee@123456` |

> 种子数据以虚构公司「云启信息科技」呈现，界面无「演示」标签；仓库内印章为合成图样，切勿提交真实公章。

完整剧本与功能对照见 **[docs/DEMO.md](./docs/DEMO.md)**。种子后负责人可见待审批任务 **录用通知 — 周婉清 · 产品经理**。

## 使用流程

1. **模板**：模板管理 → 上传空白 PDF → 拖拽字段 → 保存（仅草稿可改）→ 发布
2. **发起**：签署任务 → 新建 → 选已发布模板 → 填动态字段 → 添加审批人 / 盖章人 / 签署人（外部仅需姓名 + 邮箱）→ 设过期时间
3. **审批 → 盖章 → 签署**：按顺序审批；全部通过后盖章才被后端接受；外部签署人收到 `/sign/external/<token>` 链接
4. **归档**：版本历史可预览 / 下载；全程哈希链审计

**质量门禁与脚本**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build

node scripts/e2e-smoke.mjs            # 31 项断言全链路冒烟（需服务已启动）
node scripts/check-i18n-keys.mjs      # 中英文消息 key 一致性
```

## 配置参考

| 变量                                   | 用途                                     | 示例                                            |
| -------------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| `DATABASE_URL`                         | PostgreSQL 连接（compose 宿主端口 5433） | `postgresql://hrsign:***@localhost:5433/hrsign` |
| `MINIO_ENDPOINT/PORT/USE_SSL`          | S3 端点                                  | `localhost / 9000 / false`                      |
| `MINIO_ACCESS_KEY/SECRET_KEY/BUCKET`   | 凭据 + 桶                                | `minioadmin / *** / hrsign`                     |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET`     | 应用规范 URL / JWT 密钥                  | **生产必须更换**                                |
| `AUTH_TRUST_HOST`                      | 信任反向代理转发的 Host                  | `true`                                          |
| `APP_URL`                              | 通知链接使用的基础 URL                   | `http://localhost:3000`                         |
| `WATERMARK_TEXT`                       | 已签署版本的全局水印文案                 | `HRSign INTERNAL`                               |
| `NEXT_PUBLIC_API_BASE`                 | 可选 Envelope API 覆盖（Py/Go）          | 空 = Next `/api/v1`                             |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | 发信；留空则 SKIPPED                     | —                                               |

## 目录结构

```
apps/web/               # Next.js UI + /api + /api/v1 Envelope API
apps/api-py/            # Python FastAPI Envelope API（独立）
apps/api-go/            # Go Envelope API（独立）
packages/contracts/     # OpenAPI、SQL、FEATURE_MATRIX、状态机
packages/sdk-ts/        # TypeScript /v1 客户端
prisma/                 # schema + 迁移 + seed（供 apps/web 使用）
scripts/                # contract:test、i18n、e2e、pdf worker
docs/                   # 需求、架构、工程技能
```

完整地图见 [docs/architecture/code-map.md](./docs/architecture/code-map.md) 与 [docs/architecture/multi-backend.md](./docs/architecture/multi-backend.md)，规格见 [docs/requirements/product-spec.md](./docs/requirements/product-spec.md)。

## 贡献与文档

- [贡献指南](./CONTRIBUTING.md) — 开发环境、分支 / 提交约定、PR 流程
- [行为准则](./CODE_OF_CONDUCT.md)
- [安全策略](./SECURITY.md) — 漏洞报告
- [变更日志](./CHANGELOG.md)
- [知识库 docs/](./docs/README.md) — 产品需求、架构地图、可复用工程技能

## 许可

[Apache License 2.0](./LICENSE)。内嵌 **Noto Sans SC** 为 SIL Open Font License（OFL）；**MinIO 服务端为 AGPL-3.0** —— 本项目仅通过 S3 协议调用，可替换为其他 S3 兼容存储。
