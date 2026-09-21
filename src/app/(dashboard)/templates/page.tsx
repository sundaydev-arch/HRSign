"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Surface } from "@/components/layout/Surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { PencilLine, Plus, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import {
  TEMPLATE_CATEGORY_LABEL_KEYS,
  TEMPLATE_STATUS_LABEL_KEYS,
  TEMPLATE_STATUS_VARIANTS,
  formatDateTime,
} from "@/lib/labels";
import type { TemplateCategory, TemplateVersionStatus } from "@prisma/client";

// Shape returned by GET /api/templates (Template is a pure container; status,
// fields and page count belong to the latest version).
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

export default function TemplatesPage() {
  const t = useTranslations("templates");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const apiError = useApiError();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleUpload() {
    if (!name.trim() || !category || !file) {
      toast.error(t("formInvalid"));
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("category", category);
      form.set("file", file);
      await api("/api/templates", { method: "POST", body: form });
      toast.success(t("uploadSuccess"));
      setUploadOpen(false);
      setName("");
      setCategory("");
      setFile(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, "common.uploadFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(row: TemplateRow) {
    // spec 3.1: status belongs to the version; PUBLISHED can only be archived,
    // while drafts can be published.
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" />
              {t("uploadBtn")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("dialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-name">{t("name")}</Label>
                <Input
                  id="tpl-name"
                  placeholder={t("namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("category")}</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as TemplateCategory)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("categoryPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TEMPLATE_CATEGORY_LABEL_KEYS).map(
                      ([value, labelKey]) => (
                        <SelectItem key={value} value={value}>
                          {tl(labelKey)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-file">{t("fileLabel")}</Label>
                <Input
                  id="tpl-file"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={() => void handleUpload()} disabled={submitting}>
                <Upload className="mr-1 h-4 w-4" />
                {submitting ? tc("uploading") : tc("upload")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <Surface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colCategory")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colFieldCount")}</TableHead>
              <TableHead>{t("colPageCount")}</TableHead>
              <TableHead>{t("colCreator")}</TableHead>
              <TableHead>{t("colUpdatedAt")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {tc("loading")}
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{tl(TEMPLATE_CATEGORY_LABEL_KEYS[row.category])}</TableCell>
                  <TableCell>
                    {row.latestVersion ? (
                      <Badge
                        variant={
                          TEMPLATE_STATUS_VARIANTS[row.latestVersion.status]
                        }
                      >
                        {tl(TEMPLATE_STATUS_LABEL_KEYS[row.latestVersion.status])}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{row.latestVersion?.fieldCount ?? 0}</TableCell>
                  <TableCell>{row.latestVersion?.pageCount ?? "-"}</TableCell>
                  <TableCell>{row.creatorName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(row.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/templates/${row.id}/edit`}>
                        <PencilLine className="mr-1 h-4 w-4" />
                        {t("editFields")}
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleStatus(row)}
                      disabled={
                        !row.latestVersion ||
                        (row.latestVersion.status === "DRAFT" &&
                          row.latestVersion.fieldCount === 0)
                      }
                    >
                      {row.latestVersion?.status === "PUBLISHED"
                        ? t("archive")
                        : t("publish")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Surface>
    </div>
  );
}
