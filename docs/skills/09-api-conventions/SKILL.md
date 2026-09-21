---
name: hr-api-conventions
description: 新增或修改任何 Route Handler（API 路由）、动态页面 params/searchParams、统一响应与错误形状、分页列表、文件下载响应头时使用。规定 try/catch 收口、Next 15 Promise 参数、zod 边界、列表过滤鉴权与分页方向。
---

# 技能 09：API 路由约定

## 何时使用

- 新增 `src/app/api/**` 下的 GET/POST/PUT/PATCH/DELETE
- 新增动态路由页面（params）或带查询参数页面（searchParams）
- 定义接口响应形状、分页、下载

## 硬规则

### 文件位置与签名
1. 路由放 `src/app/api/<资源>/route.ts`，动态段 `[id]`；一个文件聚合同路径多方法。命名 kebab-case 多段。
2. **Next.js 15：动态参数是 Promise**，必须 await：
   ```ts
   export async function PATCH(
     req: NextRequest,
     { params }: { params: Promise<{ id: string }> },
   ) {
     const { id } = await params;
   ```
   页面同理：`params: Promise<{ id: string }>`、`searchParams: Promise<{ templateId?: string }>`；catch-all 为 `Promise<{ key: string[] }>`。
3. 运行在 Node 的路由（用 Prisma/bcrypt/Buffer/pdf-lib）确保不要误加 `export const runtime = "edge"`；会话边缘逻辑只存在于 middleware/auth.config。

### 边界处理
4. 每个处理器固定骨架：
   ```ts
   export async function POST(req: NextRequest, ctx) {
     const { id } = await ctx.params;
     try {
       const user = await requireApiUser(["HR"]);   // 鉴权（技能 04）
       const body = Schema.parse(await req.json()); // zod 边界（技能 01）
       // …业务（多表写用事务）
       await recordAudit({ ... });                  // 审计（技能 08）
       return NextResponse.json({ ... });
     } catch (err) {
       return handleApiError(err);
     }
   }
   ```
5. body 先取 `unknown`（`await req.json()`）再 zod parse，禁止 `req.json() as XxxBody`。query 参数自己做存在性/枚举校验。
6. 响应形状保持项目惯例：列表 `{ items 或复数命名: [...] }` 配合前端 `api<T>()`；详情返回对象；写操作返回新建主 id（如 `{ taskId }`）。不随意混用不同包裹键。
7. **列表必须鉴权过滤 + 分页方向**：where 里带数据范围（HR 全量/本人相关）；新增列表要加 take/游标或 pageSize（现有部分列表无上限是技术债，不得照抄）。
8. 时间字段经 JSON 自动序列化为 ISO 字符串，前端用 Intl 展示（技能 05），后端不预格式化本地化字符串。
9. 返回 Json 列字段前，如坐标等需要给前端用的，解包为扁平/可渲染结构（参考 tasks/[id] 对 fields 的 CoordinatesSchema.parse）。

### 文件下载
10. 所有文件只从 [files/[...key]/route.ts] 输出；设置正确 Content-Type（PDF 固定 `application/pdf`，图片按扩展名映射）、`Content-Disposition`（预览 inline / 下载 attachment；文件名做 RFC 5987 编码）；禁止把 MinIO 内部地址/凭据泄漏给前端。

### 客户端
11. 前端统一用 [src/lib/client.ts](../../../src/lib/client.ts) 的 `api(path, init)`；不要到处 fetch 重复处理 credentials/错误解析。

## 标准步骤（新增资源 API）

1. 定义 zod schema（入参）与 TS 返回类型
2. 建 route.ts，按第 4 条骨架实现；动态参数 await
3. 鉴权 → 校验 → 事务业务 → 审计 → 统一响应
4. 前端 `api()` 对接；tsc 0 错；e2e-smoke 或手工跑正反路径

## 禁忌

- ❌ 写成 `{ params }: { params: { id: string } }`（Next 15 下 build 失败）
- ❌ 处理器不 try/catch 导致原始堆栈外泄
- ❌ 无鉴权的写路由、无范围过滤的列表
- ❌ findMany 全表无上限的新代码
- ❌ 在路由里直接写状态机裸跳转或 PDF 处理细节（分别走技能 02/03）

## 完成检查

- [ ] params/searchParams 已 await；tsc 与 `pnpm build` 通过
- [ ] 鉴权、zod、try/catch、审计四件套齐全
- [ ] 列表有范围过滤，新增列表带分页上限
- [ ] 修改文件/原因/测试要点已在交付说明标注
