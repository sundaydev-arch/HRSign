"use client";

import { FormSkeleton } from "@/components/layout/skeletons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { FIELD_TYPE_LABEL_KEYS, TEMPLATE_CATEGORY_LABEL_KEYS } from "@/lib/labels";
import { useApiError } from "@/lib/use-api-error";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldType, TemplateCategory } from "@prisma/client";
import { Info, Plus, Trash2, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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

const SIGNER_ROLE_OPTIONS = [
  { value: "APPROVER", labelKey: "roleApprover" },
  { value: "COMPANY_SEAL", labelKey: "roleCompanySeal" },
  { value: "PERSONAL_SIGNATURE", labelKey: "rolePersonal" },
] as const;

export function TaskCreateForm({
  template,
  operatorName,
  initialTitle,
  initialSigners,
}: {
  template: { id: string; name: string; category: TemplateCategory; fields: TemplateFieldLite[] };
  operatorName: string;
  initialTitle?: string;
  initialSigners?: Array<{
    signRole: "APPROVER" | "COMPANY_SEAL" | "PERSONAL_SIGNATURE";
    userId?: string;
    externalFullName?: string;
    externalEmail?: string;
  }>;
}) {
  const t = useTranslations("taskCreate");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const locale = useLocale();
  const apiError = useApiError();
  const router = useRouter();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const valueFields = useMemo(
    () => template.fields.filter((f) => ["TEXT", "DATE"].includes(f.type)),
    [template.fields],
  );

  const defaultExpires = useMemo(() => {
    const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }, []);

  const defaultSigners = useMemo(() => {
    if (initialSigners && initialSigners.length > 0) {
      return initialSigners.map((s) => ({
        signRole: s.signRole,
        personType: (s.externalEmail ? "external" : "internal") as "internal" | "external",
        userId: s.userId ?? "",
        externalFullName: s.externalFullName ?? "",
        externalEmail: s.externalEmail ?? "",
      }));
    }
    return [
      {
        signRole: "APPROVER" as const,
        personType: "internal" as const,
        userId: "",
        externalFullName: "",
        externalEmail: "",
      },
      {
        signRole: "COMPANY_SEAL" as const,
        personType: "internal" as const,
        userId: "",
        externalFullName: "",
        externalEmail: "",
      },
    ];
  }, [initialSigners]);

  const schema = useMemo(() => {
    const signerSchema = z
      .object({
        signRole: z.enum(["APPROVER", "COMPANY_SEAL", "PERSONAL_SIGNATURE"]),
        personType: z.enum(["internal", "external"]),
        userId: z.string(),
        externalFullName: z.string(),
        externalEmail: z.string(),
      })
      .superRefine((row, ctx) => {
        const needsInternal =
          row.signRole !== "PERSONAL_SIGNATURE" || row.personType === "internal";
        if (needsInternal) {
          if (!row.userId.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("signerPickRequired"),
              path: ["userId"],
            });
          }
          return;
        }
        if (!row.externalFullName.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("externalNameRequired"),
            path: ["externalFullName"],
          });
        }
        if (!row.externalEmail.trim() || !z.string().email().safeParse(row.externalEmail).success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("externalEmailRequired"),
            path: ["externalEmail"],
          });
        }
      });

    return z
      .object({
        title: z.string().trim().min(1, t("titleRequired")),
        flowType: z.enum(["SEQUENTIAL", "PARALLEL"]),
        expiresAt: z.string().min(1, t("expiresRequired")),
        values: z.record(z.string(), z.string()),
        signers: z.array(signerSchema).min(1, t("signerMinRequired")),
      })
      .superRefine((data, ctx) => {
        for (const field of valueFields) {
          if (!field.required) continue;
          const v = (data.values[field.id] ?? "").trim();
          if (!v) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("fieldRequired", { label: field.label }),
              path: ["values", field.id],
            });
          }
        }
      });
  }, [t, valueFields]);

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:
        initialTitle ??
        `${template.name}-${new Date().toLocaleDateString(locale === "zh-CN" ? "zh-CN" : "en")}`,
      flowType: "SEQUENTIAL",
      expiresAt: defaultExpires,
      values: Object.fromEntries(valueFields.map((f) => [f.id, ""])),
      signers: defaultSigners,
    },
  });

  const { fields: signerFields, append, remove } = useFieldArray({
    control: form.control,
    name: "signers",
  });

  useEffect(() => {
    setUsersLoading(true);
    void api<{ users: UserOption[] }>("/api/users")
      .then((data) => setUsers(data.users))
      .catch((err) => toast.error(apiError(err, "taskCreate.usersLoadFailed")))
      .finally(() => setUsersLoading(false));
  }, [apiError]);

  async function onSubmit(values: FormValues) {
    try {
      const res = await api<{ taskId: string }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          templateId: template.id,
          title: values.title.trim(),
          flowType: values.flowType,
          expiresAt: new Date(`${values.expiresAt}T23:59:59`).toISOString(),
          formValues: values.values,
          signers: values.signers.map((row) =>
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
    }
  }

  if (usersLoading) {
    return <FormSkeleton />;
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        className="w-full max-w-6xl space-y-5 sm:space-y-6"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
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
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("taskTitle")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("taskTitlePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="flowType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("flowType")}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="SEQUENTIAL" id="seq" />
                          <Label htmlFor="seq" className="font-normal">
                            {t("sequential")}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="PARALLEL" id="par" />
                          <Label htmlFor="par" className="font-normal">
                            {t("parallel")}
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("expiresAt")}</FormLabel>
                    <FormControl>
                      <DatePicker
                        id="expires"
                        value={field.value}
                        min={new Date().toISOString().slice(0, 10)}
                        placeholder={t("expiresAtPlaceholder")}
                        clearLabel={tc("clear")}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("documentContent")}</CardTitle>
          </CardHeader>
          <CardContent>
            {valueFields.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("noTextFields")}</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {valueFields.map((tplField) => {
                  const placeholder =
                    tplField.placeholder?.trim() ||
                    (tplField.type === "DATE"
                      ? t("dateFieldPlaceholder", { label: tplField.label })
                      : t("textFieldPlaceholder", { label: tplField.label }));
                  return (
                    <FormField
                      key={tplField.id}
                      control={form.control}
                      name={`values.${tplField.id}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {tplField.label}
                            {tplField.required ? (
                              <span className="ml-1 text-destructive">*</span>
                            ) : null}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {tl(FIELD_TYPE_LABEL_KEYS[tplField.type])}
                            </span>
                          </FormLabel>
                          <FormControl>
                            {tplField.type === "DATE" ? (
                              <DatePicker
                                id={`f-${tplField.id}`}
                                value={field.value ?? ""}
                                placeholder={placeholder}
                                clearLabel={tc("clear")}
                                onChange={field.onChange}
                              />
                            ) : (
                              <Input
                                id={`f-${tplField.id}`}
                                placeholder={placeholder}
                                {...field}
                                value={field.value ?? ""}
                              />
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("signersTitle")}</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  signRole: "PERSONAL_SIGNATURE",
                  personType: "internal",
                  userId: "",
                  externalFullName: "",
                  externalEmail: "",
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("add")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-accent p-3 text-xs text-accent-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {t("signerHint")}
            </div>
            {form.formState.errors.signers?.root?.message ||
            typeof form.formState.errors.signers?.message === "string" ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.signers?.root?.message ??
                  form.formState.errors.signers?.message}
              </p>
            ) : null}
            {signerFields.map((row, index) => {
              const signRole = form.watch(`signers.${index}.signRole`);
              const personType = form.watch(`signers.${index}.personType`);
              return (
                <div key={row.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{t("position", { index: index + 1 })}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(index)}
                      disabled={signerFields.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name={`signers.${index}.signRole`}
                      render={({ field }) => (
                        <FormItem>
                          <Select
                            value={field.value}
                            onValueChange={(v) => {
                              field.onChange(v);
                              if (v !== "PERSONAL_SIGNATURE") {
                                form.setValue(`signers.${index}.personType`, "internal");
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SIGNER_ROLE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {t(option.labelKey)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {signRole === "PERSONAL_SIGNATURE" ? (
                      <div className="col-span-2 space-y-2">
                        <FormField
                          control={form.control}
                          name={`signers.${index}.personType`}
                          render={({ field }) => (
                            <FormItem>
                              <Select
                                value={field.value}
                                onValueChange={(v) => {
                                  field.onChange(v);
                                  form.setValue(`signers.${index}.userId`, "");
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t("personType")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="internal">{t("internal")}</SelectItem>
                                  <SelectItem value="external">{t("external")}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {personType === "internal" ? (
                          <FormField
                            control={form.control}
                            name={`signers.${index}.userId`}
                            render={({ field }) => (
                              <FormItem>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder={t("selectInternal")} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {users.map((user) => (
                                      <SelectItem key={user.id} value={user.id}>
                                        {t("userOption", {
                                          name: user.fullName,
                                          email: user.email,
                                        })}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <FormField
                              control={form.control}
                              name={`signers.${index}.externalFullName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input placeholder={t("externalName")} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`signers.${index}.externalEmail`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="email"
                                      placeholder={t("externalEmail")}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="col-span-2">
                        <FormField
                          control={form.control}
                          name={`signers.${index}.userId`}
                          render={({ field }) => (
                            <FormItem>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t("selectInternal")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {users.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {t("userOption", {
                                        name: user.fullName,
                                        email: user.email,
                                      })}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                  {index < signerFields.length - 1 ? <Separator className="mt-4" /> : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-1 flex justify-end gap-3 border-t bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={submitting}>
            <UserPlus className="mr-1 h-4 w-4" />
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
