import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@mango/db/server";
import type { Role } from "./roles";

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  country: string;
  currency: string;
  timezone: string;
  locale: string;
};

export type Membership = {
  id: string;
  role: Role;
  tenant: TenantSummary;
};

/** The signed-in user, verified with Supabase Auth (not just the cookie). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** The user's memberships with their tenants, by shop name. RLS limits rows to the user's tenants. */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, role, tenant:tenants!inner(id, name, slug, country, currency, timezone, locale)",
    )
    .eq("user_id", user.id);
  if (error) throw error;
  return (data ?? [])
    .map((m) => ({ id: m.id, role: m.role, tenant: m.tenant }))
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
