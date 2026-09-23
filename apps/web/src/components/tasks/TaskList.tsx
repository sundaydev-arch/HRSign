"use client";

import { DataTableShell } from "@/components/layout/DataTableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { CardListSkeleton, TableRowsSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
import { TaskStatusBadges } from "@/components/tasks/TaskStatusBadges";
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
import { useRefreshableLoad } from "@/lib/use-refreshable-load";
import { cn } from "@/lib/utils";
import {
  TASK_FLOW_LABEL_KEYS,
  TEMPLATE_CATEGORY_LABEL_KEYS,
  formatDateTime,
} from "@/lib/labels";
import type {
  ApprovalStatus,
  SigningFlowType,
  SigningStatus,
  TemplateCategory,
} from "@prisma/client";
import { BatchImportTasksButton } from "@/components/tasks/BatchImportTasksButton";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";
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

export function TaskList({ canSeeAll, canCreate }: { canSeeAll: boolean; canCreate?: boolean }) {
  const t = useTranslations("tasks");
  const tl = useTranslations("labels");
  const apiError = useApiError();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "pending-approve";
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const { loading, refreshing, run } = useRefreshableLoad();

  const load = useCallback(async () => {
    await run(async () => {
      try {
        const data = await api<{ tasks: TaskRow[] }>(`/api/tasks?tab=${tab}`);
        setTasks(data.tasks);
      } catch (err) {
        toast.error(apiError(err, "common.loadFailed"));
      }
    });
  }, [tab, apiError, run]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleTabs = TABS.filter(
    (tabDef) => tabDef.value !== "all" || canSeeAll || tab === "all",
  );

  const emptyKey =
    tab === "pending-approve"
      ? "emptyPendingApprove"
      : tab === "pending-sign"
        ? "emptyPendingSign"
        : tab === "mine"
          ? "emptyMine"
          : tab === "all"
            ? "emptyAll"
            : "empty";

  const emptyHintKey =
    tab === "mine" ? "emptyMineHint" : tab === "all" ? "emptyAllHint" : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canCreate ? (
            <div className="flex flex-wrap items-center gap-2">
              <BatchImportTasksButton onDone={() => void load()} />
              <Button asChild>
                <Link href="/templates">
                  <Plus className="mr-1 h-4 w-4" />
                  {t("createFromTemplate")}
                </Link>
              </Button>
            </div>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={(v) => router.push(`/tasks?tab=${v}`)}>
        <div className="-mx-1 overflow-x-auto px-1 pb-px">
          <TabsList className="min-w-max justify-start border-b border-border">
            {visibleTabs.map((tabDef) => (
              <TabsTrigger key={tabDef.value} value={tabDef.value}>
                {t(tabDef.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* Mobile cards */}
      <div className={cn("space-y-2 md:hidden", refreshing && "opacity-70 transition-opacity")}>
        {loading ? (
          <CardListSkeleton />
        ) : tasks.length === 0 ? (
          <Surface>
            <EmptyState
              icon={ClipboardList}
              title={t(emptyKey)}
              description={emptyHintKey ? t(emptyHintKey) : undefined}
              action={
                canCreate ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/templates">{t("createFromTemplate")}</Link>
                  </Button>
                ) : null
              }
            />
          </Surface>
        ) : (
          tasks.map((row) => (
            <Link
              key={row.id}
              href={`/tasks/${row.id}`}
              className="surface-lift pressable block rounded-xl border border-border bg-card p-4 shadow-panel"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="truncate font-medium">{row.title}</div>
                  <div className="flex flex-wrap gap-1">
                    <TaskStatusBadges
                      approvalStatus={row.approvalStatus}
                      signingStatus={row.signingStatus}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tl(TEMPLATE_CATEGORY_LABEL_KEYS[row.category])} ·{" "}
                    {tl(TASK_FLOW_LABEL_KEYS[row.flowType])} · {formatDateTime(row.expiresAt)}
                  </div>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Desktop table */}
      <Surface className={cn("hidden md:block", refreshing && "opacity-70 transition-opacity")}>
        <DataTableShell>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRowsSkeleton columns={7} />
              ) : tasks.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      icon={ClipboardList}
                      title={t(emptyKey)}
                      description={emptyHintKey ? t(emptyHintKey) : undefined}
                      action={
                        canCreate ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href="/templates">{t("createFromTemplate")}</Link>
                          </Button>
                        ) : null
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/tasks/${row.id}`)}
                  >
                    <TableCell className="max-w-[14rem] truncate font-medium">{row.title}</TableCell>
                    <TableCell>{tl(TEMPLATE_CATEGORY_LABEL_KEYS[row.category])}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <TaskStatusBadges
                        approvalStatus={row.approvalStatus}
                        signingStatus={row.signingStatus}
                      />
                    </TableCell>
                    <TableCell>{tl(TASK_FLOW_LABEL_KEYS[row.flowType])}</TableCell>
                    <TableCell>{row.creatorName}</TableCell>
                    <TableCell>{row.signerCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.expiresAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DataTableShell>
      </Surface>
    </div>
  );
}
