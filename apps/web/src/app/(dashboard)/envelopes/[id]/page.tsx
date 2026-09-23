"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DetailSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { apiV1 } from "@/lib/api-base";
import { useApiError } from "@/lib/use-api-error";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type EnvelopeDetail = {
  id: string;
  status: string;
  subject: string;
  emailBlurb: string | null;
  documents: Array<{ id: string; name: string; documentOrder: number }>;
  recipients: Array<{
    id: string;
    name: string;
    email: string;
    recipientType: string;
    status: string;
    accessUrl: string | null;
  }>;
  tabs: Array<{
    id: string;
    tabType: string;
    recipientId: string | null;
    required: boolean;
    value: string | null;
  }>;
};

export default function EnvelopeDetailPage() {
  const t = useTranslations("envelopes");
  const tc = useTranslations("common");
  const apiError = useApiError();
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<EnvelopeDetail | null>(null);
  const [coc, setCoc] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<EnvelopeDetail>(apiV1(`/envelopes/${params.id}`)));
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    }
  }, [apiError, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    setBusy(true);
    try {
      setData(await api(apiV1(`/envelopes/${params.id}/send`), { method: "POST" }));
      toast.success(t("sentToast"));
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function signFirst() {
    const signer = data?.recipients.find((r) => r.recipientType === "signer");
    if (!signer) return;
    setBusy(true);
    try {
      setData(
        await api(apiV1(`/envelopes/${params.id}/recipients/${signer.id}/sign`), {
          method: "POST",
          body: JSON.stringify({}),
        }),
      );
      toast.success(t("signedToast"));
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadCoc() {
    try {
      setCoc(await api(apiV1(`/envelopes/${params.id}/certificate`)));
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  if (!data) return <DetailSkeleton />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.subject}
        description={`${t("status")}: ${data.status}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {data.status === "created" ? (
              <Button loading={busy} onClick={() => void send()}>
                {t("send")}
              </Button>
            ) : null}
            {data.status === "sent" || data.status === "delivered" ? (
              <Button loading={busy} variant="secondary" onClick={() => void signFirst()}>
                {t("demoSign")}
              </Button>
            ) : null}
            {data.status === "completed" ? (
              <>
                <Button variant="outline" onClick={() => void loadCoc()}>
                  {t("certificate")}
                </Button>
                <Button asChild variant="outline">
                  <a href={apiV1(`/envelopes/${params.id}/evidence?download=1`)}>
                    {t("evidencePack")}
                  </a>
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface className="space-y-2 p-4">
          <h2 className="text-sm font-semibold">{t("documents")}</h2>
          <ul className="space-y-1 text-sm">
            {data.documents.map((d) => (
              <li key={d.id} className="flex justify-between gap-2">
                <span>{d.name}</span>
                <Badge variant="outline">#{d.documentOrder}</Badge>
              </li>
            ))}
          </ul>
        </Surface>
        <Surface className="space-y-2 p-4">
          <h2 className="text-sm font-semibold">{t("recipients")}</h2>
          <ul className="space-y-2 text-sm">
            {data.recipients.map((r) => (
              <li key={r.id} className="rounded-md border border-border/70 px-3 py-2">
                <div className="font-medium">
                  {r.name}{" "}
                  <Badge variant="outline" className="ml-1">
                    {r.recipientType}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">{r.email}</div>
                <div className="mt-1 text-xs">{r.status}</div>
                {r.accessUrl ? (
                  <a className="mt-1 block text-xs text-primary underline" href={r.accessUrl}>
                    {t("openLink")}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Surface>
      </div>

      <Surface className="space-y-2 p-4">
        <h2 className="text-sm font-semibold">{t("tabs")}</h2>
        {(data.tabs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(data.tabs ?? []).map((tab) => {
              const recipient = data.recipients.find((r) => r.id === tab.recipientId);
              return (
                <li
                  key={tab.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
                >
                  <span className="font-medium">{tab.tabType}</span>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {recipient ? <span>{recipient.name}</span> : null}
                    {tab.required ? <Badge variant="outline">required</Badge> : null}
                    {tab.value ? <span className="font-mono">{tab.value}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>

      {coc ? (
        <Surface className="p-4">
          <h2 className="mb-2 text-sm font-semibold">{t("certificate")}</h2>
          <pre className="overflow-auto rounded-md bg-muted/40 p-3 text-xs">{JSON.stringify(coc, null, 2)}</pre>
        </Surface>
      ) : null}

      <Button asChild variant="outline" size="sm">
        <Link href="/envelopes">{tc("back")}</Link>
      </Button>
    </div>
  );
}
