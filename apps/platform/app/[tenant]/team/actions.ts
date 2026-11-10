"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { roles } from "@/lib/roles";
import { requireMembership } from "@/lib/session";
import { createClient } from "@mango/db/server";

export type TeamActionState = {
  error?: "errorLastOwner" | "errorNotAllowed" | "errorGeneric";
  ok?: boolean;
};

const input = z.object({
  slug: z.string().min(1),
  membershipId: z.uuid(),
  intent: z.enum(["role", "remove"]),
  role: z.enum(roles).optional(),
});

/**
 * Changes a member's role or removes them. The database functions decide who
 * may do what (platform_private.assert_can_change); this maps their answer to
 * a message.
 */
export async function changeMember(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const parsed = input.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "errorGeneric" };
  const { slug, membershipId, intent, role } = parsed.data;

  await requireMembership(slug);
  const supabase = await createClient();
  const { error } =
    intent === "remove"
      ? await supabase.rpc("remove_member", { p_membership_id: membershipId })
      : role
        ? await supabase.rpc("set_member_role", {
            p_membership_id: membershipId,
            p_role: role,
          })
        : { error: { code: "invalid", message: "" } };

  if (error) {
    if (error.message === "A shop needs at least one owner")
      return { error: "errorLastOwner" };
    if (error.code === "42501") return { error: "errorNotAllowed" };
    return { error: "errorGeneric" };
  }
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}
