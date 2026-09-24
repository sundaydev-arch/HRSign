"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiClientError } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import type { FieldType } from "@prisma/client";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type TemplateLite = {
  id: string;
  name: string;
  latestVersion: { status: string } | null;
};

type TemplateField = {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
};

type UserOption = { id: string; fullName: string; email: string; role: string };

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function normalizeExpiresAt(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T23:59:59`).toISOString();
  }
  return s;
}

function defaultExpiresDate(): string {
  return new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function buildSampleCsv(opts: {
  fields: TemplateField[];
  needsSeal: boolean;
  sealUserId?: string;
}): string {
  const valueFields = opts.fields.filter((f) => f.type === "TEXT" || f.type === "DATE");
  const headers = [
    "title",
    "expiresAt",
    ...valueFields.map((f) => f.label),
    "signerEmail",
    "signerName",
    ...(opts.needsSeal ? ["sealUserId"] : []),
  ];
  const sampleValues = valueFields.map((f) => {
    if (f.type === "DATE") return defaultExpiresDate();
    if (/身份证|id.?card|passport/i.test(f.label)) return "110101199001011234";
    if (/姓名|name/i.test(f.label)) return "Wanqing Zhou";
    if (/岗位|position|title|job/i.test(f.label)) return "Product Manager";
    return "Yunqi HQ";
  });
  const row = [
    "Offer letter — Wanqing Zhou · Product Manager",
    defaultExpiresDate(),
    ...sampleValues,
    "wanqing.zhou@outlook.com",
    "Wanqing Zhou",
    ...(opts.needsSeal ? [opts.sealUserId ?? ""] : []),
  ];
  return `${headers.join(",")}\n${row.map(escapeCsv).join(",")}\n`;
}

export function BatchImportTasksButton({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("tasks.batch");
  const tc = useTranslations("common");
  const apiError = useApiError();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [csv, setCsv] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const needsSeal = useMemo(
    () => fields.some((f) => f.type === "SEAL"),
    [fields],
  );
  const needsSignature = useMemo(
    () => fields.some((f) => f.type === "SIGNATURE"),
    [fields],
  );
  const published = useMemo(
    () => templates.filter((tpl) => tpl.latestVersion?.status === "PUBLISHED"),
    [templates],
  );
  const sealUserId = useMemo(() => {
    const hr = users.find((u) => u.role === "HR" || u.role === "SUPER_ADMIN");
    return hr?.id ?? users[0]?.id ?? "";
  }, [users]);

  useEffect(() => {
    if (!open) return;
    setLoadingMeta(true);
    void Promise.all([
      api<{ templates: TemplateLite[] }>("/api/templates"),
      api<{ users: UserOption[] }>("/api/users"),
    ])
      .then(([tplRes, userRes]) => {
        setTemplates(tplRes.templates ?? []);
        setUsers(userRes.users ?? []);
      })
      .catch((err) => toast.error(apiError(err)))
      .finally(() => setLoadingMeta(false));
  }, [open, apiError]);

  useEffect(() => {
    if (!open || !templateId || loadingMeta) {
      if (!templateId) setFields([]);
      return;
    }
    let cancelled = false;
    void api<{
      template: {
        versions: Array<{ status: string; fields: TemplateField[] }>;
      };
    }>(`/api/templates/${templateId}`)
      .then((res) => {
        if (cancelled) return;
        const publishedVersion =
          res.template.versions.find((v) => v.status === "PUBLISHED") ??
          res.template.versions[0];
        const nextFields = publishedVersion?.fields ?? [];
        setFields(nextFields);
        const needs = nextFields.some((f) => f.type === "SEAL");
        setCsv(
          buildSampleCsv({
            fields: nextFields,
            needsSeal: needs,
            sealUserId,
          }),
        );
      })
      .catch((err) => {
        if (!cancelled) toast.error(apiError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [open, templateId, loadingMeta, sealUserId, apiError]);

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsv(text);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function submit() {
    if (!templateId) {
      toast.error(t("pickTemplate"));
      return;
    }
    setSubmitting(true);
    try {
      const rows = parseCsv(csv);
      if (rows.length === 0) {
        toast.error(t("empty"));
        return;
      }

      const valueFields = fields.filter((f) => f.type === "TEXT" || f.type === "DATE");
      const tasks = rows.map((r) => {
        const formValues: Record<string, string> = {};
        for (const f of valueFields) {
          const v = (r[f.label] ?? r[f.id] ?? r[`field_${f.id}`] ?? "").trim();
          if (v) formValues[f.id] = v;
        }

        const signers: Array<{
          signRole: "APPROVER" | "COMPANY_SEAL" | "PERSONAL_SIGNATURE";
          userId?: string;
          externalEmail?: string;
          externalFullName?: string;
        }> = [];

        if (needsSeal) {
          const sid = (r.sealUserId ?? "").trim();
          if (sid) {
            signers.push({ signRole: "COMPANY_SEAL", userId: sid });
          } else if ((r.sealEmail ?? "").trim()) {
            signers.push({
              signRole: "COMPANY_SEAL",
              externalEmail: r.sealEmail,
              externalFullName: r.sealName || r.sealEmail,
            });
          }
        }

        if (needsSignature || !needsSeal) {
          const email = (r.signerEmail ?? "").trim();
          const name = (r.signerName ?? "").trim();
          const uid = (r.signerUserId ?? "").trim();
          if (uid) {
            signers.push({ signRole: "PERSONAL_SIGNATURE", userId: uid });
          } else {
            signers.push({
              signRole: "PERSONAL_SIGNATURE",
              externalEmail: email,
              externalFullName: name,
            });
          }
        }

        return {
          templateId,
          title: (r.title ?? "").trim(),
          flowType: "SEQUENTIAL" as const,
          expiresAt: normalizeExpiresAt(r.expiresAt ?? ""),
          formValues,
          signers,
        };
      });

      const res = await api<{
        created: number;
        failed: number;
        results: Array<{ index: number; ok: boolean; error?: string }>;
      }>("/api/tasks/batch", {
        method: "POST",
        body: JSON.stringify({ tasks }),
      });

      if (res.failed > 0) {
        const firstErr = res.results.find((r) => !r.ok);
        const errMsg = firstErr?.error
          ? apiError(new ApiClientError(firstErr.error))
          : "";
        toast.error(
          t("partial", {
            created: res.created,
            failed: res.failed,
            error: errMsg,
          }),
        );
        if (res.created > 0) onDone?.();
        return;
      }

      toast.success(t("success", { count: res.created ?? tasks.length }));
      setOpen(false);
      onDone?.();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Upload className="mr-1.5 h-4 w-4" />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("template")}</Label>
            <Select
              value={templateId || undefined}
              onValueChange={setTemplateId}
              disabled={loadingMeta}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingMeta ? "…" : t("pickTemplate")} />
              </SelectTrigger>
              <SelectContent>
                {published.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">{t("hint")}</p>
          {needsSeal ? (
            <p className="text-xs text-muted-foreground">{t("sealHint")}</p>
          ) : null}

          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!templateId}
              onClick={() => fileRef.current?.click()}
            >
              {t("chooseFile")}
            </Button>
            {templateId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCsv(
                    buildSampleCsv({
                      fields,
                      needsSeal,
                      sealUserId,
                    }),
                  )
                }
              >
                {t("resetSample")}
              </Button>
            ) : null}
          </div>

          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            disabled={!templateId}
            placeholder={t("placeholder")}
            className="min-h-[200px] font-mono text-xs"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tc("cancel")}
          </Button>
          <Button disabled={submitting || !templateId} onClick={() => void submit()}>
            {submitting ? "…" : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
