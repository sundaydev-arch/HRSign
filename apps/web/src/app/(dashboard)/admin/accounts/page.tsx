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
import { Building2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Account = {
  accountId: string;
  name: string;
  slug: string;
  memberCount?: number;
  envelopeCount?: number;
  brandCount?: number;
  members?: Array<{ memberId: string; email?: string; role: string }>;
  brands?: Array<{ brandId: string; brandName: string; primaryColor: string }>;
};

export default function AccountsPage() {
  const t = useTranslations("accounts");
  const apiError = useApiError();
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("sender");
  const [brandName, setBrandName] = useState("");
  const [providers, setProviders] = useState<
    Array<{ id: string; status: string; kind: string; configured?: boolean }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ accounts: Account[] }>(apiV1("/accounts"));
      setRows(data.accounts);
      if (!selected && data.accounts[0]) setSelected(data.accounts[0].accountId);
      const trust = await api<{
        providers: Array<{ id: string; status: string; kind: string; configured?: boolean }>;
      }>(apiV1("/trust/providers"));
      setProviders(trust.providers);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [apiError, selected]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  async function create() {
    if (!name.trim()) {
      toast.error(t("formRequired"));
      return;
    }
    setCreating(true);
    try {
      await api(apiV1("/accounts"), {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() || undefined }),
      });
      toast.success(t("createdToast"));
      setName("");
      setSlug("");
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCreating(false);
    }
  }

  async function addMember() {
    if (!selected || !memberEmail.trim()) return;
    try {
      await api(apiV1(`/accounts/${selected}/members`), {
        method: "POST",
        body: JSON.stringify({ email: memberEmail.trim(), role: memberRole }),
      });
      toast.success(t("memberToast"));
      setMemberEmail("");
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  async function addBrand() {
    if (!selected || !brandName.trim()) return;
    try {
      await api(apiV1(`/accounts/${selected}/brands`), {
        method: "POST",
        body: JSON.stringify({ brandName: brandName.trim() }),
      });
      toast.success(t("brandToast"));
      setBrandName("");
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  const current = rows.find((r) => r.accountId === selected);

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
            <Label>{t("slug")}</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto" />
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
              <TableHead>{t("colSlug")}</TableHead>
              <TableHead>{t("colMembers")}</TableHead>
              <TableHead>{t("colEnvelopes")}</TableHead>
              <TableHead>{t("colBrands")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={5} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="p-0">
                  <EmptyState icon={Building2} title={t("empty")} description={t("emptyHint")} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.accountId}
                  className={selected === row.accountId ? "bg-muted/40" : undefined}
                  onClick={() => setSelected(row.accountId)}
                >
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="font-mono text-xs">{row.slug}</TableCell>
                  <TableCell>{row.memberCount ?? 0}</TableCell>
                  <TableCell>{row.envelopeCount ?? 0}</TableCell>
                  <TableCell>{row.brandCount ?? 0}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Surface>

      {current ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Surface className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">{t("members")} — {current.name}</h2>
            <ul className="space-y-1 text-sm">
              {(current.members ?? []).map((m) => (
                <li key={m.memberId} className="flex justify-between gap-2">
                  <span>{m.email}</span>
                  <Badge variant="outline">{m.role}</Badge>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
              <Input
                type="email"
                placeholder={t("memberEmail")}
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
              />
              <Select value={memberRole} onValueChange={setMemberRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="sender">sender</SelectItem>
                  <SelectItem value="viewer">viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => void addMember()}>
                {t("addMember")}
              </Button>
            </div>
          </Surface>
          <Surface className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">{t("brands")}</h2>
            <ul className="space-y-1 text-sm">
              {(current.brands ?? []).map((b) => (
                <li key={b.brandId} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-sm border"
                    style={{ background: b.primaryColor }}
                  />
                  {b.brandName}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                placeholder={t("brandName")}
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
              <Button size="sm" onClick={() => void addBrand()}>
                {t("addBrand")}
              </Button>
            </div>
          </Surface>
        </div>
      ) : null}

      <Surface className="space-y-2 p-4">
        <h2 className="text-sm font-semibold">{t("trustProviders")}</h2>
        <ul className="space-y-1 text-sm">
          {providers.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{p.id}</span>
              <Badge variant="outline">{p.status}</Badge>
              <span className="text-xs text-muted-foreground">{p.kind}</span>
            </li>
          ))}
        </ul>
      </Surface>
    </div>
  );
}
