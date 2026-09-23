"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { DashboardSkeleton } from "@/components/layout/skeletons";
import { Surface } from "@/components/layout/Surface";
import { TaskStatusBadges } from "@/components/tasks/TaskStatusBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { TEMPLATE_CATEGORY_LABEL_KEYS, formatDateTime } from "@/lib/labels";
import { auditActionLabelKey } from "@/lib/audit-actions";
import { useApiError } from "@/lib/use-api-error";
import { cn } from "@/lib/utils";
import type { ApprovalStatus, SigningStatus, TemplateCategory, UserRole } from "@prisma/client";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CheckCircle,
  ChevronRight,
  Clock,
  FileSignature,
  FileText,
  LayoutList,
  Plus,
  RefreshCw,
  Stamp,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type TaskItem = {
  id: string;
  title: string;
  reason: string;
  category: TemplateCategory;
  approvalStatus: ApprovalStatus;
  signingStatus: SigningStatus;
  expiresAt: string | null;
  updatedAt: string;
  creatorName: string;
};

type DashboardPayload = {
  user: { name: string; role: UserRole };
  kpis: {
    myApprove: number;
    mySign: number;
    pendingApprove: number;
    pendingSign: number;
    expiring7d: number;
    overdue: number;
    completed30d: number;
  };
  attention: TaskItem[];
  recent: TaskItem[];
  catalog: {
    templatesPublished: number;
    templatesDraft: number;
    sealsEnabled: number;
  } | null;
  activity: Array<{
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    createdAt: string;
    actorName: string | null;
  }>;
};

