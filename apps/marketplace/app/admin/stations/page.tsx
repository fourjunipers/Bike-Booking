import { saveStation, setStationActive } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@mango/db/admin";
import { StationForm } from "./station-form";

/**
 * BTS/MRT/ARL/SRT Red Line stations used by the customer search (owner
 * decision, 2026-11-07): add new stations when lines open, fix names or
 * positions, or switch a station off. Seeded from OpenStreetMap.
 */
export default async function AdminStationsPage() {
  await requireAdmin();
  const { data: stations } = await createAdminClient().rpc("station_list", {
    p_include_inactive: true,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Stations</h1>
        <p className="text-muted-foreground">
          {stations?.length ?? 0} stations. Customers pick one as their search
          location. Positions are latitude/longitude, e.g. from Google Maps
          (right-click a spot → copy the numbers).
        </p>
      </header>

      <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold">Add a station</h2>
        <StationForm action={saveStation.bind(null, null)} />
      </section>

      <ul className="divide-y rounded-xl border bg-card shadow-sm">
        {(stations ?? []).map((s) => (
          <li key={s.id} className={`p-4 ${s.active ? "" : "bg-muted/60"}`}>
            <details>
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3">
                <span className="font-medium">{s.name_en}</span>
                {s.name_th && (
                  <span className="text-muted-foreground">{s.name_th}</span>
                )}
                <span className="text-sm text-muted-foreground">
                  {s.lines.join(", ")}
                </span>
                {!s.active && (
                  <span className="text-sm font-medium text-destructive">
                    switched off
                  </span>
                )}
              </summary>
              <div className="mt-3 space-y-3">
                <StationForm
                  action={saveStation.bind(null, s.id)}
                  station={s}
                />
                <form action={setStationActive}>
                  <input type="hidden" name="id" value={s.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={s.active ? "false" : "true"}
                  />
                  <Button type="submit" variant="outline" className="h-11">
                    {s.active ? "Switch off" : "Switch on"}
                  </Button>
                </form>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
