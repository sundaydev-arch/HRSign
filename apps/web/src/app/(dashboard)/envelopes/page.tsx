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
import { FileStack, Plus, Send, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type EnvelopeRow = {
  id: string;
  status: string;
  subject: string;
  documents: unknown[];
  recipients: unknown[];
  updatedAt: string;
};

type DocDraft = { name: string };
type RecDraft = {
  name: string;
  email: string;
  phoneE164: string;
  recipientType: "signer" | "cc" | "inPersonSigner" | "witness";
  deliveryChannel: "email" | "sms" | "both";
  idvMethod: "none" | "email_otp" | "sms_otp";
  routingOrder: number;
};

export default function EnvelopesPage() {
  const t = useTranslations("envelopes");
  const tc = useTranslations("common");
  const apiError = useApiError();
  const [rows, setRows] = useState<EnvelopeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [emailBlurb, setEmailBlurb] = useState("");
  const [docs, setDocs] = useState<DocDraft[]>([{ name: "Document 1.pdf" }]);
  const [recipients, setRecipients] = useState<RecDraft[]>([
    {
      name: "",
      email: "",
      phoneE164: "",
      recipientType: "signer",
      deliveryChannel: "email",
      idvMethod: "none",
      routingOrder: 1,
    },
  ]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ envelopes: EnvelopeRow[] }>(apiV1("/envelopes"));
      setRows(data.envelopes);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAndSend() {
    if (!subject.trim() || recipients.every((r) => !r.email.trim())) {
      toast.error(t("formRequired"));
      return;
    }
    setCreating(true);
    try {
      const env = await api<{ id: string }>(apiV1("/envelopes"), {
        method: "POST",
        body: JSON.stringify({
          subject: subject.trim(),
          emailBlurb: emailBlurb.trim() || undefined,
          documents: docs
            .filter((d) => d.name.trim())
            .map((d, i) => ({ name: d.name.trim(), documentOrder: i + 1, blank: true })),
          recipients: recipients
            .filter((r) => r.email.trim())
            .map((r, i) => ({
              recipientType: r.recipientType,
              routingOrder: r.routingOrder || i + 1,
              name: r.name.trim() || r.email.trim(),
              email: r.email.trim(),
              phoneE164: r.phoneE164.trim() || undefined,
              deliveryChannel: r.deliveryChannel,
              idvMethod: r.idvMethod,
            })),
        }),
      });
      await api(apiV1(`/envelopes/${env.id}/send`), { method: "POST" });
      toast.success(t("sentToast"));
      setSubject("");
      setEmailBlurb("");
      setDocs([{ name: "Document 1.pdf" }]);
      setRecipients([
        {
          name: "",
          email: "",
          phoneE164: "",
          recipientType: "signer",
          deliveryChannel: "email",
          idvMethod: "none",
          routingOrder: 1,
        },
      ]);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Surface className="space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-semibold">{t("quickCreate")}</h2>
        <div className="space-y-1.5">
          <Label>{t("subject")}</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("subjectPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("emailBlurb")}</Label>
          <Input
            value={emailBlurb}
            onChange={(e) => setEmailBlurb(e.target.value)}
            placeholder={t("emailBlurbPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("documents")}</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setDocs((d) => [...d, { name: `Document ${d.length + 1}.pdf` }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("addDoc")}
            </Button>
          </div>
          {docs.map((d, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={d.name}
                onChange={(e) =>
                  setDocs((prev) => prev.map((x, j) => (j === i ? { name: e.target.value } : x)))
                }
              />
              {docs.length > 1 ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setDocs((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("recipients")}</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setRecipients((r) => [
                  ...r,
                  {
                    name: "",
                    email: "",
                    phoneE164: "",
                    recipientType: "signer",
                    deliveryChannel: "email",
                    idvMethod: "none",
                    routingOrder: r.length + 1,
                  },
                ])
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("addRecipient")}
            </Button>
          </div>
          {recipients.map((r, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border/60 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto]">
                <Input
                  placeholder={t("signerName")}
                  value={r.name}
                  onChange={(e) =>
                    setRecipients((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  type="email"
                  placeholder={t("signerEmail")}
                  value={r.email}
                  onChange={(e) =>
                    setRecipients((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)),
                    )
                  }
                />
                {recipients.length > 1 ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setRecipients((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <span />
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <Input
                  placeholder={t("phone")}
                  value={r.phoneE164}
                  onChange={(e) =>
                    setRecipients((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, phoneE164: e.target.value } : x)),
                    )
                  }
                />
                <Select
                  value={r.recipientType}
                  onValueChange={(v) =>
                    setRecipients((prev) =>
                      prev.map((x, j) =>
                        j === i
                          ? { ...x, recipientType: v as RecDraft["recipientType"] }
                          : x,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="signer">{t("typeSigner")}</SelectItem>
                    <SelectItem value="cc">{t("typeCc")}</SelectItem>
                    <SelectItem value="inPersonSigner">{t("typeInPerson")}</SelectItem>
                    <SelectItem value="witness">{t("typeWitness")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={r.deliveryChannel}
                  onValueChange={(v) =>
                    setRecipients((prev) =>
                      prev.map((x, j) =>
                        j === i
                          ? { ...x, deliveryChannel: v as RecDraft["deliveryChannel"] }
                          : x,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("delivery")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">{t("deliveryEmail")}</SelectItem>
                    <SelectItem value="sms">{t("deliverySms")}</SelectItem>
                    <SelectItem value="both">{t("deliveryBoth")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={r.idvMethod}
                  onValueChange={(v) =>
                    setRecipients((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, idvMethod: v as RecDraft["idvMethod"] } : x,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("idv")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("idvNone")}</SelectItem>
                    <SelectItem value="email_otp">{t("idvEmailOtp")}</SelectItem>
                    <SelectItem value="sms_otp">{t("idvSmsOtp")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <Button loading={creating} onClick={() => void createAndSend()}>
          <Send className="mr-1 h-4 w-4" />
          {t("createSend")}
        </Button>
      </Surface>

      <Surface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colSubject")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colDocs")}</TableHead>
              <TableHead>{t("colRecipients")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={5} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    icon={FileStack}
                    title={t("empty")}
                    description={t("emptyHint")}
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.subject}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                  <TableCell>{row.documents?.length ?? 0}</TableCell>
                  <TableCell>{row.recipients?.length ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/envelopes/${row.id}`}>{tc("view")}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Surface>
    </div>
  );
}
