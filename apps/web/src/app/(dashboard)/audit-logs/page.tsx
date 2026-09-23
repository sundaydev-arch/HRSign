"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTableShell } from "@/components/layout/DataTableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { ChevronLeft, ChevronRight, Download, ScrollText, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/client";
import {
  AUDIT_ACTION_GROUPS,
  auditActionGroupPrefixes,
  auditActionLabelKey,
} from "@/lib/audit-actions";
import { useApiError } from "@/lib/use-api-error";
import { formatDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@prisma/client";

interface AuditLogRow extends AuditLog {
  user: { fullName: string; email: string } | null;
}

const PAGE_SIZE = 50;

/** Shorten raw UA strings for the table (full string stays in title). */
function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "—";
  if (ua === "node" || ua.length < 24) return ua;
  const browser =
    /Edg\/[\d.]+/.test(ua)
      ? "Edge"
      : /Chrome\/[\d.]+/.test(ua)
        ? "Chrome"
        : /Firefox\/[\d.]+/.test(ua)
          ? "Firefox"
          : /Safari\/[\d.]+/.test(ua) && !/Chrome/.test(ua)
            ? "Safari"
            : null;
  const os = /Mac OS X/.test(ua)
    ? "macOS"
    : /Windows/.test(ua)
      ? "Windows"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (browser && os) return `${browser} · ${os}`;
  if (browser) return browser;
  return ua.slice(0, 28) + "…";
}

function actionGroupFor(action: string): string | null {
  for (const group of AUDIT_ACTION_GROUPS) {
    const prefixes = auditActionGroupPrefixes(group.id);
    if (prefixes?.some((p) => action.startsWith(p))) return group.id;
  }
  return null;
}

const GROUP_BADGE: Record<string, string> = {
  task: "border-foreground/10 bg-foreground/[0.04] text-foreground",
  template: "border-border bg-muted text-foreground",
  seal: "border-success/20 bg-success/10 text-success",
  signer: "border-border bg-secondary text-secondary-foreground",
  archive: "border-warning/25 bg-warning/10 text-warning",
  account: "border-border bg-muted text-muted-foreground",
  admin: "border-border bg-muted text-muted-foreground",
};

export default function AuditLogsPage() {
  const t = useTranslations("auditLogs");
  const tc = useTranslations("common");
  const apiError = useApiError();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionGroup, setActionGroup] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const actionLabel = (code: string) => {
    const key = auditActionLabelKey(code);
    try {
      return t(`actionLabels.${key}`);
    } catch {
      return code;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (actionGroup) sp.set("group", actionGroup);
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      const data = await api<{ logs: AuditLogRow[]; total: number }>(`/api/audit-logs?${sp.toString()}`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page, actionGroup, from, to, apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(actionGroup || from || to);

  const clearFilters = () => {
    setActionGroup("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  async function exportCsv() {
    try {
      const sp = new URLSearchParams({ format: "csv" });
      if (actionGroup) sp.set("group", actionGroup);
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      const res = await fetch(`/api/audit-logs?${sp.toString()}`);
      if (!res.ok) throw new Error("export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-logs.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(apiError(err, "common.actionFailed"));
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button variant="outline" size="sm" className="h-9" onClick={() => void exportCsv()}>
            <Download className="mr-1.5 h-4 w-4" />
            {t("exportCsv")}
          </Button>
        }
      />

      <Surface className="overflow-hidden">
        {/* Compact filter toolbar — not a stretched 3-column form card */}
        <div className="flex flex-col gap-3 border-b border-border/80 bg-muted/30 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:px-4">
          <Select
            value={actionGroup || "all"}
            onValueChange={(v) => {
              setActionGroup(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger
              aria-label={t("filterAction")}
              className="h-9 w-full border-border/80 bg-card shadow-none sm:w-[11.5rem]"
            >
              <SelectValue placeholder={t("filterActionPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterActionAll")}</SelectItem>
              {AUDIT_ACTION_GROUPS.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {t(`actionGroups.${group.id}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-1.5">
            <DatePicker
              id="filter-from"
              value={from}
              max={to || undefined}
              placeholder={t("dateFromPlaceholder")}
              clearLabel={tc("clear")}
              className="h-9 w-full shadow-none sm:w-[10.5rem]"
              onChange={(v) => {
                setFrom(v);
                setPage(1);
              }}
            />
            <span className="hidden px-0.5 text-xs text-muted-foreground sm:inline" aria-hidden>
              –
            </span>
            <DatePicker
              id="filter-to"
              value={to}
              min={from || undefined}
              placeholder={t("dateToPlaceholder")}
              clearLabel={tc("clear")}
              className="h-9 w-full shadow-none sm:w-[10.5rem]"
              onChange={(v) => {
                setTo(v);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            {filtersActive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1 px-2 text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5" />
                {t("clearFilters")}
              </Button>
            ) : (
              <span className="hidden text-xs text-muted-foreground lg:inline">{t("filterAutoHint")}</span>
            )}
          </div>
        </div>

        <DataTableShell>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[9.5rem]">{t("colTime")}</TableHead>
                <TableHead className="w-[8.5rem]">{t("colUser")}</TableHead>
                <TableHead className="min-w-[10rem]">{t("colAction")}</TableHead>
                <TableHead className="min-w-[9rem]">{t("colTarget")}</TableHead>
                <TableHead className="w-[6.5rem]">{t("colIp")}</TableHead>
                <TableHead className="w-[8rem]">{t("colDevice")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRowsSkeleton columns={6} />
              ) : logs.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState icon={ScrollText} title={t("empty")} description={t("emptyHint")} />
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const group = actionGroupFor(log.action);
                  return (
                    <TableRow key={log.id} className="group">
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium leading-tight">
                            {log.user?.fullName ?? t("systemExternal")}
                          </div>
                          {log.user?.email ? (
                            <div className="truncate text-[11px] text-muted-foreground">{log.user.email}</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          title={log.action}
                          className={cn(
                            "max-w-[16rem] truncate font-normal",
                            group ? GROUP_BADGE[group] : "bg-muted text-muted-foreground",
                          )}
                        >
                          {actionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0 text-sm text-muted-foreground">
                          <span className="text-foreground/80">{log.targetType}</span>
                          {log.targetId ? (
                            <span className="mt-0.5 block font-mono text-[11px] tabular-nums">
                              {log.targetId.slice(0, 12)}
                              {log.targetId.length > 12 ? "…" : ""}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {log.ip === "::1" ? "localhost" : (log.ip ?? "—")}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground"
                        title={log.userAgent ?? undefined}
                      >
                        {summarizeUserAgent(log.userAgent)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </DataTableShell>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 px-3 py-2.5 sm:px-4">
          <span className="text-xs text-muted-foreground">{t("totalRecords", { total })}</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-1">{t("prevPage")}</span>
            </Button>
            <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <span className="sr-only sm:not-sr-only sm:mr-1">{t("nextPage")}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}
