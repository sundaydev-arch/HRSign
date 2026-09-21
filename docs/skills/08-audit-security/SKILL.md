---
name: hr-audit-security
description: 新增业务写操作需要记审计、返回 API 错误、处理密码/令牌/文件上传等安全敏感逻辑、做安全评审自查时使用。规定哈希链只追加、动作码+参数口径、IP/UA 采集、错误码化、上传校验、公章不下发。
---

# 技能 08：审计日志与安全基线

## 何时使用

- 新增任何"写"业务操作（创建/审批/签署/发布/删除/改权限/登录）
- 设计新的错误返回
- 处理凭据、令牌、验证码、上传文件、文件下载
- 做安全相关自查或评审

## 关键文件

- 哈希链审计：[src/lib/audit.ts](../../../src/lib/audit.ts)（`recordAudit(AuditEntry)`、canonicalJson、prevHash 链）
- 审计 detail schema：[src/schemas/audit-detail.ts](../../../src/schemas/audit-detail.ts)
- API 错误与请求取证：[src/lib/api.ts](../../../src/lib/api.ts)（`ApiError`、`handleApiError`、`getClientIp`、`getUserAgent`）
- 密码/会话：[src/auth.ts](../../../src/auth.ts)（bcrypt.compare，禁存明文）
- 令牌/验证码：[providers/identity/email-code.ts](../../../src/server/providers/identity/email-code.ts)、SigningToken 相关路由
- 文件出口：[api/files/[...key]/route.ts](../../../src/app/api/files/[...key]/route.ts)

## 硬规则

### 审计
1. 所有关键写操作成功或失败都要 `recordAudit`：action（**动作码**，如 `task.approve`、`auth.login`、`template.publish`）、targetType/targetId、result、ip、userAgent；涉文档带 documentSha256。
2. **detail 只存参数不存文案**：经 AuditDetail zod schema；禁止把界面中文/英文句子、密码、令牌明文、验证码放进去。
3. 审计**只追加**，应用层不得 update/delete AuditLog；哈希链 payload 依赖 canonicalJson（键排序），改 detail 结构时保持规范化逻辑不变。
4. recordAudit 失败不得回滚/阻断主业务（现状设计），但要让失败可被察觉（日志）。
5. 登录失败、权限拒绝、验证码暴破等安全事件也要记 failure 审计。

### 错误返回
6. API 抛 `throw new ApiError(status, 语义消息)` 并由 `handleApiError` 统一收口；目标口径是**错误码 + 参数**（如 `VALIDATION_ERROR`/`AUTH_INVALID_CREDENTIALS`/`SEAL_APPROVAL_REQUIRED`），前端按 i18n 渲染。过渡期存在中文 message，**新代码应定义错误码常量，不继续扩散中文字符串**。
7. 不向前端泄漏堆栈/SQL/内部地址；未知错误统一 500 泛化提示，详情只在服务端日志。

### 凭据与访问
8. 密码只用 bcrypt（注册/改密用 hash，登录用 compare）；不记日志、不下发、不放 URL。
9. 令牌、验证码只存哈希；比较敏感信息用常数时间比较（timingSafeEqual，见 email-code）；发码接口防账号枚举（邮箱不存在也回成功）。
10. **公章原图仅后端读取**，任何列表/详情接口不得返回可直接访问公章图的 URL 给无关角色；盖章时由后端用 sealId 取图合成。
11. 文件下载统一走 `/api/files/[...key]`，按前缀鉴权（会话归属或 token 哈希）；外部 token 已用仍可只读但不能再签。
12. 上传 PDF：必须校验大小上限 + **魔数（%PDF-）**，并拒绝含 JavaScript / 内嵌文件 / Launch 动作 / 加密的文档（当前仅大小+解析校验，魔数/危险结构是待补 P0，新增上传入口时必须实现，不得复制旧的宽松校验）。图片上传至少做魔数（PNG/JPEG）。
13. 用户输入进入重定向/链接/SQL 的规则：URL 跳转只允许站内白名单路径；查询一律 Prisma 参数化（禁字符串拼 SQL）；渲染由 React 自动转义，禁 `dangerouslySetInnerHTML`。

### 当前安全缺口（改动相关区域时优先补齐，勿新开分支做大重构）
无 CSP/安全响应头、无限流、无 Origin 校验（CSRF 纵深）、无依赖扫描、审计表无 DB 触发器、无 env zod 启动校验。触碰登录/发码/上传时，至少把对应限流或校验以最小方式补上并说明。

## 标准步骤（给写操作加审计）

```ts
const ip = getClientIp(req);
const userAgent = getUserAgent(req);
try {
  // …业务事务
  await recordAudit({
    userId: user.id, action: "task.approve",
    targetType: "SigningTask", targetId: id,
    result: "success", ip, userAgent, documentSha256: version?.sha256 ?? null,
    detail: { fromStatus: "PENDING", toStatus: "APPROVED" },
  });
} catch (err) {
  await recordAudit({ userId: user.id, action: "task.approve", targetType: "SigningTask",
    targetId: id, result: "failure", ip, userAgent, detail: { reason: "…" } });
  throw err;
}
```

## 禁忌

- ❌ AuditLog 存本地化句子或敏感值
- ❌ 把验证码/明文 token 写日志、query、响应
- ❌ 新增不经鉴权的文件/导出路径
- ❌ catch 后把 err.message（英文堆栈类）直接回前端

## 完成检查

- [ ] 写操作有 success/failure 审计 + IP/UA
- [ ] detail 过 zod、无文案无敏感数据
- [ ] 错误走 ApiError/handleApiError；上传有魔数与危险结构检查
- [ ] 新接口复核了鉴权与数据范围
