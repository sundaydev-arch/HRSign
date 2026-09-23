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
import { Plus, Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Row = {
  transactionId: string;
  status: string;
  notaryName: string | null;
  jurisdiction: string | null;
  envelopeId: string | null;
  scheduledAt: string | null;
};

const STATUS_VALUES = [
  "created",
  "scheduled",
  "in_session",
  "completed",
  "cancelled",
] as const;

export default function NotaryPage() {
  const t = useTranslations("notary");
  const apiError = useApiError();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [notaryName, setNotaryName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [envelopeId, setEnvelopeId] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ transactions: Row[] }>(apiV1("/notary/transactions"));
      setRows(data.transactions);
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
    setCreating(true);
    try {
      await api(apiV1("/notary/transactions"), {
        method: "POST",
        body: JSON.stringify({
          notaryName: notaryName.trim() || undefined,
          jurisdiction: jurisdiction.trim() || undefined,
          envelopeId: envelopeId.trim() || undefined,
        }),
      });
      toast.success(t("createdToast"));
      setNotaryName("");
      setJurisdiction("");
      setEnvelopeId("");
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await api(apiV1(`/notary/transactions/${id}`), {
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
    if ((STATUS_VALUES as readonly string[]).includes(status)) {
      return t(`status.${status as (typeof STATUS_VALUES)[number]}`);
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
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ny-name">{t("notaryName")}</Label>
            <Input
              id="ny-name"
              value={notaryName}
              onChange={(e) => setNotaryName(e.target.value)}
              placeholder={t("notaryNamePlaceholder")}
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ny-jurisdiction">{t("jurisdiction")}</Label>
            <Input
              id="ny-jurisdiction"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              placeholder={t("jurisdictionPlaceholder")}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ny-envelope">{t("envelopeId")}</Label>
            <Input
              id="ny-envelope"
              value={envelopeId}
              onChange={(e) => setEnvelopeId(e.target.value)}
              placeholder={t("envelopeIdPlaceholder")}
              className="font-mono text-sm"
              autoComplete="off"
            />
            <FieldHint>{t("envelopeIdHint")}</FieldHint>
          </div>
        </div>
      </CreatePanel>

      <ListPanel title={t("listTitle")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colNotary")}</TableHead>
              <TableHead>{t("colJurisdiction")}</TableHead>
              <TableHead>{t("colEnvelope")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className="w-44">
                <span className="sr-only">{t("changeStatus")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={5} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="p-0">
                  <EmptyState icon={Scale} title={t("empty")} description={t("emptyHint")} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.transactionId}>
                  <TableCell className="font-medium">{row.notaryName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.jurisdiction ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate font-mono text-xs text-muted-foreground">
                    {row.envelopeId ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{statusLabel(row.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.status}
                      onValueChange={(v) => void setStatus(row.transactionId, v)}
                    >
                      <SelectTrigger aria-label={t("changeStatus")} className="h-9">
                        <SelectValue placeholder={t("changeStatus")} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(`status.${value}`)}
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
