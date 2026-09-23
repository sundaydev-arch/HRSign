"use client";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreatePanel, FieldHint, ListPanel } from "@/components/layout/ResourcePanels";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { absoluteUrl, copyText } from "@/lib/clipboard";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import { Copy, FileCheck2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Row = {
  clickwrapId: string;
  name: string;
  displayName: string;
  status: string;
  version: number;
  acceptanceCount?: number;
};

export default function ClickwrapsPage() {
  const t = useTranslations("clickwraps");
  const apiError = useApiError();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [requireScroll, setRequireScroll] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ clickwraps: Row[] }>(apiV1("/clickwraps"));
      setRows(data.clickwraps);
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
    if (!name.trim()) {
      toast.error(t("formRequired"));
      return;
    }
    setCreating(true);
    try {
      await api(apiV1("/clickwraps"), {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          bodyHtml: bodyHtml.trim() || t("bodyPlaceholder"),
          requireScroll,
        }),
      });
      toast.success(t("createdToast"));
      setName("");
      setBodyHtml("");
      setRequireScroll(false);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCreating(false);
    }
  }

  async function onCopy(id: string) {
    const ok = await copyText(absoluteUrl(`/clickwraps/${id}`));
    if (ok) toast.success(t("copied"));
    else toast.error(t("copyUrl"));
  }

  return (
    <div className="space-y-5">
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
          <Label htmlFor="cw-name">{t("name")}</Label>
          <Input
            id="cw-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cw-body">{t("body")}</Label>
          <Textarea
            id="cw-body"
            rows={5}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder={t("bodyPlaceholder")}
            className="font-mono text-xs leading-relaxed sm:text-sm"
          />
          <FieldHint>{t("bodyHint")}</FieldHint>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/90">
          <Checkbox
            checked={requireScroll}
            onCheckedChange={(v) => setRequireScroll(v === true)}
          />
          {t("requireScroll")}
        </label>
      </CreatePanel>

      <ListPanel title={t("listTitle")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colVersion")}</TableHead>
              <TableHead>{t("colAccepts")}</TableHead>
              <TableHead>{t("colUrl")}</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={6} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <EmptyState icon={FileCheck2} title={t("empty")} description={t("emptyHint")} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const path = `/clickwraps/${row.clickwrapId}`;
                return (
                  <TableRow key={row.clickwrapId}>
                    <TableCell className="font-medium">{row.displayName || row.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status}</Badge>
                    </TableCell>
                    <TableCell>v{row.version}</TableCell>
                    <TableCell>{row.acceptanceCount ?? 0}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      <a className="text-primary underline-offset-2 hover:underline" href={path}>
                        {path}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 px-2 text-xs"
                        onClick={() => void onCopy(row.clickwrapId)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {t("copyUrl")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </ListPanel>
    </div>
  );
}
