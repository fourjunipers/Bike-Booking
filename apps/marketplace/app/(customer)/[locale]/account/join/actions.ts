"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@mango/db/server";

export type JoinState = { status: "idle" } | { status: "error" };

export async function acceptInvite(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  if (!(await getCurrentUser())) return { status: "error" };
  const token = String(formData.get("token") ?? "");
  if (!token || token.length > 200) return { status: "error" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_shop_invite", {
    p_token: token,
  });
  if (error) return { status: "error" };
  redirect("/vendor");
}
