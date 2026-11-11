import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { createClient } from "@mango/db/platform-server";

/**
 * Where a bike's QR sticker points. Signed-out people sign in first and come
 * back here (proxy.ts). RLS decides the rest: a member of the bike's shop is
 * sent to the bike; anyone else gets "not found", the same as for a made-up
 * code, so a sticker reveals nothing to someone outside the shop.
 */
export default async function StickerPage({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) notFound();

  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/q/${token}`)}`);

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select("id, tenant:tenants!inner(slug)")
    .eq("qr_token", token)
    .maybeSingle();
  if (!unit) notFound();
  redirect(`/${unit.tenant.slug}/fleet/units/${unit.id}`);
}
