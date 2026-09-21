"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Surface } from "@/components/layout/Surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import {
    APPROVAL_STATUS_LABEL_KEYS,
    APPROVAL_STATUS_VARIANTS,
    DOCUMENT_STAGE_LABEL_KEYS,
    SIGNING_STATUS_LABEL_KEYS,
    SIGNING_STATUS_VARIANTS,
    TEMPLATE_CATEGORY_LABEL_KEYS,
    formatDateTime
} from "@/lib/labels";
import type {
    ApprovalStatus,
    DocumentVersion,
    SigningStatus,
    TemplateCategory
} from "@prisma/client";
import { Download, Eye, History, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface DocumentRow {
  id: string;
  title: string;
  category: TemplateCategory;
  createdAt: string;
  creator: { fullName: string };
  templateVersion: { template: { name: string } };
  signingTask: {
    id: string;
    approvalStatus: ApprovalStatus;
    signingStatus: SigningStatus;
  } | null;
  versions: Array<Pick<DocumentVersion, "version" | "storageKey" | "stage" | "createdAt">>;
}

export default function ArchivePage() {
  const t = useTranslations("archive");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const apiError = useApiError();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [versionsOf, setVersionsOf] = useState<DocumentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ documents: DocumentRow[] }>("/api/documents");
      setDocuments(data.documents);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1 h-4 w-4" />
          {tc("refresh")}
        </Button>
        }
      />

      <Surface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colTitle")}</TableHead>
              <TableHead>{t("colCategory")}</TableHead>
              <TableHead>{t("colTemplate")}</TableHead>
              <TableHead>{t("colCreator")}</TableHead>
              <TableHead>{t("colVersion")}</TableHead>
              <TableHead>{t("colTaskStatus")}</TableHead>
              <TableHead>{t("colArchivedAt")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  {tc("loading")}
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => {
                const latest = doc.versions[0];
                const currentVersion = latest?.version ?? 1;
                return (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>{tl(TEMPLATE_CATEGORY_LABEL_KEYS[doc.category])}</TableCell>
                    <TableCell className="text-muted-foreground">{doc.templateVersion.template.name}</TableCell>
                    <TableCell>{doc.creator.fullName}</TableCell>
                    <TableCell>v{currentVersion}</TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      {doc.signingTask ? (
                        <>
                          <Badge variant={APPROVAL_STATUS_VARIANTS[doc.signingTask.approvalStatus]}>
                            {tl(APPROVAL_STATUS_LABEL_KEYS[doc.signingTask.approvalStatus])}
                          </Badge>
                          <Badge variant={SIGNING_STATUS_VARIANTS[doc.signingTask.signingStatus]}>
                            {tl(SIGNING_STATUS_LABEL_KEYS[doc.signingTask.signingStatus])}
                          </Badge>
                        </>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(doc.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {doc.signingTask && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/tasks/${doc.signingTask.id}`}>
                            <Eye className="mr-1 h-4 w-4" />
                            {tc("preview")}
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVersionsOf(doc)}
                      >
                        <History className="mr-1 h-4 w-4" />
                        {t("versions")}
                      </Button>
                      {latest && (
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/api/files/${latest.storageKey}`} target="_blank" rel="noreferrer">
                            <Download className="mr-1 h-4 w-4" />
                            {tc("download")}
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Surface>

      {versionsOf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[2px]" onClick={() => setVersionsOf(null)}>
          <div
            className="w-full max-w-lg rounded-xl border bg-card shadow-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b px-5 py-4">
              <div className="font-semibold">{t("versionHistory")}</div>
              <div className="mt-0.5 text-sm text-muted-foreground">{versionsOf.title}</div>
            </div>
            <div className="max-h-[60vh] overflow-auto p-4">
              {versionsOf.versions.map((v) => (
                <div key={v.version} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">v{v.version}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {tl(DOCUMENT_STAGE_LABEL_KEYS[v.stage])} · {formatDateTime(v.createdAt)}
                    </span>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/files/${v.storageKey}`} target="_blank" rel="noreferrer">
                      {tc("view")}
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
