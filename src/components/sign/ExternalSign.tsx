"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { SignaturePad } from "@/components/pdf/SignaturePad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/client";
import {
  APPROVAL_STATUS_LABEL_KEYS,
  APPROVAL_STATUS_VARIANTS,
  SIGNER_STATUS_LABEL_KEYS,
  TASK_FLOW_LABEL_KEYS,
  formatDateTime,
} from "@/lib/labels";
import { useApiError } from "@/lib/use-api-error";
import type { ApprovalStatus, SignerRole, SignerStatus, SigningFlowType, SigningStatus } from "@prisma/client";
import { LinkIcon, PenLine, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const PdfViewer = dynamic(() => import("@/components/pdf/PdfViewer"), { ssr: false });

interface ExternalData {
  task: {
    id: string;
    title: string;
    approvalStatus: ApprovalStatus;
    signingStatus: SigningStatus;
    flowType: SigningFlowType;
    expiresAt: string;
  };
  me: {
    name: string;
    email: string;
    signRole: SignerRole;
    status: SignerStatus;
    canSign: boolean;
  };
  fileUrl: string | null;
  signers: Array<{
    signRole: SignerRole;
    status: SignerStatus;
    order: number;
    name: string;
  }>;
}

export function ExternalSign({ token }: { token: string }) {
  const t = useTranslations("external");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const apiError = useApiError();
  const [data, setData] = useState<ExternalData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<ExternalData>(`/api/sign/external/${token}`);
      setData(res);
      setLoadError(null);
    } catch (err) {
      setLoadError(apiError(err, "common.loadFailed"));
    }
  }, [token, apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSign() {
    if (!signatureData) {
      toast.error(t("signFirstToast"));
      return;
    }
    setBusy(true);
    try {
      await api(`/api/sign/external/${token}`, {
        method: "POST",
        body: JSON.stringify({ mode: "HANDWRITE", imageDataUrl: signatureData }),
      });
      toast.success(t("signSuccessToast"));
      setSignatureData(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, "external.signFailedToast"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border/80 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-6">
          <BrandLogo className="h-8 w-8 rounded-lg" />
          <span className="text-sm font-semibold tracking-tight">
            <span className="text-primary">HR</span>Sign
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loadError ? (
          <Card className="mx-auto max-w-md">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <LinkIcon className="h-10 w-10 text-muted-foreground/40" />
              <div className="text-sm text-muted-foreground">{loadError}</div>
              <p className="text-xs text-muted-foreground/80">{t("linkInvalidHint")}</p>
            </CardContent>
          </Card>
        ) : !data ? (
          <div className="py-20 text-center text-sm text-muted-foreground">{tc("loading")}</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold">{data.task.title}</h1>
                  <Badge variant={APPROVAL_STATUS_VARIANTS[data.task.approvalStatus]}>
                    {tl(APPROVAL_STATUS_LABEL_KEYS[data.task.approvalStatus])}
                  </Badge>
                  <Badge variant={data.task.signingStatus === "IN_PROGRESS" ? "default" : "outline"}>
                    {data.task.signingStatus === "IN_PROGRESS" ? t("inProgress") : t("waiting")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("signerLine", {
                    name: data.me.name,
                    flow: tl(TASK_FLOW_LABEL_KEYS[data.task.flowType]),
                    expires: formatDateTime(data.task.expiresAt),
                  })}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <RefreshCw className="mr-1 h-4 w-4" />
                {tc("refresh")}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  {data.fileUrl ? (
                    <PdfViewer url={data.fileUrl} className="max-h-[78vh] overflow-auto" />
                  ) : (
                    <div className="py-20 text-center text-sm text-muted-foreground">{t("docMissing")}</div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {data.me.canSign
                        ? t("statusHandwrite")
                        : data.me.status === "SIGNED"
                          ? t("statusSigned")
                          : data.task.signingStatus === "IN_PROGRESS"
                            ? t("statusWaitingTurn")
                            : t("statusUnavailable")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.me.canSign ? (
                      <>
                        <SignaturePad onChange={setSignatureData} width={300} height={140} />
                        <Button className="w-full" onClick={() => void handleSign()} disabled={busy || !signatureData}>
                          <PenLine className="mr-1 h-4 w-4" />
                          {busy ? tc("processing") : t("confirmSign")}
                        </Button>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {data.me.status === "SIGNED"
                          ? t("signedMessage")
                          : data.task.signingStatus === "IN_PROGRESS"
                            ? t("waitTurnMessage")
                            : t("notSignableMessage")}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("participants")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.signers.map((signer, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <span className="font-medium">{signer.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {t("orderLabel", { order: signer.order })} ·{" "}
                            {signer.signRole === "COMPANY_SEAL" ? t("roleCompanySeal") : t("rolePersonal")}
                          </span>
                        </div>
                        <Badge
                          variant={
                            signer.status === "SIGNED" ? "secondary" : signer.status === "DECLINED" ? "destructive" : "outline"
                          }
                        >
                          {tl(SIGNER_STATUS_LABEL_KEYS[signer.status])}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
