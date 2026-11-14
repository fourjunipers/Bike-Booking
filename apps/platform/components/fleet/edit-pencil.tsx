import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";

/**
 * The edit pencil at the end of a product's first line, on Fleet and on the
 * Products list: opens the product's page. A plain icon with a name for screen
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
      className="-my-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Pencil aria-hidden className="size-4" />
    </Link>
  );
}
