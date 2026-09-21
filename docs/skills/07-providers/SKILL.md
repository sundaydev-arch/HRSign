---
name: hr-providers
description: 新增或替换签名、身份核验、通知、存储的具体实现（如接 PAdES/国密、人脸、钉钉/飞书、AWS S3/OSS/COS）时使用。规定业务只依赖接口、注册表工厂用法、阶段2空实现的写法、不提前开发合规能力。
---

# 技能 07：Provider 扩展机制

## 何时使用

- 接新的签署/盖章实现（CA/PAdES/国密 SM2）
- 加通知渠道（钉钉、飞书、短信）或身份核验方式（人脸/实名）
- 换/增加对象存储（AWS S3、阿里 OSS、腾讯 COS）

## 核心文件

- 接口单一事实：[providers/types.ts](../../../src/server/providers/types.ts)（SignatureProvider / IdentityVerifier / Notifier / StorageProvider + DocumentVersionRef/SignerContext + NotImplementedError）
- 注册表与默认装配：[providers/index.ts](../../../src/server/providers/index.ts)（register/getXxx、registerStage1Defaults）
- 阶段 1 实现：[signature/image-seal.ts](../../../src/server/providers/signature/image-seal.ts)、[identity/email-code.ts](../../../src/server/providers/identity/email-code.ts)、[notify/email.ts](../../../src/server/providers/notify/email.ts)、[storage/minio.ts](../../../src/server/providers/storage/minio.ts)
- 阶段 2 空壳样板：[signature/pades.ts](../../../src/server/providers/signature/pades.ts)、[gm-sm2.ts](../../../src/server/providers/signature/gm-sm2.ts)、[identity/index.ts](../../../src/server/providers/identity/index.ts)
- PDF 叠加引擎（无 Provider 依赖的纯函数）：[lib/pdf/stamp.ts](../../../src/lib/pdf/stamp.ts)（`stampPdf`，ImageSealProvider 唯一叠章入口；旧 `lib/pdf/signer/` 插槽已删除）
- 任务事件邮件编排：[server/notifications/task-events.ts](../../../src/server/notifications/task-events.ts)（created/approved/rejected/completed；通过 providers 导出的 `sendEmail` 发送）

## 硬规则

1. **业务代码只 import 接口与工厂 getXxx()，禁止 import 具体实现类**。切换实现只改注册装配，调用方零改动。
2. 接口入参只依赖 Ref/Context 等最小结构（如 DocumentVersionRef），**不得把 Prisma 模型透传进 Provider**。
3. SignatureProvider.sign 必须返回新 DocumentVersion 信息（version/stage/storageKey/sha256）+ Signature 记录；遵守多版本不覆盖（见技能 03）。
4. 阶段 2 能力**只放空实现**：方法直接 `return notImplemented("Xxx.method")`；空实现不写未使用参数（ESLint no-unused-vars），用注释指向接口签名；类要保留并 export 以便注册表演示。
5. 存储 put：key 含版本语义，默认命中已存在 key 必须抛错；仅允许 `allowOverwrite` 用于字体等静态资源。presignGet 有效期钳制在 60–3600 秒（默认 300）。
6. Notifier：模板用 templateKey + NotificationParams（ICU 渲染在 Provider 内）；发送结果写 NotificationLog（SENT/FAILED/SKIPPED + error），不吞异常。**通知不允许阻断主业务事务**——失败记日志，重试留给未来队列。
7. IdentityVerifier：验证码/凭据只存哈希；带冷却、次数限制、过期；不存生物信息（人脸只回结果状态）。
8. 新增实现需要新环境变量时：只加 .env.example 注释与读取代码，**.env / docker-compose 改动需先获批**；环境变量最终要走 zod 启动校验（当前缺口，新增时顺手把该模块的 env schema 补上）。
9. 不引入重型 SDK 前先评估：S3 兼容优先复用现有 S3 客户端；IM webhook 优先用 fetch。

## 标准步骤（以新增钉钉通知为例）

1. 新建 `providers/notify/dingtalk.ts`，`export class DingtalkNotifier implements Notifier`
2. 在 index.ts 注册（按 channel 选择；Email 保持默认）
3. 复用 notification schema 渲染文案；写 NotificationLog
4. 配置项写进 .env.example；不修改 .env
5. 给出最小自测（构造 recipient/templateKey/params 调 send）

## 已知不一致（改动时顺手对齐，勿扩大范围）

- types.ts 的 `Locale = "zh_CN" | "en"`（下划线）与 i18n 的 `"zh-CN" | "en"`（连字符）不一致，接通通知/核验 locale 时需在边界做映射，并留注释。

## 禁忌

- ❌ 业务路由 `new MinioStorageProvider()` / 直接依赖实现
- ❌ 在阶段 1 里程碑里实现 PAdES/人脸真实逻辑
- ❌ Provider 里写 Prisma 查询或 next 响应对象
- ❌ 吞掉发送错误返回 SENT

## 完成检查

- [ ] 面向接口实现，调用方未出现具体类
[ ] 新空实现/实现通过 lint（无未用变量）与 tsc
- [ ] 结果落相应日志表；配置只动 .env.example
