"use client";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageStack } from "@/components/layout/PageStack";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreatePanel, ListPanel } from "@/components/layout/ResourcePanels";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { apiV1 } from "@/lib/api-base";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import { FolderKanban, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Row = {
  agreementId: string;
  name: string;
  status: string;
  counterparty: string | null;
  envelopeId: string | null;
};

const STATUSES = ["draft", "in_review", "active", "expired", "terminated"] as const;

export default function ClmPage() {
  const t = useTranslations("clm");
  const apiError = useApiError();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ agreements: Row[] }>(apiV1("/clm/agreements"));
      setRows(data.agreements);
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
      await api(apiV1("/clm/agreements"), {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          counterparty: counterparty.trim() || undefined,
        }),
      });
      toast.success(t("createdToast"));
      setName("");
      setCounterparty("");
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await api(apiV1(`/clm/agreements/${id}`), {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(t("statusToast"));
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  function statusLabel(status: string) {
    if ((STATUSES as readonly string[]).includes(status)) {
      return t(`status.${status}` as "status.draft");
    }
    return status;
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
            <Label htmlFor="clm-name">{t("name")}</Label>
            <Input
              id="clm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clm-party">{t("counterparty")}</Label>
            <Input
              id="clm-party"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder={t("counterpartyPlaceholder")}
              autoComplete="off"
            />
          </div>
        </div>
      </CreatePanel>

      <ListPanel title={t("listTitle")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colParty")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className="w-44">{t("changeStatus")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={4} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="p-0">
                  <EmptyState icon={FolderKanban} title={t("empty")} description={t("emptyHint")} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.agreementId}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.counterparty ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{statusLabel(row.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.status}
                      onValueChange={(v) => void setStatus(row.agreementId, v)}
                    >
                      <SelectTrigger aria-label={t("changeStatus")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`status.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
