import { redirect } from "next/navigation";

/** The old address of a product's page (before 13 Nov 2026): kept as a redirect. */
export default async function OldModelPage({
  params,
}: PageProps<"/[tenant]/fleet/models/[id]">) {
  const { tenant: slug, id } = await params;
  redirect(`/${slug}/products/${encodeURIComponent(id)}`);
}
