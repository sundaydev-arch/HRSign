"use client";

import { DataTableShell } from "@/components/layout/DataTableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import { MoreHorizontal, Check, Copy, Plus, RotateCcw, Webhook } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const ALL_EVENTS = [
  "task.created",
  "approval.result",
  "signing.completed",
  "signing.declined",
  "signing.expired",
  "envelope.sent",
  "envelope.completed",
  "envelope.voided",
  "envelope.declined",
  "recipient.completed",
] as const;

const EVENT_LABEL_KEY = {
  "task.created": "taskCreated",
  "approval.result": "approvalResult",
  "signing.completed": "signingCompleted",
  "signing.declined": "signingDeclined",
  "signing.expired": "signingExpired",
  "envelope.sent": "envelopeSent",
  "envelope.completed": "envelopeCompleted",
  "envelope.voided": "envelopeVoided",
  "envelope.declined": "envelopeDeclined",
  "recipient.completed": "recipientCompleted",
} as const;

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  secretPrefix: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  _count: { deliveries: number };
  failedDeliveries: number;
  lastFailure: { error: string | null; status: number | null; at: string } | null;
}

export default function AdminWebhooksPage() {
  const t = useTranslations("admin.webhooks");
  const tc = useTranslations("common");
  const locale = useLocale();
  const apiError = useApiError();
  const [rows, setRows] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["task.created", "signing.completed"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deliveriesOpen, setDeliveriesOpen] = useState(false);
  const [deliveriesWebhookId, setDeliveriesWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<
    Array<{
      id: string;
      event: string;
      status: string;
      attemptCount: number;
      responseError: string | null;
      createdAt: string;
    }>
  >([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ webhooks: WebhookRow[] }>("/api/admin/webhooks");
      setRows(data.webhooks);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleEvent(ev: string) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  }

  function toggleEditEvent(ev: string) {
    setEditEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  }

  function openEdit(row: WebhookRow) {
    setEditing(row);
    setEditName(row.name);
    setEditUrl(row.url);
    setEditEvents([...row.events]);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editing) return;
    setEditSubmitting(true);
    try {
      await api(`/api/admin/webhooks/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName, url: editUrl, events: editEvents }),
      });
      toast.success(t("updatedToast"));
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, "common.saveFailed"));
    } finally {
      setEditSubmitting(false);
    }
  }

  async function create() {
    setSubmitting(true);
    try {
      const res = await api<{ plaintextSecret: string }>("/api/admin/webhooks", {
        method: "POST",
        body: JSON.stringify({ name, url, events }),
      });
      setSecret(res.plaintextSecret);
      toast.success(t("createdToast"));
      await load();
    } catch (err) {
      toast.error(apiError(err, "common.createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setSecretCopied(true);
      toast.success(tc("copied"));
      window.setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      toast.error(tc("actionFailed"));
    }
  }

  async function setEnabled(id: string, enabled: boolean) {
    try {
      await api(`/api/admin/webhooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      toast.success(t("updatedToast"));
      await load();
    } catch (err) {
      toast.error(apiError(err, "common.actionFailed"));
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/admin/webhooks/${id}`, { method: "DELETE" });
      toast.success(t("deletedToast"));
      await load();
    } catch (err) {
      toast.error(apiError(err, "common.actionFailed"));
    }
  }

  async function openDeliveries(id: string) {
    setDeliveriesWebhookId(id);
    setDeliveriesOpen(true);
    setDeliveriesLoading(true);
    try {
      const res = await api<{ deliveries: typeof deliveries }>(
        `/api/admin/webhooks/${id}/deliveries`,
      );
      setDeliveries(res.deliveries);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setDeliveriesLoading(false);
    }
  }

  async function retryDelivery(deliveryId: string) {
    if (!deliveriesWebhookId) return;
    try {
      await api(`/api/admin/webhooks/${deliveriesWebhookId}/deliveries/${deliveryId}/retry`, {
        method: "POST",
      });
      toast.success(t("retryQueued"));
      await openDeliveries(deliveriesWebhookId);
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
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                setSecret(null);
                setSecretCopied(false);
                setName("");
                setUrl("");
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
              {secret ? (
                <div className="space-y-2">
                  <Label>{t("secretOnce")}</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={secret} className="font-mono text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => void copySecret()}
                    >
                      {secretCopied ? (
                        <Check className="mr-1.5 h-4 w-4" />
                      ) : (
                        <Copy className="mr-1.5 h-4 w-4" />
                      )}
                      {secretCopied ? tc("copied") : tc("copy")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{t("name")}</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("namePlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("url")}</Label>
                    <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("events")}</Label>
                    <p className="text-xs text-muted-foreground">{t("eventsHint")}</p>
                    <div className="space-y-1.5">
                      {ALL_EVENTS.map((ev) => (
                        <label key={ev} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={events.includes(ev)}
                            onCheckedChange={() => toggleEvent(ev)}
                            className="mt-0.5"
                          />
                          <span>{t(`eventLabels.${EVENT_LABEL_KEY[ev]}`)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                {secret ? (
                  <Button onClick={() => setOpen(false)}>{tc("save")}</Button>
                ) : (
                  <Button
                    onClick={() => void create()}
                    disabled={!name.trim() || !url.trim() || events.length === 0}
                    loading={submitting}
                  >
                    {submitting ? tc("creating") : t("create")}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t("name")}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("url")}</Label>
              <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://" />
            </div>
            <div className="space-y-2">
              <Label>{t("events")}</Label>
              <p className="text-xs text-muted-foreground">{t("eventsHint")}</p>
              <div className="space-y-1.5">
                {ALL_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={editEvents.includes(ev)}
                      onCheckedChange={() => toggleEditEvent(ev)}
                      className="mt-0.5"
                    />
                    <span>{t(`eventLabels.${EVENT_LABEL_KEY[ev]}`)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={() => void saveEdit()}
              disabled={!editName.trim() || !editUrl.trim() || editEvents.length === 0}
              loading={editSubmitting}
            >
              {editSubmitting ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <TableSkeleton columns={6} rows={4} />
      ) : rows.length === 0 ? (
        <Surface>
          <EmptyState
            icon={Webhook}
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
                <TableHead>{t("url")}</TableHead>
                <TableHead>{t("events")}</TableHead>
                <TableHead>{t("deliveryCount")}</TableHead>
                <TableHead>{t("failures")}</TableHead>
                <TableHead>{t("toggle")}</TableHead>
                <TableHead>{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={w.url}>
                    {w.url}
                  </TableCell>
                  <TableCell className="max-w-[280px] text-xs leading-5 text-muted-foreground">
                    {w.events
                      .map((ev) =>
                        ev in EVENT_LABEL_KEY
                          ? t(`eventLabels.${EVENT_LABEL_KEY[ev as keyof typeof EVENT_LABEL_KEY]}`)
                          : ev,
                      )
                      .join(locale.startsWith("zh") ? "、" : ", ")}
                  </TableCell>
                  <TableCell>{w._count.deliveries}</TableCell>
                  <TableCell>
                    {w.failedDeliveries > 0 ? (
                      <Badge variant="destructive" title={w.lastFailure?.error ?? undefined}>
                        {w.failedDeliveries}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={w.enabled ? "secondary" : "outline"}>
                      {w.enabled ? tc("enabled") : tc("disabled")}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-[1%] whitespace-nowrap text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 px-2" aria-label={t("more")}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void openDeliveries(w.id)}>
                          {t("viewDeliveries")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(w)}>{t("edit")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void setEnabled(w.id, !w.enabled)}>
                          {w.enabled ? tc("disable") : tc("enable")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => void remove(w.id)}
                        >
                          {t("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </DataTableShell>
        </Surface>
      )}

      <Sheet open={deliveriesOpen} onOpenChange={setDeliveriesOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t("deliveriesSheet")}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 overflow-y-auto">
            {deliveriesLoading ? (
              <p className="text-sm text-muted-foreground">…</p>
            ) : deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("deliveriesEmpty")}</p>
            ) : (
              deliveries.map((d) => (
                <div
                  key={d.id}
                  className="rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm">
                        {d.event in EVENT_LABEL_KEY
                          ? t(`eventLabels.${EVENT_LABEL_KEY[d.event as keyof typeof EVENT_LABEL_KEY]}`)
                          : d.event}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {d.status === "SUCCESS"
                          ? t("deliveryOk")
                          : d.status === "FAILED"
                            ? t("deliveryFail")
                            : t("deliveryPending")}{" "}
                        · {t("attempts", { count: d.attemptCount })}
                      </p>
                      {d.responseError ? (
                        <p className="mt-1 text-xs text-destructive">{d.responseError}</p>
                      ) : null}
                    </div>
                    {d.status !== "SUCCESS" ? (
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0"
                        onClick={() => void retryDelivery(d.id)}
                        title={t("retry")}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
