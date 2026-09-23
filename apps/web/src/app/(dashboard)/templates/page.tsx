"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTableShell } from "@/components/layout/DataTableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Archive,
  Briefcase,
  ClipboardList,
  CopyPlus,
  FilePlus2,
  FileText,
  LayoutTemplate,
  MoreHorizontal,
  PencilLine,
  Plus,
  ScrollText,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import {
  TEMPLATE_CATEGORY_LABEL_KEYS,
  TEMPLATE_STATUS_LABEL_KEYS,
  TEMPLATE_STATUS_VARIANTS,
  formatDateTime,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TemplateCategory, TemplateVersionStatus } from "@prisma/client";

interface TemplateRow {
  id: string;
  name: string;
  category: TemplateCategory;
  createdAt: string;
  updatedAt: string;
  creatorName: string;
  latestVersion: {
    id: string;
    version: number;
    status: TemplateVersionStatus;
    pageCount: number;
    fieldCount: number;
    publishedAt: string | null;
  } | null;
}

type CreateMode = "preset" | "blank" | "upload";

const CATEGORY_ICON: Record<
  TemplateCategory,
  { icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  OFFER: { icon: Briefcase, tone: "bg-brand/10 text-brand" },
  ENTRY: { icon: ClipboardList, tone: "bg-muted text-foreground" },
  CONTRACT: { icon: ScrollText, tone: "bg-foreground/8 text-foreground" },
  RESIGN: { icon: Archive, tone: "bg-muted text-muted-foreground" },
  CERTIFICATE: { icon: UserRound, tone: "bg-success/12 text-success" },
};

