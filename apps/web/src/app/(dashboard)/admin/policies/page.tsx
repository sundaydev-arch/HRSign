"use client";

import { DataTableShell } from "@/components/layout/DataTableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Surface } from "@/components/layout/Surface";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { TEMPLATE_CATEGORY_LABEL_KEYS } from "@/lib/labels";
import { useApiError } from "@/lib/use-api-error";
import type { TemplateCategory } from "@prisma/client";
import { Plus, Trash2, ListChecks } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const CATEGORIES = Object.keys(TEMPLATE_CATEGORY_LABEL_KEYS) as TemplateCategory[];

type Policy = {
  id: string;
  name: string;
  category: TemplateCategory | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  approverUserIds: string[];
  required: boolean;
  enabled: boolean;
};

type UserOption = { id: string; fullName: string; email: string; role: string };
type DeptOption = { id: string; name: string };

export default function AdminPoliciesPage() {
  const t = useTranslations("admin.policies");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const locale = useLocale();
  const apiError = useApiError();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [departmentId, setDepartmentId] = useState<string | "all">("all");
  const [approverIds, setApproverIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pol, usr, dept] = await Promise.all([
        api<{ policies: Policy[] }>("/api/admin/policies"),
        api<{ users: UserOption[] }>("/api/users"),
        api<{ departments: DeptOption[] }>("/api/admin/departments"),
      ]);
      setPolicies(pol.policies);
      setUsers(usr.users);
      setDepartments(dept.departments);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setName("");
    setCategory("all");
    setDepartmentId("all");
    setApproverIds([]);
  }

  function toggleApprover(id: string) {
    setApproverIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function create() {
    if (!name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    if (approverIds.length === 0) {
      toast.error(t("approversRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/admin/policies", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          category: category === "all" ? null : category,
          departmentId: departmentId === "all" ? null : departmentId,
          approverUserIds: approverIds,
        }),
      });
      resetForm();
      setOpen(false);
      toast.success(t("created"));
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/admin/policies/${id}`, { method: "DELETE" });
      toast.success(t("deleted"));
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  function categoryLabel(cat: TemplateCategory | null) {
    if (!cat) return t("anyCategory");
    return tl(TEMPLATE_CATEGORY_LABEL_KEYS[cat]);
  }

  function approverNames(ids: string[]) {
    if (ids.length === 0) return "—";
    const map = new Map(users.map((u) => [u.id, u.fullName]));
    return ids
      .map((id) => map.get(id) ?? id.slice(0, 8))
      .join(locale.startsWith("zh") ? "、" : ", ");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="h-9">
                <Plus className="mr-1 h-4 w-4" />
                {t("create")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("create")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="policy-name">{t("colName")}</Label>
                  <Input
                    id="policy-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void create();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("colCategory")}</Label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v as TemplateCategory | "all")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("anyCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("anyCategory")}</SelectItem>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {tl(TEMPLATE_CATEGORY_LABEL_KEYS[c])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("colDept")}</Label>
                  <Select
                    value={departmentId}
                    onValueChange={setDepartmentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("anyDept")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("anyDept")}</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("colApprovers")}</Label>
                  <p className="text-xs text-muted-foreground">{t("approversHint")}</p>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border/80 p-2">
                    {users.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-muted-foreground">{t("noUsers")}</p>
                    ) : (
                      users.map((u) => (
                        <label
                          key={u.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={approverIds.includes(u.id)}
                            onCheckedChange={() => toggleApprover(u.id)}
                          />
                          <span className="min-w-0 truncate">
                            {u.fullName}
                            <span className="ml-1 text-xs text-muted-foreground">{u.email}</span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {tc("cancel")}
                </Button>
                <Button loading={submitting} onClick={() => void create()}>
                  {submitting ? tc("creating") : t("create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Surface className="overflow-hidden">
        <DataTableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead>{t("colCategory")}</TableHead>
                <TableHead>{t("colDept")}</TableHead>
                <TableHead>{t("colApprovers")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRowsSkeleton columns={6} rows={4} />
              ) : policies.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={ListChecks}
                      title={t("empty")}
                      description={t("emptyHint")}
                      action={
                        <Button size="sm" onClick={() => setOpen(true)}>
                          <Plus className="mr-1 h-4 w-4" />
                          {t("create")}
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                policies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {categoryLabel(p.category)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.department?.name ?? t("anyDept")}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm">
                      {approverNames(p.approverUserIds)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.enabled ? "success" : "outline"}>
                        {p.enabled ? t("enabled") : t("disabled")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => void remove(p.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DataTableShell>
      </Surface>
    </div>
  );
}
