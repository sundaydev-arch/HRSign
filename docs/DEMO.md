# HRSign demo guide

Prepare demo data (requires **Postgres + MinIO + worker**):

```bash
docker compose up -d postgres minio minio-init worker
pnpm exec prisma migrate deploy
pnpm db:seed
pnpm dev
```

> **Worker required** for notification retries, expiry scans, and retention. Without it, flows may stall.

Open http://localhost:3000 — switch the UI language to **English** for the seeded roster.

## Accounts

| Role | Email | Password | Persona |
|------|-------|----------|---------|
| Super admin | `admin@hrsign.local` | `Admin@123456` | Kai Lin · users / settings / seals / webhooks |
| HR | `hr@hrsign.local` | `Hr@123456` | Avery Chen · templates, send, external links, archive |
| Dept leader | `leader@hrsign.local` | `Leader@123456` | Morgan Lee · **pending approval** (offer ready) |
| Employee | `employee@hrsign.local` | `Employee@123456` | Riley Wang · apply **Yunqi HR Seal** after approval |

Tenant company: **Yunqi Information Technology (Shanghai) Co., Ltd.** Login emails stay on `.local` for local demos.

## Starter templates (published · English)

| Template | Category |
|----------|----------|
| **2026 Standard Employment Contract** | CONTRACT |
| **Offer Letter** | OFFER |
| **Onboarding Form** | ENTRY |
| **Resignation Certificate** | RESIGN |
| **Employment Certificate** | CERTIFICATE |

Seals: **Yunqi Company Seal**, **Yunqi Contract Seal**, **Yunqi HR Seal**.

Chinese presets remain available via “Create from HR preset” if you switch the UI to中文.

## 5-minute path

1. **leader** → Tasks → Pending approval → **Offer letter — Wanqing Zhou · Product Manager** → Approve.  
2. **employee** → Pending signature → choose **Yunqi HR Seal** → stamp.  
3. **hr** → same task → copy short link / resend email for the external signer.  
4. Incognito `/s/{code}` → email code (Mailpit / server logs) → handwritten signature.  
5. **hr** → archive + audit log.

### Optional

- Templates → create from HR preset, edit, publish.  
- Task detail → revoke / void / decline; re-initiate after reject.  
- Admin → watermark text; API keys + webhooks.
