"use client";

import { EditorSkeleton } from "@/components/layout/skeletons";
import dynamic from "next/dynamic";

/** PDF field editor — code-split so document mode never downloads pdf.js. */
export const TemplateEditorLazy = dynamic(
  () => import("./TemplateEditor").then((m) => m.TemplateEditor),
  { ssr: false, loading: () => <EditorSkeleton /> },
);
