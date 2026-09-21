---
name: hr-auth-rbac
description: 涉及登录会话、角色权限校验、用户管理、外部免登录签署令牌（SigningToken）、文件访问鉴权、middleware 白名单时使用。规定边缘/Node 配置分离、后端统一鉴权入口、令牌只存哈希、已用令牌只读语义。
---

# 技能 04：认证、RBAC 与外部令牌

## 何时使用

- 新增受保护页面/API、加角色限制
- 改登录/注册/找回密码、OIDC provider
- 改外部签署链接、验证码、`?token=` 文件访问
- 调整 middleware 白名单

## 文件地图

| 关注点 | 文件 |
|---|---|
| 边缘安全配置（无 Prisma） | [src/auth.config.ts](../../../src/auth.config.ts) |
| NextAuth 实例（Credentials + JWT 回调） | [src/auth.ts](../../../src/auth.ts) |
| 边缘会话保护 + 白名单 | [src/middleware.ts](../../../src/middleware.ts) |
| SessionUser / 鉴权入口 / 角色 | [src/lib/rbac.ts](../../../src/lib/rbac.ts) |
| 外部令牌校验 | [sign/external/[token]/route.ts](../../../src/app/api/sign/external/[token]/route.ts)、[tasks/[id]/sign/route.ts](../../../src/app/api/tasks/[id]/sign/route.ts) |
| 邮箱验证码 | [providers/identity/email-code.ts](../../../src/server/providers/identity/email-code.ts) |
| 文件出口鉴权 | [api/files/[...key]/route.ts](../../../src/app/api/files/[...key]/route.ts) |

## 硬规则

### 会话与 RBAC
1. **auth.config.ts 中禁止 import Prisma/bcrypt/Node API**（它跑在 Edge middleware）；需要数据库的逻辑放 auth.ts。
2. 后端鉴权只用两个入口：API 用 `requireApiUser(roles?)`（失败抛 401/403 ApiError），页面用 `requirePageUser(roles?)`（未登录跳 /login，权限不足跳 /tasks）。**不得在业务路由里另写一套 session 判断。**
3. 角色：SUPER_ADMIN / HR / DEPT_LEADER / EMPLOYEE（无 EXTERNAL 角色——外部签署人不是用户）。`isManagerRole` 仅 HR/超管。数据级范围：HR 全部；员工仅与自己相关；负责人仅自己审批的单据——范围过滤写在查询 where 里，不能只靠前端隐藏。
4. 前端组件只做展示控制；任何写操作必须有后端鉴权。
5. 自定义字段（role 等）在 JWT 回调写入 token；读取用边界断言/守卫模式（参考 auth.ts 的 `(user as { role?: UserRole }).role` 与 ROLE_OPTIONS 回填），禁止 `any`。
6. NextAuth v5 beta + pnpm 严格布局下 `declare module "@auth/core/types"` 增强不生效，不要依赖它补类型。

### 外部签署令牌
7. SigningToken **只存 sha256(明文)**，明文只在创建那一刻出现（创建时经 externalTokenMap 传给通知层拼链接；重发通知回退内部链接是已知限制）。
8. 校验四要素：哈希命中、未 revokedAt、未 usedAt（签署动作）、未过 expiresAt；验证码另走 EmailCodeVerifier（哈希存码、冷却、次数、常数时间比较）。
9. **已用令牌允许只读 GET/文件查看**（用户要留存文档），防重复签署靠 Signer 状态机（SIGNED 后拒绝）。签署 POST 成功立即写 usedAt。
10. 文件路由按 key 前缀分别鉴权：templates/seals 走会话+管理角色；documents/signatures 走会话归属或 `?token=` 哈希校验；不得新增"凭 ID 即可下载"的路由。
11. 新增公开路由必须同步加入 middleware matcher 白名单，且白名单要尽量窄（精确到路径前缀）。

## 标准步骤（新增受保护 API）

```ts
export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    // …zod 校验 + 业务
  } catch (err) {
    return handleApiError(err); // 见技能 09
  }
}
```

## 禁忌

- ❌ 在 auth.config.ts/middleware 里引 Prisma
- ❌ 存令牌/验证码明文或写进日志
- ❌ 用邮箱是否存在决定公开接口的响应差异（防账号枚举，发码接口无论是否存在都回成功）
- ❌ 只在前端控制按钮可见性

## 完成检查

- [ ] 新接口有后端角色校验；列表接口有数据范围 where
- [ ] 公开路径已评估并加入/排除白名单
- [ ] 令牌/验证码不落日志、不明文回传
- [ ] tsc 通过；权限反例在 e2e/手工测试中验证
