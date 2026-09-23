"use client";

import { EditorSkeleton } from "@/components/layout/skeletons";
import dynamic from "next/dynamic";

/** TipTap editor — code-split so PDF mode never downloads ProseMirror. */
export const DocumentEditorLazy = dynamic(
  () => import("./DocumentEditor").then((m) => m.DocumentEditor),
  { ssr: false, loading: () => <EditorSkeleton /> },
);
