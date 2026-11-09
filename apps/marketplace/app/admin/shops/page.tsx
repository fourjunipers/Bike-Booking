import Link from "next/link";
import { setBoost, setShopSuspended } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { inputBase } from "@/components/form-kit";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@mango/db/admin";
import { formatBangkok } from "@mango/core/time";

const STATUS_ORDER = { pending: 0, live: 1, draft: 2, suspended: 3 } as const;

export default async function AdminShopsPage() {
  await requireAdmin();
  const { data: shops } = await createAdminClient()
    .from("shops")
    .select(
      "id, name, status, boost_level, flagged_for_review, created_at, approved_at, bike_models (id)",
    )
    .order("name");
  const sorted = [...(shops ?? [])].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Shops</h1>
      <ul className="divide-y rounded-xl border bg-card shadow-sm">
        {sorted.map((s) => (
          <li
            key={s.id}
            className="grid gap-3 p-4 md:grid-cols-[2fr_1fr_1.5fr_auto] md:items-center"
          >
            <div className="space-y-1">
              <Link
                href={`/admin/shops/${s.id}`}
                className="font-medium underline underline-offset-4"
              >
                {s.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {s.bike_models.length} models · created{" "}
                {formatBangkok(s.created_at)}
                {s.flagged_for_review ? " · edits to review" : ""}
              </p>
            </div>
            <p className="capitalize">{s.status}</p>
            <form action={setBoost} className="flex items-center gap-2">
              <input type="hidden" name="id" value={s.id} />
              <label htmlFor={`boost-${s.id}`} className="sr-only">
                Boost level for {s.name}
              </label>
              <select
                id={`boost-${s.id}`}
                name="boost_level"
                defaultValue={s.boost_level}
                className={`${inputBase} w-36`}
              >
                <option value="featured">Featured</option>
                <option value="preferred">Preferred</option>
                <option value="normal">Normal</option>
              </select>
              <Button type="submit" variant="outline" className="h-11">
                Set
              </Button>
            </form>
            <div>
              {(s.status === "live" || s.status === "suspended") && (
                <form action={setShopSuspended}>
                  <input type="hidden" name="id" value={s.id} />
                  <input
                    type="hidden"
                    name="suspend"
                    value={String(s.status === "live")}
                  />
                  <Button
                    type="submit"
                    variant={s.status === "live" ? "destructive" : "outline"}
                    className="h-11"
                  >
                    {s.status === "live" ? "Suspend" : "Reinstate"}
                  </Button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
