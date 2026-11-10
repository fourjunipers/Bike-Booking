import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@mango/db/platform-server";
import type { Role } from "./roles";

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  country: string;
  currency: string;
  locale: string;
  distanceUnit: "km" | "mi";
  /** The default location's time zone (time zones belong to locations). */
  timezone: string;
};

export type Membership = {
  id: string;
  role: Role;
  tenant: TenantSummary;
};

export type SessionUser = { id: string; email: string | undefined };

/**
 * The signed-in user, from the session's access token. getClaims() checks the
 * token's signature against the project's published signing keys (cached), so
 * with asymmetric keys (staging and live) this needs no call to Supabase Auth,
 * one round trip less on every page. With a shared-secret key (some local
 * setups) it falls back to asking Auth. RLS checks the same token on every
 * query either way.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: claims.email };
});

/** The user's memberships with their tenants, by shop name. RLS limits rows to the user's tenants. */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, role, tenant:tenants!inner(id, name, slug, country, currency, locale, distance_unit, locations(timezone, is_default))",
    )
    .eq("user_id", user.id);
  if (error) throw error;
  return (data ?? [])
    .map((m) => {
      const { locations, distance_unit, ...tenant } = m.tenant;
      return {
        id: m.id,
        role: m.role,
        tenant: {
          ...tenant,
          distanceUnit: distance_unit === "mi" ? ("mi" as const) : ("km" as const),
          // Every tenant has a default location (the database enforces it).
          timezone:
            locations.find((l) => l.is_default)?.timezone ??
            locations[0]?.timezone ??
            "UTC",
        },
      };
    })
    .sort((a, b) => a.tenant.name.localeCompare(b.tenant.name));
});

/**
 * The signed-in user's membership in the tenant at `/[slug]`. Signed-out users
 * go to sign in; a tenant the user isn't in is a 404, so a slug doesn't reveal
 * whether a shop exists.
 */
export const requireMembership = cache(async (slug: string) => {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/${slug}`)}`);
  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.tenant.slug === slug);
  if (!membership) notFound();
  return { user, membership, memberships };
});
