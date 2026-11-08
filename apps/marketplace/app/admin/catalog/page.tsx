import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { catalogLabel } from "@/lib/catalog";
import { createAdminClient } from "@mango/db/admin";

export default async function AdminCatalogPage({
  searchParams,
}: PageProps<"/admin/catalog">) {
  await requireAdmin();
  const { status } = await searchParams;
  const filter =
    status === "requested" || status === "rejected" ? status : "approved";
  const { data: entries } = await createAdminClient()
    .from("bike_catalog")
    .select(
      "id, make, model, year_from, year_to, cc, type, stock_photo, abs, key_type, bike_models (id)",
    )
    .eq("status", filter)
    .order("make")
    .order("model")
    .order("year_from");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Bike catalog</h1>
        <Link
          href="/admin/catalog/new"
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground"
        >
          Add entry
        </Link>
      </header>
      <nav aria-label="Catalog status" className="flex gap-4">
        {(["approved", "requested", "rejected"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/catalog?status=${s}`}
            aria-current={filter === s ? "page" : undefined}
            className="capitalize underline-offset-4 aria-[current=page]:font-semibold aria-[current=page]:underline"
          >
            {s}
          </Link>
        ))}
      </nav>
      <ul className="divide-y rounded-xl border bg-card shadow-sm">
        {(entries ?? []).map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 p-3"
          >
            <Link
              href={`/admin/catalog/${e.id}`}
              className="font-medium underline underline-offset-4"
            >
              {catalogLabel(e)}
            </Link>
            <span className="text-sm text-muted-foreground">
              {e.cc}cc · {e.bike_models.length} listings ·{" "}
              {e.stock_photo ? "stock photo" : "placeholder photo"}
              {e.abs === null || e.key_type === null
                ? " · features missing"
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
