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
            <Label htmlFor="room-name">{t("name")}</Label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="room-member">{t("memberEmail")}</Label>
            <Input
              id="room-member"
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder={t("memberEmailPlaceholder")}
              autoComplete="email"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room-desc">{t("description")}</Label>
          <Input
            id="room-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
          />
        </div>
      </CreatePanel>
      <ListPanel title={t("listTitle")}>
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
      </ListPanel>
    </PageStack>
  );
}
