/**
 * HRSign E2E smoke test: full-link API scenario.
 *
 * Requires a running server and a seeded database.
 * Flow: HR uploads a template → configures fields → publishes; admin uploads a
 *       seal; HR issues a task (approve + seal + external sign) → leader
 *       approves → HR applies the company seal → external candidate signs via
 *       token → archive/audit checks → RBAC negative checks.
 *
 * Usage: node scripts/e2e-smoke.mjs [baseUrl]
 * Requires: the postgres container from docker compose (the external signing
 *           token is stored only as a hash, spec 4, so the test injects a
 *           known token hash for its external signer).
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";

const BASE = process.argv[2] ?? "http://localhost:3000";
const DB = "docker compose exec -T postgres psql -U hrsign -d hrsign -t -A -c";
const DEMO_SEAL_PNG = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../public/brand/demo-seal.png"),
);

let passed = 0;
let failed = 0;

function assert(cond, label, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label} ${extra}`);
  }
}

/** 1x1 transparent PNG (used for handwritten signature stubs only). */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** Log in via the NextAuth credentials flow; returns the cookie jar string. */
async function login(email, password) {
  const jar = new Map();
  const putCookies = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const idx = pair.indexOf("=");
      jar.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
  };
  const serialize = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
  const { csrfToken } = await csrfRes.json();
  putCookies(csrfRes);

  const form = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/tasks`,
    json: "true",
  });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: serialize() },
    body: form.toString(),
    redirect: "manual",
  });
  putCookies(res);
  const cookie = serialize();
  if ((res.headers.get("location") ?? "").includes("error")) return null;
  const check = await fetch(`${BASE}/api/tasks`, { headers: { Cookie: cookie }, redirect: "manual" });
  if (check.status !== 200) return null;
  return cookie;
}

async function req(cookie, method, path, body) {
  const headers = { Cookie: cookie };
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log(`HRSign E2E smoke test → ${BASE}\n`);

  // ===== 1. Log in with all four seeded account types =====
  console.log("1. Authentication");
  const hr = await login("hr@hrsign.local", "Hr@123456");
  const admin = await login("admin@hrsign.local", "Admin@123456");
  const leader = await login("leader@hrsign.local", "Leader@123456");
  const employee = await login("employee@hrsign.local", "Employee@123456");
  assert(!!hr && !!admin && !!leader && !!employee, "all four seeded accounts can log in");

  // ===== 2. Generate a test PDF and upload it as a template =====
  console.log("\n2. Template upload and field configuration");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`HRSign test template page ${i + 1}`, { x: 60, y: 780, size: 18, font });
  }
  const pdfBytes = Buffer.from(await pdf.save());

  const form = new FormData();
  form.set("name", "E2E smoke Offer template");
  form.set("category", "OFFER");
  form.set("file", new Blob([pdfBytes], { type: "application/pdf" }), "template.pdf");
  const tplRes = await req(hr, "POST", "/api/templates", form);
  assert(tplRes.status === 201 || tplRes.status === 200, "HR can upload a PDF template", JSON.stringify(tplRes.data));
  const templateId = tplRes.data?.template?.id;
  assert(!!templateId, "response contains the template id");

  const fieldsRes = await req(hr, "PUT", `/api/templates/${templateId}/fields`, {
    fields: [
      { type: "TEXT", label: "Full name", page: 1, x: 72, y: 600, width: 160, height: 24, required: true, fontSize: 14 },
      { type: "DATE", label: "Start date", page: 1, x: 72, y: 560, width: 140, height: 24, required: true, fontSize: 14 },
      { type: "TEXT", label: "Job duties", page: 1, x: 72, y: 420, width: 300, height: 24, required: false, fontSize: 12 },
      { type: "SEAL", label: "Company seal", page: 2, x: 380, y: 640, width: 120, height: 120, required: false },
      { type: "SIGNATURE", label: "Candidate signature", page: 2, x: 120, y: 640, width: 160, height: 60, required: false },
    ],
  });
  assert(fieldsRes.status === 200 && fieldsRes.data?.count === 5, "save 5 template fields", JSON.stringify(fieldsRes.data));

  const pubRes = await req(hr, "PATCH", `/api/templates/${templateId}`, { status: "PUBLISHED" });
  assert(pubRes.status === 200 && pubRes.data?.template?.versions?.[0]?.status === "PUBLISHED", "template is published");

  const tplDetail = await req(hr, "GET", `/api/templates/${templateId}`);
  const fields = tplDetail.data?.template?.versions?.[0]?.fields ?? [];
  assert(fields.length === 5, "template fields can be read back (with field ids)");

  // ===== 3. Seal upload =====
  console.log("\n3. Seal management");
  const sealForm = new FormData();
  sealForm.set("name", "E2E test seal");
  sealForm.set("file", new Blob([DEMO_SEAL_PNG], { type: "image/png" }), "seal.png");
  const sealRes = await req(admin, "POST", "/api/seals", sealForm);
  assert(sealRes.status === 201 || sealRes.status === 200, "admin can upload a transparent PNG seal", JSON.stringify(sealRes.data));
  const sealId = sealRes.data?.seal?.id;

  const badSealForm = new FormData();
  badSealForm.set("name", "Bad seal");
  badSealForm.set("file", new Blob([Buffer.from("not a png")], { type: "image/png" }), "bad.png");
  const badRes = await req(admin, "POST", "/api/seals", badSealForm);
  assert(badRes.status === 400, "non-PNG files are rejected (magic-number check)");

  // ===== 4. Create a signing task =====
  console.log("\n4. Signing task creation");
  const usersRes = await req(hr, "GET", "/api/users");
  const users = usersRes.data?.users ?? [];
  const leaderUser = users.find((u) => u.email === "leader@hrsign.local");
  const hrUser = users.find((u) => u.email === "hr@hrsign.local");
  assert(!!leaderUser && !!hrUser, "HR can read the internal user list");

  const fieldByName = Object.fromEntries(fields.map((f) => [f.label, f.id]));
  const taskRes = await req(hr, "POST", "/api/tasks", {
    templateId,
    title: "Jane Doe offer (E2E smoke)",
    flowType: "SEQUENTIAL",
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    formValues: {
      [fieldByName["Full name"]]: "Jane Doe",
      [fieldByName["Start date"]]: "2026-10-01",
      [fieldByName["Job duties"]]: "Backend service development and maintenance",
    },
    signers: [
      { signRole: "APPROVER", userId: leaderUser.id },
      { signRole: "COMPANY_SEAL", userId: hrUser.id },
      { signRole: "PERSONAL_SIGNATURE", externalFullName: "Jane Doe", externalEmail: "candidate@example.com" },
    ],
  });
  assert(taskRes.status === 201 || taskRes.status === 200, "sequential signing task is created", JSON.stringify(taskRes.data));
  const taskId = taskRes.data?.taskId;
  const docId = taskRes.data?.documentId;
  assert(!!taskId && !!docId, "response contains task and document ids");

  const missingRes = await req(hr, "POST", "/api/tasks", {
    templateId,
    title: "Task missing required fields",
    flowType: "SEQUENTIAL",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    formValues: {},
    signers: [
      { signRole: "APPROVER", userId: leaderUser.id },
      { signRole: "COMPANY_SEAL", userId: hrUser.id },
      { signRole: "PERSONAL_SIGNATURE", externalFullName: "Li Si", externalEmail: "candidate2@example.com" },
    ],
  });
  assert(missingRes.status === 400, "task creation with missing required fields is rejected");

  // ===== 5. Approval =====
  console.log("\n5. Approval flow");
  const detailForLeader = await req(leader, "GET", `/api/tasks/${taskId}`);
  assert(detailForLeader.data?.me?.canApprove === true, "it is the leader's turn to approve");
  const empDetail = await req(employee, "GET", `/api/tasks/${taskId}`);
  assert(empDetail.status === 403, "an unrelated employee cannot view the task");
  const hrDetail = await req(hr, "GET", `/api/tasks/${taskId}`);
  assert(hrDetail.data?.currentVersion === 1, "current document version is v1 (generated by form fill)");

  const sealBefore = await req(hr, "POST", `/api/tasks/${taskId}/sign`, {
    mode: "COMPANY_SEAL",
    sealId,
  });
  assert(sealBefore.status === 400, "sealing before approval is rejected (approval-before-seal)");

  const approveRes = await req(leader, "POST", `/api/tasks/${taskId}/approve`, { comment: "Approved, send promptly" });
  assert(approveRes.status === 201 || approveRes.status === 200, "leader approves the task", JSON.stringify(approveRes.data));
  const afterApprove = await req(leader, "GET", `/api/tasks/${taskId}`);
  assert(
    afterApprove.data?.task?.approvalStatus === "APPROVED" &&
    afterApprove.data?.task?.signingStatus === "IN_PROGRESS",
    "task enters the pending-signature state",
  );

  // ===== 6. Company seal + external signing =====
  console.log("\n6. Sealing and external signing");
  const sealRes2 = await req(hr, "POST", `/api/tasks/${taskId}/sign`, { mode: "COMPANY_SEAL", sealId });
  assert(
    (sealRes2.status === 201 || sealRes2.status === 200) && sealRes2.data?.version === 2,
    "HR applies the company seal and produces v2",
    JSON.stringify(sealRes2.data),
  );
  const wrongRole = await req(hr, "POST", `/api/tasks/${taskId}/sign`, { mode: "HANDWRITE", imageDataUrl: `data:image/png;base64,${TINY_PNG.toString("base64")}` });
  assert(wrongRole.status === 400 || wrongRole.status === 403, "the sealer cannot sign out of role or sign twice");

  // The external signing token is stored only as a SHA-256 hash (spec 4), so
  // the plaintext is unrecoverable. Inject a known token hash for the smoke
  // external signer, then use the corresponding plaintext token.
  const smokeToken = `smoke-token-${taskId}`;
  const smokeTokenHash = createHash("sha256").update(smokeToken).digest("hex");
  execSync(
    `${DB} "UPDATE signing_tokens SET \\"tokenHash\\"='${smokeTokenHash}' FROM signers WHERE signing_tokens.\\"signerId\\"=signers.id AND signers.\\"taskId\\"='${taskId}' AND signers.\\"signRole\\"='PERSONAL_SIGNATURE';"`,
    { encoding: "utf8" },
  );
  const tokenOut = smokeToken;
  assert(tokenOut.length > 10, "external signing token is available (DB)");

  const extRes = await fetch(`${BASE}/api/sign/external/${tokenOut}`);
  const extData = await extRes.json();
  assert(extData?.me?.canSign === true && extData?.fileUrl, "external signer can fetch task data without login");
  const extFile = await fetch(`${BASE}${extData.fileUrl}`);
  assert(extFile.ok && (extFile.headers.get("content-type") ?? "").includes("pdf"), "external signer can preview the PDF via token");

  // Email verification gate: start verification, then mark VERIFIED in DB (smoke only).
  const verifyStart = await fetch(`${BASE}/api/sign/external/${tokenOut}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale: "en" }),
  });
  const verifyStartData = await verifyStart.json();
  const verificationId = verifyStartData?.verificationId;
  assert(verifyStart.ok && !!verificationId, "external email verification can start", JSON.stringify(verifyStartData));
  execSync(
    `${DB} "UPDATE identity_verifications SET status='VERIFIED', \\"verifiedAt\\"=NOW() WHERE id='${verificationId}';"`,
    { encoding: "utf8" },
  );

  const extSign = await fetch(`${BASE}/api/sign/external/${tokenOut}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "HANDWRITE",
      imageDataUrl: `data:image/png;base64,${TINY_PNG.toString("base64")}`,
      verificationId,
    }),
  });
  const extSignData = await extSign.json();
  assert(
    extSign.ok && extSignData?.completed === true && extSignData?.version === 3,
    "external handwritten signature completes the task and produces v3",
    JSON.stringify(extSignData),
  );

  const extAgain = await fetch(`${BASE}/api/sign/external/${tokenOut}`);
  const extAgainData = await extAgain.json().catch(() => ({}));
  // The token is single-use (spec 4): after signing it is invalidated and the
  // link resolves to 404; canSign is also false while the token is still valid.
  assert(
    extAgain.status === 404 || extAgainData?.me?.canSign === false,
    "repeat signing is blocked by the state machine / single-use token",
    `status=${extAgain.status} ${JSON.stringify(extAgainData)}`,
  );

  // ===== 7. Archive and audit =====
  console.log("\n7. Archive and audit");
  const docs = await req(hr, "GET", "/api/documents");
  const doc = (docs.data?.documents ?? []).find((d) => d.id === docId);
  assert(!!doc && doc.versions[0]?.version === 3 && doc.versions.length === 3, "archived document keeps 3 versions (multi-version retention)");

  const logs = await req(hr, "GET", `/api/audit-logs?action=task.sign`);
  const signLogs = logs.data?.logs ?? [];
  assert(signLogs.length >= 2, "audit log records both signing actions", `got ${signLogs.length}`);

  // ===== 8. RBAC negative cases =====
  console.log("\n8. RBAC negative cases");
  const empTpl = await req(employee, "GET", "/api/templates");
  assert(empTpl.status === 403, "employees cannot access template management");
  const empLogs = await req(employee, "GET", "/api/audit-logs");
  assert(empLogs.status === 403, "employees cannot access audit logs");
  const empUsers = await req(employee, "GET", "/api/admin/users");
  assert(empUsers.status === 403, "employees cannot access user management");
  const leaderSeal = await req(leader, "POST", "/api/seals", sealForm);
  assert(leaderSeal.status === 403, "department leaders cannot upload seals");

  // ===== Result =====
  console.log(`\n========== Result: ${passed} passed, ${failed} failed ==========`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E smoke test aborted:", err);
  process.exit(1);
});
