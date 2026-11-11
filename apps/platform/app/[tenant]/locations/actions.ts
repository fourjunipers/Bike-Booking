"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import {
  closureSchema,
  dbErrorKey,
  fieldErrors,
  hoursSchema,
  locationSchema,
} from "@/lib/fleet";
import { canSeeArea } from "@/lib/roles";
import { requireMembership } from "@/lib/session";
import { createClient } from "@mango/db/platform-server";

/**
 * Location actions: owners and managers. The database also refuses a time-zone
 * change by anyone but an owner, and deleting the main location.
 */

const notAllowed: FormState = { errors: { form: "notAllowed" } };
const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "").trim();

async function context(formData: FormData) {
  const slug = field(formData, "slug");
  const { membership } = await requireMembership(slug);
  return {
    slug,
    tenant: membership.tenant,
    role: membership.role,
    allowed: canSeeArea(membership.role, "locations"),
    supabase: await createClient(),
  };
}

export async function saveLocation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, allowed, supabase } = await context(formData);
  if (!allowed) return notAllowed;
  const id = field(formData, "id");

  const raw = Object.fromEntries(formData);
  const parsed = locationSchema.safeParse({
    name: raw.name,
    // A manager's form has no time-zone field; the current one rides along.
    timezone: raw.timezone,
    address: raw.address,
    maps_url: raw.maps_url,
    phone: raw.phone,
    whatsapp: raw.whatsapp,
    line_id: raw.line_id,
    email: raw.email,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const toFormState = (error: Parameters<typeof dbErrorKey>[0]): FormState => {
    const key = dbErrorKey(error);
    if (key === "nameExists") return { errors: { name: key } };
    if (key === "timezoneOwnerOnly") return { errors: { timezone: key } };
    return { errors: { form: key } };
  };

  if (!id) {
    const { data, error } = await supabase
      .from("locations")
      .insert({ ...parsed.data, tenant_id: tenant.id })
      .select("id")
      .single();
    if (error) return toFormState(error);
    revalidatePath(`/${slug}`, "layout");
    redirect(`/${slug}/locations/${data.id}`);
  }

  // Only an owner sends a time zone; everyone else leaves it untouched.
  const { timezone, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("locations")
    .update(role === "owner" ? { ...rest, timezone } : rest)
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    .select("id");
  if (error || data.length !== 1) return toFormState(error);
  // The shell shows times in the main location's zone.
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}

export async function deleteLocation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, allowed, supabase } = await context(formData);
  if (!allowed) return notAllowed;
  const { data, error } = await supabase
    .from("locations")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "id"))
    .select("id");
  if (error || data.length !== 1) return { errors: { form: dbErrorKey(error) } };
  revalidatePath(`/${slug}`, "layout");
  redirect(`/${slug}/locations`);
}

/** The whole week at once: a day with both times blank is closed. */
export async function saveHours(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, allowed, supabase } = await context(formData);
  if (!allowed) return notAllowed;
  const locationId = field(formData, "id");

  const errors: Record<string, string> = {};
  const open: { weekday: number; open: string; close: string }[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    const opens = field(formData, `open_${weekday}`);
    const closes = field(formData, `close_${weekday}`);
    if (!opens && !closes) continue;
    const parsed = hoursSchema.safeParse({ weekday, open: opens, close: closes });
    if (parsed.success) open.push(parsed.data);
    else errors[`close_${weekday}`] = parsed.error.issues[0].message;
  }
  if (Object.keys(errors).length > 0) return { errors };

  const closedDays = [0, 1, 2, 3, 4, 5, 6].filter(
    (weekday) => !open.some((h) => h.weekday === weekday),
  );
  const removed = await supabase
    .from("location_hours")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("location_id", locationId)
    .in("weekday", closedDays);
  if (removed.error) return { errors: { form: dbErrorKey(removed.error) } };
  if (open.length > 0) {
    const { error } = await supabase.from("location_hours").upsert(
      open.map((h) => ({
        ...h,
        tenant_id: tenant.id,
        location_id: locationId,
      })),
      { onConflict: "location_id,weekday" },
    );
    if (error) return { errors: { form: dbErrorKey(error) } };
  }
  revalidatePath(`/${slug}/locations/${locationId}`);
  return { ok: true };
}

export async function addClosure(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, allowed, supabase } = await context(formData);
  if (!allowed) return notAllowed;
  const locationId = field(formData, "id");

  const raw = Object.fromEntries(formData);
  const parsed = closureSchema.safeParse({
    start_date: raw.start_date,
    end_date: raw.end_date || raw.start_date,
    note: raw.note,
    repeats_yearly: raw.repeats_yearly,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { error } = await supabase.from("location_closures").insert({
    ...parsed.data,
    tenant_id: tenant.id,
    location_id: locationId,
  });
  if (error) return { errors: { form: dbErrorKey(error) } };
  revalidatePath(`/${slug}/locations/${locationId}`);
  return { ok: true };
}

export async function deleteClosure(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, allowed, supabase } = await context(formData);
  if (!allowed) return notAllowed;
  const { data, error } = await supabase
    .from("location_closures")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "closure"))
    .select("location_id");
  if (error || data.length !== 1) return { errors: { form: dbErrorKey(error) } };
  revalidatePath(`/${slug}/locations/${data[0].location_id}`);
  return { ok: true };
}
