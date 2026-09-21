"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Surface } from "@/components/layout/Surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ROLE_OPTIONS } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";
import { KeyRound, Plus, UserRoundCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const tr = useTranslations("roles");
  const apiError = useApiError();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "EMPLOYEE" as UserRole });
  const [submitting, setSubmitting] = useState(false);

  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

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

  async function handleCreate() {
    if (!form.email.trim() || !form.name.trim() || form.password.length < 8) {
      toast.error(t("formInvalid"));
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim(),
          name: form.name.trim(),
          password: form.password,
          role: form.role,
        }),
      });
      toast.success(t("createSuccess"));
      setCreateOpen(false);
      setForm({ email: "", name: "", password: "", role: "EMPLOYEE" });
      await load();
    } catch (err) {
      toast.error(apiError(err, "common.createFailed"));
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
    if (!resetId || resetPassword.length < 8) {
      toast.error(t("resetInvalid"));
      return;
    }
    await patchUser(resetId, { password: resetPassword });
    setResetId(null);
    setResetPassword("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
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
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-name">{t("name")}</Label>
                <Input
                  id="u-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-password">{t("password")}</Label>
                <Input
                  id="u-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
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

      <Surface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colEmail")}</TableHead>
              <TableHead>{t("colRole")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colCreatedAt")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {tc("loading")}
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
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
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Surface>

      <Dialog open={resetId !== null} onOpenChange={(open) => !open && setResetId(null)}>
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
              onChange={(e) => setResetPassword(e.target.value)}
            />
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
