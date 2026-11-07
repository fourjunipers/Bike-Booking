import { saveRankingWeights } from "@/app/admin/actions";
import { ActionForm, TextField } from "@/components/form-kit";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const FACTORS = [
  ["boost", "Admin boost", "Featured 1.0 · Preferred 0.6 · Normal 0.3"],
  ["rating", "Rating", "Platform reviews; neutral below 3 reviews"],
  ["response", "Request response", "Share of requests answered in time"],
  ["cancellation", "Cancellations", "Fewer shop cancellations score higher"],
  ["distance", "Distance", "Closer to the search location scores higher"],
] as const;

/** SPEC "Ranking score": weights for the Recommended sort. */
export default async function AdminRankingPage() {
  await requireAdmin();
  const { data: w } = await createAdminClient()
    .from("ranking_settings")
    .select("boost, rating, response, cancellation, distance")
    .single();
  if (!w) return null;
  const total = FACTORS.reduce((sum, [k]) => sum + Number(w[k]), 0);

  return (
    <div className="max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Ranking</h1>
        <p className="text-muted-foreground">
          Weights for the Recommended sort in search. They don&apos;t need to
          add up to 1: each is divided by the total (now {total.toFixed(2)}).
          Starting point from the spec: 0.30 / 0.20 / 0.15 / 0.15 / 0.20.
        </p>
      </header>
      <ActionForm
        action={saveRankingWeights}
        className="space-y-4 rounded-xl border bg-card p-4 shadow-sm md:p-6"
      >
        {FACTORS.map(([key, label, hint]) => (
          <TextField
            key={key}
            inputMode="decimal"
            name={key}
            label={label}
            hint={`${hint}. Now ${Math.round((Number(w[key]) / total) * 100)}% of the score.`}
            defaultValue={Number(w[key])}
          />
        ))}
      </ActionForm>
    </div>
  );
}
