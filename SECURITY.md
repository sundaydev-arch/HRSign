# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.3.x (current) | Best-effort security fixes on `main` |
| 0.2.x | Security fixes only if still tagged; prefer upgrading to 0.3.x |
| < 0.2 | Not supported |

HRSign is pre-1.0 software. Self-hosters are expected to track `main` (or a tagged release once 1.0 ships) and apply fixes promptly.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them privately:

1. **Preferred:** enable and use [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository ("Report a vulnerability" on the Security tab). Fork maintainers should turn this on under **Settings → Code security**.
2. If private reporting is not available yet, open a **blank issue titled `[SECURITY]`** and ask maintainers for a private channel — do **not** include exploit details in the public body.

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

Out of scope: missing hardening that is explicitly documented as not-yet-implemented on the roadmap (e.g. CAPTCHA on public PowerForms, full CSP headers, CA-qualified signatures), reports requiring physical access, automated scanner output without demonstrated impact, and vulnerabilities in third-party services (report upstream).

## Security notes for operators

- Change `NEXTAUTH_SECRET`, database and MinIO credentials before any non-local deployment.
- Serve over HTTPS behind a reverse proxy; keep `AUTH_TRUST_HOST` aligned with your proxy setup.
- Seal master images are read server-side only; do not make the MinIO bucket public.
- Phase 1 seals/signatures are **not** legally qualified electronic signatures — see the README disclaimer.
- Public PowerForm start is rate-limited in-process; put a reverse-proxy or WAF limit in front for multi-instance production.
