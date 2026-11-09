"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, localeCookie } from "@/i18n/config";
import { getCurrentUser, vendorShopForAction } from "@/lib/auth/session";
import {
  mergeStates,
  failed,
  hasErrors,
  invalid,
  savedState,
  type ActionState,
} from "@/lib/forms";
import { isOwnPhotoPath, PHOTO_BUCKETS } from "@/lib/photos";
import { createClient } from "@mango/db/server";
import {
  bookingSettingsSchema,
  closureSchema,
  contactsSchema,
  createShopSchema,
  fieldErrors,
  formObject,
  parseHours,
  shopInclusionsSchema,
  shopProfileSchema,
  toShopPolicies,
} from "@/lib/validation/vendor";

// Every action re-checks the caller: Server Actions are reachable by direct
// POST, not only from our pages. RLS is the second line of defence.

async function ownerShop() {
  const shop = await vendorShopForAction();
  return shop?.role === "owner" ? shop : null;
}

export async function setVendorLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(localeCookie, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function createShop(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await getCurrentUser())) return failed;
  const parsed = createShopSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_shop", {
    p_name: parsed.data.name,
  });
  if (error) return failed;
  // The form sits in the vendor layout, which the client keeps across a
  // same-area redirect: refresh it so the new membership shows.
  refresh();
  redirect("/vendor");
}

/** Deletes Storage files that were removed from a photo list. */
async function deleteRemovedPhotos(
  bucket: string,
  before: string[],
  after: string[],
) {
  const removed = before.filter(
    (p) => !after.includes(p) && !p.startsWith("/"),
  );
  if (removed.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from(bucket).remove(removed);
}

export async function saveProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shop = await ownerShop();
  if (!shop) return failed;
  const parsed = shopProfileSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const v = parsed.data;
  if (!v.photos.every((p) => isOwnPhotoPath(p, shop.id)))
    return invalid({ photos: "invalid" });

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("shops")
    .select("photos")
    .eq("id", shop.id)
    .single();
  const location =
    v.lat !== undefined && v.lng !== undefined
      ? `SRID=4326;POINT(${v.lng} ${v.lat})`
      : null;
  const { error } = await supabase
    .from("shops")
    .update({
      name: v.name,
      about: v.about ?? null,
      photos: v.photos,
      location,
      maps_url: v.maps_url ?? null,
      nearest_station: v.nearest_station ?? null,
      google_place_id: v.google_place_id ?? null,
    })
    .eq("id", shop.id);
  if (error) return failed;
  await deleteRemovedPhotos(
    PHOTO_BUCKETS.shop,
    current?.photos ?? [],
    v.photos,
  );
  refresh();
  return savedState;
}

export async function saveHours(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shop = await ownerShop();
  if (!shop) return failed;
  const { rows, errors } = parseHours(formObject(formData));
  if (hasErrors(errors)) return invalid(errors);

  const supabase = await createClient();
  if (rows.length > 0) {
    const { error } = await supabase
      .from("shop_hours")
      .upsert(rows.map((r) => ({ shop_id: shop.id, ...r })));
    if (error) return failed;
  }
  const open = rows.map((r) => r.weekday);
  let remove = supabase.from("shop_hours").delete().eq("shop_id", shop.id);
  if (open.length > 0)
    remove = remove.not("weekday", "in", `(${open.join(",")})`);
  const { error } = await remove;
  if (error) return failed;
  refresh();
  return savedState;
}

export async function saveContacts(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shop = await ownerShop();
  if (!shop) return failed;
  const parsed = contactsSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("shop_contacts").upsert({
    shop_id: shop.id,
    whatsapp: v.whatsapp ?? null,
    phone: v.phone ?? null,
    line_id: v.line_id ?? null,
    email: v.email ?? null,
  });
  if (error) return failed;
  refresh();
  return savedState;
}

export async function saveBookingSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shop = await ownerShop();
  if (!shop) return failed;
  const parsed = bookingSettingsSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase
    .from("shops")
    .update(parsed.data)
    .eq("id", shop.id);
  if (error) return failed;
  refresh();
  return savedState;
}

export async function saveShopInclusions(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shop = await ownerShop();
  if (!shop) return failed;
  const parsed = shopInclusionsSchema.safeParse({
    ...formObject(formData),
    helmet_types: formData.getAll("helmet_types"),
    deposit_methods: formData.getAll("deposit_methods"),
  });
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase
    .from("shop_policies")
    .upsert({ shop_id: shop.id, ...toShopPolicies(parsed.data) });
  if (error) return failed;
  refresh();
  return savedState;
}

export async function submitForReview(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shop = await ownerShop();
  if (!shop) return failed;
  const supabase = await createClient();
  const { data: missing, error } = await supabase.rpc("submit_shop", {
    p_shop_id: shop.id,
    p_accept_terms: formData.get("accept_terms") === "on",
  });
  if (error) return failed;
  // Only the terms block submitting; other missing steps are for the admin
  // (approval needs a complete shop) and stay on the vendor's checklist.
  if (missing?.includes("terms"))
    return invalid({ accept_terms: "termsRequired" });
  refresh();
  return savedState;
}

/**
 * Holiday closures from the Store information form: `closures` is JSON with
 * the ids kept and the new entries. Removed ones are deleted.
 */
export async function saveClosures(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shop = await ownerShop();
  if (!shop) return failed;
  let parsed: { keep?: unknown; add?: unknown };
  try {
    parsed = JSON.parse(String(formData.get("closures") ?? "{}"));
  } catch {
    return invalid({ closures: "invalid" });
  }
  const keep = Array.isArray(parsed.keep)
    ? parsed.keep.filter(
        (id): id is string =>
          typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),
      )
    : [];
  const add = [];
  for (const entry of Array.isArray(parsed.add) ? parsed.add : []) {
    const r = closureSchema.safeParse(
      Object.fromEntries(
        Object.entries(entry ?? {}).map(([k, v]) => [
          k,
          k === "repeats_yearly" ? (v ? "on" : undefined) : (v ?? ""),
        ]),
      ),
    );
    if (!r.success) return invalid({ closures: "invalid" });
    add.push(r.data);
  }

  const supabase = await createClient();
  let remove = supabase.from("shop_closures").delete().eq("shop_id", shop.id);
  if (keep.length > 0) remove = remove.not("id", "in", `(${keep.join(",")})`);
  const { error: removeError } = await remove;
  if (removeError) return failed;
  if (add.length > 0) {
    const { error } = await supabase.from("shop_closures").insert(
      add.map((c) => ({
        shop_id: shop.id,
        start_date: c.start_date,
        end_date: c.end_date,
        note: c.note ?? null,
        repeats_yearly: c.repeats_yearly,
      })),
    );
    if (error) return failed;
  }
  refresh();
  return savedState;
}

/** Store information's one Save button: profile, hours, closures, contacts. */
export async function saveStoreInformation(
  prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return mergeStates([
    await saveProfile(prev, formData),
    await saveHours(prev, formData),
    await saveClosures(prev, formData),
    await saveContacts(prev, formData),
  ]);
}

/** Default settings' one Save button: booking rules and "What's included". */
export async function saveShopDefaults(
  prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return mergeStates([
    await saveBookingSettings(prev, formData),
    await saveShopInclusions(prev, formData),
  ]);
}
