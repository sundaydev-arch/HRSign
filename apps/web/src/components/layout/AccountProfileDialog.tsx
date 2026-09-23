"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function AccountProfileDialog({
  open,
  onOpenChange,
  initialName,
  initialEmail,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  initialEmail: string;
  onSaved?: (fullName: string) => void;
}) {
  const t = useTranslations("account.profile");
  const tc = useTranslations("common");
  const apiError = useApiError();
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(initialName);
    setEmail(initialEmail);
    setLoading(true);
    void api<{ user: { fullName: string; email: string; phoneE164: string | null } }>("/api/me")
      .then((res) => {
        setFullName(res.user.fullName);
        setEmail(res.user.email);
        setPhone(res.user.phoneE164 ?? "");
      })
      .catch((err) => toast.error(apiError(err, "common.loadFailed")))
      .finally(() => setLoading(false));
  }, [open, initialName, initialEmail, apiError]);

  async function save() {
    if (!fullName.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ user: { fullName: string } }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: fullName.trim(),
          phoneE164: phone.trim() || null,
        }),
      });
      toast.success(t("saved"));
      onSaved?.(res.user.fullName);
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">{t("fullName")}</Label>
            <Input
              id="profile-name"
              value={fullName}
              disabled={loading || saving}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">{t("email")}</Label>
            <Input id="profile-email" value={email} readOnly disabled className="bg-muted/40" />
            <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">{t("phone")}</Label>
            <Input
              id="profile-phone"
              value={phone}
              disabled={loading || saving}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phonePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("phoneHint")}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tc("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={loading || saving || !fullName.trim()}>
            {saving ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
