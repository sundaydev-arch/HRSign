import { DataTableShell } from "@/components/layout/DataTableShell";
import { Surface } from "@/components/layout/Surface";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Full-page list skeleton: mirrors PageHeader + table card. */
export function ListPageSkeleton({
  columns = 6,
  rows = 6,
  className,
}: {
  columns?: number;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 sm:space-y-5", className)} aria-busy aria-live="polite">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 sm:h-8 sm:w-48" />
          <Skeleton className="h-4 w-64 max-w-full sm:w-80" />
        </div>
        <Skeleton className="h-8 w-24 shrink-0" />
      </div>
      <TableSkeleton columns={columns} rows={rows} />
    </div>
  );
}

/** Table card skeleton — same surface language as real lists. */
export function TableSkeleton({
  columns = 6,
  rows = 6,
  headers,
}: {
  columns?: number;
  rows?: number;
  headers?: string[];
}) {
  const cols = headers?.length ?? columns;
  return (
    <Surface>
      <DataTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: cols }).map((_, i) => (
                <TableHead key={i}>
                  {headers?.[i] ? (
                    headers[i]
                  ) : (
                    <Skeleton className="h-3 w-14" />
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, r) => (
              <TableRow key={r} className="pointer-events-none hover:bg-transparent">
                {Array.from({ length: cols }).map((_, c) => (
                  <TableCell key={c}>
                    <Skeleton
                      className={cn(
                        "h-3.5",
                        c === 0 ? "w-[70%]" : c === cols - 1 ? "ml-auto w-16" : "w-[45%]",
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableShell>
    </Surface>
  );
}

/** Skeleton rows for an existing table (keeps real headers). */
export function TableRowsSkeleton({
  columns,
  rows = 6,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="pointer-events-none hover:bg-transparent">
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton
                className={cn(
                  "h-3.5",
                  c === 0 ? "w-[70%]" : c === columns - 1 ? "ml-auto w-16" : "w-[45%]",
                )}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Mobile task/card list skeleton. */
export function CardListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 md:hidden" aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 shadow-panel"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className="h-4 w-[75%] max-w-[14rem]" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** PDF viewer panel placeholder. */
export function PdfPanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)} aria-busy aria-live="polite">
      <Surface className="p-4">
        <Skeleton className="mb-3 h-[min(42vh,18rem)] w-full rounded-xl" />
        <Skeleton className="h-[min(38vh,16rem)] w-full rounded-xl" />
      </Surface>
    </div>
  );
}

/** Template editor: toolbar + canvas + side panel. */
export function EditorSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-[#f2f3f5] dark:bg-zinc-900"
      aria-busy
      aria-live="polite"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 bg-white/90 px-4 py-2.5">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="mx-auto flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-full" />
          ))}
        </div>
        <Skeleton className="ml-auto h-8 w-20 rounded-full" />
      </div>
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden p-8 sm:p-10">
        <Skeleton className="h-[min(72vh,40rem)] w-full max-w-[42rem] rounded-sm shadow-md" />
      </div>
    </div>
  );
}

/** Multi-section create/edit form placeholder. */
/** Wide create/edit form placeholder — keep in sync with TaskCreateForm (`max-w-6xl`). */
export function FormSkeleton() {
  return (
    <div className="w-full max-w-6xl space-y-5 sm:space-y-6" aria-busy aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Surface key={i} className="space-y-4 p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </Surface>
      ))}
      <div className="flex justify-end gap-3">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

/** Auth set-password card placeholder. */
export function AuthFormSkeleton() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4" aria-busy aria-live="polite">
      <Surface className="w-full max-w-md space-y-6 p-8">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="mx-auto h-4 w-32" />
      </Surface>
    </div>
  );
}

/** Task / document detail skeleton. */
export function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-8 w-20 shrink-0" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Surface className="p-4">
          <Skeleton className="h-[min(60vh,28rem)] w-full rounded-xl" />
        </Surface>
        <div className="space-y-4">
          <Surface className="space-y-3 p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 flex-1" />
            </div>
          </Surface>
          <Surface className="space-y-3 p-4">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </Surface>
        </div>
      </div>
    </div>
  );
}

/** Admin settings form first-paint skeleton. */
export function SettingsSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Surface key={i} className="space-y-4 p-4 sm:p-5">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-9 w-full sm:col-span-2 max-w-lg" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </Surface>
      ))}
    </div>
  );
}

/** Workspace dashboard first-paint skeleton. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy aria-live="polite">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Surface key={i} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-14" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </Surface>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Surface key={i} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-10" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </Surface>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Surface key={i} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/80 bg-muted/30 px-4 py-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-7 w-16" />
            </div>
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-12 w-full" />
              ))}
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}
