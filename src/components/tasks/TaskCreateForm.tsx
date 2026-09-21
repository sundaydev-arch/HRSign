"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import { FIELD_TYPE_LABEL_KEYS, TEMPLATE_CATEGORY_LABEL_KEYS } from "@/lib/labels";
import type { FieldType, TemplateCategory } from "@prisma/client";
import { Info, Plus, Trash2, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface TemplateFieldLite {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder: string | null;
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface SignerRow {
  key: string;
  signRole: "APPROVER" | "COMPANY_SEAL" | "PERSONAL_SIGNATURE";
  personType: "internal" | "external";
  userId: string;
  externalFullName: string;
  externalEmail: string;
}

const SIGNER_ROLE_OPTIONS = [
  { value: "APPROVER", labelKey: "roleApprover" },
  { value: "COMPANY_SEAL", labelKey: "roleCompanySeal" },
  { value: "PERSONAL_SIGNATURE", labelKey: "rolePersonal" },
] as const;

export function TaskCreateForm({
  template,
  operatorName,
}: {
  template: { id: string; name: string; category: TemplateCategory; fields: TemplateFieldLite[] };
  operatorName: string;
}) {
  const t = useTranslations("taskCreate");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const locale = useLocale();
  const apiError = useApiError();
  const router = useRouter();
  const [title, setTitle] = useState(
    `${template.name}-${new Date().toLocaleDateString(locale === "zh-CN" ? "zh-CN" : "en")}`,
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [flowType, setFlowType] = useState<"SEQUENTIAL" | "PARALLEL">("SEQUENTIAL");
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [signers, setSigners] = useState<SignerRow[]>([
    { key: "s1", signRole: "APPROVER", personType: "internal", userId: "", externalFullName: "", externalEmail: "" },
    { key: "s2", signRole: "COMPANY_SEAL", personType: "internal", userId: "", externalFullName: "", externalEmail: "" },
  ]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const valueFields = useMemo(
    () => template.fields.filter((f) => ["TEXT", "DATE"].includes(f.type)),
    [template.fields],
  );

  useEffect(() => {
    void api<{ users: UserOption[] }>("/api/users")
      .then((data) => setUsers(data.users))
      .catch((err) => toast.error(apiError(err, "taskCreate.usersLoadFailed")));
  }, [apiError]);

  function addSigner() {
    setSigners((prev) => [
      ...prev,
      {
        key: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        signRole: "PERSONAL_SIGNATURE",
        personType: "internal",
        userId: "",
        externalFullName: "",
        externalEmail: "",
      },
    ]);
  }

  function updateSigner(key: string, patch: Partial<SignerRow>) {
    setSigners((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{ taskId: string }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          templateId: template.id,
          title: title.trim(),
          flowType,
          expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString(),
          formValues: values,
          signers: signers.map((row) =>
            row.signRole !== "PERSONAL_SIGNATURE" || row.personType === "internal"
              ? { signRole: row.signRole, userId: row.userId || undefined }
              : {
                  signRole: row.signRole,
                  externalFullName: row.externalFullName,
                  externalEmail: row.externalEmail,
                },
          ),
        }),
      });
      toast.success(t("createdToast"));
      router.push(`/tasks/${res.taskId}`);
    } catch (err) {
      toast.error(apiError(err, "taskCreate.createFailed"));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle", {
          name: template.name,
          category: tl(TEMPLATE_CATEGORY_LABEL_KEYS[template.category]),
          operator: operatorName,
        })}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("basicInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">{t("taskTitle")}</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("flowType")}</Label>
              <RadioGroup value={flowType} onValueChange={(v) => setFlowType(v as "SEQUENTIAL" | "PARALLEL")}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="SEQUENTIAL" id="seq" />
                  <Label htmlFor="seq" className="font-normal">{t("sequential")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="PARALLEL" id="par" />
                  <Label htmlFor="par" className="font-normal">{t("parallel")}</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires">{t("expiresAt")}</Label>
              <Input
                id="expires"
                type="date"
                value={expiresAt}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("documentContent")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {valueFields.length === 0 && (
            <div className="text-sm text-muted-foreground">{t("noTextFields")}</div>
          )}
          {valueFields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={`f-${field.id}`}>
                {field.label}
                {field.required && <span className="ml-1 text-destructive">*</span>}
                <span className="ml-2 text-xs text-muted-foreground">{tl(FIELD_TYPE_LABEL_KEYS[field.type])}</span>
              </Label>
              <Input
                id={`f-${field.id}`}
                type={field.type === "DATE" ? "date" : "text"}
                placeholder={field.placeholder ?? ""}
                value={values[field.id] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("signersTitle")}</CardTitle>
          <Button variant="outline" size="sm" onClick={addSigner}>
            <Plus className="mr-1 h-4 w-4" />
            {t("add")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-accent p-3 text-xs text-accent-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {t("signerHint")}
          </div>
          {signers.map((row, index) => (
            <div key={row.key}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{t("position", { index: index + 1 })}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setSigners((prev) => prev.filter((x) => x.key !== row.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Select
                  value={row.signRole}
                  onValueChange={(v) => updateSigner(row.key, { signRole: v as SignerRow["signRole"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIGNER_ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {row.signRole === "PERSONAL_SIGNATURE" ? (
                  <div className="col-span-2 space-y-2">
                    <Select
                      value={row.personType}
                      onValueChange={(v) =>
                        updateSigner(row.key, { personType: v as "internal" | "external", userId: "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("personType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">{t("internal")}</SelectItem>
                        <SelectItem value="external">{t("external")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {row.personType === "internal" ? (
                      <Select value={row.userId} onValueChange={(v) => updateSigner(row.key, { userId: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectInternal")} />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {t("userOption", { name: user.fullName, email: user.email })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder={t("externalName")}
                          value={row.externalFullName}
                          onChange={(e) => updateSigner(row.key, { externalFullName: e.target.value })}
                        />
                        <Input
                          placeholder={t("externalEmail")}
                          type="email"
                          value={row.externalEmail}
                          onChange={(e) => updateSigner(row.key, { externalEmail: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="col-span-2">
                    <Select value={row.userId} onValueChange={(v) => updateSigner(row.key, { userId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectInternal")} />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {t("userOption", { name: user.fullName, email: user.email })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {index < signers.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          {tc("cancel")}
        </Button>
        <Button onClick={() => void handleSubmit()} disabled={submitting}>
          <UserPlus className="mr-1 h-4 w-4" />
          {submitting ? t("submitting") : t("submit")}
        </Button>
      </div>
    </div>
  );
}
