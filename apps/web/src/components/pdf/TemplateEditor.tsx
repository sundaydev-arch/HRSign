"use client";

import { EditorSkeleton } from "@/components/layout/skeletons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/client";
import { FIELD_TYPE_LABEL_KEYS } from "@/lib/labels";
import { useApiError } from "@/lib/use-api-error";
import { cn } from "@/lib/utils";
import { CoordinatesSchema } from "@/schemas/coordinates";
import type { FieldType, TemplateField, TemplateVersionStatus } from "@prisma/client";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Loader2,
  PenLine,
  Save,
  Stamp,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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

const FIELD_PALETTE: Array<{
  type: FieldType;
  icon: React.ComponentType<{ className?: string }>;
  width: number;
  height: number;
}> = [
  { type: "TEXT", icon: Type, width: 180, height: 28 },
  { type: "DATE", icon: CalendarDays, width: 140, height: 28 },
  { type: "SEAL", icon: Stamp, width: 120, height: 120 },
  { type: "SIGNATURE", icon: PenLine, width: 160, height: 70 },
];

const PAGE_GAP_PX = 40;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function fieldsEqual(a: EditorField[], b: EditorField[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Soft selection chrome — Quiet Precision ink highlight, not form widgets. */
function fieldShellClass(selected: boolean, editable: boolean): string {
  if (selected) {
    return cn(
      "border border-dashed border-foreground/35 bg-foreground/[0.04] shadow-[0_0_0_1px_hsl(var(--foreground)/0.08)]",
      editable && "cursor-move",
    );
  }
  return cn(
    "border border-transparent bg-transparent group-hover/field:border-foreground/20 group-hover/field:bg-foreground/[0.03]",
    editable && "cursor-move",
  );
}

export function TemplateEditor({
  templateId,
  templateName,
  fileUrl,
  pageCount,
  initialFields,
  versionStatus,
  versionNumber,
}: {
  templateId: string;
  templateName: string;
  fileUrl: string;
  pageCount: number;
  initialFields: TemplateField[];
  versionStatus: TemplateVersionStatus;
  versionNumber: number;
}) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const apiError = useApiError();
  const router = useRouter();
  const editable = versionStatus === "DRAFT";

  const toEditorFields = useCallback(
    (rows: TemplateField[]): EditorField[] =>
      rows.flatMap((field) => {
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
            placeholder: field.defaultValue ?? "",
            fontSize: field.fontSize,
          },
        ];
      }),
    [],
  );

  const [fields, setFields] = useState<EditorField[]>(() => toEditorFields(initialFields));
  const [savedSnapshot, setSavedSnapshot] = useState(() => toEditorFields(initialFields));
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<FieldType | null>(null);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rendering, setRendering] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pageElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const canvasElsRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pdfDocRef = useRef<Awaited<
    ReturnType<typeof import("pdfjs-dist").getDocument>["promise"]
  > | null>(null);
  const scaleRef = useRef(1);
  const skipScrollRef = useRef(false);

  const dirty = editable && !fieldsEqual(fields, savedSnapshot);
  const scale = fitScale * zoom;
  scaleRef.current = scale;

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
        const thumbs: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          sizes.push({ width: viewport.width, height: viewport.height });
          const thumbScale = Math.min(0.18, 72 / viewport.width);
          const thumbViewport = page.getViewport({ scale: thumbScale });
          const thumbCanvas = document.createElement("canvas");
          thumbCanvas.width = Math.floor(thumbViewport.width);
          thumbCanvas.height = Math.floor(thumbViewport.height);
          const thumbCtx = thumbCanvas.getContext("2d");
          if (thumbCtx) {
            await page.render({ canvasContext: thumbCtx, viewport: thumbViewport }).promise;
            thumbs.push(thumbCanvas.toDataURL("image/png"));
          } else {
            thumbs.push("");
          }
        }
        if (!cancelled) {
          setPageSizes(sizes);
          setThumbUrls(thumbs);
        }
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

  const renderPages = useCallback(async () => {
    const doc = pdfDocRef.current;
    if (!doc || pageSizes.length === 0) return;
    setRendering(true);
    const containerWidth = wrapperRef.current?.clientWidth ?? 720;
    const maxPageWidth = Math.max(...pageSizes.map((p) => p.width));
    const nextFit = Math.min(1.6, Math.max(0.45, (containerWidth - 48) / maxPageWidth));
    setFitScale(nextFit);
    const nextScale = nextFit * zoom;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const canvas = canvasElsRef.current.get(pageNum);
      if (!canvas) continue;
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: nextScale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
    }
    setRendering(false);
  }, [pageSizes, zoom]);

  useEffect(() => {
    void renderPages();
  }, [renderPages]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      void renderPages();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderPages]);

  // Track visible page while scrolling continuous canvas
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root || pageSizes.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (skipScrollRef.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top) return;
        const pageAttr = (top.target as HTMLElement).dataset.page;
        if (!pageAttr) return;
        const pageNum = Number(pageAttr);
        if (Number.isFinite(pageNum)) setCurrentPage(pageNum);
      },
      { root, threshold: [0.35, 0.55, 0.75] },
    );
    pageElsRef.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [pageSizes]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const saveFields = useCallback(
    async (silent = false) => {
      if (!editable) return;
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
        setSavedSnapshot(fields);
        if (!silent) toast.success(t("saveSuccess"));
      } catch (err) {
        toast.error(apiError(err, "common.saveFailed"));
      } finally {
        setSaving(false);
      }
    },
    [apiError, editable, fields, t, templateId],
  );

  useEffect(() => {
    if (!dirty || !editable) return;
    const timer = window.setTimeout(() => {
      void saveFields(true);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [dirty, editable, fields, saveFields]);

  const scrollToPage = useCallback((pageNum: number) => {
    skipScrollRef.current = true;
    setCurrentPage(pageNum);
    const node = pageElsRef.current.get(pageNum);
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(() => {
      skipScrollRef.current = false;
    }, 450);
  }, []);

  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      setActiveTool(null);
      setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable]);

  useEffect(() => {
    if (!editable || !selectedId) return;
    const selected = fields.find((f) => f.localId === selectedId);
    if (!selected) return;
    const pageW = pageSizes[selected.page - 1]?.width ?? 595;
    const pageH = pageSizes[selected.page - 1]?.height ?? 842;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        setFields((prev) => prev.filter((f) => f.localId !== selectedId));
        setSelectedId(null);
        return;
      } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void saveFields(false);
        return;
      } else return;
      e.preventDefault();
      setFields((prev) =>
        prev.map((item) => {
          if (item.localId !== selectedId) return item;
          return {
            ...item,
            x: clamp(item.x + dx, 0, pageW - item.width),
            y: clamp(item.y + dy, 0, pageH - item.height),
          };
        }),
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, fields, pageSizes, saveFields, selectedId]);

  function placeFieldAt(type: FieldType, page: number, clickX: number, clickY: number) {
    if (!editable) return;
    const preset = FIELD_PALETTE.find((p) => p.type === type)!;
    const pageW = pageSizes[page - 1]?.width ?? 595;
    const pageH = pageSizes[page - 1]?.height ?? 842;
    const count = fields.filter((field) => field.type === type).length + 1;
    const width = Math.min(preset.width, pageW - 40);
    const height = Math.min(preset.height, pageH - 40);
    const field: EditorField = {
      localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      label: t("defaultName", { typeLabel: tl(FIELD_TYPE_LABEL_KEYS[type]), count }),
      page,
      x: clamp(clickX - width / 2, 0, pageW - width),
      y: clamp(clickY - height / 2, 0, pageH - height),
      width,
      height,
      required: type === "TEXT" || type === "DATE",
      placeholder: "",
      fontSize: 12,
    };
    setFields((prev) => [...prev, field]);
    setSelectedId(field.localId);
    setActiveTool(null);
  }

  function onPaperPointerDown(e: React.PointerEvent, page: number) {
    if (!editable) return;
    if ((e.target as HTMLElement).closest("[data-field]")) return;
    setSelectedId(null);
    if (!activeTool) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / scaleRef.current;
    const y = (e.clientY - rect.top) / scaleRef.current;
    placeFieldAt(activeTool, page, x, y);
  }

  function startDrag(e: React.PointerEvent, field: EditorField, mode: "move" | "resize") {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(field.localId);
    setActiveTool(null);
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { x: field.x, y: field.y, width: field.width, height: field.height };
    const pageW = pageSizes[field.page - 1]?.width ?? 595;
    const pageH = pageSizes[field.page - 1]?.height ?? 842;
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
              x: clamp(orig.x + dx, 0, pageW - item.width),
              y: clamp(orig.y + dy, 0, pageH - item.height),
            };
          }
          return {
            ...item,
            width: clamp(orig.width + dx, 30, pageW - item.x),
            height: clamp(orig.height + dy, 18, pageH - item.y),
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

  function updateSelected(patch: Partial<EditorField>) {
    if (!selectedId || !editable) return;
    setFields((prev) =>
      prev.map((field) => (field.localId === selectedId ? { ...field, ...patch } : field)),
    );
  }

  async function publish() {
    if (!editable || fields.length === 0) {
      toast.error(t("publishNeedFields"));
      return;
    }
    if (dirty) await saveFields(true);
    setPublishing(true);
    try {
      await api(`/api/templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      toast.success(t("publishSuccess"));
      router.push("/templates");
      router.refresh();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setPublishing(false);
    }
  }

  async function createNewVersion() {
    setCloning(true);
    try {
      await api(`/api/templates/${templateId}/versions`, { method: "POST" });
      toast.success(t("newVersionSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCloning(false);
    }
  }

  async function convertViaOcr() {
    if (!confirm(t("ocrConfirm"))) return;
    setOcrRunning(true);
    try {
      await api(`/api/templates/${templateId}/ocr`, { method: "POST" });
      toast.success(t("ocrSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setOcrRunning(false);
    }
  }

  const selected = fields.find((field) => field.localId === selectedId) ?? null;
  const isValueField = selected ? ["TEXT", "DATE"].includes(selected.type) : false;
  const selectedPageW = selected ? (pageSizes[selected.page - 1]?.width ?? 595) : 595;
  const selectedPageH = selected ? (pageSizes[selected.page - 1]?.height ?? 842) : 842;
  const multiPage = pageCount > 1;

  const saveChip = (() => {
    if (!editable) {
      return <span>{t("statusReadonly")}</span>;
    }
    if (saving) {
      return (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("statusSaving")}
        </span>
      );
    }
    if (dirty) {
      return <span className="text-amber-700 dark:text-amber-400">{t("statusUnsaved")}</span>;
    }
    return <span className="text-success">{t("statusSaved")}</span>;
  })();

  if (pageSizes.length === 0) {
    return <EditorSkeleton />;
  }

  function PageNav({ className }: { className?: string }) {
    if (!multiPage) return null;
    return (
      <div className={cn("flex gap-2", className)}>
        {Array.from({ length: pageCount }, (_, i) => {
          const pageNum = i + 1;
          const active = currentPage === pageNum;
          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => scrollToPage(pageNum)}
              className={cn(
                "group/thumb flex shrink-0 flex-col items-center gap-1.5 rounded-lg p-1.5 transition-colors",
                active ? "bg-white shadow-sm ring-1 ring-border" : "hover:bg-white/70",
              )}
              aria-label={t("pageThumb", { page: pageNum })}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={cn(
                  "overflow-hidden rounded border bg-white",
                  active ? "border-foreground/25" : "border-border/80",
                )}
              >
                {thumbUrls[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbUrls[i]}
                    alt=""
                    className="block h-auto w-11"
                    draggable={false}
                  />
                ) : (
                  <span className="block h-14 w-11 bg-muted" />
                )}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{pageNum}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const propsPanel = selected ? (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("fieldName")}</Label>
        <Input
          className="h-9"
          value={selected.label}
          disabled={!editable}
          onChange={(e) => updateSelected({ label: e.target.value })}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={selected.required}
          disabled={!editable}
          onCheckedChange={(v) => updateSelected({ required: v === true })}
        />
        {t("required")}
      </label>

      {isValueField ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("fontSize", { size: selected.fontSize })}
          </Label>
          <Input
            type="range"
            min={6}
            max={24}
            step={1}
            value={selected.fontSize}
            disabled={!editable}
            onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border/80">
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-between rounded-none px-3 py-2 text-xs font-medium text-muted-foreground"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          {t("advanced")}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")}
          />
        </Button>
        {advancedOpen ? (
          <div className="flex flex-col gap-2 border-t border-border/80 px-3 py-2.5">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["x", selected.x],
                  ["y", selected.y],
                  ["width", selected.width],
                  ["height", selected.height],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {key}
                  </Label>
                  <Input
                    className="h-8"
                    type="number"
                    value={Math.round(value)}
                    disabled={!editable}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      if (key === "x") {
                        updateSelected({ x: clamp(n, 0, selectedPageW - selected.width) });
                      }
                      if (key === "y") {
                        updateSelected({ y: clamp(n, 0, selectedPageH - selected.height) });
                      }
                      if (key === "width") {
                        updateSelected({
                          width: clamp(n, 30, selectedPageW - selected.x),
                        });
                      }
                      if (key === "height") {
                        updateSelected({
                          height: clamp(n, 18, selectedPageH - selected.y),
                        });
                      }
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{t("nudgeHint")}</p>
          </div>
        ) : null}
      </div>

      {editable ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            setFields((prev) => prev.filter((f) => f.localId !== selected.localId));
            setSelectedId(null);
          }}
        >
          <Trash2 className="mr-1 h-4 w-4" />
          {t("deleteField")}
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f2f3f5] dark:bg-zinc-900">
      {/* Doc chrome — title + tools in one Feishu-like top bar */}
      <header className="z-20 flex shrink-0 flex-col gap-2 border-b border-border/70 bg-white/90 px-3 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 dark:bg-card/90 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link href="/templates" aria-label={t("back")}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              {templateName}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>v{versionNumber}</span>
              <span aria-hidden>·</span>
              {saveChip}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:justify-center">
          {FIELD_PALETTE.map((paletteItem) => {
            const Icon = paletteItem.icon;
            const active = activeTool === paletteItem.type;
            return (
              <Button
                key={paletteItem.type}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 gap-1.5 rounded-md px-2.5",
                  active && "bg-muted text-foreground ring-1 ring-foreground/15",
                )}
                disabled={!editable}
                title={t("toolHint", { type: tl(FIELD_TYPE_LABEL_KEYS[paletteItem.type]) })}
                onClick={() =>
                  setActiveTool((prev) => (prev === paletteItem.type ? null : paletteItem.type))
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{tl(FIELD_TYPE_LABEL_KEYS[paletteItem.type])}</span>
              </Button>
            );
          })}

          <Separator orientation="vertical" className="mx-1 hidden h-4 sm:block" />

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom((z) => clamp(Number((z - 0.1).toFixed(2)), 0.5, 2))}
              title={t("zoomOut")}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 min-w-[3rem] px-1 text-xs tabular-nums text-muted-foreground"
              onClick={() => setZoom(1)}
              title={t("zoomReset")}
            >
              {Math.round(zoom * 100)}%
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom((z) => clamp(Number((z + 0.1).toFixed(2)), 0.5, 2))}
              title={t("zoomIn")}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {multiPage ? (
            <>
              <Separator orientation="vertical" className="mx-1 hidden h-4 sm:block" />
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground">
                  {t("pageIndicator", { current: currentPage, total: pageCount })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= pageCount}
                  onClick={() => scrollToPage(Math.min(pageCount, currentPage + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {rendering ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
          {editable ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={ocrRunning}
              onClick={() => void convertViaOcr()}
            >
              {ocrRunning ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              {t("ocrConvert")}
            </Button>
          ) : null}
          {!editable ? (
            <Button size="sm" variant="outline" className="h-8" disabled={cloning} onClick={() => void createNewVersion()}>
              <CopyPlus className="mr-1 h-4 w-4" />
              {cloning ? tc("processing") : t("newVersion")}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                disabled={saving || !dirty}
                onClick={() => void saveFields(false)}
              >
                <Save className="mr-1 h-3.5 w-3.5" />
                {t("save")}
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-md px-4"
                disabled={publishing || fields.length === 0}
                onClick={() => void publish()}
              >
                {publishing ? tc("processing") : t("publish")}
              </Button>
            </>
          )}
        </div>
      </header>

      {!editable ? (
        <Alert className="shrink-0 rounded-none border-x-0 border-t-0 py-2">
          <AlertDescription className="text-xs text-muted-foreground">{t("readonlyHint")}</AlertDescription>
        </Alert>
      ) : null}

      {editable && activeTool ? (
        <div className="shrink-0 border-b border-border bg-muted/80 px-4 py-1.5 text-center text-xs text-muted-foreground">
          {t("placeHint", { type: tl(FIELD_TYPE_LABEL_KEYS[activeTool]) })}
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        {multiPage ? (
          <aside className="hidden w-[4.75rem] shrink-0 overflow-y-auto border-r border-border/60 bg-[hsl(220_12%_94%)] p-2 dark:bg-zinc-950/40 lg:block">
            <PageNav className="flex-col" />
          </aside>
        ) : null}

        <div
          ref={wrapperRef}
          className={cn(
            "relative min-h-0 min-w-0 flex-1 overflow-auto",
            activeTool && editable && "cursor-crosshair",
          )}
        >
          <div className="mx-auto flex w-full max-w-[980px] flex-col items-center px-4 py-8 sm:px-10 sm:py-10">
            {pageSizes.map((size, index) => {
              const pageNum = index + 1;
              const displayW = Math.floor(size.width * scale);
              const pageFields = fields.filter((field) => field.page === pageNum);
              return (
                <div
                  key={pageNum}
                  data-page={pageNum}
                  ref={(node) => {
                    if (node) pageElsRef.current.set(pageNum, node);
                    else pageElsRef.current.delete(pageNum);
                  }}
                  className="relative bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.08)]"
                  style={{
                    width: displayW,
                    marginBottom: index < pageSizes.length - 1 ? PAGE_GAP_PX : 0,
                  }}
                  onPointerDown={(e) => onPaperPointerDown(e, pageNum)}
                >
                  <canvas
                    ref={(node) => {
                      if (node) canvasElsRef.current.set(pageNum, node);
                      else canvasElsRef.current.delete(pageNum);
                    }}
                    className="pointer-events-none block"
                  />
                  <div className="absolute inset-0">
                    {pageFields.map((field) => {
                      const isSelected = field.localId === selectedId;
                      return (
                        <div
                          key={field.localId}
                          data-field
                          onPointerDown={(e) => startDrag(e, field, "move")}
                          className={cn(
                            "group/field absolute rounded-[2px] transition-colors",
                            fieldShellClass(isSelected, editable),
                          )}
                          style={{
                            left: field.x * scale,
                            top: field.y * scale,
                            width: field.width * scale,
                            height: field.height * scale,
                            fontSize: Math.max(8, field.fontSize * scale * 0.85),
                          }}
                        >
                          <span
                            className={cn(
                              "pointer-events-none absolute -top-5 left-0 max-w-[12rem] truncate whitespace-nowrap rounded px-1.5 text-[10px] leading-4 transition-opacity",
                              isSelected
                                ? "bg-foreground text-background opacity-100"
                                : "bg-foreground/75 text-background opacity-0 group-hover/field:opacity-100",
                            )}
                          >
                            {field.label}
                          </span>
                          <span className="pointer-events-none flex h-full w-full items-center overflow-hidden px-1.5 text-foreground/30">
                            {field.placeholder || field.label}
                          </span>
                          {editable && isSelected ? (
                            <div
                              onPointerDown={(e) => startDrag(e, field, "resize")}
                              className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-sm border-2 border-card bg-foreground"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating properties — only when a field is selected */}
          {selected ? (
            <aside className="pointer-events-auto absolute bottom-3 right-3 z-30 w-[min(17.5rem,calc(100%-1.5rem))] overflow-hidden rounded-xl border border-border/80 bg-white/95 shadow-float backdrop-blur-md dark:bg-card/95 sm:bottom-auto sm:top-3">
              <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
                <span className="text-xs font-medium text-foreground">{t("propsTitle")}</span>
                <Badge variant="outline" className="font-normal">
                  {tl(FIELD_TYPE_LABEL_KEYS[selected.type])}
                </Badge>
              </div>
              <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-3">{propsPanel}</div>
            </aside>
          ) : null}
        </div>

        {multiPage ? (
          <div className="flex shrink-0 overflow-x-auto border-t border-border/70 bg-[hsl(220_12%_94%)] p-2 dark:bg-zinc-950/40 lg:hidden">
            <PageNav className="flex-row" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
