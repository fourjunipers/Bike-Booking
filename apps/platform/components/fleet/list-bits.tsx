import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowDownAZ, Check, ListOrdered } from "lucide-react";
import { resetProductOrder } from "@/app/[tenant]/products/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonVariants } from "@/components/ui/button";
import { listSorts, mangoFor, type ListSort } from "@/lib/product-list";
import type { ListingStatus } from "@/lib/vehicle-kinds";
import { cn } from "@/lib/utils";

/**
 * The parts Fleet and the Products list share (owner, 14 Nov 2026): every row
 * the same height, two lines, one grid; the Moto Mangos mango; the sort and
 * reorder bar; the filter chips.
 */

/**
 * A row's grid. Line 1: icon, name (one line, "…" when too long), edit
 * pencil. Line 2: the summary under the name, the mango under the pencil.
 * Both lines have a fixed height, so every row on a list is the same height
 * whatever its name or tags. Fleet adds a column for its chevron; reorder mode
 * adds one for the arrows (and, later, a drag handle).
 */
export function rowGrid({
  chevron = false,
  reorder = false,
}: {
  chevron?: boolean;
  reorder?: boolean;
}) {
  return cn(
    "grid h-18 grid-rows-[1.5rem_1.5rem] items-center gap-x-2 gap-y-1 px-3 py-2.5 sm:px-4",
    reorder
      ? "grid-cols-[2rem_minmax(0,1fr)_2.75rem_auto]"
      : chevron
        ? "grid-cols-[2rem_minmax(0,1fr)_2.75rem_1.25rem]"
        : "grid-cols-[2rem_minmax(0,1fr)_2.75rem]",
  );
}

/** Where each part of a row sits in rowGrid. */
export const cell = {
  icon: "col-start-1 row-start-1 flex size-8 items-center justify-center overflow-hidden rounded-md border bg-card text-muted-foreground",
  name: "col-start-2 row-start-1 min-w-0 truncate font-semibold",
  pencil: "col-start-3 row-start-1 justify-self-center",
  summary:
    "col-start-2 row-start-2 flex min-w-0 items-center gap-2 overflow-hidden text-sm whitespace-nowrap text-muted-foreground",
  mango: "col-start-3 row-start-2 justify-self-center",
  end: "col-start-4 row-span-2 row-start-1 justify-self-end",
};

/** The summary's tags, on wide screens only, cut off where the line ends. */
export function RowTags({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <span className="hidden min-w-0 gap-1.5 overflow-hidden sm:flex">
      {labels.map((label) => (
        <span
          key={label}
          className="shrink-0 rounded-full border bg-card px-2 py-px text-xs font-medium text-foreground"
        >
          {label}
        </span>
      ))}
    </span>
  );
}

/**
 * The Moto Mangos mango, about 24 px, on a motorbike's row: in colour when
 * it is on Moto Mangos, in colour with an amber dot while in review, in grey
 * when it is not (a red dot when Moto Mangos asked for changes). A picture
 * with a name for screen readers, and the same words as a tooltip.
 */
export async function MangoStatus({
  listing,
}: {
  /** Null: not a motorbike, or not this person's business. */
  listing: ListingStatus | null;
}) {
  const mango = mangoFor(listing);
  if (!mango) return null;
  const t = await getTranslations("Lists.mango");
  const label = t(mango.label);
  const src = (size: number) =>
    `/brand/moto-mangos-mango-${mango.image}-${size}.png`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-mango={mango.label}
      className="relative inline-flex size-6 shrink-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a 24 px icon in two sizes; nothing for the optimiser to do */}
      <img
        src={src(48)}
        srcSet={`${src(48)} 2x, ${src(96)} 4x`}
        alt=""
        width={24}
        height={24}
        className="size-6"
      />
      {mango.dot && (
        <span
          aria-hidden
          className={cn(
            "absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card",
            mango.dot === "amber" ? "bg-amber-500" : "bg-red-600",
          )}
        />
      )}
    </span>
  );
}

/**
 * Above a list: the sort (A–Z, By type, My order) and, for owners and
 * managers, "Reorder". In reorder mode: what it does, "Reset to A–Z" while
 * the shop has its own order, and "Done".
 */
export async function ListToolbar({
  slug,
  sort,
  sortHref,
  reorderHref,
  doneHref,
  reordering,
  custom,
}: {
  slug: string;
  sort: ListSort;
  sortHref: (sort: ListSort) => string;
  /** Null: this person can't reorder, or there is nothing to reorder. */
  reorderHref: string | null;
  doneHref: string;
  reordering: boolean;
  /** The shop has its own order. */
  custom: boolean;
}) {
  const t = await getTranslations("Lists");
  const tOrder = await getTranslations("Products.order");
  const small = cn(buttonVariants({ variant: "outline" }), "h-11 px-3");

  if (reordering)
    return (
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p
          role="status"
          className="min-w-0 flex-1 basis-48 text-sm text-muted-foreground"
        >
          {t("reorder.help")}
        </p>
        {custom && (
          <form action={resetProductOrder}>
            <input type="hidden" name="slug" value={slug} />
            {/* It wipes a hand-made order, so it asks first. */}
            <ConfirmSubmit question={tOrder("resetConfirm")} className={small}>
              <ArrowDownAZ aria-hidden />
              {tOrder("reset")}
            </ConfirmSubmit>
          </form>
        )}
        <Link
          href={doneHref}
          className={cn(buttonVariants({ variant: "default" }), "h-11 px-4")}
        >
          <Check aria-hidden />
          {t("reorder.done")}
        </Link>
      </div>
    );

  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <nav aria-label={t("sort.label")}>
        <ul className="inline-flex rounded-md border bg-card p-0.5">
          {listSorts.map((option) => (
            <li key={option}>
              <Link
                href={sortHref(option)}
                aria-current={option === sort ? "true" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-[5px] px-2.5 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  option === sort
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t(`sort.${option}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {reorderHref && (
        <Link href={reorderHref} className={small}>
          <ListOrdered aria-hidden />
          {t("reorder.start")}
        </Link>
      )}
    </div>
  );
}

/**
 * A row of chips above a list, scrolling sideways on a phone: All, then the
 * kinds and categories the shop has. They keep the search, and the search
 * keeps them.
 */
export async function FilterChips({
  chips,
}: {
  chips: { label: string; href: string; current: boolean }[];
}) {
  if (chips.length < 2) return null;
  const t = await getTranslations("Lists.chips");
  return (
    <nav aria-label={t("label")} className="-mx-3 mb-3 sm:mx-0">
      <ul className="flex [scrollbar-width:none] gap-2 overflow-x-auto px-3 py-1 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {chips.map((chip) => (
          <li key={chip.href} className="shrink-0">
            <Link
              href={chip.href}
              aria-current={chip.current ? "true" : undefined}
              className={cn(
                // 36 px to see, 44 px to tap.
                "relative inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap outline-none after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:ring-2 focus-visible:ring-ring",
                chip.current
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-muted",
              )}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
