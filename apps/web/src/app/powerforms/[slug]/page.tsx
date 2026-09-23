"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Surface } from "@/components/layout/Surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/client";
import { apiV1 } from "@/lib/api-base";
import { useParams } from "next/navigation";
import { useState } from "react";

/**
 * Public PowerForm entry — collects signer info and starts an envelope from the bound template.
 * Token-free demo path; production would rate-limit + CAPTCHA.
 */
export default function PublicPowerFormPage() {
  const params = useParams<{ slug: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUrl, setSignUrl] = useState<string | null>(null);

  async function start() {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required");
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
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <BrandLogo className="h-8" />
        <p className="text-sm text-muted-foreground">Your envelope is ready.</p>
        <Button asChild>
          <a href={signUrl}>Continue to sign</a>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <BrandLogo className="h-8" />
      <Surface className="space-y-3 p-4">
        <h1 className="text-base font-semibold">PowerForm</h1>
        <p className="text-xs text-muted-foreground">/{params.slug}</p>
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" loading={busy} onClick={() => void start()}>
          Start signing
        </Button>
      </Surface>
    </main>
  );
}
