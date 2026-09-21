"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client";
import { FIELD_TYPE_LABEL_KEYS } from "@/lib/labels";
import { useApiError } from "@/lib/use-api-error";
import { CoordinatesSchema } from "@/schemas/coordinates";
import type { FieldType, TemplateField } from "@prisma/client";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PenLine,
  Save,
  Stamp,
  Trash2,
  Type
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface EditorField {
  localId: string;
  type: FieldType;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  placeholder: string;
  fontSize: number;
}

interface PageSize {
  width: number;
  height: number;
}

const FIELD_PALETTE: Array<{ type: FieldType; icon: React.ComponentType<{ className?: string }>; width: number; height: number }> = [
  { type: "TEXT", icon: Type, width: 180, height: 28 },
  { type: "DATE", icon: CalendarDays, width: 140, height: 28 },
  { type: "SEAL", icon: Stamp, width: 120, height: 120 },
  { type: "SIGNATURE", icon: PenLine, width: 160, height: 70 },
];

const FIELD_COLORS: Record<FieldType, string> = {
  TEXT: "border-blue-400 bg-blue-50/80",
  DATE: "border-violet-400 bg-violet-50/80",
  SEAL: "border-red-400 bg-red-50/70",
  SIGNATURE: "border-emerald-400 bg-emerald-50/70",
  // spec 20.6: perforation seals are reserved for a later phase; keep the
  // color mapping but do not expose the type in the field palette yet.
  PERFORATION_SEAL: "border-orange-400 bg-orange-50/70",
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function TemplateEditor({
  templateId,
  fileUrl,
  pageCount,
  initialFields,
}: {
  templateId: string;
  fileUrl: string;
  pageCount: number;
  initialFields: TemplateField[];
}) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const apiError = useApiError();

  const [fields, setFields] = useState<EditorField[]>(() =>
    initialFields.flatMap((field) => {
      // Coordinates live in a Json column and must pass through zod (spec 3.1);
      // drop rows whose stored data fails validation.
      const parsed = CoordinatesSchema.safeParse(field.coordinates);
      if (!parsed.success) return [];
      const coordinates = parsed.data;
      return [
        {
          localId: field.id,
          type: field.type,
          label: field.label,
          page: coordinates.page,
          x: coordinates.x,
          y: coordinates.y,
          width: coordinates.width,
          height: coordinates.height,
          required: field.required,
          // In the current schema the placeholder semantics live on defaultValue.
          placeholder: field.defaultValue ?? "",
          fontSize: field.fontSize,
        },
      ];
    }),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [scale, setScale] = useState(1);
  const [rendering, setRendering] = useState(true);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<Awaited<ReturnType<typeof import("pdfjs-dist").getDocument>["promise"]> | null>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const pageWidth = pageSizes[currentPage - 1]?.width ?? 595;
  const pageHeight = pageSizes[currentPage - 1]?.height ?? 842;

  // Load the PDF document and collect per-page dimensions.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ url: fileUrl }).promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        pdfDocRef.current = doc;
        const sizes: PageSize[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          sizes.push({ width: viewport.width, height: viewport.height });
        }
        setPageSizes(sizes);
      } catch {
        toast.error(t("pdfLoadFailed"));
      }
    })();
    return () => {
      cancelled = true;
      void pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, [fileUrl, t]);

  // Render the current page, scaled to fit the available width.
  const renderPage = useCallback(async () => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || pageSizes.length === 0) return;
    setRendering(true);
    const page = await doc.getPage(currentPage);
    const containerWidth = wrapperRef.current?.clientWidth ?? 720;
    const nextScale = Math.min(1.8, containerWidth / pageWidth);
    setScale(nextScale);
    const viewport = page.getViewport({ scale: nextScale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    await page.render({ canvasContext: ctx, viewport }).promise;
    setRendering(false);
  }, [currentPage, pageSizes, pageWidth]);

  useEffect(() => {
    void renderPage();
  }, [renderPage]);

  const displayWidth = Math.floor(pageWidth * scale);

  function addField(type: FieldType) {
    const preset = FIELD_PALETTE.find((p) => p.type === type)!;
    const count = fields.filter((field) => field.type === type).length + 1;
    const width = Math.min(preset.width, pageWidth - 40);
    const height = preset.height;
    const field: EditorField = {
      localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      label: t("defaultName", { typeLabel: tl(FIELD_TYPE_LABEL_KEYS[type]), count }),
      page: currentPage,
      x: Math.max(10, (pageWidth - width) / 2),
      y: Math.max(10, pageHeight * 0.38),
      width,
      height,
      required: type === "TEXT" || type === "DATE",
      placeholder: "",
      fontSize: 12,
    };
    setFields((prev) => [...prev, field]);
    setSelectedId(field.localId);
  }

  function startDrag(e: React.PointerEvent, field: EditorField, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(field.localId);
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { x: field.x, y: field.y, width: field.width, height: field.height };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scaleRef.current;
      const dy = (ev.clientY - startY) / scaleRef.current;
      setFields((prev) =>
        prev.map((item) => {
          if (item.localId !== field.localId) return item;
          if (mode === "move") {
            return {
              ...item,
              x: clamp(orig.x + dx, 0, pageWidth - item.width),
              y: clamp(orig.y + dy, 0, pageHeight - item.height),
            };
          }
          return {
            ...item,
            width: clamp(orig.width + dx, 30, pageWidth - item.x),
            height: clamp(orig.height + dy, 18, pageHeight - item.y),
          };
        }),
      );
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  }

  function removeField(localId: string) {
    setFields((prev) => prev.filter((field) => field.localId !== localId));
    setSelectedId(null);
  }

  function updateSelected(patch: Partial<EditorField>) {
    if (!selectedId) return;
    setFields((prev) => prev.map((field) => (field.localId === selectedId ? { ...field, ...patch } : field)));
  }

  async function saveFields() {
    setSaving(true);
    try {
      await api(`/api/templates/${templateId}/fields`, {
        method: "PUT",
        body: JSON.stringify({
          fields: fields.map((field) => ({
            type: field.type,
            label: field.label,
            page: field.page,
            x: Math.round(field.x),
            y: Math.round(field.y),
            width: Math.round(field.width),
            height: Math.round(field.height),
            required: field.required,
            placeholder: field.placeholder || undefined,
            fontSize: field.fontSize,
          })),
        }),
      });
      toast.success(t("saveSuccess"));
    } catch (err) {
      toast.error(apiError(err, "common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const pageFields = fields.filter((field) => field.page === currentPage);
  const selected = fields.find((field) => field.localId === selectedId) ?? null;
  const isValueField = selected ? ["TEXT", "DATE"].includes(selected.type) : false;

  return (
    <div className="flex gap-4">
      {/* Left column: field palette */}
      <div className="w-52 shrink-0 space-y-4">
        <div className="rounded-lg border bg-white p-3">
          <div className="mb-2 text-xs font-medium text-gray-500">{t("addFieldHint")}</div>
          <div className="space-y-2">
            {FIELD_PALETTE.map((paletteItem) => {
              const Icon = paletteItem.icon;
              return (
                <Button
                  key={paletteItem.type}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => addField(paletteItem.type)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {tl(FIELD_TYPE_LABEL_KEYS[paletteItem.type])}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="mb-2 text-xs font-medium text-gray-500">{t("configuredFields", { count: fields.length })}</div>
          <div className="space-y-1">
            {fields.length === 0 && <div className="py-2 text-xs text-gray-400">{t("noFields")}</div>}
            {fields.map((field) => (
              <button
                key={field.localId}
                className={`w-full truncate rounded px-2 py-1 text-left text-xs ${
                  field.localId === selectedId ? "bg-blue-50 font-medium text-blue-700" : "text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => {
                  setCurrentPage(field.page);
                  setSelectedId(field.localId);
                }}
              >
                P{field.page} · {field.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Middle column: PDF canvas with the field overlay */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between rounded-lg border bg-white px-3 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              {t("pageIndicator", { current: currentPage, total: pageCount })}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= pageCount}
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {rendering && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>
          <Button size="sm" onClick={() => void saveFields()} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? tc("saving") : t("save")}
          </Button>
        </div>

        <div ref={wrapperRef} className="flex justify-center rounded-lg bg-gray-200/60 p-4">
          <div className="relative shadow-md" style={{ width: displayWidth }}>
            <canvas ref={canvasRef} className="block rounded-sm bg-white" />
            <div className="absolute inset-0">
              {pageFields.map((field) => (
                <div
                  key={field.localId}
                  onPointerDown={(e) => startDrag(e, field, "move")}
                  className={`absolute cursor-move rounded border-2 ${FIELD_COLORS[field.type]} ${
                    field.localId === selectedId ? "ring-2 ring-blue-500 ring-offset-1" : ""
                  }`}
                  style={{
                    left: field.x * scale,
                    top: field.y * scale,
                    width: field.width * scale,
                    height: field.height * scale,
                  }}
                >
                  <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded bg-gray-800 px-1 text-[10px] leading-4 text-white">
                    {field.label}
                  </span>
                  <span className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden text-[10px] text-gray-500">
                    {tl(FIELD_TYPE_LABEL_KEYS[field.type])}
                  </span>
                  <div
                    onPointerDown={(e) => startDrag(e, field, "resize")}
                    className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-full border border-white bg-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right column: properties panel */}
      <div className="w-60 shrink-0">
        <div className="rounded-lg border bg-white p-3">
          <div className="mb-3 text-xs font-medium text-gray-500">{t("propsTitle")}</div>
          {!selected ? (
            <div className="py-6 text-center text-xs text-gray-400">{t("selectHint")}</div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("fieldName")}</Label>
                <Input
                  className="h-8"
                  value={selected.label}
                  onChange={(e) => updateSelected({ label: e.target.value })}
                />
              </div>
              {isValueField && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("placeholderLabel")}</Label>
                    <Input
                      className="h-8"
                      value={selected.placeholder}
                      onChange={(e) => updateSelected({ placeholder: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("fontSize", { size: selected.fontSize })}</Label>
                    <Input
                      type="range"
                      min={6}
                      max={24}
                      step={1}
                      value={selected.fontSize}
                      onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.required}
                      onCheckedChange={(v) => updateSelected({ required: v === true })}
                    />
                    {t("required")}
                  </label>
                </>
              )}
              <div className="rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-500">
                {t("geometry", {
                  x: Math.round(selected.x),
                  y: Math.round(selected.y),
                  width: Math.round(selected.width),
                  height: Math.round(selected.height),
                  page: selected.page,
                })}
              </div>
              <Button variant="destructive" size="sm" className="w-full" onClick={() => removeField(selected.localId)}>
                <Trash2 className="mr-1 h-4 w-4" />
                {t("deleteField")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
