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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import {
  APPROVAL_STATUS_LABEL_KEYS,
  APPROVAL_STATUS_VARIANTS,
  SIGNING_STATUS_LABEL_KEYS,
  SIGNING_STATUS_VARIANTS,
  TASK_FLOW_LABEL_KEYS,
  TEMPLATE_CATEGORY_LABEL_KEYS,
  formatDateTime
} from "@/lib/labels";
import type {
  ApprovalStatus,
  SigningFlowType,
  SigningStatus,
  TemplateCategory,
} from "@prisma/client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface TaskRow {
  id: string;
  title: string;
  approvalStatus: ApprovalStatus;
  signingStatus: SigningStatus;
  flowType: SigningFlowType;
  category: TemplateCategory;
  creatorName: string;
  signerCount: number;
  expiresAt: string;
  createdAt: string;
}

const TABS = [
  { value: "pending-approve", labelKey: "tabPendingApprove" },
  { value: "pending-sign", labelKey: "tabPendingSign" },
  { value: "mine", labelKey: "tabMine" },
  { value: "all", labelKey: "tabAll" },
] as const;

export function TaskList({ canSeeAll }: { canSeeAll: boolean }) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const tl = useTranslations("labels");
  const apiError = useApiError();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "pending-approve";
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ tasks: TaskRow[] }>(`/api/tasks?tab=${tab}`);
      setTasks(data.tasks);
    } catch (err) {
      toast.error(apiError(err, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [tab, apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Tabs value={tab} onValueChange={(v) => router.push(`/tasks?tab=${v}`)}>
        <TabsList className="h-10 w-full justify-start overflow-x-auto sm:w-auto">
          {TABS.filter((tabDef) => tabDef.value !== "all" || canSeeAll || tab === "all").map((tabDef) => (
            <TabsTrigger key={tabDef.value} value={tabDef.value}>
              {t(tabDef.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Surface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colTitle")}</TableHead>
              <TableHead>{t("colCategory")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colFlow")}</TableHead>
              <TableHead>{t("colCreator")}</TableHead>
              <TableHead>{t("colSignerCount")}</TableHead>
              <TableHead>{t("colExpiresAt")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {tc("loading")}
                </TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/tasks/${row.id}`)}
                >
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{tl(TEMPLATE_CATEGORY_LABEL_KEYS[row.category])}</TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    <Badge variant={APPROVAL_STATUS_VARIANTS[row.approvalStatus]}>
                      {tl(APPROVAL_STATUS_LABEL_KEYS[row.approvalStatus])}
                    </Badge>
                    <Badge variant={SIGNING_STATUS_VARIANTS[row.signingStatus]}>
                      {tl(SIGNING_STATUS_LABEL_KEYS[row.signingStatus])}
                    </Badge>
                  </TableCell>
                  <TableCell>{tl(TASK_FLOW_LABEL_KEYS[row.flowType])}</TableCell>
                  <TableCell>{row.creatorName}</TableCell>
                  <TableCell>{row.signerCount}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(row.expiresAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/tasks/${row.id}`}>{t("view")}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Surface>
    </div>
  );
}
