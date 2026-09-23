"use client";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageStack } from "@/components/layout/PageStack";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreatePanel, FieldHint, ListPanel } from "@/components/layout/ResourcePanels";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
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
import { apiV1 } from "@/lib/api-base";
import { absoluteUrl, copyText } from "@/lib/clipboard";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import { Copy, FileInput, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type PowerForm = { id: string; name: string; templateId: string; url: string };

export default function PowerFormsPage() {
  const t = useTranslations("powerforms");
  const apiError = useApiError();
  const [rows, setRows] = useState<PowerForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ powerForms: PowerForm[] }>(apiV1("/powerforms"));
      setRows(data.powerForms);
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
    if (!name.trim() || !templateId.trim()) {
      toast.error(t("formRequired"));
      return;
    }
    setCreating(true);
    try {
      await api(apiV1("/powerforms"), {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), templateId: templateId.trim() }),
      });
      toast.success(t("createdToast"));
      setName("");
      setTemplateId("");
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCreating(false);
    }
  }

  async function onCopy(url: string) {
    const ok = await copyText(absoluteUrl(url));
    if (ok) toast.success(t("copied"));
    else toast.error(t("copyUrl"));
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">{t("name")}</Label>
            <Input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-template">{t("templateId")}</Label>
            <Input
              id="pf-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder={t("templateIdPlaceholder")}
              className="font-mono text-sm"
              autoComplete="off"
            />
            <FieldHint>{t("templateIdHint")}</FieldHint>
          </div>
        </div>
      </CreatePanel>

      <ListPanel title={t("listTitle")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colTemplate")}</TableHead>
              <TableHead>{t("colUrl")}</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={4} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="p-0">
                  <EmptyState icon={FileInput} title={t("empty")} description={t("emptyHint")} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.templateId}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs">
                    <a className="text-primary underline-offset-2 hover:underline" href={row.url}>
                      {row.url}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs"
                      onClick={() => void onCopy(row.url)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t("copyUrl")}
                    </Button>
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
