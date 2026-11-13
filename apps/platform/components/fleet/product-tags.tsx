import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";
import { humanizeKey, type ListingStatus } from "@/lib/vehicle-kinds";
import { cn } from "@/lib/utils";

/** The Moto Mangos chip: the word says it, the colour helps. */
const listingClass: Record<ListingStatus, string> = {
  listed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  inReview: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  needsChanges: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  notListed: "border bg-card text-muted-foreground",
};

/**
 * A product's tags, the same on the Products list and on its Fleet line
 * (owner, 13 Nov 2026): Retired, where it stands on Moto Mangos (motorcycles
 * only, and only for those who set the shop up), and its categories.
 */
export async function ProductTags({
  name,
  retired,
  listing,
  categories,
}: {
  name: string;
  retired: boolean;
  /** Null: not a motorcycle, or not this person's business. */
  listing: ListingStatus | null;
  categories: string[];
}) {
  const t = await getTranslations("Fleet");
  const chip = "rounded-full px-2 py-0.5 text-xs font-medium";
  if (!retired && !listing && categories.length === 0) return null;
  return (
    <ul
      aria-label={t("modelFacts", { name })}
      className="flex flex-wrap items-center gap-1.5"
    >
      {retired && (
        <li className={cn(chip, "bg-muted text-muted-foreground")}>
          {t("listing.retired")}
        </li>
      )}
      {listing && !retired && (
        <li className={cn(chip, listingClass[listing])}>
          {t(`listing.${listing}`)}
        </li>
      )}
      {categories.map((key) => (
        <li key={key} className={cn(chip, "border bg-card")}>
          {t.has(`category.${key}` as "category.sedan")
            ? t(`category.${key}` as "category.sedan")
            : humanizeKey(key)}
        </li>
      ))}
    </ul>
  );
}

/**
 * The edit pencil beside a product's title, on Fleet and on the Products
 * list: opens the product's page. A plain icon with a name for screen
 * readers ("Edit product: Honda PCX 160"), a focus ring, and 44 px to tap.
 */
export async function EditPencil({
  href,
  name,
}: {
  href: string;
  name: string;
}) {
  const t = await getTranslations("Fleet");
  return (
    <Link
      href={href}
      aria-label={`${t("editModel")}: ${name}`}
      title={t("editModel")}
      // The negative margin keeps the line's height.
      className="-my-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Pencil aria-hidden className="size-4" />
    </Link>
  );
}
