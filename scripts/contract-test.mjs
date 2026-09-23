#!/usr/bin/env node
/**
 * Contract gate for open-source triple-backend parity.
 * Checks shared artifacts exist and optionally smoke-tests live backends.
 *
 * Usage:
 *   node scripts/contract-test.mjs
 *   NEXT_URL=http://localhost:3000/api/v1 PY_URL=http://localhost:8000/v1 GO_URL=http://localhost:8080/v1 node scripts/contract-test.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const required = [
  "packages/contracts/openapi/docusign-parity.yaml",
  "packages/contracts/schema/erd.md",
  "packages/contracts/schema/envelope.sql",
  "packages/contracts/state-machines/envelope.yaml",
  "packages/contracts/state-machines/recipient.yaml",
  "packages/contracts/FEATURE_MATRIX.md",
  "apps/api-py/app/main.py",
  "apps/api-go/cmd/server/main.go",
  "apps/api-go/internal/api/server.go",
  "packages/sdk-ts/src/index.ts",
];

let failed = 0;
for (const rel of required) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    console.error(`MISSING ${rel}`);
    failed++;
  } else {
    console.log(`ok  ${rel}`);
  }
}

const oas = readFileSync(join(root, "packages/contracts/openapi/docusign-parity.yaml"), "utf8");
for (const path of [
  "/envelopes",
  "/health",
  "/powerforms",
  "/clickwraps",
  "/rooms",
  "/clm/agreements",
  "/trust/providers",
  "/evidence",
  "/accounts",
  "/connect/configurations",
  "/sign/envelope/{envelopeId}",
]) {
  if (!oas.includes(path)) {
    console.error(`OpenAPI missing path ${path}`);
    failed++;
  }
}

async function smoke(name, base) {
  if (!base) return;
  const rootUrl = base.replace(/\/$/, "");
  try {
    const res = await fetch(`${rootUrl}/health`);
    const json = await res.json();
    if (!res.ok || json.status !== "ok") throw new Error(JSON.stringify(json));
    console.log(`ok  live ${name} health → ${json.backend}`);

    const paths = [
      "/tabs/types",
      "/identity/methods",
      "/trust/providers",
      "/accounts",
      "/envelopes",
      "/powerforms",
      "/clickwraps",
      "/rooms",
      "/clm/agreements",
      "/notary/transactions",
      "/connect/configurations",
    ];
    for (const p of paths) {
      const r = await fetch(`${rootUrl}${p}`);
      if (!r.ok) throw new Error(`${p} → HTTP ${r.status}`);
    }
    console.log(`ok  live ${name} catalog routes`);

    // create → send → hosted view → sign → certificate → evidence
    const created = await fetch(`${rootUrl}/envelopes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: `contract-${name}`,
        documents: [{ name: "Doc.pdf" }],
        recipients: [{ name: "A", email: "a@example.com", recipientType: "signer" }],
      }),
    });
    if (!created.ok) throw new Error(`create envelope ${created.status}`);
    const env = await created.json();
    const sent = await fetch(`${rootUrl}/envelopes/${env.id}/send`, { method: "POST" });
    if (!sent.ok) throw new Error(`send ${sent.status}`);
    const sentBody = await sent.json();
    const signer = (sentBody.recipients || []).find((x) => x.recipientType === "signer");
    if (!signer) throw new Error("no signer");
    const accessUrl = signer.accessUrl || "";
    const tokenMatch = /[?&]t=([^&]+)/.exec(accessUrl);
    if (tokenMatch) {
      const hosted = await fetch(
        `${rootUrl}/sign/envelope/${env.id}?r=${signer.id}&t=${encodeURIComponent(tokenMatch[1])}`,
      );
      if (!hosted.ok) throw new Error(`hosted sign GET ${hosted.status}`);
      const hostedBody = await hosted.json();
      if (!Array.isArray(hostedBody.tabs)) throw new Error("hosted sign missing tabs");
    }
    // skip IDV for backends that require it when method is none
    const signed = await fetch(`${rootUrl}/envelopes/${env.id}/recipients/${signer.id}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!signed.ok) throw new Error(`sign ${signed.status} ${await signed.text()}`);
    const coc = await fetch(`${rootUrl}/envelopes/${env.id}/certificate`);
    if (!coc.ok) throw new Error(`certificate ${coc.status}`);
    const evid = await fetch(`${rootUrl}/envelopes/${env.id}/evidence`);
    if (!evid.ok) throw new Error(`evidence ${evid.status}`);
    const pack = await evid.json();
    if (!pack.integrity?.sha256) throw new Error("evidence missing integrity.sha256");
    console.log(`ok  live ${name} envelope lifecycle + hosted + evidence`);
  } catch (err) {
    console.error(`FAIL live ${name}:`, err.message ?? err);
    failed++;
  }
}

await smoke("next", process.env.NEXT_URL);
await smoke("python", process.env.PY_URL);
await smoke("go", process.env.GO_URL);

if (failed > 0) {
  console.error(`\ncontract:test failed (${failed})`);
  process.exit(1);
}
console.log("\ncontract:test passed");
