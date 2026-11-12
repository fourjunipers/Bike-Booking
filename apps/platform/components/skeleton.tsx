import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/**
 * Loading states for loading.tsx. Next.js prefetches these with each link, so
 * a tap swaps to the skeleton at once while the server renders the page
 * (SPEC › Staff app › Look: a slow server never looks like a dead button).
 * Shapes follow the real pages so nothing jumps when they arrive.
 */

export function Bone({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

/** Screen-reader "Loading…" plus the page's shape. */
async function Loading({ children }: { children: ReactNode }) {
  const t = await getTranslations("Common");
  return (
    <div aria-busy="true" data-testid="page-loading">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      {children}
    </div>
  );
}

function HeaderBones({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-2">
        <Bone className="h-8 w-56" />
        <Bone className="h-4 w-72 max-w-full" />
      </div>
      {action && <Bone className="h-10 w-28" />}
    </div>
  );
}

function CardBones({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-lg border bg-card p-4">
          <Bone className="h-5 w-2/5" />
          <Bone className="h-4 w-3/5" />
        </div>
      ))}
    </div>
  );
}

/** Dashboard: header, the four tabs, section cards. */
export function DashboardSkeleton() {
  return (
    <Loading>
      <HeaderBones action />
      <div className="grid grid-cols-4 gap-1 rounded-lg border bg-card p-1">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-10" />
        ))}
      </div>
      <Bone className="mt-5 mb-3 h-4 w-48" />
      <CardBones count={5} className="xl:grid-cols-3" />
    </Loading>
  );
}

/** A search box, a row of chips and a list (Orders, Maintenance). */
export function SearchListSkeleton({ chips = 0 }: { chips?: number }) {
  return (
    <Loading>
      <HeaderBones />
      <Bone className="h-11 w-full" />
      {chips > 0 && (
        <div className="mt-3 flex gap-2 overflow-hidden">
          {Array.from({ length: chips }, (_, i) => (
            <Bone key={i} className="h-9 w-20 shrink-0 rounded-full" />
          ))}
        </div>
      )}
      <CardBones count={2} className="mt-6" />
    </Loading>
  );
}

/** Rows in a white panel (Team, the shop picker). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Loading>
      <HeaderBones />
      <div className="divide-y rounded-lg border bg-card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 p-4">
            <div className="flex-1 space-y-2">
              <Bone className="h-4 w-1/3" />
              <Bone className="h-3 w-1/2" />
            </div>
            <Bone className="h-10 w-32" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Labelled fields in a white panel (Settings, You and this device). */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <Loading>
      <HeaderBones />
      <div className="max-w-2xl space-y-5 rounded-lg border bg-card p-4 sm:p-6">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-4 w-28" />
            <Bone className="h-11 w-full" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Steps of New order. */
export function StepsSkeleton() {
  return (
    <Loading>
      <HeaderBones />
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-lg border bg-card p-4"
          >
            <Bone className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bone className="h-4 w-1/3" />
              <Bone className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}
