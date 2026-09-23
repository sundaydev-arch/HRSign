"use client";

import { SignatureDisclaimer } from "@/components/sign/SignatureDisclaimer";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTableShell } from "@/components/layout/DataTableShell";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
import { SealPreview } from "@/components/seals/SealPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDropzone } from "@/components/ui/file-dropzone";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import { formatDateTime, SEAL_STYLE_LABEL_KEYS } from "@/lib/labels";
import type { Seal, SealStyle } from "@prisma/client";
import { PencilLine, Plus, Upload, MoreHorizontal, Stamp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface SealRow extends Seal {
  creator: { fullName: string };
}

export default function SealsPage() {
  const t = useTranslations("seals");
  const tc = useTranslations("common");
  const apiError = useApiError();
  const [seals, setSeals] = useState<SealRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [name, setName] = useState("");
  const [style, setStyle] = useState<SealStyle>("ROUND_CHINESE");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; file?: string }>({});

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ seals: SealRow[] }>("/api/seals");
      setSeals(data.seals);
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
    const next: { name?: string; file?: string } = {};
    if (!name.trim()) next.name = t("nameRequired");
    if (!file) next.file = t("fileRequired");
    setErrors(next);
    if (next.name || next.file) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("style", style);
      form.set("file", file!);
      await api("/api/seals", { method: "POST", body: form });
      toast.success(t("uploadSuccess"));
      setUploadOpen(false);
      setName("");
      setStyle("ROUND_CHINESE");
      setFile(null);
      setErrors({});
      await load();
    } catch (err) {
      toast.error(apiError(err, "common.uploadFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleEnabled(seal: SealRow) {
    try {
      await api(`/api/seals/${seal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !seal.enabled }),
      });
      toast.success(seal.enabled ? t("disabledToast") : t("enabledToast"));
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  async function handleRename() {
    if (!renameId) return;
    if (!renameValue.trim()) {
      setRenameError(t("nameRequired"));
      return;
    }
    setRenameError("");
    try {
      await api(`/api/seals/${renameId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      toast.success(t("renamedToast"));
      setRenameId(null);
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
          open={uploadOpen}
          onOpenChange={(open) => {
            setUploadOpen(open);
            if (!open) {
              setName("");
              setStyle("ROUND_CHINESE");
              setFile(null);
              setErrors({});
            }
          }}
        >
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
                <Label htmlFor="seal-name">{t("name")}</Label>
                <Input
                  id="seal-name"
                  value={name}
                  placeholder={t("namePlaceholder")}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>{t("styleLabel")}</Label>
                <Select value={style} onValueChange={(v) => setStyle(v as SealStyle)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("stylePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SEAL_STYLE_LABEL_KEYS) as SealStyle[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(SEAL_STYLE_LABEL_KEYS[key])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("imageLabel")}</Label>
                <FileDropzone
                  kind="image"
                  accept="image/png"
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
                  previewAlt={t("previewAlt")}
                />
                {errors.file ? <p className="text-sm text-destructive">{errors.file}</p> : null}
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

      <SignatureDisclaimer variant="compact" />

      <Surface>
        <DataTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colPreview")}</TableHead>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colStyle")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colUploader")}</TableHead>
              <TableHead>{t("colUploadedAt")}</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={7} />
            ) : seals.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    icon={Stamp}
                    title={t("empty")}
                    description={t("emptyHint")}
                    action={
                      <Button size="sm" onClick={() => setUploadOpen(true)}>
                        <Plus className="mr-1 h-4 w-4" />
                        {t("uploadBtn")}
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              seals.map((seal) => (
                <TableRow key={seal.id}>
                  <TableCell>
                    <SealPreview storageKey={seal.storageKey} alt={seal.name} />
                  </TableCell>
                  <TableCell className="font-medium">{seal.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t(SEAL_STYLE_LABEL_KEYS[seal.style])}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={seal.enabled ? "default" : "outline"}>
                      {seal.enabled ? tc("enabled") : tc("disabled")}
                    </Badge>
                  </TableCell>
                  <TableCell>{seal.creator.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(seal.createdAt)}</TableCell>
                  <TableCell className="w-[1%] whitespace-nowrap text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        className="h-8 px-2.5"
                        onClick={() => {
                          setRenameId(seal.id);
                          setRenameValue(seal.name);
                        }}
                      >
                        <PencilLine className="mr-1 h-3.5 w-3.5" />
                        {tc("rename")}
                      </Button>
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
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => void toggleEnabled(seal)}>
                            {seal.enabled ? tc("disable") : tc("enable")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </DataTableShell>
      </Surface>

      <Dialog
        open={renameId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameId(null);
            setRenameError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("renameTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input">{t("name")}</Label>
            <Input
              id="rename-input"
              value={renameValue}
              placeholder={t("namePlaceholder")}
              onChange={(e) => {
                setRenameValue(e.target.value);
                if (renameError) setRenameError("");
              }}
              aria-invalid={Boolean(renameError)}
            />
            {renameError ? <p className="text-sm text-destructive">{renameError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>
              {tc("cancel")}
            </Button>
            <Button onClick={() => void handleRename()}>{tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