function greetingKey(hour: number): "greetingMorning" | "greetingAfternoon" | "greetingEvening" {
  if (hour < 12) return "greetingMorning";
  if (hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tl = useTranslations("labels");
  const ta = useTranslations("auditLogs");
  const tc = useTranslations("common");
  const locale = useLocale();
  const apiError = useApiError();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        setData(await api<DashboardPayload>("/api/dashboard"));
      } catch (err) {
        toast.error(apiError(err, "common.loadFailed"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiError],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const hour = new Date().getHours();
  const dateLabel = new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const canManage = data?.catalog != null;
  const canCreate = data?.user.role === "SUPER_ADMIN" || data?.user.role === "HR";
  const showTeam = Boolean(data && data.user.role !== "EMPLOYEE");
  const boot = loading && !data;

  function reasonBadge(reason: string) {
    if (reason === "approve") return <Badge variant="accent">{t("reasonApprove")}</Badge>;
    if (reason === "sign") return <Badge variant="default">{t("reasonSign")}</Badge>;
    return null;
  }

  function activityLabel(action: string) {
    const key = auditActionLabelKey(action);
    try {
      return ta(`actionLabels.${key}`);
    } catch {
      return action;
    }
  }

  function activityHref(targetType: string | null, targetId: string | null) {
    if (!targetId) return null;
    if (targetType === "task" || targetType === "SigningTask") return `/tasks/${targetId}`;
    if (targetType === "template" || targetType === "Template") return `/templates/${targetId}/edit`;
    return null;
  }

  const mineCards = [
    {
      key: "myApprove",
      label: t("myApprove"),
      href: "/tasks?tab=pending-approve",
      icon: Clock,
      value: data?.kpis.myApprove,
    },
    {
      key: "mySign",
      label: t("mySign"),
      href: "/tasks?tab=pending-sign",
      icon: FileSignature,
      value: data?.kpis.mySign,
    },
  ];

  const teamCards = [
    {
      key: "pendingApprove",
      label: t("pendingApprove"),
      href: "/tasks?tab=all",
      icon: FileSignature,
      value: data?.kpis.pendingApprove,
      tone: "default" as const,
    },
    {
      key: "pendingSign",
      label: t("pendingSign"),
      href: "/tasks?tab=all",
      icon: FileSignature,
      value: data?.kpis.pendingSign,
      tone: "default" as const,
    },
    {
      key: "overdue",
      label: t("overdue"),
      href: "/tasks?tab=all",
      icon: AlertTriangle,
      value: data?.kpis.overdue,
      tone: "warn" as const,
    },
    {
      key: "expiring7d",
      label: t("expiring7d"),
      href: "/tasks?tab=all",
      icon: AlertTriangle,
      value: data?.kpis.expiring7d,
      tone: "warn" as const,
    },
    {
      key: "completed30d",
      label: t("completed30d"),
      href: "/archive",
      icon: CheckCircle2,
      value: data?.kpis.completed30d,
      tone: "ok" as const,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {boot ? (
        <DashboardSkeleton />
      ) : (
        <>
      <PageHeader
        title={t(greetingKey(hour), { name: data?.user.name ?? "" })}
        description={dateLabel}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              loading={refreshing}
              onClick={() => void load(true)}
            >
              {!refreshing ? <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> : null}
              {tc("refresh")}
            </Button>
            {canCreate ? (
              <Button asChild size="sm" className="h-9">
                <Link href="/tasks/new">
                  <Plus className="mr-1 h-4 w-4" />
                  {t("newTask")}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href="/tasks">{t("openTasks")}</Link>
            </Button>
          </div>
        }
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">{t("mineSection")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {mineCards.map((card) => (
            <Link key={card.key} href={card.href} className="block">
              <Surface
                className={cn(
                  "surface-lift pressable h-full p-4 hover:bg-muted/40",
                  (card.value ?? 0) > 0 && "border-foreground/15",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                      {card.value ?? 0}
                    </p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <card.icon className="h-4 w-4" />
                  </span>
                </div>
              </Surface>
            </Link>
          ))}
        </div>
      </section>

      {showTeam ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight">{t("teamSection")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {teamCards.map((card) => (
              <Link key={card.key} href={card.href} className="block">
                <Surface
                  className={cn(
                    "surface-lift pressable h-full p-4 hover:bg-muted/40",
                    card.tone === "warn" && (card.value ?? 0) > 0 && "border-amber-200/80",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                        {card.value ?? 0}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                        card.tone === "warn" && (card.value ?? 0) > 0 && "bg-amber-50 text-amber-800",
                      )}
                    >
                      <card.icon className="h-4 w-4" />
                    </span>
                  </div>
                </Surface>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className={cn("grid gap-4 lg:grid-cols-2", refreshing && "opacity-80 transition-opacity")}>
        <Surface className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/80 bg-muted/30 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">{t("attentionTitle")}</h2>
              <p className="text-xs text-muted-foreground">{t("attentionHint")}</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <Link href="/tasks">
                {t("viewAll")}
                <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </Link>
            </Button>
          </div>
          <TaskMiniList
            items={data?.attention ?? []}
            empty={t("attentionEmpty")}
            emptyHint={t("attentionEmptyHint")}
            reasonBadge={reasonBadge}
            categoryLabel={(c) => tl(TEMPLATE_CATEGORY_LABEL_KEYS[c])}
            expiresLabel={t("expiresAt")}
            compact
          />
        </Surface>

        <Surface className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/80 bg-muted/30 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">{t("recentTitle")}</h2>
              <p className="text-xs text-muted-foreground">{t("recentHint")}</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <Link href="/tasks?tab=all">
                {t("viewAll")}
                <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </Link>
            </Button>
          </div>
          <TaskMiniList
            items={data?.recent ?? []}
            empty={t("recentEmpty")}
            emptyHint={t("recentEmptyHint")}
            reasonBadge={() => null}
            categoryLabel={(c) => tl(TEMPLATE_CATEGORY_LABEL_KEYS[c])}
            expiresLabel={t("updatedAt")}
            useUpdated
          />
        </Surface>
      </div>

      {(canManage || data?.activity?.length) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {data?.catalog ? (
            <Surface className="space-y-3 p-4 lg:col-span-1">
              <h2 className="text-sm font-semibold tracking-tight">{t("catalogTitle")}</h2>
              <p className="text-xs text-muted-foreground">{t("catalogHint")}</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    {t("templatesPublished")}
                  </span>
                  <span className="font-semibold tabular-nums">{data.catalog.templatesPublished}</span>
                </li>
                <li className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <LayoutList className="h-3.5 w-3.5" />
                    {t("templatesDraft")}
                  </span>
                  <span className="font-semibold tabular-nums">{data.catalog.templatesDraft}</span>
                </li>
                <li className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Stamp className="h-3.5 w-3.5" />
                    {t("sealsEnabled")}
                  </span>
                  <span className="font-semibold tabular-nums">{data.catalog.sealsEnabled}</span>
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link href="/templates">{t("quickTemplates")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link href="/seals">{t("quickSeals")}</Link>
                </Button>
              </div>
            </Surface>
          ) : null}

          <Surface className={cn("overflow-hidden", data?.catalog ? "lg:col-span-2" : "lg:col-span-3")}>
            <div className="flex items-center justify-between border-b border-border/80 bg-muted/30 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">{t("activityTitle")}</h2>
                <p className="text-xs text-muted-foreground">{t("activityHint")}</p>
              </div>
              {canManage ? (
                <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                  <Link href="/audit-logs">{t("quickAudit")}</Link>
                </Button>
              ) : null}
            </div>
            {!data?.activity.length ? (
              <EmptyState
                compact
                icon={CheckCircle}
                title={t("activityEmpty")}
                description={t("activityEmptyHint")}
              />
            ) : (
              <ul className="divide-y divide-border/70">
                {data.activity.map((a) => {
                  const href = activityHref(a.targetType, a.targetId);
                  const row = (
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{activityLabel(a.action)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {a.actorName ?? t("systemActor")}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatDateTime(a.createdAt)}
                      </time>
                    </div>
                  );
                  return (
                    <li key={a.id}>
                      {href ? (
                        <Link href={href} className="block transition-colors hover:bg-muted/30">
                          {row}
                        </Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Surface>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function TaskMiniList({
  items,
  empty,
  emptyHint,
  reasonBadge,
  categoryLabel,
  expiresLabel,
  useUpdated,
  compact,
}: {
  items: TaskItem[];
  empty: string;
  emptyHint?: string;
  reasonBadge: (reason: string) => React.ReactNode;
  categoryLabel: (c: TemplateCategory) => string;
  expiresLabel: string;
  useUpdated?: boolean;
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        icon={CheckCircle}
        title={empty}
        description={emptyHint}
      />
    );
  }
  return (
    <ul className="divide-y divide-border/70">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/tasks/${item.id}`}
            className="block px-4 py-3 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  {reasonBadge(item.reason)}
                </div>
                {compact ? (
                  <p className="text-xs text-muted-foreground">
                    {categoryLabel(item.category)}
                    {" · "}
                    {expiresLabel} {formatDateTime(item.expiresAt ?? item.updatedAt)}
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-normal">
                        {categoryLabel(item.category)}
                      </Badge>
                      <TaskStatusBadges
                        approvalStatus={item.approvalStatus}
                        signingStatus={item.signingStatus}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.creatorName}
                      {" · "}
                      {expiresLabel}{" "}
                      {formatDateTime(useUpdated ? item.updatedAt : (item.expiresAt ?? item.updatedAt))}
                    </p>
                  </>
                )}
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/70" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
