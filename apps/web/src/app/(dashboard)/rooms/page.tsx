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
import { DoorOpen, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Row = {
  roomId: string;
  name: string;
  status: string;
  description: string | null;
  members?: unknown[];
  documents?: unknown[];
};

export default function RoomsPage() {
  const t = useTranslations("rooms");
  const apiError = useApiError();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ rooms: Row[] }>(apiV1("/rooms"));
      setRows(data.rooms);
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
      await api(apiV1("/rooms"), {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          members: memberEmail.trim()
            ? [{ name: memberEmail.trim(), email: memberEmail.trim(), role: "viewer" }]
            : undefined,
        }),
      });
      toast.success(t("createdToast"));
      setName("");
      setDescription("");
      setMemberEmail("");
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("memberEmail")}</Label>
            <Input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="optional"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("description")}</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
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
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colMembers")}</TableHead>
              <TableHead>{t("colDocs")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={4} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="p-0">
                  <EmptyState icon={DoorOpen} title={t("empty")} description={t("emptyHint")} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.roomId}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                  <TableCell>{row.members?.length ?? 0}</TableCell>
                  <TableCell>{row.documents?.length ?? 0}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Surface>
    </div>
  );
}
