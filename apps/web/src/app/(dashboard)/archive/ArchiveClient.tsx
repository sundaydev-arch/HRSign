"use client";

import { DataTableShell } from "@/components/layout/DataTableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { TableRowsSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
import { TaskStatusBadges } from "@/components/tasks/TaskStatusBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useRefreshableLoad } from "@/lib/use-refreshable-load";
import {
  DOCUMENT_STAGE_LABEL_KEYS,
  TEMPLATE_CATEGORY_LABEL_KEYS,
  formatDateTime,
} from "@/lib/labels";
import type {
  ApprovalStatus,
  DocumentVersion,
  SigningStatus,
  TemplateCategory,
} from "@prisma/client";
import { Archive, Download, Eye, History, MoreHorizontal, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DocumentRow {
  id: string;
  title: string;
  category: TemplateCategory;
  createdAt: string;
  legalHold: boolean;
  legalHoldReason: string | null;
  creator: { fullName: string };
  templateVersion: { template: { name: string } };
  signingTask: {
    id: string;
    approvalStatus: ApprovalStatus;
    signingStatus: SigningStatus;
  } | null;
  versions: Array<Pick<DocumentVersion, "version" | "storageKey" | "stage" | "createdAt">>;
}

export default function ArchiveClient({ canManageHold }: { canManageHold: boolean }) {
  const t = useTranslations("archive");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const apiError = useApiError();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [versionsOf, setVersionsOf] = useState<DocumentRow | null>(null);
  const { loading, refreshing, run } = useRefreshableLoad();

  const load = useCallback(async () => {
    await run(async () => {
      try {
        const data = await api<{ documents: DocumentRow[] }>("/api/documents");
        setDocuments(data.documents);
      } catch (err) {
        toast.error(apiError(err, "common.loadFailed"));
      }
    });
  }, [apiError, run]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleHold(doc: DocumentRow) {
    try {
      await api(`/api/documents/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          legalHold: !doc.legalHold,
          legalHoldReason: doc.legalHold ? null : "Manual hold from archive",
        }),
      });
      toast.success(t("holdUpdated"));
      await load();
    } catch (err) {
      toast.error(apiError(err, "common.actionFailed"));
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <RefreshButton
            refreshing={refreshing}
            label={tc("refresh")}
            onClick={() => void load()}
          />
        }
      />

      <Surface className={cn(refreshing && "opacity-70 transition-opacity")}>
        <DataTableShell>
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
                <TableHead className="w-[1%] whitespace-nowrap text-right">{t("colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRowsSkeleton columns={8} />
              ) : documents.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState icon={Archive} title={t("empty")} description={t("emptyHint")} />
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => {
                  const latest = doc.versions[0];
                  const currentVersion = latest?.version ?? 1;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{doc.title}</span>
                          {doc.legalHold ? (
                            <Badge variant="outline" className="shrink-0">
                              {t("legalHoldOn")}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{tl(TEMPLATE_CATEGORY_LABEL_KEYS[doc.category])}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {doc.templateVersion.template.name}
                      </TableCell>
                      <TableCell>{doc.creator.fullName}</TableCell>
                      <TableCell>v{currentVersion}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {doc.signingTask ? (
                          <TaskStatusBadges
                            approvalStatus={doc.signingTask.approvalStatus}
                            signingStatus={doc.signingTask.signingStatus}
                          />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(doc.createdAt)}
                      </TableCell>
                      <TableCell className="w-[1%] whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {latest ? (
                            <Button asChild size="sm" className="h-8 px-2.5">
                              <a
                                href={`/api/files/${latest.storageKey}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="mr-1 h-3.5 w-3.5" />
                                {tc("download")}
                              </a>
                            </Button>
                          ) : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                aria-label={t("openActions")}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {doc.signingTask ? (
                                <DropdownMenuItem asChild>
                                  <Link href={`/tasks/${doc.signingTask.id}`}>
                                    <Eye className="h-4 w-4" />
                                    {tc("preview")}
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onClick={() => setVersionsOf(doc)}>
                                <History className="h-4 w-4" />
                                {t("versions")}
                              </DropdownMenuItem>
                              {canManageHold ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => void toggleHold(doc)}>
                                    <Shield className="h-4 w-4" />
                                    {doc.legalHold ? t("legalHoldOff") : t("legalHold")}
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </DataTableShell>
      </Surface>

      <Dialog open={!!versionsOf} onOpenChange={(open) => !open && setVersionsOf(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("versionHistory")}</DialogTitle>
          </DialogHeader>
          {versionsOf ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{versionsOf.title}</p>
              <div className="max-h-[60vh] space-y-2 overflow-auto pt-2">
                {versionsOf.versions.map((v) => (
                  <div
                    key={v.version}
                    className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"
                  >
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
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