export default function TemplatesPage() {
  const t = useTranslations("templates");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const apiError = useApiError();
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null);
  const [mode, setMode] = useState<CreateMode>("preset");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "">("");
  const [pageCount, setPageCount] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; category?: string; file?: string }>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ templates: TemplateRow[] }>("/api/templates");
      setTemplates(data.templates);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetDialog() {
    setName("");
    setCategory("");
    setPageCount(1);
    setFile(null);
    setMode("preset");
    setErrors({});
  }

  async function handleCreate() {
    const next: { name?: string; category?: string; file?: string } = {};
    if (!name.trim()) next.name = t("nameRequired");
    if (!category) next.category = t("categoryRequired");
    if (mode === "upload" && !file) next.file = t("fileRequired");
    setErrors(next);
    if (next.name || next.category || next.file) return;
    setSubmitting(true);
    try {
      let templateId: string;
      if (mode === "preset") {
        const res = await api<{ template: { id: string } }>("/api/templates", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            preset: category,
          }),
        });
        templateId = res.template.id;
        toast.success(t("createPresetSuccess"));
      } else if (mode === "blank") {
        const res = await api<{ template: { id: string } }>("/api/templates", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            category,
            pageCount,
          }),
        });
        templateId = res.template.id;
        toast.success(t("createBlankSuccess"));
      } else {
        const form = new FormData();
        form.set("name", name.trim());
        form.set("category", category);
        form.set("file", file!);
        const res = await api<{ template: { id: string } }>("/api/templates", {
          method: "POST",
          body: form,
        });
        templateId = res.template.id;
        toast.success(t("uploadSuccess"));
      }
      setDialogOpen(false);
      resetDialog();
      router.push(`/templates/${templateId}/edit`);
    } catch (err) {
      toast.error(apiError(err, "common.uploadFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(row: TemplateRow) {
    const current = row.latestVersion?.status;
    const next: TemplateVersionStatus =
      current === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED";
    try {
      await api(`/api/templates/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      toast.success(next === "PUBLISHED" ? t("publishedToast") : t("archivedToast"));
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  async function newVersion(row: TemplateRow) {
    try {
      await api(`/api/templates/${row.id}/versions`, { method: "POST" });
      toast.success(t("newVersionToast"));
      router.push(`/templates/${row.id}/edit`);
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  async function removeTemplate(row: TemplateRow) {
    try {
      const res = await api<{ ok: boolean; hard?: boolean }>(`/api/templates/${row.id}`, {
        method: "DELETE",
      });
      toast.success(res.hard === false ? t("archivedToast") : t("deletedToast"));
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetDialog();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" />
                {t("createBtn")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("dialogTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["preset", LayoutTemplate, "modePreset", "modePresetHint"],
                      ["blank", FilePlus2, "modeBlank", "modeBlankHint"],
                      ["upload", Upload, "modeUpload", "modeUploadHint"],
                    ] as const
                  ).map(([value, Icon, titleKey, hintKey]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={mode === value ? "secondary" : "outline"}
                      onClick={() => setMode(value)}
                      className="h-auto flex-col items-start gap-1.5 px-3 py-3 text-left whitespace-normal"
                    >
                      <Icon className="h-4 w-4" />
                      <div className="text-sm font-medium">{t(titleKey)}</div>
                      <div className="text-[11px] font-normal text-muted-foreground">{t(hintKey)}</div>
                    </Button>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tpl-name">{t("name")}</Label>
                  <Input
                    id="tpl-name"
                    placeholder={t("namePlaceholder")}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label>{t("category")}</Label>
                  <Select
                    value={category}
                    onValueChange={(v) => {
                      setCategory(v as TemplateCategory);
                      if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
                    }}
                  >
                    <SelectTrigger aria-invalid={Boolean(errors.category)}>
                      <SelectValue placeholder={t("categoryPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TEMPLATE_CATEGORY_LABEL_KEYS).map(([value, labelKey]) => (
                        <SelectItem key={value} value={value}>
                          {tl(labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category ? (
                    <p className="text-sm text-destructive">{errors.category}</p>
                  ) : null}
                </div>

                {mode === "blank" ? (
                  <div className="space-y-2">
                    <Label htmlFor="tpl-pages">{t("pageCountLabel")}</Label>
                    <Input
                      id="tpl-pages"
                      type="number"
                      min={1}
                      max={20}
                      value={pageCount}
                      onChange={(e) => setPageCount(clampPages(Number(e.target.value)))}
                    />
                    <p className="text-xs text-muted-foreground">{t("pageCountHint")}</p>
                  </div>
                ) : mode === "upload" ? (
                  <div className="space-y-2">
                    <Label>{t("fileLabel")}</Label>
                    <FileDropzone
                      kind="file"
                      accept="application/pdf"
                      file={file}
                      onFileChange={(f) => {
                        setFile(f);
                        if (errors.file) setErrors((prev) => ({ ...prev, file: undefined }));
                      }}
                      idleTitle={t("dropTitle")}
                      idleHint={t("dropHint")}
                      activeTitle={t("dropActive")}
                      replaceLabel={t("replaceFile")}
                      clearLabel={t("clearFile")}
                    />
                    {errors.file ? <p className="text-sm text-destructive">{errors.file}</p> : null}
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {tc("cancel")}
                </Button>
                <Button onClick={() => void handleCreate()} loading={submitting}>
                  {submitting
                    ? tc("creating")
                    : mode === "preset"
                      ? t("createPreset")
                      : mode === "blank"
                        ? t("createBlank")
                        : tc("upload")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Surface>
        <DataTableShell className="min-w-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 sm:pl-5">{t("colName")}</TableHead>
                <TableHead className="w-[7.5rem]">{t("colStatus")}</TableHead>
                <TableHead className="hidden w-[9.5rem] md:table-cell">{t("colUpdatedAt")}</TableHead>
                <TableHead className="w-[1%] pr-3 text-right sm:pr-4">
                  <span className="sr-only">{t("colActions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRowsSkeleton columns={4} rows={6} />
              ) : templates.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState
                      icon={FileText}
                      title={t("empty")}
                      description={t("emptyHint")}
                      action={
                        <Button size="sm" onClick={() => setDialogOpen(true)}>
                          <Plus className="mr-1 h-4 w-4" />
                          {t("createBtn")}
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((row) => {
                  const cat = CATEGORY_ICON[row.category];
                  const CatIcon = cat.icon;
                  const published = row.latestVersion?.status === "PUBLISHED";
                  const canPublish =
                    !!row.latestVersion &&
                    !(row.latestVersion.status === "DRAFT" && row.latestVersion.fieldCount === 0);

                  return (
                    <TableRow key={row.id} className="group">
                      <TableCell className="pl-4 py-3.5 sm:pl-5">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              cat.tone,
                            )}
                          >
                            <CatIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <Link
                              href={`/templates/${row.id}/edit`}
                              className="block truncate text-[13.5px] font-medium text-foreground transition-colors hover:text-brand"
                            >
                              {row.name}
                            </Link>
                            <p className="truncate text-[11.5px] text-muted-foreground">
                              {tl(TEMPLATE_CATEGORY_LABEL_KEYS[row.category])}
                              <span className="mx-1.5 text-border">·</span>
                              {t("metaFields", {
                                count: row.latestVersion?.fieldCount ?? 0,
                              })}
                              <span className="mx-1.5 text-border">·</span>
                              {t("metaPages", {
                                count: row.latestVersion?.pageCount ?? 0,
                              })}
                              <span className="mx-1.5 hidden text-border sm:inline">·</span>
                              <span className="hidden sm:inline">{row.creatorName}</span>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        {row.latestVersion ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={TEMPLATE_STATUS_VARIANTS[row.latestVersion.status]}>
                              {tl(TEMPLATE_STATUS_LABEL_KEYS[row.latestVersion.status])}
                            </Badge>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {t("versionLabel", { version: row.latestVersion.version })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden py-3.5 text-[12.5px] text-muted-foreground md:table-cell">
                        {formatDateTime(row.updatedAt)}
                      </TableCell>
                      <TableCell className="py-3.5 pr-3 text-right sm:pr-4">
                        <div className="inline-flex items-center justify-end gap-1">
                          {published ? (
                            <Button asChild size="sm" className="h-8 px-2.5">
                              <Link href={`/tasks/new?templateId=${row.id}`}>
                                <FilePlus2 className="mr-1 h-3.5 w-3.5" />
                                {t("initiate")}
                              </Link>
                            </Button>
                          ) : (
                            <Button asChild variant="outline" size="sm" className="h-8 px-2.5">
                              <Link href={`/templates/${row.id}/edit`}>
                                <PencilLine className="mr-1 h-3.5 w-3.5" />
                                {t("editFields")}
                              </Link>
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                aria-label={t("openActions")}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {published ? (
                                <DropdownMenuItem asChild>
                                  <Link href={`/templates/${row.id}/edit`}>
                                    <PencilLine className="h-4 w-4" />
                                    {t("editFields")}
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              {row.latestVersion && row.latestVersion.status !== "DRAFT" ? (
                                <DropdownMenuItem onClick={() => void newVersion(row)}>
                                  <CopyPlus className="h-4 w-4" />
                                  {t("newVersion")}
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                disabled={!canPublish}
                                onClick={() => void toggleStatus(row)}
                              >
                                <Archive className="h-4 w-4" />
                                {published ? t("archive") : t("publish")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                                {t("delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </DataTableShell>
      </Surface>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? t("deleteConfirm", { name: deleteTarget.name }) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) void removeTemplate(deleteTarget);
              }}
            >
              {tc("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function clampPages(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(20, Math.max(1, Math.round(n)));
}
