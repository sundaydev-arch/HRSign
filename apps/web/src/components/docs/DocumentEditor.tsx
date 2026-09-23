"use client";

import { DocBubbleToolbar } from "@/components/docs/DocBubbleToolbar";
import {
  DocFloatingInsert,
  type DocInsertAction,
} from "@/components/docs/DocFloatingInsert";
import { DocSlashMenu } from "@/components/docs/DocSlashMenu";
import { TemplateFieldExtension } from "@/components/docs/template-field-extension";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client";
import { countDocumentFields } from "@/lib/document-fields";
import { FIELD_TYPE_LABEL_KEYS } from "@/lib/labels";
import { useApiError } from "@/lib/use-api-error";
import { cn } from "@/lib/utils";
import {
  emptyDocumentContent,
  type DocumentContent,
  type DocumentFieldAttrs,
} from "@/schemas/document-content";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { FieldType, TemplateVersionStatus } from "@prisma/client";
import { ChevronLeft, CopyPlus, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function countUnlabeledFields(content: DocumentContent): number {
  let n = 0;
  const walk = (nodes: unknown[] | undefined) => {
    if (!nodes) return;
    for (const raw of nodes) {
      const node = raw as { type?: string; attrs?: { label?: string }; content?: unknown[] };
      if (node.type === "templateField") {
        if (!String(node.attrs?.label ?? "").trim()) n += 1;
      }
      walk(node.content);
    }
  };
  walk((content as { content?: unknown[] }).content);
  return n;
}

function newFieldId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function buildFieldAttrs(editor: Editor, type: FieldType, t: (k: string, v: Record<string, unknown>) => string, typeLabel: string): DocumentFieldAttrs {
  return {
    fieldId: newFieldId(),
    type: type as DocumentFieldAttrs["type"],
    label: t("defaultName", {
      typeLabel,
      count: countDocumentFields(editor.getJSON() as DocumentContent) + 1,
    }),
    required: true,
  };
}

function applyInsert(
  editor: Editor,
  action: DocInsertAction,
  opts: {
    range?: { from: number; to: number };
    t: (k: string, v: Record<string, unknown>) => string;
    typeLabel: (type: FieldType) => string;
  },
) {
  const chain = editor.chain().focus();
  if (opts.range) {
    chain.deleteRange(opts.range);
  }

  if (action.kind === "heading") {
    chain.setHeading({ level: action.level }).run();
    return;
  }
  if (action.kind === "bullet") {
    chain.toggleBulletList().run();
    return;
  }
  if (action.kind === "ordered") {
    chain.toggleOrderedList().run();
    return;
  }
  if (action.kind === "table") {
    chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    return;
  }
  const attrs = buildFieldAttrs(editor, action.type, opts.t, opts.typeLabel(action.type));
  chain.insertTemplateField(attrs).run();
}

export function DocumentEditor({
  templateId,
  templateName,
  initialContent,
  versionStatus,
  versionNumber,
}: {
  templateId: string;
  templateName: string;
  initialContent: DocumentContent | null;
  versionStatus: TemplateVersionStatus;
  versionNumber: number;
}) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const apiError = useApiError();
  const router = useRouter();
  const editable = versionStatus === "DRAFT";

  const seed = initialContent ?? emptyDocumentContent(templateName);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [statusChip, setStatusChip] = useState<"saved" | "saving" | "unsaved" | "readonly">(
    editable ? "saved" : "readonly",
  );
  const [title, setTitle] = useState(templateName);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const savedJsonRef = useRef(JSON.stringify(seed));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: editable ? "end" : false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return t("docPlaceholderHeading");
          return t("docPlaceholder");
        },
        includeChildren: true,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TemplateFieldExtension,
    ],
    content: seed,
    editable,
    editorProps: {
      attributes: {
        class: "hrsign-doc-editor focus:outline-none",
        spellcheck: "false",
      },
      handleClickOn: (_view, _pos, _node, _nodePos, event) => {
        // Keep clicks on paper focusing the editor
        if ((event.target as HTMLElement)?.closest?.("[data-template-field]")) return false;
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = JSON.stringify(ed.getJSON());
      const isDirty = json !== savedJsonRef.current;
      setDirty(isDirty);
      if (isDirty) setStatusChip("unsaved");
    },
  });

  const saveDocument = useCallback(
    async (silent: boolean) => {
      if (!editor || !editable) return;
      const content = editor.getJSON() as DocumentContent;
      setSaving(true);
      setStatusChip("saving");
      try {
        await api(`/api/templates/${templateId}/document`, {
          method: "PUT",
          body: JSON.stringify({ content }),
        });
        savedJsonRef.current = JSON.stringify(content);
        setDirty(false);
        setStatusChip("saved");
        if (!silent) toast.success(t("docSaveSuccess"));
      } catch (err) {
        setStatusChip("unsaved");
        toast.error(apiError(err));
      } finally {
        setSaving(false);
      }
    },
    [apiError, editable, editor, t, templateId],
  );

  useEffect(() => {
    if (!dirty || !editable) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveDocument(true);
    }, 1600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [dirty, editable, saveDocument, editor?.state.doc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void saveDocument(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveDocument]);

  const typeLabel = useCallback(
    (type: FieldType) => tl(FIELD_TYPE_LABEL_KEYS[type]),
    [tl],
  );

  const handleInsert = useCallback(
    (action: DocInsertAction, range?: { from: number; to: number }) => {
      if (!editor || !editable) return;
      applyInsert(editor, action, {
        range,
        t: (key, values) => t(key as "defaultName", values as { typeLabel: string; count: number }),
        typeLabel,
      });
    },
    [editable, editor, t, typeLabel],
  );

  async function openPreview() {
    if (!editor) return;
    setPreviewing(true);
    try {
      if (dirty) await saveDocument(true);
      const content = editor.getJSON() as DocumentContent;
      const res = await fetch(`/api/templates/${templateId}/preview-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw Object.assign(new Error("preview"), { code: err?.error ?? "PREVIEW_FAILED" });
      }
      const blob = await res.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewOpen(true);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setPreviewing(false);
    }
  }

  async function publish() {
    if (!editor) return;
    const content = editor.getJSON() as DocumentContent;
    if (countDocumentFields(content) === 0) {
      toast.error(t("publishNeedFields"));
      return;
    }
    const unlabeled = countUnlabeledFields(content);
    if (unlabeled > 0) {
      toast.error(t("publishNeedLabels", { count: unlabeled }));
      return;
    }
    setPublishing(true);
    try {
      if (dirty) await saveDocument(true);
      if (title.trim() && title.trim() !== templateName) {
        await api(`/api/templates/${templateId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: title.trim() }),
        });
      }
      await api(`/api/templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      toast.success(t("publishSuccess"));
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

  const chipLabel =
    statusChip === "saving"
      ? t("statusSaving")
      : statusChip === "unsaved"
        ? t("statusUnsaved")
        : statusChip === "readonly"
          ? t("statusReadonly")
          : t("statusSaved");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f5f6f7]">
      {/* Slim Lark-like top bar — no format clutter */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white/90 px-2 backdrop-blur-md sm:px-3">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-muted-foreground">
          <Link href="/templates">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("backShort")}</span>
          </Link>
        </Button>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!editable}
          className="h-8 max-w-[min(100%,20rem)] flex-1 border-transparent bg-transparent px-2 text-[15px] font-medium shadow-none focus-visible:border-border focus-visible:bg-background sm:flex-none"
          aria-label={t("docTitle")}
        />

        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex",
              statusChip === "unsaved" && "text-amber-700",
            )}
          >
            {statusChip === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {chipLabel}
          </span>
          <Badge variant="outline" className="h-6 border-black/8 font-normal tabular-nums text-muted-foreground">
            v{versionNumber}
          </Badge>

          {!editable ? (
            <Button size="sm" variant="outline" className="h-8" disabled={cloning} onClick={() => void createNewVersion()}>
              <CopyPlus className="mr-1 h-4 w-4" />
              {cloning ? tc("processing") : t("newVersion")}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={previewing || saving}
                onClick={() => void openPreview()}
              >
                {previewing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Eye className="mr-1 h-4 w-4" />}
                {t("previewPdf")}
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-md px-4"
                disabled={publishing || saving}
                onClick={() => void publish()}
              >
                {publishing ? tc("processing") : t("publish")}
              </Button>
            </>
          )}
        </div>
      </header>

      {!editable ? (
        <Alert className="shrink-0 rounded-none border-x-0 border-t-0 bg-white py-2">
          <AlertDescription className="text-xs text-muted-foreground">{t("readonlyHint")}</AlertDescription>
        </Alert>
      ) : (
        <div className="shrink-0 border-b border-black/[0.04] bg-white/70 px-4 py-1.5 text-center text-[12px] text-muted-foreground">
          {t("docHintBar")}
        </div>
      )}

      <div
        className="relative min-h-0 flex-1 overflow-auto"
        onMouseDown={(e) => {
          // Clicking gray canvas focuses end of doc (Lark: click empty = type)
          if (!editor || !editable) return;
          const target = e.target as HTMLElement;
          if (target.closest(".hrsign-doc-paper") || target.closest("[data-tippy-root]")) return;
          if (target.closest("button, a, input, [role='listbox']")) return;
          e.preventDefault();
          editor.chain().focus("end").run();
        }}
      >
        <div className="mx-auto w-full max-w-[920px] px-3 py-8 sm:px-6 sm:py-10">
          <div
            ref={paperRef}
            className="hrsign-doc-paper relative mx-auto min-h-[calc(100vh-9rem)] w-full max-w-[816px] rounded-sm bg-white px-10 py-12 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_28px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] sm:px-16 sm:py-14"
            onMouseDown={(e) => {
              if (!editor || !editable) return;
              const target = e.target as HTMLElement;
              if (target.closest(".ProseMirror") || target.closest("[data-template-field]")) return;
              // Click padding of paper → focus nearest / end
              e.preventDefault();
              editor.chain().focus("end").run();
            }}
          >
            <EditorContent editor={editor} />
            {editor && editable ? (
              <>
                <DocBubbleToolbar editor={editor} />
                <DocFloatingInsert editor={editor} onInsert={handleInsert} />
                <DocSlashMenu editor={editor} onInsert={handleInsert} />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open && previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t("previewPdfTitle")}</DialogTitle>
          </DialogHeader>
          <div className="h-[70vh] bg-muted/40">
            {previewUrl ? (
              <iframe title="pdf-preview" src={previewUrl} className="h-full w-full border-0" />
            ) : null}
          </div>
          <DialogFooter className="border-t px-4 py-3">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={() => {
                setPreviewOpen(false);
                void publish();
              }}
            >
              {t("publish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
