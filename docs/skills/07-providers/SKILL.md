---
name: providers
description: Use when adding or replacing signature, identity, notify, or storage implementations (e.g. PAdES/national crypto, face, DingTalk/Feishu, AWS S3/OSS/COS). Business code depends only on interfaces; registry factory usage; stage-2 empty implementations; do not build compliance features early.
---

# Skill 07: Provider extension

## When to use

- Plug in a new sign/seal implementation (CA/PAdES/GM SM2)
- Add a notify channel (DingTalk, Feishu, SMS) or identity method (face/real-name)
- Swap or add object storage (AWS S3, Aliyun OSS, Tencent COS)

## Core files

- Interface source of truth: [providers/types.ts](../../../src/server/providers/types.ts) (SignatureProvider / IdentityVerifier / Notifier / StorageProvider + DocumentVersionRef/SignerContext + NotImplementedError)
- Registry and default wiring: [providers/index.ts](../../../src/server/providers/index.ts) (register/getXxx, registerStage1Defaults)
- Stage-1 implementations: [signature/image-seal.ts](../../../src/server/providers/signature/image-seal.ts), [identity/email-code.ts](../../../src/server/providers/identity/email-code.ts), [notify/email.ts](../../../src/server/providers/notify/email.ts), [storage/minio.ts](../../../src/server/providers/storage/minio.ts)
- Stage-2 **demo** crypto: [signature/pades.ts](../../../src/server/providers/signature/pades.ts) (PEM PKCS#7), [gm-sm2.ts](../../../src/server/providers/signature/gm-sm2.ts) (SM2 digest). Select via AppSettings `signatureMethod` or env `PADES_*` / `GM_SM2_*`.
- Notify bots: [wecom.ts](../../../src/server/providers/notify/wecom.ts), [dingtalk.ts](../../../src/server/providers/notify/dingtalk.ts), [lark.ts](../../../src/server/providers/notify/lark.ts) — fan-out via [channels.ts](../../../src/server/providers/notify/channels.ts) from AppSettings `notifyChannels`.
- Task-event orchestration: [server/notifications/task-events.ts](../../../src/server/notifications/task-events.ts) (uses `fanOutChannels`)

## Hard rules

1. **Business code imports only interfaces and factory getXxx(); never import concrete implementation classes.** Switching implementations only changes registry wiring; callers stay unchanged.
2. Interface inputs use minimal Ref/Context shapes (e.g. DocumentVersionRef); **do not pass Prisma models into Providers**.
3. SignatureProvider.sign must return new DocumentVersion info (version/stage/storageKey/sha256) + a Signature record; obey no-overwrite versions (skill 03).
4. Stage-2 capabilities are **empty implementations only**: methods `return notImplemented("Xxx.method")`; unused parameters are omitted (ESLint no-unused-vars); comments point at the interface signature; keep and export the class so the registry can demo it.
5. Storage put: keys include version semantics; hitting an existing key must throw by default; `allowOverwrite` only for static assets like fonts. presignGet TTL is clamped to 60–3600 seconds (default 300).
6. Notifier: templates use templateKey + NotificationParams (ICU render inside the Provider); results write NotificationLog (SENT/FAILED/SKIPPED + error); do not swallow errors. **Notifications must not block the main business transaction** — failures are logged; retries belong to a future queue.
7. IdentityVerifier: codes/credentials stored hashed only; cooldown, attempt limits, expiry; no biometric storage (face returns result status only).
8. New env vars: add comments in .env.example and read code only; **.env / docker-compose changes need prior approval**; env should eventually go through zod at startup (current gap — when adding a module, add that module's env schema).
9. Before heavy SDKs: prefer the existing S3 client for S3-compatible stores; IM webhooks prefer fetch.

## Standard steps (example: add DingTalk notify)

1. Create `providers/notify/dingtalk.ts`, `export class DingtalkNotifier implements Notifier`
2. Register in index.ts (select by channel; Email stays default)
3. Reuse the notification schema to render copy; write NotificationLog
4. Document config in .env.example; do not edit .env
5. Minimal self-test (construct recipient/templateKey/params and call send)

## Known inconsistency (align when you touch it; do not expand scope)

- types.ts `Locale = "zh_CN" | "en"` (underscore) vs i18n `"zh-CN" | "en"` (hyphen). Map at the boundary when wiring notify/identity locale, and leave a comment.

## Do not

- ❌ Business routes `new MinioStorageProvider()` / depend on a concrete class
- ❌ Implement real PAdES/face logic in a stage-1 milestone
- ❌ Prisma queries or Next response objects inside a Provider
- ❌ Swallow send errors and return SENT

## Done when

- [ ] Implemented against the interface; callers do not mention concrete classes
- [ ] New empty/real implementations pass lint (no unused vars) and tsc
- [ ] Results land in the matching log table; config only touches .env.example
