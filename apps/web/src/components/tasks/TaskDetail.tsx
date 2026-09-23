"use client";

import { RefreshButton } from "@/components/layout/RefreshButton";
import { DetailSkeleton } from "@/components/layout/skeletons";
import { SealPreview } from "@/components/seals/SealPreview";
import { TaskStatusBadges } from "@/components/tasks/TaskStatusBadges";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client";
import {
  SIGNER_ROLE_LABEL_KEYS,
  SIGNER_STATUS_LABEL_KEYS,
  TASK_FLOW_LABEL_KEYS,
  TEMPLATE_CATEGORY_LABEL_KEYS,
  formatDateTime,
} from "@/lib/labels";
import { useApiError } from "@/lib/use-api-error";
import { useRefreshableLoad } from "@/lib/use-refreshable-load";
import { cn } from "@/lib/utils";
import type {
  ApprovalStatus,
  FieldType,
  SignatureMethod,
  SignerRole,
  SignerStatus,
  SigningFlowType,
  SigningStatus,
  TemplateCategory,
} from "@prisma/client";
import { Ban, Check, ImageUp, PenLine, RotateCcw, Stamp, Undo2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const PdfViewer = dynamic(() => import("@/components/pdf/PdfViewer"), { ssr: false });
const SignaturePad = dynamic(
  () => import("@/components/pdf/SignaturePad").then((m) => m.SignaturePad),
  {
    ssr: false,
    loading: () => <div className="h-[140px] animate-pulse rounded-md border border-border bg-muted/40" />,
  },
);

interface TaskField {
  id: string;
  type: FieldType;
  label: string;
  page: number;
}

interface TaskDetailData {
  task: {
    id: string;
    title: string;
    approvalStatus: ApprovalStatus;
    signingStatus: SigningStatus;
    flowType: SigningFlowType;
    expiresAt: string;
    createdAt: string;
    categoryName: TemplateCategory;
  };
  creator: string;
  fileUrl: string | null;
  currentVersion: number;
  fields: TaskField[];
  signers: Array<{
    id: string;
    signRole: SignerRole;
    status: SignerStatus;
    order: number;
    name: string;
    email: string;
    isExternal: boolean;
    comment: string | null;
    signedAt: string | null;
  }>;
  approvals: Array<{
    id: string;
    approverName: string;
    action: "APPROVE" | "REJECT";
    comment: string | null;
    createdAt: string;
  }>;
  signatures: Array<{
    id: string;
    method: SignatureMethod;
    sealName: string | null;
    signerName: string;
    createdAt: string;
  }>;
  me: {
    canManage: boolean;
    canApprove: boolean;
    canSign: boolean;
    signRole: SignerRole | null;
  };
}

interface SealOption {
  id: string;
  name: string;
  storageKey: string;
  enabled: boolean;
}

function defaultSealIdForCategory(category: TemplateCategory, seals: SealOption[]): string {
  if (seals.length === 0) return "";
  const pick = (pred: (name: string) => boolean) => seals.find((s) => pred(s.name))?.id;
  switch (category) {
    case "CONTRACT":
      return pick((n) => n.includes("合同")) ?? seals[0]!.id;
    case "RESIGN":
    case "CERTIFICATE":
      return pick((n) => n.includes("公章") || n.includes("公司")) ?? seals[0]!.id;
    case "OFFER":
    case "ENTRY":
      return pick((n) => n.includes("人事")) ?? seals[0]!.id;
    default:
      return seals[0]!.id;
  }
}

export function TaskDetail({ taskId }: { taskId: string }) {
  const t = useTranslations("taskDetail");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const apiError = useApiError();
  const [data, setData] = useState<TaskDetailData | null>(null);
  const [seals, setSeals] = useState<SealOption[]>([]);
  const [selectedSealId, setSelectedSealId] = useState<string>("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { refreshing, run } = useRefreshableLoad();

  const load = useCallback(async () => {
    await run(async () => {
      try {
        const res = await api<TaskDetailData>(`/api/tasks/${taskId}`);
        setData(res);
      } catch (err) {
        toast.error(apiError(err, "common.loadFailed"));
      }
    });
  }, [taskId, apiError, run]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api<{ seals: SealOption[] }>("/api/seals")
      .then((res) => setSeals(res.seals.filter((s) => s.enabled)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!data || seals.length === 0) return;
    setSelectedSealId((prev) => {
      if (prev && seals.some((s) => s.id === prev)) return prev;
      return defaultSealIdForCategory(data.task.categoryName, seals);
    });
  }, [data, seals]);

  async function copySignerLink(signerId: string) {
    try {
      const res = await api<{ url: string }>(`/api/tasks/${taskId}/signers/${signerId}/link`, {
        method: "POST",
        body: JSON.stringify({ action: "link" }),
      });
      await navigator.clipboard.writeText(res.url);
      toast.success(t("linkCopiedToast"));
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  async function resendSignerLink(signerId: string) {
    try {
      await api(`/api/tasks/${taskId}/signers/${signerId}/link`, {
        method: "POST",
        body: JSON.stringify({ action: "resend" }),
      });
      toast.success(t("linkResentToast"));
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  async function regenerateSignerLink(signerId: string) {
    try {
      const res = await api<{ url: string }>(`/api/tasks/${taskId}/signers/${signerId}/link`, {
        method: "POST",
        body: JSON.stringify({ action: "regenerate" }),
      });
      await navigator.clipboard.writeText(res.url);
      toast.success(t("linkRegeneratedToast"));
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  async function handleApprove() {
    setBusy(true);
    try {
      await api(`/api/tasks/${taskId}/approve`, {
        method: "POST",
        body: JSON.stringify({ comment: comment || undefined }),
      });
      toast.success(t("approvedToast"));
      setComment("");
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    try {
      await api(`/api/tasks/${taskId}/reject`, {
        method: "POST",
        body: JSON.stringify({ comment: comment || undefined }),
      });
      toast.success(t("rejectedToast"));
      setRejectOpen(false);
      setComment("");
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    setBusy(true);
    try {
      await api(`/api/tasks/${taskId}/withdraw`, { method: "POST", body: JSON.stringify({}) });
      toast.success(t("withdrawnToast"));
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    setBusy(true);
    try {
      await api(`/api/tasks/${taskId}/revoke`, { method: "POST", body: JSON.stringify({}) });
      toast.success(t("revokedToast"));
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline() {
    setBusy(true);
    try {
      await api(`/api/tasks/${taskId}/decline`, {
        method: "POST",
        body: JSON.stringify({ reason: declineReason || undefined }),
      });
      toast.success(t("declinedToast"));
      setDeclineOpen(false);
      setDeclineReason("");
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSign(mode: "COMPANY_SEAL" | "HANDWRITE") {
    if (mode === "COMPANY_SEAL" && !selectedSealId) {
      toast.error(t("selectSealToast"));
      return;
    }
    if (mode === "HANDWRITE" && !signatureData) {
      toast.error(t("signFirstToast"));
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ completed: boolean }>(`/api/tasks/${taskId}/sign`, {
        method: "POST",
        body: JSON.stringify({
          mode,
          sealId: mode === "COMPANY_SEAL" ? selectedSealId : undefined,
          imageDataUrl: mode === "HANDWRITE" ? signatureData : undefined,
        }),
      });
      toast.success(res.completed ? t("signCompletedToast") : t("signSuccessToast"));
      setSignatureData(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, "taskDetail.signFailedToast"));
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <DetailSkeleton />;
  }

  const { task, me } = data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-[1.45rem]">{task.title}</h1>
          <TaskStatusBadges
            approvalStatus={task.approvalStatus}
            signingStatus={task.signingStatus}
          />
          <p className="text-sm text-muted-foreground">
            {t("metaLine", {
              category: tl(TEMPLATE_CATEGORY_LABEL_KEYS[task.categoryName]),
              flow: tl(TASK_FLOW_LABEL_KEYS[task.flowType]),
              creator: data.creator,
              expires: formatDateTime(task.expiresAt),
              version: data.currentVersion,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:pt-0.5">
          {me.canManage && task.approvalStatus === "REJECTED" ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/tasks/new?fromTaskId=${task.id}`}>
                <RotateCcw className="mr-1 h-4 w-4" />
                {t("reissue")}
              </Link>
            </Button>
          ) : null}
          <RefreshButton
            refreshing={refreshing}
            label={tc("refresh")}
            onClick={() => void load()}
          />
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]", refreshing && "opacity-70 transition-opacity")}>
        {/* PDF — below actions on mobile so approve/sign is reachable */}
        <Card className="order-2 overflow-hidden xl:order-1">
          <CardContent className="p-4">
            {data.fileUrl ? (
              <PdfViewer url={data.fileUrl} className="max-h-[78vh] overflow-auto" />
            ) : (
              <div className="py-20 text-center text-sm text-muted-foreground">{t("docMissing")}</div>
            )}
          </CardContent>
        </Card>

        {/* Actions and timeline — first on mobile */}
        <div className="order-1 space-y-4 xl:order-2">
          {me.canManage &&
          (task.approvalStatus === "PENDING" ||
            task.signingStatus === "IN_PROGRESS" ||
            task.signingStatus === "COMPLETED") ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("actionManage")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {task.approvalStatus === "PENDING" ? (
                  <Button variant="outline" onClick={() => void handleWithdraw()} loading={busy}>
                    <Undo2 className="mr-1 h-4 w-4" />
                    {t("withdraw")}
                  </Button>
                ) : null}
                {task.signingStatus === "IN_PROGRESS" || task.signingStatus === "COMPLETED" ? (
                  <Button variant="destructive" onClick={() => void handleRevoke()} loading={busy}>
                    <Ban className="mr-1 h-4 w-4" />
                    {t("revoke")}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {(me.canApprove || me.canSign) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {me.canApprove
                    ? t("actionApproval")
                    : me.signRole === "COMPANY_SEAL"
                      ? t("actionCompanySeal")
                      : t("actionHandwrite")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {me.canApprove && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="comment">{t("approvalComment")}</Label>
                      <Textarea
                        id="comment"
                        rows={2}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t("approvalPlaceholder")}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => void handleApprove()} loading={busy}>
                        <Check className="mr-1 h-4 w-4" />
                        {t("approve")}
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => setRejectOpen(true)}
                        disabled={busy}
                      >
                        <X className="mr-1 h-4 w-4" />
                        {t("reject")}
                      </Button>
                    </div>
                  </>
                )}

                {me.canSign && me.signRole === "COMPANY_SEAL" && (
                  <>
                    <div className="space-y-2">
                      <Label>{t("selectSeal")}</Label>
                      {seals.length === 0 ? (
                        <div className="text-sm text-muted-foreground">{t("noSeals")}</div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {seals.map((seal) => (
                            <Button
                              key={seal.id}
                              type="button"
                              variant={selectedSealId === seal.id ? "secondary" : "outline"}
                              onClick={() => setSelectedSealId(seal.id)}
                              className="h-auto bg-white p-2"
                              title={seal.name}
                            >
                              <SealPreview
                                storageKey={seal.storageKey}
                                alt={seal.name}
                                className="h-auto w-full border-0 bg-transparent p-0"
                              />
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => void handleSign("COMPANY_SEAL")}
                      disabled={!selectedSealId}
                      loading={busy}
                    >
                      <Stamp className="mr-1 h-4 w-4" />
                      {busy ? tc("processing") : t("confirmStamp")}
                    </Button>
                  </>
                )}

                {me.canSign && me.signRole === "PERSONAL_SIGNATURE" && (
                  <>
                    <SignaturePad onChange={setSignatureData} width={300} height={140} />
                    <Button
                      className="w-full"
                      onClick={() => void handleSign("HANDWRITE")}
                      disabled={!signatureData}
                      loading={busy}
                    >
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
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("recordsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.approvals.length === 0 && data.signatures.length === 0 && (
                <div className="text-sm text-muted-foreground">{t("noRecords")}</div>
              )}
              {data.approvals.map((approval) => (
                <div key={`a-${approval.id}`} className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  {approval.action === "APPROVE" ? (
                    <Check className="mt-0.5 h-4 w-4 text-success" />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {approval.approverName} ·{" "}
                      {approval.action === "APPROVE" ? t("approvedAction") : t("rejectedAction")}
                    </div>
                    {approval.comment && <div className="text-xs text-muted-foreground">{approval.comment}</div>}
                    <div className="text-xs text-muted-foreground">{formatDateTime(approval.createdAt)}</div>
                  </div>
                </div>
              ))}
              {data.signatures.map((sig) => (
                <div key={`s-${sig.id}`} className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <ImageUp className="mt-0.5 h-4 w-4 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {sig.signerName} ·{" "}
                      {sig.method === "IMAGE_SEAL"
                        ? t("sealAction", { sealName: sig.sealName ?? "" })
                        : t("handwrittenAction")}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(sig.createdAt)}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("participants")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.signers.map((signer) => (
                <div key={signer.id} className="space-y-2 rounded-lg border border-border/70 p-2.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium">{signer.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t("orderLabel", { order: signer.order })} ·{" "}
                        {tl(SIGNER_ROLE_LABEL_KEYS[signer.signRole])}
                        {signer.isExternal ? ` · ${t("externalTag")}` : ""}
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
                  {signer.isExternal && signer.status === "PENDING" ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => void copySignerLink(signer.id)}
                      >
                        {t("copyLink")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => void resendSignerLink(signer.id)}
                      >
                        {t("resendLink")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => void regenerateSignerLink(signer.id)}
                      >
                        {t("regenerateLink")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("declineTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decline-reason">{t("declineReason")}</Label>
            <Textarea
              id="decline-reason"
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
            <Button variant="destructive" onClick={() => void handleDecline()} loading={busy}>
              {t("confirmDecline")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-comment">{t("rejectComment")}</Label>
            <Input
              id="reject-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("rejectPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void handleReject()} loading={busy}>
              {t("confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
