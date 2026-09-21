---
name: hr-pdf-pipeline
description: 涉及模板字段坐标、PDF 填充、字体嵌入、盖章、水印、手写签名合成、文档版本生成时使用。规定 PDF 只在后端修改、坐标结构与原点、storageKey 版本命名、多版本不覆盖、前端只做预览拖拽。
---

# 技能 03：PDF 处理管线

## 何时使用

- 改模板编辑器字段/坐标、填充引擎、盖章与水印、签名图片合成
- 新增一种 DocumentVersion stage
- 处理中文字体或文本溢出

## 模块地图

| 关注点 | 文件 |
|---|---|
| 字段坐标 schema | [schemas/coordinates.ts](../../../src/schemas/coordinates.ts)：`{ page, x, y, width, height, rotation }`，page 从 1 开始 |
| 后端填充 | [lib/pdf/fill.ts](../../../src/lib/pdf/fill.ts)（FillField 扁平结构、FILLABLE_TYPES=TEXT/DATE） |
| 中文字体 | [lib/pdf/font.ts](../../../src/lib/pdf/font.ts) + [public/fonts/NotoSansSC-Regular.otf](../../../public/fonts)（fontkit 嵌入，随仓库带 OFL） |
| 盖章/水印 | [lib/pdf/stamp.ts](../../../src/lib/pdf/stamp.ts) `stampPdf(bytes, images, options)` |
| 签署编排 | [lib/signing.ts](../../../src/lib/signing.ts) `executeSign/loadTaskForSign` |
| Provider | [providers/signature/image-seal.ts](../../../src/server/providers/signature/image-seal.ts)（阶段1），pades/gm-sm2 为阶段2 空实现 |
| 前端预览/编辑 | [components/pdf/PdfViewer.tsx](../../../src/components/pdf/PdfViewer.tsx)、[TemplateEditor.tsx](../../../src/components/pdf/TemplateEditor.tsx)、[SignaturePad.tsx](../../../src/components/pdf/SignaturePad.tsx) |

## 硬规则

1. **任何 PDF 修改只在后端**；前端代码中不得出现 pdf-lib 的写入/保存调用。前端 pdf.js 仅渲染与坐标采集。
2. **多版本不覆盖**：每次产物写新 key（现行约定 `documents/{docId}/v{n}-{STAGE}.pdf`），同 key 禁 put 覆盖（StorageProvider 语义）；同步落 DocumentVersion（version/stage/storageKey/sha256/createdBy）。
3. 每次写文件前算 `sha256` 并存版本记录；模板上传同样算 sha256。
4. 坐标经 CoordinatesSchema 解析后使用。**注意原点语义**：schema 规定 PDF point 左下原点；当前编辑器存的是左上原点像素语义，转换纯函数模块尚缺——在该模块落地前不要擅自翻转数值，改动需在注释中标注语义并列入遗留项。
5. 字段类型：可填值 TEXT/DATE；签章域 SEAL/SIGNATURE（PERFORATION_SEAL 预留不做）。`placeholder` 旧字段已统一为 TemplateField.**defaultValue**。
6. 管线顺序固定：填充 → 水印 → 盖章 → 个人签名 →（阶段2）加密 → 锁定；盖章/水印/填充都必须发生在加密签名之前。
7. 水印：全局文案读 `WATERMARK_TEXT`（signing.ts 透传给 StampOptions）；敏感文档"下载人+时间"动态水印尚未实现，新增时不得移除全局水印逻辑。
8. pdf.js worker 从 `/pdf.worker.min.mjs` 自托管加载，不引 CDN；`GlobalWorkerOptions.workerSrc` 写法保持现状。
9. 中文输出必须走嵌入字体路径，禁止依赖系统字体。

## 标准步骤（以"新增字段效果"为例）

1. 先确认字段类型与坐标来源（编辑器保存的是扁平 page/x/y…，PUT 接口包装为 coordinates Json）
2. 在 fill.ts/stamp.ts 做纯函数式处理，入参带 buffer，出参带新 buffer
3. 调用方（signing 或 tasks 路由）负责存新版本+哈希，不在 pdf 工具函数里碰 Prisma
4. 含中文的结果应有快照/样例验证（当前测试缺口，新增逻辑至少提供手工自测 PDF）

## 禁忌

- ❌ 在浏览器端 import pdf-lib 改文件
- ❌ 复用同一 storageKey 覆盖旧版本
- ❌ 在工具函数内直接 new PrismaClient 或发通知
- ❌ 硬编码字体路径到系统目录

## 完成检查

- [ ] 新版本号/stage/sha256/createdBy 四要素齐全
- [ ] tsc、test 通过；中文渲染手工验证
- [ ] 坐标语义若有变动已在注释与遗留清单说明
