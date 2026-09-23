"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

function ToolBtn({
  active,
  title,
  onClick,
  icon: Icon,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-foreground/80 transition-colors",
        "hover:bg-foreground/8 hover:text-foreground",
        active && "bg-foreground/10 text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function DocBubbleToolbar({ editor }: { editor: Editor }) {
  const t = useTranslations("editor");

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: ed, state }) => {
        const { empty, from, to } = state.selection;
        if (empty || from === to) return false;
        if (ed.isActive("templateField")) return false;
        return ed.isEditable;
      }}
      className="z-50 flex items-center gap-0.5 rounded-lg border border-border/80 bg-card p-1 shadow-float"
    >
      <ToolBtn
        title={t("fmtBold")}
        active={editor.isActive("bold")}
        icon={Bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolBtn
        title={t("fmtH1")}
        active={editor.isActive("heading", { level: 1 })}
        icon={Heading1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolBtn
        title={t("fmtH2")}
        active={editor.isActive("heading", { level: 2 })}
        icon={Heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <span className="mx-0.5 h-4 w-px bg-border" />
      <ToolBtn
        title={t("fmtBullet")}
        active={editor.isActive("bulletList")}
        icon={List}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolBtn
        title={t("fmtOrdered")}
        active={editor.isActive("orderedList")}
        icon={ListOrdered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
    </BubbleMenu>
  );
}
