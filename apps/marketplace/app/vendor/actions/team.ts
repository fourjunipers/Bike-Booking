"use server";

import { refresh } from "next/cache";
import { vendorShopForAction } from "@/lib/auth/session";
import { failed, type ActionState } from "@/lib/forms";
import { createClient } from "@mango/db/server";

async function ownerShop() {
  const shop = await vendorShopForAction();
  return shop?.role === "owner" ? shop : null;
}

/** Returns the invite link once in `notice`; only its hash is stored. */
export async function createInvite(): Promise<ActionState> {
  const shop = await ownerShop();
  if (!shop) return failed;
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_shop_invite", {
    p_shop_id: shop.id,
  });
  if (error || !token) return failed;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  refresh();
  return {
    status: "saved",
    notice: `${site}/account/join?token=${encodeURIComponent(token)}`,
  };
}

export async function cancelInvite(formData: FormData) {
  const shop = await ownerShop();
  const id = String(formData.get("id") ?? "");
  if (!shop || !id) return;
  const supabase = await createClient();
  await supabase
    .from("shop_invites")
    .delete()
    .eq("id", id)
    .eq("shop_id", shop.id);
  refresh();
}

export async function removeMember(formData: FormData) {
  const shop = await ownerShop();
  const userId = String(formData.get("user_id") ?? "");
  if (!shop || !userId) return;
  const supabase = await createClient();
  // Only staff can be removed here; owners stay (and the DB keeps the last one).
  await supabase
    .from("shop_members")
    .delete()
    .eq("shop_id", shop.id)
    .eq("user_id", userId)
    .eq("role", "staff");
  refresh();
}
