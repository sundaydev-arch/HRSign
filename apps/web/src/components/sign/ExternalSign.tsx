"use client";

import { SignatureDisclaimer } from "@/components/sign/SignatureDisclaimer";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { DetailSkeleton } from "@/components/layout/skeletons";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client";
import {
  APPROVAL_STATUS_LABEL_KEYS,
  APPROVAL_STATUS_VARIANTS,
  SIGNER_STATUS_LABEL_KEYS,
  TASK_FLOW_LABEL_KEYS,
  formatDateTime,
} from "@/lib/labels";
import { useApiError } from "@/lib/use-api-error";
import { useRefreshableLoad } from "@/lib/use-refreshable-load";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ApprovalStatus, SignerRole, SignerStatus, SigningFlowType, SigningStatus } from "@prisma/client";
import { LinkIcon, PenLine, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const PdfViewer = dynamic(() => import("@/components/pdf/PdfViewer"), { ssr: false });
const SignaturePad = dynamic(
  () => import("@/components/pdf/SignaturePad").then((m) => m.SignaturePad),
  {
    ssr: false,
    loading: () => <div className="h-[140px] animate-pulse rounded-md border border-border bg-muted/40" />,
  },
);

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
  requiresEmailVerification?: boolean;
}

export function ExternalSign({ token }: { token: string }) {
  const t = useTranslations("external");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const locale = useLocale();
  const apiError = useApiError();
  const [data, setData] = useState<ExternalData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const { refreshing, run } = useRefreshableLoad();

  const codeSchema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .min(1, t("codeRequiredToast"))
          .length(6, t("codeRequiredToast")),
      }),
    [t],
  );
  type CodeValues = z.infer<typeof codeSchema>;
  const codeForm = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  const load = useCallback(async () => {
    await run(async () => {
      try {
        const res = await api<ExternalData>(`/api/sign/external/${token}`);
        setData(res);
        setLoadError(null);
      } catch (err) {
        setLoadError(apiError(err, "common.loadFailed"));
      }
    });
  }, [token, apiError, run]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendCode() {
    setBusy(true);
    try {
      const res = await api<{ verificationId: string; emailHint: string }>(
        `/api/sign/external/${token}/verify`,
        {
          method: "POST",
          body: JSON.stringify({ locale: locale === "en" ? "en" : "zh-CN" }),
        },
      );
      setVerificationId(res.verificationId);
      setEmailHint(res.emailHint);
      toast.success(t("codeSentToast"));
    } catch (err) {
      toast.error(apiError(err, "external.codeSendFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(values: CodeValues) {
    if (!verificationId) return;
    setBusy(true);
    try {
      const res = await api<{ status: string; remainingAttempts: number }>(
        `/api/sign/external/${token}/verify`,
        {
          method: "PUT",
          body: JSON.stringify({ verificationId, code: values.code.trim() }),
        },
      );
      if (res.status === "VERIFIED") {
        setVerified(true);
        toast.success(t("codeVerifiedToast"));
      } else if (res.status === "EXPIRED") {
        toast.error(t("codeExpiredToast"));
      } else {
        codeForm.setError("code", {
          message: t("codeInvalidToast", { remaining: res.remainingAttempts }),
        });
      }
    } catch (err) {
      toast.error(apiError(err, "external.codeVerifyFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline() {
    if (!verified || !verificationId) {
      toast.error(t("verifyFirstToast"));
      return;
    }
    setBusy(true);
    try {
      await api(`/api/sign/external/${token}`, {
        method: "POST",
        body: JSON.stringify({
          action: "decline",
          reason: declineReason || undefined,
          verificationId,
        }),
      });
      toast.success(t("declineSuccessToast"));
      setDeclineOpen(false);
      setDeclineReason("");
      await load();
    } catch (err) {
      toast.error(apiError(err, "external.declineFailedToast"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSign() {
    if (!signatureData) {
      toast.error(t("signFirstToast"));
      return;
    }
    if (!verified || !verificationId) {
      toast.error(t("verifyFirstToast"));
      return;
    }
    setBusy(true);
    try {
      await api(`/api/sign/external/${token}`, {
        method: "POST",
        body: JSON.stringify({
          mode: "HANDWRITE",
          imageDataUrl: signatureData,
          verificationId,
        }),
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

  const canDraw = Boolean(data?.me.canSign && verified);

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border/80 bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-6">
          <BrandLogo className="h-8 w-8 rounded-lg" />
          <span className="text-sm font-semibold tracking-tight">HRSign</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 pt-4">
        <SignatureDisclaimer variant="compact" />
      </div>

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
          <DetailSkeleton />
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
              <RefreshButton
                refreshing={refreshing}
                label={tc("refresh")}
                onClick={() => void load()}
              />
            </div>

            <div className={cn("grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]", refreshing && "opacity-70 transition-opacity")}>
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
                {data.me.canSign && !verified ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t("verifyTitle")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {emailHint ? t("verifyHintSent", { email: emailHint }) : t("verifyHint")}
                      </p>
                      <Button className="w-full" variant="outline" onClick={() => void sendCode()} disabled={busy}>
                        <ShieldCheck className="mr-1 h-4 w-4" />
                        {busy ? tc("processing") : t("sendCode")}
                      </Button>
                      {verificationId ? (
                        <Form {...codeForm}>
                          <form
                            className="flex flex-col gap-2"
                            onSubmit={codeForm.handleSubmit(checkCode)}
                            noValidate
                          >
                            <FormField
                              control={codeForm.control}
                              name="code"
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex gap-2">
                                    <FormControl>
                                      <Input
                                        placeholder={t("codePlaceholder")}
                                        maxLength={6}
                                        inputMode="numeric"
                                        {...field}
                                      />
                                    </FormControl>
                                    <Button type="submit" disabled={busy}>
                                      {t("verifyCode")}
                                    </Button>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </form>
                        </Form>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {data.me.status === "DECLINED"
                        ? t("statusDeclined")
                        : canDraw
                        ? t("statusHandwrite")
                        : data.me.status === "SIGNED"
                          ? t("statusSigned")
                          : data.task.signingStatus === "IN_PROGRESS"
                            ? verified
                              ? t("statusHandwrite")
                              : t("statusWaitingTurn")
                            : t("statusUnavailable")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.me.status === "DECLINED" ? (
                      <div className="text-sm text-muted-foreground">{t("declinedMessage")}</div>
                    ) : canDraw ? (
                      <>
                        <SignaturePad onChange={setSignatureData} width={300} height={140} />
                        <Button className="w-full" onClick={() => void handleSign()} disabled={busy || !signatureData}>
                          <PenLine className="mr-1 h-4 w-4" />
                          {busy ? tc("processing") : t("confirmSign")}
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setDeclineOpen(true)}
                          disabled={busy}
                        >
                          {t("decline")}
                        </Button>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {data.me.status === "SIGNED"
                          ? t("signedMessage")
                          : data.me.canSign && !verified
                            ? t("verifyFirstMessage")
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
                            signer.status === "SIGNED"
                              ? "secondary"
                              : signer.status === "DECLINED"
                                ? "destructive"
                                : "outline"
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

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("declineTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="external-decline-reason">{t("declineReason")}</Label>
            <Textarea
              id="external-decline-reason"
              rows={2}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder={t("declinePlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void handleDecline()} disabled={busy}>
              {t("confirmDecline")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
