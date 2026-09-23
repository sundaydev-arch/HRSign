# HRSign 演示手册

一键准备演示数据（需 **Postgres + MinIO + worker** 已启动）：

```bash
# App 依赖的基础设施 + 后台 worker（通知重试、过期扫描、保留扫描）
docker compose up -d postgres minio minio-init worker
pnpm exec prisma migrate deploy   # 或已基线后仅部署新迁移
pnpm db:seed
pnpm dev
```

> **Worker 必开**：邮件/通知重试、任务过期扫描、归档保留扫描都由 `worker` 服务执行。只起 app 不启 worker 时，演示链路可能“卡住”或通知不重试。

打开 http://localhost:3000

## 账号

| 角色 | 邮箱 | 密码 | 演示用途 |
|------|------|------|----------|
| 超管 | `admin@hrsign.local` | `Admin@123456` | 用户/设置/印章/Webhook/API Key |
| HR | `hr@hrsign.local` | `Hr@123456` | 模板、发起任务、外链、归档审计 |
| 部门负责人 | `leader@hrsign.local` | `Leader@123456` | **待我审批**（演示任务已就绪） |
| 员工 | `employee@hrsign.local` | `Employee@123456` | 审批后用印 |

## 初始模板（已发布 · 中英双语）

种子按界面语言各准备一套人事预设（PDF + 字段标签）：

| 中文 | English | 类别 |
|------|---------|------|
| **2026 标准劳动合同** | 2026 Standard Employment Contract | CONTRACT |
| **录用通知书** | Offer Letter | OFFER |
| **入职登记表** | Onboarding Form | ENTRY |
| **离职证明** | Resignation Certificate | RESIGN |
| **在职证明** | Employment Certificate | CERTIFICATE |

切换语言后，模板 / 任务 / 归档列表只显示对应语言的数据。演示账号姓名为英文（Chen Siyuan 等），避免英文界面出现中文姓名。

印章库：**Company Seal**、**Contract Seal**、**HR Seal**（均标注 DEMO SEAL）。

种子会自动归档非演示已发布模板，保证列表干净。

## 推荐演示路径（约 5 分钟）

1. **leader** 登录 → 签署任务 → 「待我审批」→ 打开演示录用通知任务 → 通过。  
   - 中文：`【演示】张三 · 录用通知签署`  
   - English: `[Demo] Alex Zhang — Offer letter signing`  
2. **employee** 登录 → 「待我签署」→ 选择 **人事专用章** → 盖章。  
3. **hr** 登录 → 打开同一任务 → 对外部签署人「复制短链」或「重发邮件」。  
4. 无痕窗口打开短链 `/s/{code}` → 邮箱验证码（Mailpit / 服务端日志）→ 手写签名提交。  
5. **hr** 查看归档与审计日志。

### 可选加戏

- 模板列表 → 「从人事预设创建」再编辑一版并发布。  
- 任务详情 → 撤回 / 作废 / 拒签；驳回后「重新发起」预填。  
- 超管 → 系统设置改水印文案，新建任务后 PDF 可见水印。  
- 超管 → 邀请用户 / 忘记密码 / 改密；API Key + Webhook。

---

## 全功能对照表

### 认证与账号

| 功能 | 入口 | 角色 |
|------|------|------|
| 登录 / 登出 | `/login` | 全员 |
| 忘记密码 / 重置 | `/forgot-password` → `/reset-password` | 全员 |
| 邀请设密 | `/invite` | 被邀用户 |
| 侧栏改密 | 侧栏账号区 | 全员 |
| 语言切换（写回 User.locale） | 侧栏 | 全员 |
| 可选 OIDC SSO | 环境变量 | — |

### 模板

| 功能 | 入口 | 角色 |
|------|------|------|
| 列表 / 搜索 / 骨架屏 | `/templates` | 超管、HR |
| 从人事预设创建（5 类） | 模板页 | 超管、HR |
| 上传 PDF + 可视化编辑域 | `/templates/[id]/edit` | 超管、HR |
| 发布 / 归档 / 新版本 | 模板页操作 | 超管、HR |
| 删除（无文档时硬删） | 模板页 | 超管、HR |
| **从模板一键发起签署** | 模板行操作 | 超管、HR |

### 签署任务

| 功能 | 入口 | 角色 |
|------|------|------|
| 任务列表（待我审批 / 待我签署 / 全部） | `/tasks` | 按参与与角色 |
| 新建任务（顺序/并行、过期、表单） | `/tasks/new` | 超管、HR |
| 驳回后重新发起（预填） | 任务详情 | 超管、HR |
| 审批通过 / 驳回 | 任务详情 | 当前审批人 |
| 盖章（选印章） / 手写签名 | 任务详情 | 当前签署人 |
| 内部拒签 | 任务详情 | 当前签署人 |
| 撤回（审批中） / 作废（签署中） | 任务详情 | 发起人 / 超管·HR |
| 外部短链复制 / 重发 | 任务详情 | 超管、HR |
| 批量发起 | `POST /api/tasks/batch` | API Key / HR |

### 外部签署

| 功能 | 入口 | 角色 |
|------|------|------|
| 短链跳转 | `/s/{code}` → `/sign/external/{token}` | 外部 |
| 邮箱验证码 | 外链页 | 外部 |
| 手写签名 / 拒签 | 外链页 | 外部 |

### 印章 / 归档 / 审计

| 功能 | 入口 | 角色 |
|------|------|------|
| 印章上传 / 启用禁用 | `/seals` | 超管、HR |
| 归档列表、预览下载、版本历史 | `/archive` | 全内部（法律保留仅超管·HR） |
| 法律保留开关 | 归档 | 超管、HR |
| 审计日志筛选（动作 Select + 日期） | `/audit-logs` | 超管、HR |
| 哈希链校验 | `pnpm audit:verify` | 运维 |

### 管理后台

| 功能 | 入口 | 角色 |
|------|------|------|
| 用户列表 / 邀请 / 启停 / 改角色 | `/admin/users` | 超管 |
| API Key 创建 / 吊销 | `/admin/api-keys` | 超管 |
| Webhook 增删改 | `/admin/webhooks` | 超管 |
| 系统设置（水印等） | `/admin/settings` | 超管 |
| 保留策略（按模板类别） | 种子 + 设置相关 | 超管 |

### 基础设施（演示可提一句）

- `/api/health`、OpenAPI `docs/openapi.yaml`
- pg-boss Worker：通知重试、过期扫描、保留扫描
- SMTP / Mailpit；未配 SMTP 时用「复制短链」
- Docker Compose：`postgres` / `minio` / `app` / `worker` / `mailpit`

## 角色能力矩阵

| 能力 | 超管 | HR | 负责人 | 员工 | 外部 |
|------|:----:|:--:|:------:|:----:|:----:|
| 模板 CRUD / 预设 / 发起 | ✓ | ✓ | | | |
| 印章管理 | ✓ | ✓ | | | |
| 审批 / 用印 / 手写 | ✓* | ✓* | ✓* | ✓* | 手写 |
| 短链签署 | | 管理链接 | | | ✓ |
| 归档 / 法律保留 | ✓ | ✓ | 只读 | 只读 | |
| 审计日志 | ✓ | ✓ | | | |
| 用户 / API / Webhook / 设置 | ✓ | | | | |

\* 仅当被指派为当前参与人时。

## 邮件说明

未配置 SMTP 时通知会跳过；演示请用任务详情 **复制短链**。本地可加 Mailpit：

```bash
docker compose --profile full up -d mailpit
# 控制台 http://localhost:8025
```
