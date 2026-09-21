# Security Policy

English ｜ [中文](#中文安全策略)

## Supported versions

| Version | Supported |
|---|---|
| 0.2.x (current MVP) | ✅ Best-effort security fixes on `main` |
| < 0.2 | ❌ Not supported |

HRSign is pre-1.0 software. Self-hosters are expected to track `main` (or a tagged release once 1.0 ships) and apply fixes promptly.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them privately:

1. **Preferred:** use [GitHub private vulnerability reporting](https://github.com/<your-org>/hrsign/security/advisories/new) ("Report a vulnerability").
2. Or email the maintainers: **TODO: replace with a monitored security address (e.g. security@example.com)**.

Include:

- A description of the issue and its impact
- Steps to reproduce (PoC URL/request if safe)
- Affected commit/tag and deployment mode (self-hosted config)
- Any suggested remediation

### Response process

- **Acknowledgement:** within **5 business days**
- **Initial assessment & severity:** within **10 business days**
- Fix coordinated via a private advisory; public disclosure after a patch is available (typically within 30 days of confirmation for high/critical issues), crediting the reporter unless they prefer anonymity.

## Scope

In scope: authentication/session handling, RBAC bypass, signing-token or verification-code flaws, audit-chain integrity, path traversal / unauthorized file access, injection, XSS/CSRF with security impact, insecure handling of uploaded PDFs/seals, credential leakage.

Out of scope: missing hardening that is explicitly documented as not-yet-implemented on the roadmap (e.g. rate limiting, CSP headers, CA-qualified signatures), reports requiring physical access, automated scanner output without demonstrated impact, and vulnerabilities in third-party services (report upstream).

## Security notes for operators

- Change `NEXTAUTH_SECRET`, database and MinIO credentials before any non-local deployment.
- Serve over HTTPS behind a reverse proxy; keep `AUTH_TRUST_HOST` aligned with your proxy setup.
- Seal master images are read server-side only; do not make the MinIO bucket public.
- Phase 1 seals/signatures are **not** legally qualified electronic signatures — see the README disclaimer.

---

<a id="中文安全策略"></a>
# 中文安全策略

**当前版本：** 0.2.x（MVP，pre-1.0），在 `main` 上尽最大努力修复安全问题；0.2 以下不支持。建议自托管方及时跟踪。

**报告方式：** 请勿通过公开 GitHub Issue 披露。优先使用 GitHub 私密漏洞报告（Security → Report a vulnerability），或邮件至（发布前请替换为真实地址）**TODO: security@example.com**。报告请包含：问题与影响描述、复现步骤（安全的 PoC）、受影响 commit/版本与部署方式、修复建议。

**响应时限：** 5 个工作日内确认收到；10 个工作日内给出初步评估与严重等级；通过私密安全公告协作修复，补丁发布后（高/危问题通常在确认后 30 天内）再公开披露，并在致谢中署名（匿名可选）。

**范围内：** 认证/会话、RBAC 绕过、签署令牌或验证码缺陷、审计链完整性、路径穿越/越权文件访问、注入、有实际影响的 XSS/CSRF、上传 PDF/印章的不安全处理、凭据泄漏。

**范围外：** 路线图中已明确尚未实现的加固项（如限流、CSP、CA 合规签名）、需要物理接触的攻击、无实际影响证明的扫描器结果、第三方服务自身漏洞（请上报上游）。

**部署方注意：** 非本地部署前必须更换 `NEXTAUTH_SECRET`、数据库与 MinIO 凭据；经反向代理启用 HTTPS；不要将 MinIO 桶设为公开；阶段 1 的盖章/签名不具备可靠电子签名法律效力（见 README 免责声明）。
