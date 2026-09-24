# Deploy HRSign

## Local / staging

```bash
docker compose up -d postgres minio minio-init
pnpm db:migrate:deploy && pnpm db:seed
pnpm dev   # or: docker compose --profile full up -d

# Staging ports (3001 / 5434):
docker compose -f docker-compose.yml -f docker-compose.staging.yml --profile full up -d
```

## Images (GHCR)

On push to `main`, `.github/workflows/release-images.yml` builds:

- `ghcr.io/<owner>/hrsign-web`
- `ghcr.io/<owner>/hrsign-worker`

## Helm

```bash
kubectl create secret generic hrsign-secrets \
  --from-literal=DATABASE_URL='...' \
  --from-literal=NEXTAUTH_SECRET='...'
helm upgrade --install hrsign deploy/helm/hrsign
```

## Gateway

Nginx sample: [`deploy/nginx/default.conf`](../deploy/nginx/default.conf). Terminate TLS at the edge; set `RATE_LIMIT_REDIS_URL` when running multiple web replicas.

## Active-passive

Share one Postgres + MinIO. Run ≥1 web replica and 1 worker. Sticky sessions are not required for `/api`. Fail over by pointing the load balancer at a healthy replica (`/api/health?probe=ready`).

## Sibling APIs

```bash
# Python
HRSIGN_DATABASE_URL=$DATABASE_URL uvicorn app.main:app --app-dir apps/api-py --port 8000

# Go
HRSIGN_DATABASE_URL=$DATABASE_URL go run ./apps/api-go/cmd/server

NEXT_PUBLIC_API_BASE=http://localhost:8000/v1 pnpm dev
```

See also: [slo.md](./slo.md), [pades.md](./pades.md).
