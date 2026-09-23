# `@hrsign/sdk-ts`

Official TypeScript client for the HRSign Envelope API.

Works against **any** of the three backends (Next `/api/v1`, Python `/v1`, Go `/v1`) — same OpenAPI contract.

```ts
import { HrsignClient } from "@hrsign/sdk-ts";

const client = new HrsignClient({
  baseUrl: "http://localhost:3000/api/v1",
  apiKey: process.env.HRSIGN_API_KEY,
});

await client.health();
const { envelopes } = await client.listEnvelopes({ limit: 20 });
const pack = await client.evidencePack(envelopes[0].id);
```

## Surface (Phase 1–4)

| Area | Methods |
|------|---------|
| Health | `health` |
| Envelopes | `list/get/create/send/void`, `signRecipient`, `replaceTabs`, `certificate`, `evidencePack` |
| Accounts | `list/create/get`, `addAccountMember`, `listBrands`, `createBrand` |
| PowerForms / Clickwrap / Rooms / CLM / Notary | list + create |
| Trust | `listTrustProviders`, `listIdvMethods` |

Python / Go SDK packages are planned as thin OpenAPI-generated clients pointing at the same paths.
