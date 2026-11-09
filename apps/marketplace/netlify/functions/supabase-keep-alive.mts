// Free-plan Supabase projects pause after about a week with little activity
// (https://supabase.com/docs/guides/platform/free-project-pausing). One small
// read a day keeps the hosted project awake. Uses the public anon key and a
// table anon can read under RLS, so no secret is involved.
// TODO(launch): remove once the project is on a paid Supabase plan.

export default async function keepAlive() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL or anon key not set");

  const response = await fetch(`${url}/rest/v1/shops?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    throw new Error(`Supabase keep-alive failed: HTTP ${response.status}`);
  }
  console.log("Supabase keep-alive ok");
}

// Runs once a day at 00:00 UTC (07:00 Bangkok).
export const config = { schedule: "@daily" };
