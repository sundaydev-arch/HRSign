---
name: hr-shadcn-forms
description: 新建或修改任何表单页面、对话框表单、列表/详情/空错态布局、按钮 loading 反馈、响应式页面时使用。规定 react-hook-form+zod 为唯一表单范式、shadcn Form 组件组合方式、每页主按钮数量、状态三重表达、桌面企业后台布局。
---

# 技能 06：shadcn 表单与 UI 范式

## 何时使用

- 新建表单（登录/注册/找回密码/发起任务/设置等）
- Dialog/Popover 里的录入
- 统一加载、空数据、错误、提交反馈
- 页面布局与响应式调整

## 可用组件（仅允许 shadcn，[components/ui/](../../../src/components/ui)，已安装 23 个）

button input textarea label form select radio-group checkbox calendar card dialog alert-dialog popover dropdown-menu tabs table badge avatar separator scroll-area tooltip sonner(toast)。
**不得引入其他 UI 库**；需要新 shadcn 组件先走"新增依赖/组件"说明并获批。

## 硬规则

### 表单
1. 表单唯一范式：**react-hook-form + `@hookform/resolvers/zod` + 项目 zod schema**，用 shadcn 的 `<Form>/<FormField>/<FormItem>/<FormLabel>/<FormControl>/<FormMessage>` 组合（[ui/form.tsx](../../../src/components/ui/form.tsx)）。禁止再写 useState 收集每个字段 + toast 报校验错的旧模式（登录页改造后为参考样板）。
2. 字段级错误只显示在 `FormMessage`；提交级错误（如凭证错误、服务 500）才用 sonner `toast.error`。
3. 输入语义化：`type="email"`、`autoComplete`（email/current-password/new-password/one-time-code/name）、`inputMode`、`aria-invalid`/`aria-describedby` 由 FormItem 自动关联，不要手写错乱关联。
4. 提交期间：按钮 `disabled` + Loader2 旋转 + 文案切换（`submitting` 消息走 i18n）；防重复提交。
5. 密码类输入提供显示/切换（Eye/EyeOff），type 在 password/text 间切。
6. 发验证码类按钮：60 秒倒计时（Intl 或 ICU 变量文案），冷却中 disabled，剩余次数由后端错误码提示。

### 布局与反馈
7. 企业后台桌面布局：(dashboard) 左导航 + 顶栏；内容最大宽度按场景（表单 max-w-3xl、登录卡 max-w-sm、列表全宽）；移动端用响应式 grid/flex，`px-4` 保底；登录/外部页必须手机可用。
8. **每页主按钮 1 个**（default variant）；次要操作用 outline/ghost；表格行内查看/编辑收敛为 ghost 文字按钮放操作列（右侧）。
9. 状态表达三重冗余：颜色 + 图标 + 文案（Badge variant 映射见 labels.ts 的 `*_VARIANTS`，长期迁 i18n）。成功绿/警告橙/错误红/进行中蓝。
10. 列表四态：加载用 `Skeleton`（不要永远"加载中..."纯文本）、空态给图标+说明+行动入口、错误态可重试（已有 RefreshCw 模式）、正常表格。
11. 视觉只走主题 token（primary/muted/border/destructive 等 CSS 变量），禁止散落 `bg-blue-600` 这类硬编码品牌色（登录 logo 块为待清理项）。
12. 弹破坏性操作用 `alert-dialog`（删除/归档/作废），不用 confirm()。
13. 无障碍基线：键盘可达、焦点环 `focus-visible:ring-*` 不去掉、label 与控件关联、图标按钮有 aria-label/tooltip。

## 标准步骤（新表单）

1. 在 `src/schemas/` 或页面旁定义 zod schema（API 复用同一份，边界单一事实）
2. `useForm({ resolver: zodResolver(schema), defaultValues })`
3. FormField render prop 内放 FormItem/Label/Control/Message
4. onSubmit 内 setSubmitting，调 `api()`，成功 router 跳转/刷新，失败按错误码 toast
5. 文案全部 useTranslations

## 禁忌

- ❌ 每个输入一个 useState + 手工 if 判空
- ❌ 校验错误塞 toast
- ❌ 提交按钮无 loading/可双击
- ❌ 引入 Ant Design/MUI 等或自造轮询组件
- ❌ 中文硬编码（见技能 05）

## 完成检查

- [ ] zod resolver 接入，字段错误在 FormMessage
- [ ] loading/disabled/防重复提交/三态图标完整
- [ ] 移动端 375px 宽度手工检查无横向溢出
- [ ] 键盘 Tab 顺序合理、焦点可见
