"use client";

import { PublicPageShell } from "@/components/layout/PublicPageShell";
import { Surface } from "@/components/layout/Surface";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/client";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Clickwrap = {
  clickwrapId: string;
  displayName: string;
  bodyHtml: string | null;
  version: number;
  requireScroll: boolean;
};

export default function PublicClickwrapPage() {
  const t = useTranslations("clickwrapPublic");
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Clickwrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ acceptanceId: string; documentHash: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clickwraps/${params.id}`);
      const json = await res.json();
      if (!res.ok) throw new ApiClientError(json?.error?.code ?? `HTTP_${res.status}`);
      setData(json as Clickwrap);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.code : "LOAD_FAILED");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept() {
    if (!email.trim() || !agreed) {
      setError(t("acceptRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/clickwraps/${params.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptorEmail: email.trim(), acceptorName: name.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new ApiClientError(json?.error?.code ?? `HTTP_${res.status}`);
      setDone({ acceptanceId: json.acceptanceId, documentHash: json.documentHash });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.code : "ACCEPT_FAILED");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <PublicPageShell>
        <p className="py-12 text-center text-sm text-destructive">
          {error === "LOAD_FAILED" || error.startsWith("HTTP_") || error.includes("NOT_FOUND")
            ? t("unavailable")
            : error}
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

  if (done) {
    return (
      <PublicPageShell>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold">{t("recorded")}</h1>
          <p className="font-mono text-xs text-muted-foreground">{done.documentHash.slice(0, 16)}…</p>
        </div>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <Surface className="space-y-4 p-4 sm:p-5">
        <div className="space-y-1">
          <h1 className="text-base font-semibold tracking-tight">{data.displayName}</h1>
          <p className="text-xs text-muted-foreground">{t("version", { version: data.version })}</p>
        </div>
        <div
          className="prose prose-sm max-h-64 overflow-auto rounded-md border border-border/60 p-3 text-sm dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: data.bodyHtml || "" }}
        />
        <div className="space-y-1.5">
          <Label htmlFor="cw-name">{t("name")}</Label>
          <Input
            id="cw-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cw-email">{t("email")}</Label>
          <Input
            id="cw-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
          />
        </div>
        <label className="flex items-start gap-2 text-sm leading-snug">
          <Checkbox
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            className="mt-0.5"
          />
          <span>{t("agree")}</span>
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" loading={busy} onClick={() => void accept()}>
          {t("accept")}
        </Button>
      </Surface>
    </PublicPageShell>
  );
}
