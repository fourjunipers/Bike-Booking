import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireAdmin } from "@/lib/auth/session";
import { catalogLabel } from "@/lib/catalog";
import { createAdminClient } from "@mango/db/admin";
import { formatBangkok } from "@mango/core/time";

/** Approval queue: new shops, flagged edits on live shops, catalog requests. */
export default async function AdminPage() {
  const profile = await requireAdmin();
  const db = createAdminClient();
  const [
    { data: pending },
    { data: flaggedShops },
    { data: flaggedModels },
    { data: requests },
  ] = await Promise.all([
    db
      .from("shops")
      .select("id, name, submitted_at")
      .eq("status", "pending")
      .order("submitted_at"),
    db
      .from("shops")
      .select("id, name")
      .eq("status", "live")
      .eq("flagged_for_review", true),
    db
      .from("bike_models")
      .select(
        "id, shop:shops!inner (id, name, status), catalog:bike_catalog (make, model, year_from, year_to)",
      )
      .eq("flagged_for_review", true)
      .eq("shop.status", "live"),
    db
      .from("bike_catalog")
      .select(
        "id, make, model, year_from, year_to, cc, created_at, shop:shops (name)",
      )
      .eq("status", "requested")
      .order("created_at"),
  ]);

  // Live shops with flagged edits, from either the shop or its models.
  const flagged = new Map<string, { name: string; models: string[] }>();
  for (const s of flaggedShops ?? [])
    flagged.set(s.id, { name: s.name, models: [] });
  for (const m of flaggedModels ?? []) {
    if (!m.shop) continue;
    const entry = flagged.get(m.shop.id) ?? { name: m.shop.name, models: [] };
    if (m.catalog) entry.models.push(catalogLabel(m.catalog));
    flagged.set(m.shop.id, entry);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {profile.email}
          </p>
        </div>
        <SignOutButton />
      </header>

      <Queue title="New shops waiting for approval" empty="No shops waiting.">
        {(pending ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap justify-between gap-2 p-3">
            <Link
              href={`/admin/shops/${s.id}`}
              className="font-medium underline underline-offset-4"
            >
              {s.name}
            </Link>
            <span className="text-sm text-muted-foreground">
              Submitted {formatBangkok(s.submitted_at)}
            </span>
          </li>
        ))}
      </Queue>

      <Queue title="Edits to review on live shops" empty="No flagged edits.">
        {[...flagged].map(([shopId, f]) => (
          <li key={shopId} className="space-y-1 p-3">
            <Link
              href={`/admin/shops/${shopId}`}
              className="font-medium underline underline-offset-4"
            >
              {f.name}
            </Link>
            <p className="text-sm text-muted-foreground">
              {f.models.length > 0
                ? `Models: ${f.models.join(", ")}`
                : "Policies or extras changed"}
            </p>
          </li>
        ))}
      </Queue>

      <Queue title="Catalog requests" empty="No catalog requests.">
        {(requests ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap justify-between gap-2 p-3">
            <Link
              href={`/admin/catalog/${r.id}`}
              className="font-medium underline underline-offset-4"
            >
              {catalogLabel(r)} · {r.cc}cc
            </Link>
            <span className="text-sm text-muted-foreground">
              from {r.shop?.name ?? "a deleted shop"}
            </span>
          </li>
        ))}
      </Queue>
    </div>
  );
}

function Queue({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        {title} ({children.length})
      </h2>
      {children.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card shadow-sm">
          {children}
        </ul>
      )}
    </section>
  );
}
