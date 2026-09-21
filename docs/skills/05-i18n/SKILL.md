---
name: hr-i18n
description: 新增或修改任何用户可见文案（页面、组件、邮件、通知、错误展示）、日期/时间/数字/金额格式化、语言切换、消息文件时使用。规定禁止硬编码与字符串拼接、ICU MessageFormat、两语言 key 必须一致、UI 语言与文档语言分离。
---

# 技能 05：国际化（next-intl，zh-CN / en）

## 何时使用

- 在页面/组件里写任何用户可见文字
- 新增邮件/通知模板
- 展示日期、时间、数字、金额、倒计时秒数
- 新增命名空间或消息 key

## 关键文件

- locale 判定/常量/cookie：[src/i18n/config.ts](../../../src/i18n/config.ts)（`LOCALES`、`DEFAULT_LOCALE=zh-CN`、cookie `HR_SIGN_LOCALE`、Accept-Language 归并：所有 zh* → zh-CN）
- Server 侧取消息：[src/i18n/request.ts](../../../src/i18n/request.ts)；Provider 在根 layout
- 消息文件：[messages/zh-CN.json](../../../messages/zh-CN.json)、[messages/en.json](../../../messages/en.json)
- key 一致性检查：[scripts/check-i18n-keys.mjs](../../../scripts/check-i18n-keys.mjs)
- 枚举标签过渡方案：[src/lib/labels.ts](../../../src/lib/labels.ts)（**现状为硬编码中文，新代码不要再往里加，应迁入消息**）

## 硬规则

1. **禁止硬编码界面文案、禁止字符串拼接**。Server Component 用 `getTranslations`，Client Component 用 `useTranslations`。
2. **带变量/复数/条件选择一律 ICU MessageFormat**。示例（已在仓库）：
   - 变量：`"welcome": "欢迎，{name}"`
   - select：`"role": "{role, select, SUPER_ADMIN {超级管理员} HR {HR 专员} … other {未知角色}}"`
   - 复数（中文无复数形式，英文必须写）：`"items": "{count, plural, =0 {No items} one {# item} other {# items}}"`
   - 冷却秒数等用变量，不允许前端拼 `"重新发送(" + s + "s)"`
3. **两份消息文件 key 必须完全一致**；提交前跑 `node scripts/check-i18n-keys.mjs`（CI 应以此为门禁，当前 CI 缺）。
4. 命名空间按功能模块组织（现有：app / localeSwitch / nav / auth.login）；新增页面加独立命名空间，如 `tasks.detail.*`、`auth.register.*`。
5. **日期/时间/数字/金额只用 Intl API**（`Intl.DateTimeFormat`、`Intl.NumberFormat`、`Intl.RelativeTimeFormat`），禁止手写格式字符串、禁止新增日期库。库内时间 UTC 存储，界面按用户时区。现有 `formatDateTime` 是过渡封装，演进方向是带 locale/timeZone 的 Intl 封装。
6. **UI 语言 ≠ 文档语言**：生成 PDF 的语言取 `Template.locale`（zh-CN/en/bilingual），与操作者界面语言无关。
7. **后端不返回本地化文案**：API 返回错误码 + 参数（如 `{ code: "AUTH_INVALID_CREDENTIALS" }`），由前端按当前语言渲染。AuditLog 只存动作码+参数（语言无关）。
8. 邮件/通知模板按 locale 多份，语言优先级：签署人偏好 → 发起人指定 → 浏览器语言。
9. 排版：中文行高 1.65–1.75、不对中文用斜体/letter-spacing；按钮/表头不定宽（英文长 30–50%）；优先 CSS 逻辑属性（ms-/me-/ps-/pe-）。

## 标准步骤（加一段文案）

1. 在 zh-CN.json 对应命名空间加 key + ICU 文案
2. **同 key 同步加到 en.json**（真翻译，不留中文）
3. 组件 `const t = useTranslations("ns")`；`<span>{t("key", { var })}</span>`
4. 跑 key 检查脚本；手工切到 en 检查无溢出/无漏翻

## 禁忌

- ❌ JSX 里直接写中文字面量（含 toast、placeholder、title 属主）
- ❌ 用三元运算符在组件里选中英文
- ❌ 后端 catch 里 `throw new ApiError(400, "邮箱格式不正确")` 作为最终形态（过渡期可接受，目标是错误码字典）
- ❌ 用 dayjs/moment 等新增日期库

## 完成检查

- [ ] 两份消息 key 一致（脚本通过）
- [ ] 无新增硬编码文案；变量走 ICU
- [ ] en 下布局手工检查；日期/数字走 Intl
- [ ] 后端新增错误只回错误码
