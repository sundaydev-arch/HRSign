"use client";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageStack } from "@/components/layout/PageStack";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreatePanel, FieldHint, ListPanel } from "@/components/layout/ResourcePanels";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
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
import { apiV1 } from "@/lib/api-base";
import { api } from "@/lib/client";
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
  const [csv, setCsv] = useState(
    "name,email\nZhou Wanqing,wanqing.zhou@outlook.com\nLi Jun,li.jun@yunqi-tech.cn",
  );
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
    <PageStack>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <CreatePanel
        title={t("create")}
        hint={t("createHint")}
        actions={
          <Button loading={creating} onClick={() => void create()}>
            <Plus className="mr-1 h-4 w-4" />
            {t("create")}
          </Button>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="bulk-template">{t("templateId")}</Label>
          <Input
            id="bulk-template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            placeholder={t("templateIdPlaceholder")}
            className="font-mono text-sm"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-rows">{t("rows")}</Label>
          <Textarea
            id="bulk-rows"
            rows={6}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={t("rowsPlaceholder")}
            className="font-mono text-xs"
          />
          <FieldHint>{t("rowsHint")}</FieldHint>
        </div>
      </CreatePanel>

      <ListPanel title={t("listTitle")}>
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
      </ListPanel>
    </PageStack>
  );
}
