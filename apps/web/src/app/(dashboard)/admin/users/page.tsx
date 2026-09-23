"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTableShell } from "@/components/layout/DataTableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
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
import { useApiError } from "@/lib/use-api-error";
import { formatDateTime } from "@/lib/labels";
import { ROLE_OPTIONS } from "@/lib/roles";
import type { UserRole } from "@prisma/client";
import { KeyRound, Plus, UserRoundCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  hasPassword?: boolean;
}

export default function AdminUsersPage() {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const tr = useTranslations("roles");
  const apiError = useApiError();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "EMPLOYEE" as UserRole,
    invite: true,
  });
  const [createErrors, setCreateErrors] = useState<{
    email?: string;
    name?: string;
    password?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ users: UserRow[] }>("/api/admin/users");
      setUsers(data.users);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (!q) return true;
    return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  async function handleCreate() {
    const next: { email?: string; name?: string; password?: string } = {};
    if (!form.email.trim() || !z.string().email().safeParse(form.email.trim()).success) {
      next.email = t("emailRequired");
    }
    if (!form.name.trim()) next.name = t("nameRequired");
    if (!form.invite && form.password.length < 8) next.password = t("passwordRequired");
    setCreateErrors(next);
    if (next.email || next.name || next.password) return;
    setSubmitting(true);
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim(),
          fullName: form.name.trim(),
          password: form.invite ? undefined : form.password,
          role: form.role,
          invite: form.invite,
        }),
      });
      toast.success(form.invite ? t("inviteSuccess") : t("createSuccess"));
      setCreateOpen(false);
      setForm({ email: "", name: "", password: "", role: "EMPLOYEE", invite: true });
      setCreateErrors({});
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function patchUser(id: string, data: Record<string, unknown>) {
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      toast.success(tc("updated"));
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  async function handleResetPassword() {
    if (!resetId) return;
    if (resetPassword.length < 8) {
      setResetError(t("resetInvalid"));
      return;
    }
    setResetError("");
    await patchUser(resetId, { password: resetPassword });
    setResetId(null);
    setResetPassword("");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9">
              <Plus className="mr-1 h-4 w-4" />
              {t("createBtn")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("dialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="u-email">{t("email")}</Label>
                <Input
                  id="u-email"
                  type="email"
                  placeholder="user@company.com"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    if (createErrors.email) setCreateErrors((p) => ({ ...p, email: undefined }));
                  }}
                  aria-invalid={Boolean(createErrors.email)}
                />
                {createErrors.email ? (
                  <p className="text-sm text-destructive">{createErrors.email}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-name">{t("name")}</Label>
                <Input
                  id="u-name"
                  value={form.name}
                  placeholder={t("namePlaceholder")}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (createErrors.name) setCreateErrors((p) => ({ ...p, name: undefined }));
                  }}
                  aria-invalid={Boolean(createErrors.name)}
                />
                {createErrors.name ? (
                  <p className="text-sm text-destructive">{createErrors.name}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>{t("role")}</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {tr(option.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.invite}
                  onCheckedChange={(checked) => {
                    setForm({ ...form, invite: checked === true });
                    if (createErrors.password) setCreateErrors((p) => ({ ...p, password: undefined }));
                  }}
                />
                {t("inviteByEmail")}
              </label>
              {!form.invite ? (
                <div className="space-y-2">
                  <Label htmlFor="u-password">{t("password")}</Label>
                  <Input
                    id="u-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => {
                      setForm({ ...form, password: e.target.value });
                      if (createErrors.password) {
                        setCreateErrors((p) => ({ ...p, password: undefined }));
                      }
                    }}
                    aria-invalid={Boolean(createErrors.password)}
                  />
                  {createErrors.password ? (
                    <p className="text-sm text-destructive">{createErrors.password}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("inviteHint")}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={() => void handleCreate()} disabled={submitting}>
                {submitting ? tc("creating") : tc("create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <Surface className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border/80 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tc("search")}
            className="h-9 max-w-xs bg-card shadow-none"
          />
          <Select
            value={roleFilter === "all" ? undefined : roleFilter}
            onValueChange={(v) => setRoleFilter(v as UserRole)}
          >
            <SelectTrigger className="h-9 w-full bg-card shadow-none sm:w-44">
              <SelectValue placeholder={t("allRoles")} />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {tr(option.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {roleFilter !== "all" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-muted-foreground"
              onClick={() => setRoleFilter("all")}
            >
              {tc("clear")}
            </Button>
          ) : null}
        </div>
        <DataTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colEmail")}</TableHead>
              <TableHead>{t("colRole")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colCreatedAt")}</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={6} />
            ) : filteredUsers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={UserRoundCog}
                    title={t("empty")}
                    description={t("emptyHint")}
                    action={
                      <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="mr-1 h-4 w-4" />
                        {t("createBtn")}
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(v) => void patchUser(user.id, { role: v })}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <UserRoundCog className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {tr(option.value)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "outline"}>
                        {user.isActive ? tc("active") : tc("disabled")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(user.createdAt)}</TableCell>
                    <TableCell className="w-[1%] whitespace-nowrap text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setResetId(user.id);
                            setResetPassword("");
                          }}
                        >
                          <KeyRound className="mr-1 h-4 w-4" />
                          {t("resetPassword")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void patchUser(user.id, { isActive: !user.isActive })}
                        >
                          {user.isActive ? tc("disable") : tc("enable")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </DataTableShell>
      </Surface>

      <Dialog
        open={resetId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetId(null);
            setResetError("");
            setResetPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("resetTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-password">{t("newPassword")}</Label>
            <Input
              id="reset-password"
              type="password"
              value={resetPassword}
              onChange={(e) => {
                setResetPassword(e.target.value);
                if (resetError) setResetError("");
              }}
              aria-invalid={Boolean(resetError)}
            />
            {resetError ? <p className="text-sm text-destructive">{resetError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetId(null)}>
              {tc("cancel")}
            </Button>
            <Button onClick={() => void handleResetPassword()}>{t("confirmReset")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
