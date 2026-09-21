"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Surface } from "@/components/layout/Surface";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import { formatDateTime } from "@/lib/labels";
import type { Seal } from "@prisma/client";
import { PencilLine, Plus, Upload } from "lucide-react";
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
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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
    if (!name.trim() || !file) {
      toast.error(t("formInvalid"));
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("file", file);
      await api("/api/seals", { method: "POST", body: form });
      toast.success(t("uploadSuccess"));
      setUploadOpen(false);
      setName("");
      setFile(null);
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
    if (!renameId || !renameValue.trim()) return;
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
                <Label htmlFor="seal-name">{t("name")}</Label>
                <Input
                  id="seal-name"
                  placeholder={t("namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seal-file">{t("imageLabel")}</Label>
                <Input
                  id="seal-file"
                  type="file"
                  accept="image/png"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {file && (
                <div className="flex items-center justify-center rounded-md border bg-muted/40 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(file)} alt={t("previewAlt")} className="max-h-24 object-contain" />
                </div>
              )}
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
              <TableHead>{t("colPreview")}</TableHead>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colUploader")}</TableHead>
              <TableHead>{t("colUploadedAt")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {tc("loading")}
                </TableCell>
              </TableRow>
            ) : seals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              seals.map((seal) => (
                <TableRow key={seal.id}>
                  <TableCell>
                    <div className="flex h-14 w-20 items-center justify-center rounded border bg-white p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/files/${seal.storageKey}`}
                        alt={seal.name}
                        className="max-h-12 max-w-full object-contain"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{seal.name}</TableCell>
                  <TableCell>
                    <Badge variant={seal.enabled ? "default" : "outline"}>
                      {seal.enabled ? tc("enabled") : tc("disabled")}
                    </Badge>
                  </TableCell>
                  <TableCell>{seal.creator.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(seal.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRenameId(seal.id);
                        setRenameValue(seal.name);
                      }}
                    >
                      <PencilLine className="mr-1 h-4 w-4" />
                      {tc("rename")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void toggleEnabled(seal)}>
                      {seal.enabled ? tc("disable") : tc("enable")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Surface>

      <Dialog open={renameId !== null} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("renameTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input">{t("name")}</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
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
