# HRSign 知识库

本目录是面向**所有智能体（Agent）与新成员**的项目知识库：需求、架构索引、可复用技能（Skills）。
仓库根目录的 [README.md](../README.md) 面向使用者（快速开始/部署）；本目录面向"在本仓库内做开发与修改的人或智能体"。

## 目录导航

| 分类 | 文档 | 用途 |
|---|---|---|
| 需求 | [requirements/product-spec.md](./requirements/product-spec.md) | 完整产品规格（0–20 节）+ 每项实现状态对照 |
| 架构 | [architecture/code-map.md](./architecture/code-map.md) | 前端 / 后端 / 数据层代码与资源分类索引、数据流 |
| 技能 | [skills/README.md](./skills/README.md) | 9 个通用智能体技能总清单 |

## 技能（Skills）索引

| # | 技能 | 何时使用 |
|---|---|---|
| 01 | [Schema 与 Zod 约定](./skills/01-schema-zod/SKILL.md) | 改 Prisma 模型、读写 Json 列、加校验 |
| 02 | [双状态机](./skills/02-state-machines/SKILL.md) | 改审批/签署/签署人状态流转 |
| 03 | [PDF 处理管线](./skills/03-pdf-pipeline/SKILL.md) | 模板填充、坐标、盖章、水印、签名、中文字体 |
| 04 | [认证、RBAC 与外部令牌](./skills/04-auth-rbac/SKILL.md) | 登录、权限、免登录签署链接 |
| 05 | [国际化 i18n](./skills/05-i18n/SKILL.md) | 任何界面文案、日期/数字格式化、消息文件改动 |
| 06 | [shadcn 表单与 UI 范式](./skills/06-shadcn-forms/SKILL.md) | 新建表单/页面、loading/错误态、响应式 |
| 07 | [Provider 扩展机制](./skills/07-providers/SKILL.md) | 接入新签名/核验/通知/存储实现 |
| 08 | [审计日志与安全基线](./skills/08-audit-security/SKILL.md) | 写审计、错误码、安全相关改动 |
| 09 | [API 路由约定](./skills/09-api-conventions/SKILL.md) | 新增/修改 Route Handler、文件下载路由 |

## 项目硬规则（所有智能体必须遵守）

1. **最小变更**；先读上下文再改；不推翻原架构；TS strict，禁止 `any`
2. **所有 Prisma Json 列读写必须经配套 zod schema**（见技能 01）
3. **PDF 的任何修改只在后端**；前端只做预览、拖拽、录入
4. **企业盖章必须审批已通过**，由后端状态机强校验
5. **文件多版本留存、禁止覆盖写**；storageKey 含版本语义
6. **界面文案禁止硬编码**，走 next-intl，两份消息文件 key 必须一致
7. **后端错误只返回错误码 + 参数**；AuditLog 只存"动作码 + 参数"，不存本地化文本
8. 不擅自引入新依赖、不改 `.env` / `package.json` / `docker-compose`（需先说明并获授权）
9. 代码标识符用英文，注释优先中文；文件命名 kebab-case
10. 阶段 2 合规能力（PAdES/国密/人脸）只留接口与空实现，不提前开发

## 状态标记说明

需求文档中实现状态统一用：

- ✅ 已实现　　🟡 部分实现/有差距　　⬜ 未实现　　🔒 阶段 2 预留
