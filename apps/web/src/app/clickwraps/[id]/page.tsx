"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Surface } from "@/components/layout/Surface";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/client";
import { Check } from "lucide-react";
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
      setError("ACCEPT_REQUIRED");
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
      <main className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-3 p-6">
        <BrandLogo className="h-8" />
        <p className="text-sm text-destructive">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
        <BrandLogo className="h-8" />
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">Agreement recorded</h1>
        <p className="font-mono text-xs text-muted-foreground">{done.documentHash.slice(0, 16)}…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-svh max-w-lg space-y-4 p-4 py-8 sm:p-6">
      <BrandLogo className="h-7" />
      <Surface className="space-y-3 p-4">
        <h1 className="text-base font-semibold">{data.displayName}</h1>
        <p className="text-xs text-muted-foreground">Version {data.version}</p>
        <div
          className="max-h-64 overflow-auto rounded-md border border-border/60 p-3 text-sm prose prose-sm dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: data.bodyHtml || "" }}
        />
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />I agree
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" loading={busy} onClick={() => void accept()}>
          Accept
        </Button>
      </Surface>
    </main>
  );
}
