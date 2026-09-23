"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client";
import { TEMPLATE_CATEGORY_LABEL_KEYS } from "@/lib/labels";
import { useApiError } from "@/lib/use-api-error";
import type { TemplateCategory } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface RetentionPolicyRow {
  id: string;
  name: string;
  category: string;
  retentionYears: number;
  action: string;
  enabled: boolean;
}

type SignatureMethod = "IMAGE_SEAL" | "PADES" | "GM_SM2";
type NotifyChannel = "EMAIL" | "WECOM" | "DINGTALK" | "LARK" | "SLACK" | "TEAMS";

interface SettingsPayload {
  watermarkText: string;
  signatureMethod: SignatureMethod;
  remindDaysBefore: number;
  notifyChannels: NotifyChannel[];
  hasPadesCert: boolean;
  hasSm2Key: boolean;
  appUrl: string;
  smtpConfigured: boolean;
  oidcConfigured: boolean;
  wecomConfigured: boolean;
  dingtalkConfigured: boolean;
  larkConfigured: boolean;
  slackConfigured: boolean;
  teamsConfigured: boolean;
  padesEnvConfigured: boolean;
  retentionPolicies: RetentionPolicyRow[];
}

export default function AdminSettingsPage() {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const apiError = useApiError();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [watermarkText, setWatermarkText] = useState("");
  const [signatureMethod, setSignatureMethod] = useState<SignatureMethod>("IMAGE_SEAL");
  const [remindDaysBefore, setRemindDaysBefore] = useState(3);
  const [notifyChannels, setNotifyChannels] = useState<NotifyChannel[]>(["EMAIL"]);
  const [padesCertPem, setPadesCertPem] = useState("");
  const [padesKeyPem, setPadesKeyPem] = useState("");
  const [policies, setPolicies] = useState<RetentionPolicyRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<SettingsPayload>("/api/admin/settings");
      setData(res);
      setWatermarkText(res.watermarkText);
      setSignatureMethod(res.signatureMethod);
      setRemindDaysBefore(res.remindDaysBefore);
      setNotifyChannels(res.notifyChannels);
      setPolicies(res.retentionPolicies);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    }
  }, [apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        watermarkText: watermarkText.trim(),
        signatureMethod,
        remindDaysBefore,
        notifyChannels,
        retentionPolicies: policies.map((p) => ({
          id: p.id,
          retentionYears: p.retentionYears,
          enabled: p.enabled,
        })),
      };
      if (padesCertPem.trim()) body.padesCertPem = padesCertPem.trim();
      if (padesKeyPem.trim()) body.padesKeyPem = padesKeyPem.trim();

      const res = await api<SettingsPayload>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setData(res);
      setWatermarkText(res.watermarkText);
      setSignatureMethod(res.signatureMethod);
      setRemindDaysBefore(res.remindDaysBefore);
      setNotifyChannels(res.notifyChannels);
      setPolicies(res.retentionPolicies);
      setPadesCertPem("");
      setPadesKeyPem("");
      toast.success(t("saveSuccess"));
    } catch (err) {
      toast.error(apiError(err, "common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function toggleChannel(ch: NotifyChannel) {
    setNotifyChannels((prev) => {
      if (prev.includes(ch)) {
        const next = prev.filter((c) => c !== ch);
        return next.length === 0 ? ["EMAIL"] : next;
      }
      return [...prev, ch];
    });
  }

  function updatePolicy(
    id: string,
    patch: Partial<Pick<RetentionPolicyRow, "retentionYears" | "enabled">>,
  ) {
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  if (!data) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-4 pb-20">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Surface className="space-y-4 p-4 sm:p-5">
        <SectionTitle title={t("sectionWatermark")} hint={t("sectionWatermarkHint")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="wm">{t("watermark")}</Label>
            <Input
              id="wm"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              className="h-9 max-w-lg"
            />
          </div>
          <EnvRow label={t("appUrl")} value={data.appUrl} />
          <EnvRow
            label={t("smtp")}
            value={data.smtpConfigured ? t("smtpConfigured") : t("smtpMissing")}
            ok={data.smtpConfigured}
          />
          <EnvRow
            label={t("oidc")}
            value={data.oidcConfigured ? t("oidcOn") : t("oidcOff")}
            ok={data.oidcConfigured}
          />
        </div>
      </Surface>

      <Surface className="space-y-4 p-4 sm:p-5">
        <SectionTitle title={t("sectionSignature")} hint={t("sectionSignatureHint")} />
        <div className="max-w-sm space-y-1.5">
          <Label>{t("signatureMethod")}</Label>
          <Select
            value={signatureMethod}
            onValueChange={(v) => setSignatureMethod(v as SignatureMethod)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IMAGE_SEAL">{t("methodImageSeal")}</SelectItem>
              <SelectItem value="PADES">{t("methodPades")}</SelectItem>
              <SelectItem value="GM_SM2">{t("methodGmSm2")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(signatureMethod === "PADES" || signatureMethod === "GM_SM2") && (
          <p className="rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
            {signatureMethod === "PADES" ? t("disclaimerPades") : t("disclaimerGmSm2")}
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant={data.hasPadesCert || data.padesEnvConfigured ? "success" : "outline"}>
            {t("padesCertStatus", {
              status: data.hasPadesCert || data.padesEnvConfigured ? "ok" : "missing",
            })}
          </Badge>
          <Badge variant={data.hasSm2Key ? "success" : "outline"}>
            {t("sm2Status", { status: data.hasSm2Key ? "ok" : "missing" })}
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("padesCertPem")}</Label>
            <Textarea
              value={padesCertPem}
              onChange={(e) => setPadesCertPem(e.target.value)}
              placeholder={t("pemPlaceholder")}
              className="min-h-[88px] font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("padesKeyPem")}</Label>
            <Textarea
              value={padesKeyPem}
              onChange={(e) => setPadesKeyPem(e.target.value)}
              placeholder={t("pemPlaceholder")}
              className="min-h-[88px] font-mono text-xs"
            />
          </div>
        </div>
      </Surface>

      <Surface className="space-y-4 p-4 sm:p-5">
        <SectionTitle title={t("sectionNotify")} hint={t("sectionNotifyHint")} />
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("channelGroupCn")}
            </p>
            <div className="flex flex-wrap gap-4">
              {(["EMAIL", "WECOM", "DINGTALK", "LARK"] as const).map((ch) => (
                <label key={ch} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={notifyChannels.includes(ch)}
                    onCheckedChange={() => toggleChannel(ch)}
                  />
                  {t(`channel.${ch}`)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("channelGroupIntl")}
            </p>
            <div className="flex flex-wrap gap-4">
              {(["SLACK", "TEAMS"] as const).map((ch) => (
                <label key={ch} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={notifyChannels.includes(ch)}
                    onCheckedChange={() => toggleChannel(ch)}
                  />
                  {t(`channel.${ch}`)}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={data.wecomConfigured ? "success" : "outline"}>{t("envWecom")}</Badge>
          <Badge variant={data.dingtalkConfigured ? "success" : "outline"}>{t("envDingtalk")}</Badge>
          <Badge variant={data.larkConfigured ? "success" : "outline"}>{t("envLark")}</Badge>
          <Badge variant={data.slackConfigured ? "success" : "outline"}>{t("envSlack")}</Badge>
          <Badge variant={data.teamsConfigured ? "success" : "outline"}>{t("envTeams")}</Badge>
        </div>
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="remind">{t("remindDays")}</Label>
          <Input
            id="remind"
            type="number"
            min={0}
            max={30}
            value={remindDaysBefore}
            onChange={(e) => setRemindDaysBefore(Number(e.target.value) || 0)}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">{t("remindDaysHint")}</p>
        </div>
      </Surface>

      <Surface className="space-y-4 p-4 sm:p-5">
        <SectionTitle title={t("sectionRetention")} hint={t("retentionNote")} />
        <div className="space-y-3">
          {policies.map((p) => {
            const categoryKey = TEMPLATE_CATEGORY_LABEL_KEYS[p.category as TemplateCategory];
            const categoryLabel = categoryKey ? tl(categoryKey) : p.category;
            return (
              <div
                key={p.id}
                className="flex flex-col gap-2 rounded-md border border-border/80 bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {t("policyName", { category: categoryLabel })}
                  </p>
                  <p className="text-xs text-muted-foreground">{categoryLabel}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={p.retentionYears}
                    onChange={(e) =>
                      updatePolicy(p.id, { retentionYears: Number(e.target.value) || 1 })
                    }
                    className="h-8 w-20"
                    aria-label={t("retentionYears")}
                  />
                  <span className="text-xs text-muted-foreground">{t("yearsUnit")}</span>
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={p.enabled}
                      onCheckedChange={(v) => updatePolicy(p.id, { enabled: Boolean(v) })}
                    />
                    {tc("enabled")}
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </Surface>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
        <div className="mx-auto flex max-w-5xl justify-end">
          <Button
            onClick={() => void save()}
            disabled={!watermarkText.trim()}
            loading={saving}
          >
            {saving ? tc("saving") : tc("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function EnvRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate text-sm ${ok === false ? "text-muted-foreground" : ""}`}>
        {value}
      </p>
    </div>
  );
}
