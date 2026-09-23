"use client";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
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
import { api } from "@/lib/client";
import { apiV1 } from "@/lib/api-base";
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

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Surface className="space-y-3 p-4 sm:p-5">
        <h2 className="text-sm font-semibold">{t("create")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("counterparty")}</Label>
            <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          </div>
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
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colParty")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead />
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
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                  <TableCell className="w-40">
                    <Select
                      value={row.status}
                      onValueChange={(v) => void setStatus(row.agreementId, v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">draft</SelectItem>
                        <SelectItem value="in_review">in_review</SelectItem>
                        <SelectItem value="active">active</SelectItem>
                        <SelectItem value="expired">expired</SelectItem>
                        <SelectItem value="terminated">terminated</SelectItem>
                      </SelectContent>
                    </Select>
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
