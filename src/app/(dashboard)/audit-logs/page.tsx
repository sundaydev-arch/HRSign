"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Surface } from "@/components/layout/Surface";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import { formatDateTime } from "@/lib/labels";
import type { AuditLog } from "@prisma/client";

interface AuditLogRow extends AuditLog {
  user: { name: string; email: string } | null;
}

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const t = useTranslations("auditLogs");
  const tc = useTranslations("common");
  const apiError = useApiError();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (action.trim()) sp.set("action", action.trim());
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
  }, [page, action, from, to, apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Surface className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-action">{t("filterAction")}</Label>
          <Input
            id="filter-action"
            className="w-56"
            placeholder={t("actionPlaceholder")}
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-from">{t("dateFrom")}</Label>
          <Input
            id="filter-from"
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-to">{t("dateTo")}</Label>
          <Input
            id="filter-to"
            type="date"
            className="w-40"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <Search className="mr-1 h-4 w-4" />
          {tc("search")}
        </Button>
      </div>
      </Surface>

      <Surface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colTime")}</TableHead>
              <TableHead>{t("colUser")}</TableHead>
              <TableHead>{t("colAction")}</TableHead>
              <TableHead>{t("colTarget")}</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>{t("colDevice")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {tc("loading")}
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                  <TableCell>{log.user?.name ?? t("systemExternal")}</TableCell>
                  <TableCell>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.targetType}
                    {log.targetId ? ` · ${log.targetId.slice(0, 10)}` : ""}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.ip ?? "-"}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={log.userAgent ?? ""}>
                    {log.userAgent ?? "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Surface>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{t("totalRecords", { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            {t("prevPage")}
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("nextPage")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
