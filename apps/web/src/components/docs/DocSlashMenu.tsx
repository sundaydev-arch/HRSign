"use client";

import type { Editor } from "@tiptap/react";
import {
  CalendarDays,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  PenLine,
  Stamp,
  Table2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldType } from "@prisma/client";
import { FIELD_TYPE_LABEL_KEYS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { DocInsertAction } from "@/components/docs/DocFloatingInsert";

type SlashItem = {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
  icon: LucideIcon;
  action: DocInsertAction;
};

export function DocSlashMenu({
  editor,
  onInsert,
}: {
  editor: Editor;
  onInsert: (action: DocInsertAction, range?: { from: number; to: number }) => void;
}) {
  const t = useTranslations("editor");
  const tl = useTranslations("labels");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [active, setActive] = useState(0);

  const items: SlashItem[] = useMemo(
    () => [
      {
        id: "h1",
        label: t("fmtH1"),
        hint: t("slashHintHeading"),
        keywords: ["h1", "title", "heading", "标题", "一级"],
        icon: Heading1,
        action: { kind: "heading", level: 1 },
      },
      {
        id: "h2",
        label: t("fmtH2"),
        hint: t("slashHintSubheading"),
        keywords: ["h2", "subtitle", "heading", "标题", "二级"],
        icon: Heading2,
        action: { kind: "heading", level: 2 },
      },
      {
        id: "ul",
        label: t("fmtBullet"),
        hint: t("slashHintList"),
        keywords: ["ul", "bullet", "list", "列表", "无序"],
        icon: List,
        action: { kind: "bullet" },
      },
      {
        id: "ol",
        label: t("fmtOrdered"),
        hint: t("slashHintList"),
        keywords: ["ol", "number", "ordered", "列表", "有序", "数字"],
        icon: ListOrdered,
        action: { kind: "ordered" },
      },
      {
        id: "table",
        label: t("fmtTable"),
        hint: t("slashHintTable"),
        keywords: ["table", "grid", "表格"],
        icon: Table2,
        action: { kind: "table" },
      },
      {
        id: "text",
        label: tl(FIELD_TYPE_LABEL_KEYS.TEXT),
        hint: t("slashHintField"),
        keywords: ["text", "field", "文本", "字段", "填写"],
        icon: Type,
        action: { kind: "field", type: "TEXT" as FieldType },
      },
      {
        id: "date",
        label: tl(FIELD_TYPE_LABEL_KEYS.DATE),
        hint: t("slashHintField"),
        keywords: ["date", "日期", "字段"],
        icon: CalendarDays,
        action: { kind: "field", type: "DATE" as FieldType },
      },
      {
        id: "seal",
        label: tl(FIELD_TYPE_LABEL_KEYS.SEAL),
        hint: t("slashHintField"),
        keywords: ["seal", "stamp", "公章", "印章", "盖章"],
        icon: Stamp,
        action: { kind: "field", type: "SEAL" as FieldType },
      },
      {
        id: "sig",
        label: tl(FIELD_TYPE_LABEL_KEYS.SIGNATURE),
        hint: t("slashHintField"),
        keywords: ["sign", "signature", "签名", "签字"],
        icon: PenLine,
        action: { kind: "field", type: "SIGNATURE" as FieldType },
      },
    ],
    [t, tl],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q) || q.includes(k)),
    );
  }, [items, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setRange(null);
    setCoords(null);
    setActive(0);
  }, []);

  const select = useCallback(
    (item: SlashItem) => {
      if (!range) return;
      onInsert(item.action, range);
      close();
    },
    [close, onInsert, range],
  );

  useEffect(() => {
    if (!editor) return;

    const sync = () => {
      if (!editor.isEditable) {
        close();
        return;
      }
      const { state, view } = editor;
      const { $from, empty } = state.selection;
      if (!empty) {
        close();
        return;
      }
      const parent = $from.parent;
      if (parent.type.name !== "paragraph" && parent.type.name !== "heading") {
        close();
        return;
      }
      const textBefore = parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
      const match = textBefore.match(/(?:^|\s)\/([^\s/]*)$/);
      if (!match) {
        close();
        return;
      }
      const q = match[1] ?? "";
      const from = $from.pos - q.length - 1;
      const to = $from.pos;
      const rect = view.coordsAtPos(from);
      setOpen(true);
      setQuery(q);
      setRange({ from, to });
      setCoords({ top: rect.bottom + 6, left: rect.left });
      setActive(0);
    };

    editor.on("selectionUpdate", sync);
    editor.on("update", sync);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("update", sync);
    };
  }, [close, editor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % Math.max(filtered.length, 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
        return;
      }
      if (e.key === "Enter" && filtered[active]) {
        e.preventDefault();
        select(filtered[active]!);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, close, filtered, open, select]);

  if (!open || !coords) return null;

  return (
    <div
      className="fixed z-[60] w-72 overflow-hidden rounded-xl border border-border/80 bg-card py-1.5 shadow-float"
      style={{ top: coords.top, left: coords.left }}
      role="listbox"
      aria-label={t("slashMenu")}
    >
      <p className="px-3 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">
        {t("slashMenuHint")}
      </p>
      {filtered.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{t("slashEmpty")}</p>
      ) : (
        filtered.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={index === active}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(index)}
            onClick={() => select(item)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
              index === active ? "bg-muted" : "hover:bg-muted/70",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground">
              <item.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{item.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}
