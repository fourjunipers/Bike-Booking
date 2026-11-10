import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { QrCode, Search } from "lucide-react";
import { inputClass } from "@/components/form";
import { PageHeader, PlannedCard } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireTab } from "@/lib/access";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("maintenance") };
}

/**
 * Maintenance tab (SPEC › Staff app 4): find a bike by plate or QR, and the
 * fleet's due list. Bikes arrive in Phase 1; QR scanning in Phase 5.
 */
export default async function MaintenancePage({
  params,
  searchParams,
}: PageProps<"/[tenant]/maintenance">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  await requireTab(slug, "maintenance");
  const [t, tCommon] = await Promise.all([
    getTranslations("Maintenance"),
    getTranslations("Common"),
  ]);
  const plate = typeof query.plate === "string" ? query.plate.trim() : "";

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="find-bike" className="space-y-3">
          <h2 id="find-bike" className="text-lg font-semibold">
            {t("searchLabel")}
          </h2>
          <form
            role="search"
            action={`/${slug}/maintenance`}
            className="flex gap-2"
          >
            <label htmlFor="plate" className="sr-only">
              {t("searchPlaceholder")}
            </label>
            <input
              id="plate"
              name="plate"
              type="search"
              defaultValue={plate}
              placeholder={t("searchPlaceholder")}
              autoComplete="off"
              className={cn(inputClass, "flex-1")}
            />
            <Button type="submit" className="h-11 px-4">
              <Search aria-hidden />
              <span className="max-sm:sr-only">{tCommon("search")}</span>
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled
            aria-describedby="scan-later"
          >
            <QrCode aria-hidden />
            {t("scan")}
          </Button>
          <p id="scan-later" className="text-xs text-muted-foreground">
            {tCommon("comingIn", { phase: 5 })}
          </p>
          <PlannedCard title={t("searchLabel")} phase={1}>
            {plate && <p className="mt-2 text-sm font-medium">“{plate}”</p>}
            <p className="mt-2 text-sm text-muted-foreground">{t("noBikes")}</p>
          </PlannedCard>
        </section>
        <section aria-labelledby="due-list" className="space-y-3">
          <h2 id="due-list" className="text-lg font-semibold">
            {t("due")}
          </h2>
          <PlannedCard title={t("due")} phase={1} />
        </section>
      </div>
    </>
  );
}
