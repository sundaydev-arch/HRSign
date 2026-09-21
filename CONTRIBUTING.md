# Contributing to HRSign

English ｜ [中文](#中文贡献指南)

First off — thank you for taking the time to contribute! HRSign is an open-source, self-hosted HR signing system, and contributions of all kinds are welcome: bug reports, feature discussions, documentation, tests, and code.

By participating, you agree to respect the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Development environment](#development-environment)
- [Build & test commands](#build--test-commands)
- [Coding standards](#coding-standards)
- [Pull request workflow](#pull-request-workflow)
- [Commit convention](#commit-convention)
- [Reporting bugs & requesting features](#reporting-bugs--requesting-features)
- [Maintainers](#maintainers)

## Ways to contribute

- **Bug reports / feature requests:** open an issue using the templates; fill in every section.
- **Documentation:** fix typos, clarify guides, translate.
- **Code:** pick an issue labeled `good first issue` or propose a change in an issue first for non-trivial work.
- **Security issues:** do **not** open a public issue — follow [SECURITY.md](./SECURITY.md).

## Development environment

Requirements: **Node.js 20 LTS+**, **pnpm 9**, Docker, git.

```bash
# 1. Fork on GitHub, then clone your fork
git clone https://github.com/<your-username>/hrsign.git
cd hrsign

# 2. Install dependencies (also copies the pdf.js worker)
pnpm install

# 3. Start PostgreSQL 16 (:5433) and MinIO (:9000/:9001)
docker compose up -d

# 4. Environment
cp .env.example .env
# Local defaults work out of the box. Generate a secret for anything shared:
#   openssl rand -base64 32

# 5. Database
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 6. Dev server
pnpm dev   # http://localhost:3000
```

Useful test accounts after seeding are listed in the [README](./README.md#demo-accounts).

## Build & test commands

All of these must pass before a PR is merged:

```bash
pnpm lint               # ESLint (next config)
pnpm typecheck          # tsc --noEmit — zero errors required
pnpm test               # Vitest, currently 98 tests
pnpm test:coverage      # coverage report under coverage/
pnpm build              # production build

# Optional but encouraged for API/flow changes (server must be running):
node scripts/e2e-smoke.mjs

# Required whenever you touch messages/:
node scripts/check-i18n-keys.mjs   # zh-CN.json and en.json keys must match
```

Guidelines for tests:

- State-machine changes require new transition-table tests (valid + invalid paths) under `src/server/state-machines/__tests__/`.
- Pure logic (coordinate conversion, validation, formatting) gets a Vitest unit test next to it.
- Do not weaken existing assertions to make a test pass.

## Coding standards

The project enforces opinions on purpose — please follow them instead of introducing alternatives:

1. **TypeScript strict everywhere.** No `any`; use `unknown` + type guards at boundaries. `noUncheckedIndexedAccess` is enabled — handle `undefined`.
2. **zod at every system boundary** — API bodies, forms, env vars, and every Prisma `Json` column. Never cast a parsed `Json` value to a type directly; use the paired schema in `src/schemas/`.
3. **PDF modification happens on the server only.** The client previews (pdf.js) and collects coordinates; pdf-lib never runs in the browser.
4. **Files are never overwritten.** Every processing stage creates a new versioned storage key with a SHA-256 record.
5. **Approval before seal.** Company-seal operations require `APPROVED`; enforce it in the backend state machine, never in UI alone.
6. **i18n:** no hard-coded user-facing strings. Use next-intl (ICU MessageFormat for variables/plurals). Keep `messages/zh-CN.json` and `messages/en.json` in lockstep. Format dates/numbers via `Intl` only.
7. **Backend errors return error codes + parameters, not localized sentences.** Audit logs store action codes + parameters only.
8. **UI library:** shadcn/ui + Tailwind only. Forms use react-hook-form + `zodResolver` with the shadcn `Form` components.
9. **Code comments: write in English** for new and modified code (this is the standard going forward; pre-existing Chinese comments are migrated gradually in dedicated cleanup PRs — do not mix languages within one file).
10. Naming: variables/functions `camelCase`, components/types `PascalCase`, constants `SCREAMING_SNAKE_CASE`. File names are `kebab-case` for everything **except React component files**, which use `PascalCase.tsx` (e.g. `TaskList.tsx`) — this matches the React/Next.js convention; the `components/ui/` primitives remain `kebab-case` because they come from shadcn. Route segments stay lowercase (`route.ts`, `page.tsx`, `[id]/`).
11. Minimal, focused diffs — do not reformat unrelated code or restructure directories in a feature PR.
12. Do not add third-party dependencies without justification in the PR description (why, size/risk, alternatives). Do not change `.env`, `docker-compose.yml`, or `package.json` version pins without maintainer approval.

Architecture guidance lives in [`docs/`](./docs/README.md): requirements with implementation status, a full code map, and reusable engineering skills — read the one relevant to your change before starting.

## Pull request workflow

1. Create a topic branch from `main`: `feat/short-desc`, `fix/short-desc`, `docs/short-desc`.
2. Keep PRs small and single-purpose; one logical change per PR.
3. Ensure `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass locally.
4. If you change UI copy, update **both** message catalogs and run the i18n key check.
5. If you change the Prisma schema, generate the client and include the migration (`pnpm prisma migrate dev --name <change>`); describe any data-impact in the PR.
6. Fill in the [pull request template](./.github/PULL_REQUEST_TEMPLATE.md) completely: what changed, why, how it was tested, screenshots for UI changes.
7. A maintainer will review; address review feedback by pushing new commits (do not force-push reviewed branches unless asked).
8. Squash-merge is used; keep the final commit message meaningful.

## Commit convention

We follow Conventional Commits:

```
<type>(<optional scope>): <summary>

feat(templates): add template field duplication
fix(signing): reject seal when approval is not complete
docs(readme): clarify windows setup
refactor(providers): extract notification registration
test(state-machines): cover expired signer transitions
chore(deps): bump prisma to 6.19.4
```

Types: `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore`.

## Reporting bugs & requesting features

- Bugs: [open a Bug Report](https://github.com/<your-org>/hrsign/issues/new?template=bug_report.yml) with reproduction steps, expected/actual behavior, logs, and environment (OS, Node, browser).
- Features: [open a Feature Request](https://github.com/<your-org>/hrsign/issues/new?template=feature_request.yml) describing the problem, proposed approach, and alternatives considered.

## Maintainers

- Maintainer contact: **TODO: replace with your team's address** (e.g. `hrsign-maintainers@example.com`) and link the real repository in all placeholder URLs before publishing.
- Vulnerability contact and SLA: see [SECURITY.md](./SECURITY.md).

---

<a id="中文贡献指南"></a>

# 中文贡献指南

感谢参与 HRSign！参与即表示同意遵守[行为准则](./CODE_OF_CONDUCT.md)。

**环境准备**：Node.js 20 LTS+、pnpm 9、Docker；`pnpm install` → `docker compose up -d` → `cp .env.example .env` → `pnpm db:generate && pnpm db:migrate && pnpm db:seed` → `pnpm dev`。

**提交前必须通过**：`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`；改动消息文件后运行 `node scripts/check-i18n-keys.mjs`（两份消息 key 必须一致）。

**核心规范**（详见上文英文完整版）：TS strict 禁 `any`；系统边界与 Prisma Json 列全部经 zod；PDF 只在后端修改；文件多版本不覆盖；企业盖章必须审批通过（后端强校验）；界面文案全部走 next-intl（ICU，中英同步）；后端只返回错误码、审计只存动作码；UI 只用 shadcn/ui + Tailwind；**新增/修改代码注释统一英文**（存量中文注释按专项 PR 渐进迁移，同一文件不混写）；最小变更、不顺手重构；新增依赖与改动 `.env`/`package.json`/`docker-compose.yml` 需维护者同意。

**PR 流程**：从 `main` 切 `feat/xxx`、`fix/xxx`、`docs/xxx` 分支 → 小而专注 → 本地四件套通过 → 完整填写 PR 模板（改了什么、为什么、怎么测、UI 截图）→ review 后追加提交、勿强推 → 采用 Squash merge。提交信息遵循约定式提交（feat/fix/docs/refactor/test/chore 等）。

**问题反馈**：Bug 用 Bug Report 模板（复现步骤、预期/实际、日志、环境）；功能建议用 Feature Request 模板；安全问题**不要**提公开 issue，按 [SECURITY.md](./SECURITY.md) 私下报告。
