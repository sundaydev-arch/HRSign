"use client";

import type { Editor } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import {
  CalendarDays,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  PenLine,
  Plus,
  Stamp,
  Table2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { FieldType } from "@prisma/client";
import { FIELD_TYPE_LABEL_KEYS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type DocInsertAction =
  | { kind: "heading"; level: 1 | 2 }
  | { kind: "bullet" }
  | { kind: "ordered" }
  | { kind: "table" }
  | { kind: "field"; type: FieldType };

export function DocFloatingInsert({
  editor,
  onInsert,
}: {
  editor: Editor;
  onInsert: (action: DocInsertAction) => void;
}) {
  const t = useTranslations("editor");
  const tl = useTranslations("labels");
  const [open, setOpen] = useState(false);

  const items: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    action: DocInsertAction;
  }> = [
    { id: "h1", label: t("fmtH1"), icon: Heading1, action: { kind: "heading", level: 1 } },
    { id: "h2", label: t("fmtH2"), icon: Heading2, action: { kind: "heading", level: 2 } },
    { id: "ul", label: t("fmtBullet"), icon: List, action: { kind: "bullet" } },
    { id: "ol", label: t("fmtOrdered"), icon: ListOrdered, action: { kind: "ordered" } },
    { id: "table", label: t("fmtTable"), icon: Table2, action: { kind: "table" } },
    {
      id: "text",
      label: tl(FIELD_TYPE_LABEL_KEYS.TEXT),
      icon: Type,
      action: { kind: "field", type: "TEXT" },
    },
    {
      id: "date",
      label: tl(FIELD_TYPE_LABEL_KEYS.DATE),
      icon: CalendarDays,
      action: { kind: "field", type: "DATE" },
    },
    {
      id: "seal",
      label: tl(FIELD_TYPE_LABEL_KEYS.SEAL),
      icon: Stamp,
      action: { kind: "field", type: "SEAL" },
    },
    {
      id: "sig",
      label: tl(FIELD_TYPE_LABEL_KEYS.SIGNATURE),
      icon: PenLine,
      action: { kind: "field", type: "SIGNATURE" },
    },
  ];

  return (
    <FloatingMenu
      editor={editor}
      options={{ placement: "left-start", offset: 12 }}
      shouldShow={({ editor: ed, state }) => {
        if (!ed.isEditable) return false;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        if ($from.parent.type.name !== "paragraph") return false;
        return $from.parent.content.size === 0;
      }}
      className="z-40"
    >
      <div className="relative">
        <button
          type="button"
          title={t("insertMenu")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card text-muted-foreground shadow-sm",
            "transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground",
            open && "border-foreground/25 bg-muted text-foreground",
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
        {open ? (
          <div className="absolute left-0 top-9 z-50 w-56 overflow-hidden rounded-lg border border-border/80 bg-card py-1 shadow-float">
            <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("insertMenu")}
            </p>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onInsert(item.action);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </FloatingMenu>
  );
}
