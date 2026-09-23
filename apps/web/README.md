# @hrsign/web — Next.js UI + optional TypeScript API

This app includes:

1. **Browser UI** (can talk to **any** of the three backends)
2. **TypeScript Envelope API** at `/api/v1` (one of three independent backends)

Sibling backends (do **not** depend on this package):

- [`../api-py`](../api-py) — FastAPI
- [`../api-go`](../api-go) — Go

```bash
# UI → Next API (default)
pnpm dev

# UI → Python API only
NEXT_PUBLIC_API_BASE=http://localhost:8000/v1 pnpm dev

# UI → Go API only
NEXT_PUBLIC_API_BASE=http://localhost:8080/v1 pnpm dev
```
