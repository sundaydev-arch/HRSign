"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { CalendarDays, PenLine, Stamp, Type, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_LABEL_KEYS } from "@/lib/labels";
import type { DocumentFieldAttrs } from "@/schemas/document-content";

const ICONS = {
  TEXT: Type,
  DATE: CalendarDays,
  SEAL: Stamp,
  SIGNATURE: PenLine,
} as const;

export function TemplateFieldChip({ node, selected, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const t = useTranslations("editor");
  const tl = useTranslations("labels");
  const attrs = node.attrs as DocumentFieldAttrs;
  const Icon = ICONS[attrs.type] ?? Type;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (selected) setOpen(true);
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const blocky = attrs.type === "SEAL" || attrs.type === "SIGNATURE";

  return (
    <NodeViewWrapper as="span" className="relative inline align-baseline">
      <span ref={wrapRef} className="relative inline">
      <button
        type="button"
        contentEditable={false}
        onClick={() => {
          if (editor?.isEditable) setOpen(true);
        }}
        className={cn(
          "mx-0.5 inline-flex max-w-[16rem] items-center gap-1.5 rounded-md border px-2 align-baseline text-[0.8125rem] font-medium leading-none transition-colors",
          "border-foreground/12 bg-muted/90 text-foreground",
          "hover:border-foreground/25 hover:bg-muted",
          selected && "ring-2 ring-foreground/15",
          blocky ? "min-h-[2.75rem] min-w-[5.5rem] py-2" : "py-1",
          !editor?.isEditable && "cursor-default",
        )}
        data-template-field=""
      >
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="truncate">{attrs.label || attrs.type}</span>
      </button>

      {open && editor?.isEditable ? (
        <span
          contentEditable={false}
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 rounded-xl border border-border/80 bg-card p-3 shadow-float"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {tl(FIELD_TYPE_LABEL_KEYS[attrs.type])}
            </span>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                deleteNode();
                setOpen(false);
              }}
              title={t("deleteField")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor={`fld-${attrs.fieldId}`} className="text-xs">
                {t("fieldName")}
              </Label>
              <Input
                id={`fld-${attrs.fieldId}`}
                value={attrs.label}
                autoFocus
                className="h-8"
                onChange={(e) => updateAttributes({ label: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`req-${attrs.fieldId}`}
                checked={attrs.required !== false}
                onCheckedChange={(v) => updateAttributes({ required: v === true })}
              />
              <Label htmlFor={`req-${attrs.fieldId}`} className="text-xs font-normal">
                {t("required")}
              </Label>
            </div>
          </div>
        </span>
        ) : null}
      </span>
    </NodeViewWrapper>
  );
}
