"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { vendorShopForAction } from "@/lib/auth/session";
import { failed, invalid, type ActionState } from "@/lib/forms";
import { createClient } from "@mango/db/server";
import { extraSchema, fieldErrors, formObject } from "@/lib/validation/vendor";

async function ownerShop() {
  const shop = await vendorShopForAction();
  return shop?.role === "owner" ? shop : null;
}

/** Creates (extraId null) or updates an extra and the models it applies to. */
export async function saveExtra(
  extraId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shop = await ownerShop();
  if (!shop) return failed;
  const parsed = extraSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const v = parsed.data;
  const modelIds = formData.getAll("model_ids").map(String);
  if (!v.all_models && modelIds.length === 0)
    return invalid({ model_ids: "required" });

  const supabase = await createClient();
  const row = {
    shop_id: shop.id,
    name: v.name,
    description: v.description ?? null,
    terms: v.terms ?? null,
    price_kind: v.price_kind,
    price_rental: v.price_rental,
    price_1d: v.price_1d,
    price_7d: v.price_7d,
    price_30d: v.price_30d,
    all_models: v.all_models,
    active: v.active,
  };
  const { data, error } = extraId
    ? await supabase
        .from("shop_extras")
        .update(row)
        .eq("id", extraId)
        .eq("shop_id", shop.id)
        .select("id")
        .single()
    : await supabase.from("shop_extras").insert(row).select("id").single();
  if (error || !data) return failed;

  const { error: clearError } = await supabase
    .from("shop_extra_models")
    .delete()
    .eq("extra_id", data.id);
  if (clearError) return failed;
  if (!v.all_models) {
    const { error: linkError } = await supabase
      .from("shop_extra_models")
      .insert(modelIds.map((id) => ({ extra_id: data.id, bike_model_id: id })));
    if (linkError) return invalid({ model_ids: "invalid" });
  }
  redirect("/vendor/extras");
}

export async function setExtraActive(formData: FormData) {
  const shop = await ownerShop();
  const id = String(formData.get("id") ?? "");
  if (!shop || !id) return;
  const supabase = await createClient();
  await supabase
    .from("shop_extras")
    .update({ active: formData.get("active") === "true" })
    .eq("id", id)
    .eq("shop_id", shop.id);
  refresh();
}

export async function deleteExtra(extraId: string): Promise<ActionState> {
  const shop = await ownerShop();
  if (!shop) return failed;
  const supabase = await createClient();
  const { error } = await supabase
    .from("shop_extras")
    .delete()
    .eq("id", extraId)
    .eq("shop_id", shop.id);
  if (error) return failed;
  redirect("/vendor/extras");
}
