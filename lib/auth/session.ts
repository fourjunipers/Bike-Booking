import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Data access layer for the signed-in user. Every read here touches cookies,
 * so callers must render inside a <Suspense> boundary (Cache Components).
 */

export type CurrentUser = { id: string; email: string | null };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Session checks compare token expiry with the clock, so they must run per
  // request, never in a prerender (Next.js rejects Date.now() there).
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

/** The signed-in user, or a redirect to /login that comes back to `next`. */
export async function requireUser(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export const getMyProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, name, email, whatsapp, language, notify_channels")
    .eq("id", user.id)
    .single();
  return data;
});

/**
 * Admin pages: anyone without the admin role gets a 404, not a hint.
 * Call this in every admin page and action, not only the layout: Next.js
 * renders a page in parallel with its layout, so a layout check alone does not
 * stop the page's code (and its service-role queries) from running.
 */
export async function requireAdmin() {
  await requireUser("/admin");
  const profile = await getMyProfile();
  if (profile?.role !== "admin") notFound();
  return profile;
}

/** Shops the signed-in user belongs to, owner memberships first. */
export const getMyShops = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_members")
    .select("role, shop:shops (id, name, slug, status)")
    .eq("user_id", user.id)
    .order("role");
  return (data ?? []).flatMap((m) =>
    m.shop ? [{ role: m.role, ...m.shop }] : [],
  );
});

/**
 * The shop a vendor page works on, or null for someone in no shop (the layout
 * then shows "create your shop"). Like requireAdmin, call it in every vendor
 * page: the layout's check does not stop a page from running.
 * TODO(phase-2): shop switcher for people in more than one shop.
 */
export async function requireVendorShop() {
  await requireUser("/vendor");
  const [shop] = await getMyShops();
  return shop ?? null;
}
