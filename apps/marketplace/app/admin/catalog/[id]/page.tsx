import Link from "next/link";
import { notFound } from "next/navigation";
import { reviewCatalogRequest, saveCatalogEntry } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/form-kit";
import { requireAdmin } from "@/lib/auth/session";
import { catalogLabel } from "@/lib/catalog";
import { photoUrl, PHOTO_BUCKETS } from "@/lib/photos";
import { createAdminClient } from "@mango/db/admin";
import { supabaseUrl } from "@mango/db/env";
import { CatalogForm } from "./catalog-form";

/** /admin/catalog/new adds an approved entry; /admin/catalog/<id> edits or reviews. */
export default async function AdminCatalogEntryPage({
  params,
}: PageProps<"/admin/catalog/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";
  const { data: entry } = isNew
    ? { data: null }
    : await createAdminClient()
        .from("bike_catalog")
        .select("*, shop:shops (name)")
        .eq("id", id)
        .maybeSingle();
  if (!isNew && !entry) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <Link
          href="/admin/catalog"
          className="text-sm underline underline-offset-4"
        >
          Bike catalog
        </Link>
        <h1 className="text-2xl font-semibold">
          {entry ? catalogLabel(entry) : "New catalog entry"}
        </h1>
        {entry && (
          <p className="text-muted-foreground capitalize">
            {entry.status}
            {entry.shop && ` · requested by ${entry.shop.name}`}
          </p>
        )}
      </header>

      {entry?.status === "requested" && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-semibold">Review request</h2>
          {entry.request_note && <p>&ldquo;{entry.request_note}&rdquo;</p>}
          <p className="text-sm text-muted-foreground">
            Check the details below, add a licensed or own stock photo, save,
            then approve.
          </p>
          <form action={reviewCatalogRequest} className="space-y-2">
            <input type="hidden" name="id" value={entry.id} />
            <label htmlFor="review-notes" className="text-sm font-medium">
              Notes for the vendor (optional)
            </label>
            <textarea
              id="review-notes"
              name="notes"
              rows={2}
              className={textareaClass}
            />
            <div className="flex gap-3">
              <Button
                type="submit"
                name="decision"
                value="approved"
                className="h-11"
              >
                Approve
              </Button>
              <Button
                type="submit"
                name="decision"
                value="rejected"
                variant="outline"
                className="h-11"
              >
                Reject
              </Button>
            </div>
          </form>
        </section>
      )}

      {entry && (
        // eslint-disable-next-line @next/next/no-img-element -- Storage URL
        <img
          src={photoUrl(
            supabaseUrl(),
            PHOTO_BUCKETS.catalog,
            entry.stock_photo,
          )}
          alt={
            entry.stock_photo
              ? "Stock photo"
              : "Placeholder (no stock photo yet)"
          }
          className="aspect-4/3 w-full max-w-sm rounded-md border object-cover"
        />
      )}

      <CatalogForm
        action={saveCatalogEntry.bind(null, isNew ? null : id)}
        entryId={isNew ? null : id}
        entry={entry}
      />
    </div>
  );
}
