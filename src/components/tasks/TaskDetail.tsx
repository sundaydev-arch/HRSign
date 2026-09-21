"use client";

import { SignaturePad } from "@/components/pdf/SignaturePad";
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
import { useApiError } from "@/lib/use-api-error";
import {
  APPROVAL_STATUS_LABEL_KEYS,
  APPROVAL_STATUS_VARIANTS,
  SIGNING_STATUS_LABEL_KEYS,
  SIGNING_STATUS_VARIANTS,
  SIGNER_ROLE_LABEL_KEYS,
  SIGNER_STATUS_LABEL_KEYS,
  TASK_FLOW_LABEL_KEYS,
  TEMPLATE_CATEGORY_LABEL_KEYS,
  formatDateTime
} from "@/lib/labels";
import type {
  ApprovalStatus,
  FieldType,
  SignatureMethod,
  SignerRole,
  SignerStatus,
  SigningFlowType,
  SigningStatus,
  TemplateCategory
} from "@prisma/client";
import { Check, ImageUp, PenLine, RefreshCw, Stamp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const PdfViewer = dynamic(() => import("@/components/pdf/PdfViewer"), { ssr: false });

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
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<TaskDetailData>(`/api/tasks/${taskId}`);
      setData(res);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    }
  }, [taskId, apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api<{ seals: SealOption[] }>("/api/seals")
      .then((res) => setSeals(res.seals.filter((s) => s.enabled)))
      .catch(() => undefined);
  }, []);

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
    return <div className="py-20 text-center text-sm text-muted-foreground">{tc("loading")}</div>;
  }

  const { task, me } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{task.title}</h1>
            <Badge variant={APPROVAL_STATUS_VARIANTS[task.approvalStatus]}>
              {tl(APPROVAL_STATUS_LABEL_KEYS[task.approvalStatus])}
            </Badge>
            <Badge variant={SIGNING_STATUS_VARIANTS[task.signingStatus]}>
              {tl(SIGNING_STATUS_LABEL_KEYS[task.signingStatus])}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("metaLine", {
              category: tl(TEMPLATE_CATEGORY_LABEL_KEYS[task.categoryName]),
              flow: tl(TASK_FLOW_LABEL_KEYS[task.flowType]),
              creator: data.creator,
              expires: formatDateTime(task.expiresAt),
              version: data.currentVersion,
            })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1 h-4 w-4" />
          {tc("refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        {/* Left: PDF preview */}
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            {data.fileUrl ? (
              <PdfViewer url={data.fileUrl} className="max-h-[78vh] overflow-auto" />
            ) : (
              <div className="py-20 text-center text-sm text-muted-foreground">{t("docMissing")}</div>
            )}
          </CardContent>
        </Card>

        {/* Right: actions and timeline */}
        <div className="space-y-4">
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
                      <Button className="flex-1" onClick={() => void handleApprove()} disabled={busy}>
                        <Check className="mr-1 h-4 w-4" />
                        {t("approve")}
                      </Button>
                      <Button variant="destructive" className="flex-1" onClick={() => setRejectOpen(true)} disabled={busy}>
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
                            // eslint-disable-next-line @next/next/no-img-element
                            <button
                              key={seal.id}
                              type="button"
                              onClick={() => setSelectedSealId(seal.id)}
                              className={`rounded border bg-white p-2 transition ${
                                selectedSealId === seal.id ? "border-blue-500 ring-2 ring-blue-200" : "hover:border-gray-300"
                              }`}
                              title={seal.name}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/files/${seal.storageKey}`}
                                alt={seal.name}
                                className="mx-auto max-h-14 object-contain"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => void handleSign("COMPANY_SEAL")}
                      disabled={busy || !selectedSealId}
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
                      disabled={busy || !signatureData}
                    >
                      <PenLine className="mr-1 h-4 w-4" />
                      {busy ? tc("processing") : t("confirmSign")}
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
                <div key={`a-${approval.id}`} className="flex items-start gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
                  {approval.action === "APPROVE" ? (
                    <Check className="mt-0.5 h-4 w-4 text-green-600" />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 text-red-500" />
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
                <div key={`s-${sig.id}`} className="flex items-start gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
                  <ImageUp className="mt-0.5 h-4 w-4 text-blue-600" />
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
            <CardContent className="space-y-2">
              {data.signers.map((signer) => (
                <div key={signer.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{signer.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t("orderLabel", { order: signer.order })} · {tl(SIGNER_ROLE_LABEL_KEYS[signer.signRole])}
                      {signer.isExternal ? ` · ${t("externalTag")}` : ""}
                    </span>
                  </div>
                  <Badge
                    variant={signer.status === "SIGNED" ? "secondary" : signer.status === "DECLINED" ? "destructive" : "outline"}
                  >
                    {tl(SIGNER_STATUS_LABEL_KEYS[signer.status])}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

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
            <Button variant="destructive" onClick={() => void handleReject()} disabled={busy}>
              {t("confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
