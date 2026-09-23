"use client";

import { PublicPageShell } from "@/components/layout/PublicPageShell";
import { Surface } from "@/components/layout/Surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/lib/client";
import { Check, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

type ViewPayload = {
  envelope: {
    id: string;
    subject: string;
    status: string;
    emailBlurb: string | null;
    documents: Array<{ id: string; name: string; documentOrder: number }>;
  };
  recipient: {
    id: string;
    name: string;
    email: string;
    status: string;
    recipientType: string;
    phoneE164: string | null;
    idvMethod: string;
    idvStatus: string;
  } | null;
  tabs: Array<{
    id: string;
    tabType: string;
    required: boolean;
    value: string | null;
  }>;
  idvRequired: boolean;
};

function HostedSignInner() {
  const t = useTranslations("hostedSign");
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const envelopeId = params.id;
  const recipientId = search.get("r") ?? "";
  const token = search.get("t") ?? search.get("embed") ?? "";
  const [data, setData] = useState<ViewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tabValues, setTabValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [idvVerified, setIdvVerified] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [targetHint, setTargetHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/sign/envelope/${envelopeId}?r=${encodeURIComponent(recipientId)}&t=${encodeURIComponent(token)}`,
      );
      const json = await res.json();
      if (!res.ok) {
        throw new ApiClientError(json?.error?.code ?? `HTTP_${res.status}`);
      }
      const payload = json as ViewPayload;
      setData(payload);
      setIdvVerified(!payload.idvRequired);
      const initial: Record<string, string> = {};
      for (const tab of payload.tabs) {
        if (tab.value) initial[tab.id] = tab.value;
      }
      setTabValues(initial);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.code : "LOAD_FAILED");
    }
  }, [envelopeId, recipientId, token]);

  useEffect(() => {
    if (recipientId && token) void load();
    else setError("SIGN_LINK_INVALID");
  }, [load, recipientId, token]);

  const textTabs = useMemo(
    () =>
      (data?.tabs ?? []).filter((tab) =>
        ["text", "fullName", "emailAddress", "company", "title", "note"].includes(tab.tabType),
      ),
    [data],
  );
  const signTabs = useMemo(
    () => (data?.tabs ?? []).filter((tab) => ["signHere", "initialHere"].includes(tab.tabType)),
    [data],
  );

  async function startIdv() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/envelope/${envelopeId}/idv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          recipientId,
          token,
          method: data?.recipient?.idvMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new ApiClientError(json?.error?.code ?? `HTTP_${res.status}`);
      if (json.status === "skipped") {
        setIdvVerified(true);
        return;
      }
      setVerificationId(json.verificationId);
      setTargetHint(json.targetHint ?? null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.code : "IDV_START_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function verifyIdv() {
    if (!verificationId || !otpCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/envelope/${envelopeId}/idv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          recipientId,
          token,
          method: data?.recipient?.idvMethod,
          verificationId,
          code: otpCode.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new ApiClientError(json?.error?.code ?? `HTTP_${res.status}`);
      if (json.status !== "verified") {
        setError(`IDV_${String(json.status).toUpperCase()}`);
        return;
      }
      setIdvVerified(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.code : "IDV_VERIFY_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function submit(decline = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/envelope/${envelopeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId,
          token,
          tabValues,
          decline,
          declineReason: decline ? declineReason : undefined,
          signatureImageBase64: decline ? undefined : "data:image/png;base64,signed",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new ApiClientError(json?.error?.code ?? `HTTP_${res.status}`);
      setDone(true);
      setDeclineOpen(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.code : "SIGN_FAILED");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <PublicPageShell>
        <p className="py-12 text-center text-sm text-destructive">
          {error === "SIGN_LINK_INVALID" ? t("invalidLink") : error}
        </p>
      </PublicPageShell>
    );
  }

  if (!data) {
    return (
      <PublicPageShell>
        <p className="py-12 text-center text-sm text-muted-foreground">{t("loading")}</p>
      </PublicPageShell>
    );
  }

  if (done || data.recipient?.status === "signed" || data.recipient?.status === "completed") {
    return (
      <PublicPageShell>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold">{t("thankYou")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("recorded", { subject: data.envelope.subject })}
          </p>
        </div>
      </PublicPageShell>
    );
  }

  if (!idvVerified) {
    return (
      <PublicPageShell>
        <Surface className="space-y-3 p-4">
          <h1 className="text-base font-semibold">{t("verifyTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("verifyMethod", { method: data.recipient?.idvMethod ?? "—" })}
            {targetHint ? ` → ${targetHint}` : ""}
          </p>
          {!verificationId ? (
            <Button loading={busy} onClick={() => void startIdv()}>
              {t("sendCode")}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="hosted-otp">{t("codeLabel")}</Label>
                <Input
                  id="hosted-otp"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder={t("codePlaceholder")}
                  autoComplete="one-time-code"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" loading={busy} onClick={() => void startIdv()}>
                  {t("resend")}
                </Button>
                <Button className="flex-1" loading={busy} onClick={() => void verifyIdv()}>
                  {t("continue")}
                </Button>
              </div>
            </div>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </Surface>
      </PublicPageShell>
    );
  }

  const roleSuffix =
    data.recipient?.recipientType === "inPersonSigner"
      ? t("inPerson")
      : data.recipient?.recipientType === "witness"
        ? t("witness")
        : "";

  return (
    <PublicPageShell badge={<Badge variant="outline">{data.recipient?.recipientType}</Badge>}>
      <Surface className="space-y-3 p-4">
        <h1 className="text-base font-semibold tracking-tight">{data.envelope.subject}</h1>
        {data.envelope.emailBlurb ? (
          <p className="text-sm text-muted-foreground">{data.envelope.emailBlurb}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t("signingAs", {
            name: data.recipient?.name ?? "—",
            email: data.recipient?.email ?? "—",
          })}
          {roleSuffix}
        </p>
        <ul className="space-y-1 text-sm">
          {data.envelope.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {d.name}
            </li>
          ))}
        </ul>
      </Surface>

      {textTabs.length > 0 ? (
        <Surface className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">{t("fields")}</h2>
          {textTabs.map((tab) => (
            <div key={tab.id} className="space-y-1.5">
              <Label htmlFor={`tab-${tab.id}`}>
                {tab.tabType}
                {tab.required ? " *" : ""}
              </Label>
              <Input
                id={`tab-${tab.id}`}
                value={tabValues[tab.id] ?? ""}
                onChange={(e) => setTabValues((p) => ({ ...p, [tab.id]: e.target.value }))}
              />
            </div>
          ))}
        </Surface>
      ) : null}

      {signTabs.length > 0 ? (
        <Surface className="space-y-2 p-4">
          <h2 className="text-sm font-semibold">{t("signature")}</h2>
          <p className="text-xs text-muted-foreground">{t("signatureHint", { count: signTabs.length })}</p>
        </Surface>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {declineOpen ? (
        <Surface className="space-y-3 p-4">
          <Label htmlFor="decline-reason">{t("declineReason")}</Label>
          <Textarea
            id="decline-reason"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder={t("declineReasonPlaceholder")}
            rows={3}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeclineOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              loading={busy}
              onClick={() => void submit(true)}
            >
              {t("confirmDecline")}
            </Button>
          </div>
        </Surface>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setDeclineOpen(true)}>
            {t("decline")}
          </Button>
          <Button className="flex-1" loading={busy} onClick={() => void submit(false)}>
            {t("finish")}
          </Button>
        </div>
      )}
    </PublicPageShell>
  );
}

export default function HostedEnvelopeSignPage() {
  const t = useTranslations("hostedSign");
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
          {t("loading")}
        </main>
      }
    >
      <HostedSignInner />
    </Suspense>
  );
}
