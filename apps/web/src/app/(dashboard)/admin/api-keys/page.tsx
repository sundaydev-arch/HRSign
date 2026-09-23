"use client";

import { DataTableShell } from "@/components/layout/DataTableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableSkeleton } from "@/components/layout/skeletons";
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
import { formatDateTime } from "@/lib/labels";
import { useApiError } from "@/lib/use-api-error";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

function scopeLabel(
  scope: string,
  t: (key: "scopeTasksRead" | "scopeTasksWrite" | "scopeAdmin" | "scopeAll") => string,
): string {
  if (scope === "tasks:read") return t("scopeTasksRead");
  if (scope === "tasks:write") return t("scopeTasksWrite");
  if (scope === "*" || scope === "SUPER_ADMIN") return t("scopeAll");
  if (scope.startsWith("admin") || scope === "HR") return t("scopeAdmin");
  return t("scopeTasksRead");
}

interface KeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export default function AdminApiKeysPage() {
  const t = useTranslations("admin.apiKeys");
  const tc = useTranslations("common");
  const locale = useLocale();
  const apiError = useApiError();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ keys: KeyRow[] }>("/api/admin/api-keys");
      setKeys(data.keys);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setSubmitting(true);
    try {
      const res = await api<{ plaintext: string }>("/api/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setPlaintext(res.plaintext);
      setName("");
      toast.success(t("createdToast"));
      await load();
    } catch (err) {
      toast.error(apiError(err, "common.createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPlaintext() {
    if (!plaintext) return;
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
      toast.success(tc("copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tc("actionFailed"));
    }
  }

  async function revoke(id: string) {
    try {
      await api(`/api/admin/api-keys/${id}`, { method: "DELETE" });
      toast.success(t("revokedToast"));
      await load();
    } catch (err) {
      toast.error(apiError(err, "common.actionFailed"));
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/admin/api-keys/${id}`, { method: "DELETE" });
      toast.success(t("deletedToast"));
      await load();
    } catch (err) {
      toast.error(apiError(err, "common.actionFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                setPlaintext(null);
                setCopied(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" />
                {t("create")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("create")}</DialogTitle>
              </DialogHeader>
              {plaintext ? (
                <div className="space-y-2">
                  <Label>{t("plaintextLabel")}</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={plaintext} className="font-mono text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => void copyPlaintext()}
                    >
                      {copied ? (
                        <Check className="mr-1.5 h-4 w-4" />
                      ) : (
                        <Copy className="mr-1.5 h-4 w-4" />
                      )}
                      {copied ? tc("copied") : tc("copy")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t("name")}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                  />
                </div>
              )}
              <DialogFooter>
                {plaintext ? (
                  <Button onClick={() => setOpen(false)}>{tc("save")}</Button>
                ) : (
                  <Button onClick={() => void create()} disabled={!name.trim()} loading={submitting}>
                    {submitting ? tc("creating") : t("create")}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <TableSkeleton columns={7} rows={4} />
      ) : keys.length === 0 ? (
        <Surface>
          <EmptyState
            icon={KeyRound}
            title={t("empty")}
            description={t("emptyHint")}
            action={
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                {t("create")}
              </Button>
            }
          />
        </Surface>
      ) : (
        <Surface>
          <DataTableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("prefix")}</TableHead>
                <TableHead>{t("scopes")}</TableHead>
                <TableHead>{t("lastUsed")}</TableHead>
                <TableHead>{t("expires")}</TableHead>
                <TableHead>{tc("status")}</TableHead>
                <TableHead>{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                      {k.name}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{k.keyPrefix}…</TableCell>
                  <TableCell className="text-xs">
                    {k.scopes.map((s) => scopeLabel(s, t)).join(locale.startsWith("zh") ? "、" : ", ")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {k.lastUsedAt ? formatDateTime(k.lastUsedAt) : t("neverUsed")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {k.expiresAt ? formatDateTime(k.expiresAt) : t("neverExpires")}
                  </TableCell>
                  <TableCell>
                    {k.revokedAt ? (
                      <Badge variant="destructive">{t("revoked")}</Badge>
                    ) : (
                      <Badge variant="secondary">{tc("active")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {k.revokedAt ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void remove(k.id)}
                      >
                        {t("delete")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => void revoke(k.id)}>
                        {t("revoke")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </DataTableShell>
        </Surface>
      )}
    </div>
  );
}
