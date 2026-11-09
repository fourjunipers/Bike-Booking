import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/** Page title row: title and intro on the left, actions on the right (wrapping on phones). */
export function PageHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="text-muted-foreground">{intro}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/** A card for a section whose data arrives in a later phase. */
export async function PlannedCard({
  title,
  phase,
  className,
  children,
}: {
  title: string;
  phase: number;
  className?: string;
  children?: ReactNode;
}) {
  const t = await getTranslations("Common");
  return (
    <section
      aria-label={title}
      className={cn("rounded-lg border bg-card p-4", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 font-medium">{title}</h3>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {t("comingIn", { phase })}
        </span>
      </div>
      {children ?? (
        <p className="mt-2 text-sm text-muted-foreground">{t("nothingYet")}</p>
      )}
    </section>
  );
}
