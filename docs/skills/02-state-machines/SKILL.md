---
name: hr-state-machines
description: 涉及审批状态、签署状态、签署人状态的任何流转（通过/驳回/签署/拒签/过期/作废/顺序签轮次判定）时使用。规定只能经转换表改状态、事务边界、两个状态机相互独立、盖章前置审批的强校验位置。
---

# 技能 02：双状态机（审批与签署分离）

## 何时使用

- 改 approve/reject/sign/过期/作废相关逻辑
- 新增一种任务操作（如撤回、转签）
- 判断"某签署人当前能不能操作"

## 状态空间（权威定义在 [schema.prisma](../../../prisma/schema.prisma)，转换规则在 [state-machines/](../../../src/server/state-machines)）

- **ApprovalStatus**：DRAFT → PENDING → APPROVED | REJECTED | WITHDRAWN
- **SigningStatus**：NOT_STARTED → IN_PROGRESS → COMPLETED | DECLINED | EXPIRED | REVOKED
- **Signer**：PENDING → VIEWED → SIGNED | DECLINED
- SignerRole：APPROVER（审批人）/ COMPANY_SEAL（企业盖章）/ PERSONAL_SIGNATURE（个人签署）。注意旧枚举 COMPANY_SIGNER/REJECTED/WAITING 已废弃，不得再出现。

## 硬规则

1. **合法转换只允许写在转换表**（approval.ts / signing.ts / signer.ts），路由层禁止手写 `if (status===...) status='...'` 式裸跳转；非法转换由状态机抛错。
2. **企业盖章前置审批**：COMPANY_SEAL 操作只在 ApprovalStatus=APPROVED 时放行（signing.ts + sign 路由双保险）。
3. 一次审批通过要在**单事务**内完成：Signer PENDING→SIGNED + 写 ApprovalRecord（含 fromStatus/toStatus/ip/userAgent）；最后一个 APPROVER 通过时才把任务置 APPROVED 且 SigningStatus NOT_STARTED→IN_PROGRESS。参考 [approve/route.ts](../../../src/app/api/tasks/[id]/approve/route.ts)。
4. 驳回：Signer→DECLINED 并写 declinedReason/declinedAt；任务 approvalStatus=REJECTED、signingStatus=NOT_STARTED。
5. **顺序签轮次**统一用 [tasks.ts](../../../src/lib/tasks.ts) 的 `getCurrentSigners()` 判定；并行签全部可操作。canSign/canApprove 的判定必须包含"状态机允许 + 轮到该人 + 任务未过期"。
6. 过期统一走 `expireDueTasks()`（当前惰性触发；未来改队列时业务路由不需改判定逻辑）。
7. 签署完成：所有必签 Signer 都 SIGNED 后任务才 COMPLETED；外部令牌 POST 成功后立即写 usedAt。
8. 改转换表必须同步加/改单测（`__tests__/`，现有 91 例），非法路径要有断言。

## 标准步骤

1. 先在对应状态机文件加转换与判定函数并补单测（红→绿）
2. 路由只调用状态机函数，不内联规则
3. 涉及多表写操作包 `prisma.$transaction`
4. `pnpm test`（vitest）与 tsc 全绿

## 禁忌

- ❌ 为图省事在路由里直接 update 状态字段
- ❌ 把审批与签署合并成一个状态字段
- ❌ 只改前端按钮置灰而不做后端校验（前端仅展示控制）
- ❌ 删除/跳过 ApprovalRecord 记录

## 完成检查

- [ ] 新转换在转换表中有单测（合法+非法各一条以上）
- [ ] 多表变更在事务内；写了 IP/UA/原因字段
- [ ] 顺序签、并行签两条路径都验证
- [ ] 前端 canXxx 与后端判定一致
