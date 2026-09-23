---
name: pdf-pipeline
description: Use for template field coordinates, PDF fill, font embedding, stamps, watermarks, handwriting overlay, and document version generation. PDFs are mutated only on the backend; defines coordinate origin, storageKey version naming, no overwrite of versions, and frontend preview/drag only.
---

# Skill 03: PDF processing pipeline

## When to use

- Change template editor fields/coordinates, the fill engine, stamps and watermarks, or signature image overlay
- Add a DocumentVersion stage
- Handle CJK fonts or text overflow

## Module map

| Concern | File |
|---|---|
| Field coordinate schema | [schemas/coordinates.ts](../../../src/schemas/coordinates.ts): `{ page, x, y, width, height, rotation }`, page starts at 1 |
| Backend fill | [lib/pdf/fill.ts](../../../src/lib/pdf/fill.ts) (flat FillField, FILLABLE_TYPES=TEXT/DATE) |
| CJK fonts | [lib/pdf/font.ts](../../../src/lib/pdf/font.ts) + [public/fonts/NotoSansSC-Regular.ttf](../../../public/fonts) (static TrueType; embed with `{ subset: false }` — fontkit CJK subsetting and CFF/OTF break in pdf.js) |
| Stamp/watermark | [lib/pdf/stamp.ts](../../../src/lib/pdf/stamp.ts) `stampPdf(bytes, images, options)` |
| Sign orchestration | [lib/signing.ts](../../../src/lib/signing.ts) `executeSign/loadTaskForSign` |
| Provider | [providers/signature/image-seal.ts](../../../src/server/providers/signature/image-seal.ts) (stage 1); pades/gm-sm2 are stage-2 empty implementations |
| Frontend preview/edit | [components/pdf/PdfViewer.tsx](../../../src/components/pdf/PdfViewer.tsx), [TemplateEditor.tsx](../../../src/components/pdf/TemplateEditor.tsx) (PDF_OVERLAY), [DocumentEditor.tsx](../../../src/components/docs/DocumentEditor.tsx) (DOCUMENT / TipTap), [SignaturePad.tsx](../../../src/components/pdf/SignaturePad.tsx) |
| Document → PDF | [lib/pdf/document-render.ts](../../../src/lib/pdf/document-render.ts) `renderDocumentToPdf` on publish; TipTap JSON in `TemplateVersion.contentJson` |
| TipTap deps | `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder` — allowed for DOCUMENT editor mode only |

## Hard rules

1. **Any PDF mutation happens only on the backend**; frontend code must not call pdf-lib write/save. Frontend pdf.js only renders and collects coordinates.
2. **Never overwrite versions**: each artifact gets a new key (current convention `documents/{docId}/v{n}-{STAGE}.pdf`); putting over the same key is forbidden (StorageProvider semantics); always persist DocumentVersion (version/stage/storageKey/sha256/createdBy).
3. Compute `sha256` before every write and store it on the version; template uploads also store sha256.
4. Coordinates are used only after CoordinatesSchema parse. **Origin semantics**: the schema specifies PDF-point origin at bottom-left; the editor currently stores top-left pixel semantics; a dedicated conversion module is still missing — do not flip values until that lands; annotate origin in comments and list it as leftover work.
5. Field types: fillable TEXT/DATE; sign/seal domains SEAL/SIGNATURE (PERFORATION_SEAL reserved, not built). The old `placeholder` field is unified as TemplateField.**defaultValue**.
6. Pipeline order is fixed: fill → watermark → stamp → personal signature → (stage 2) encrypt → lock; stamp/watermark/fill must all happen before cryptographic signing.
7. Watermark: global copy from `WATERMARK_TEXT` (signing.ts passes through to StampOptions); per-download "downloader + timestamp" watermark is not implemented yet; adding it must not remove the global watermark path.
8. pdf.js worker loads from self-hosted `/pdf.worker.min.mjs`, not a CDN; keep the current `GlobalWorkerOptions.workerSrc` style.
9. CJK output must use the embedded-font path; do not rely on system fonts.

## Standard steps (example: new field effect)

1. Confirm field type and coordinate source (editor saves flat page/x/y…; PUT wraps them as coordinates Json)
2. Implement pure functions in fill.ts/stamp.ts: buffer in, new buffer out
3. Callers (signing or tasks routes) persist the new version + hash; pdf helpers must not touch Prisma
4. Results that include CJK should have snapshot/sample verification (current test gap; new logic at least needs a manual sample PDF)

## Do not

- ❌ Import pdf-lib in the browser to mutate files
- ❌ Reuse the same storageKey and overwrite an old version
- ❌ Instantiating PrismaClient or sending notifications inside PDF helpers
- ❌ Hardcoding font paths to system directories

## Done when

- [ ] New version has version/stage/sha256/createdBy
- [ ] tsc and tests pass; CJK rendering verified manually
- [ ] Coordinate-semantics changes are documented in comments and the leftover list
