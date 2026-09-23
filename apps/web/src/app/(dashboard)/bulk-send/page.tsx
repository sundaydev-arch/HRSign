"use client";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/client";
import { apiV1 } from "@/lib/api-base";
import { useApiError } from "@/lib/use-api-error";
import { Layers, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Batch = {
  batchId: string;
  templateId: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  createdAt: string;
};

export default function BulkSendPage() {
  const t = useTranslations("bulkSend");
  const apiError = useApiError();
  const [rows, setRows] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [csv, setCsv] = useState("name,email\nAlice,alice@example.com\nBob,bob@example.com");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ batches: Batch[] }>(apiV1("/bulk_send_batches"));
      setRows(data.batches);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  function parseRows(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    const header = (lines[0] ?? "").toLowerCase();
    const hasHeader = header.includes("email");
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.map((line) => {
      const [a, b] = line.split(",").map((x) => x.trim());
      if (hasHeader && header.startsWith("name")) {
        return { name: a, email: b || a };
      }
      // email,name or just email
      if (line.includes("@")) {
        if (b?.includes("@")) return { name: a, email: b };
        if (a?.includes("@")) return { email: a, name: b || a };
      }
      return { name: a, email: b || "" };
    });
  }

  async function create() {
    const parsed = parseRows(csv).filter((r) => r.email);
    if (!templateId.trim() || parsed.length === 0) {
      toast.error(t("formRequired"));
      return;
    }
    setCreating(true);
    try {
      const result = await api<{
        batchId: string;
        succeeded: number;
        failed: number;
      }>(apiV1("/bulk_send_batches"), {
        method: "POST",
        body: JSON.stringify({ templateId: templateId.trim(), rows: parsed, send: true }),
      });
      toast.success(t("createdToast", { ok: result.succeeded, fail: result.failed }));
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Surface className="space-y-3 p-4 sm:p-5">
        <h2 className="text-sm font-semibold">{t("create")}</h2>
        <div className="space-y-1.5">
          <Label>{t("templateId")}</Label>
          <Input value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="tmpl_…" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("rows")}</Label>
          <Textarea rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground">{t("rowsHint")}</p>
        </div>
        <Button loading={creating} onClick={() => void create()}>
          <Plus className="mr-1 h-4 w-4" />
          {t("create")}
        </Button>
      </Surface>
      <Surface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colBatch")}</TableHead>
              <TableHead>{t("colTemplate")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colCounts")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={4} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="p-0">
                  <EmptyState icon={Layers} title={t("empty")} description={t("emptyHint")} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.batchId}>
                  <TableCell className="font-mono text-xs">{row.batchId}</TableCell>
                  <TableCell className="font-mono text-xs">{row.templateId}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.succeeded}/{row.total}
                    {row.failed ? ` (−${row.failed})` : ""}
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
