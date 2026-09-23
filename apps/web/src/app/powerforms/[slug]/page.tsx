"use client";

import { PublicPageShell } from "@/components/layout/PublicPageShell";
import { Surface } from "@/components/layout/Surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiV1 } from "@/lib/api-base";
import { ApiClientError } from "@/lib/client";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";

/**
 * Public PowerForm entry — collects signer info and starts an envelope from the bound template.
 * Token-free demo path; production would add CAPTCHA in front of the rate-limited API.
 */
export default function PublicPowerFormPage() {
  const t = useTranslations("powerformPublic");
  const params = useParams<{ slug: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUrl, setSignUrl] = useState<string | null>(null);

  async function start() {
    if (!name.trim() || !email.trim()) {
      setError(t("required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiV1(`/powerforms/${params.slug}/start`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new ApiClientError(json?.error?.code ?? `HTTP_${res.status}`);
      setSignUrl(json.accessUrl as string);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.code : "START_FAILED");
    } finally {
      setBusy(false);
    }
  }

  if (signUrl) {
    return (
      <PublicPageShell>
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t("ready")}</p>
          <Button asChild>
            <a href={signUrl}>{t("continue")}</a>
          </Button>
        </div>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <Surface className="space-y-4 p-4 sm:p-5">
        <div className="space-y-1">
          <h1 className="text-base font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-public-name">{t("name")}</Label>
          <Input
            id="pf-public-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-public-email">{t("email")}</Label>
          <Input
            id="pf-public-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" loading={busy} onClick={() => void start()}>
          {t("start")}
        </Button>
      </Surface>
    </PublicPageShell>
  );
}
