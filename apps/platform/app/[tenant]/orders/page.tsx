import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { inputClass } from "@/components/form";
import { PageHeader, PlannedCard } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireTab } from "@/lib/access";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("orders") };
}

const filters = [
  "all",
  "today",
  "upcoming",
  "outNow",
  "overdue",
  "unpaid",
] as const;
type Filter = (typeof filters)[number];

/**
 * Orders tab (SPEC › Staff app 2): one search box and quick filters. Phase 0
 * builds the search form and filters (kept in the URL, so they work with the
 * keyboard, the back button and bookmarks); results arrive with Phase 3.
 */
export default async function OrdersPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/orders">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  await requireTab(slug, "orders");
  const t = await getTranslations("Orders");
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const filter: Filter = filters.includes(query.filter as Filter)
    ? (query.filter as Filter)
    : "all";

  const hrefFor = (f: Filter) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (f !== "all") search.set("filter", f);
    const s = search.toString();
    return `/${slug}/orders${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title={t("title")} />
      <form role="search" className="flex gap-2" action={`/${slug}/orders`}>
        <label htmlFor="order-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <input
          id="order-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("searchPlaceholder")}
          className={cn(inputClass, "flex-1")}
          autoComplete="off"
        />
        {filter !== "all" && (
          <input type="hidden" name="filter" value={filter} />
        )}
        <Button type="submit" className="h-11 px-4">
          <Search aria-hidden />
          <span className="max-sm:sr-only">{t("searchLabel")}</span>
        </Button>
      </form>
      <nav
        aria-label={t("filters")}
        className="-mx-4 mt-4 overflow-x-auto px-4"
      >
        <ul className="flex gap-2">
          {filters.map((f) => (
            <li key={f}>
              <Link
                href={hrefFor(f)}
                aria-current={f === filter ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm whitespace-nowrap hover:bg-muted",
                  f === filter &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {t(f)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <PlannedCard title={t(filter)} phase={3} className="mt-6">
        {q && (
          <p className="mt-2 text-sm font-medium">
            {t("searchingFor", { query: q })}
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">{t("noResults")}</p>
      </PlannedCard>
    </>
  );
}
