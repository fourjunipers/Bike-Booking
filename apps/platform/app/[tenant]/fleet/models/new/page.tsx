import { redirect } from "next/navigation";

/** The old address of "New product" (before 13 Nov 2026): kept as a redirect. */
export default async function OldNewModelPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/fleet/models/new">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const kept = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (typeof value === "string") kept.set(key, value);
  const suffix = kept.size > 0 ? `?${kept}` : "";
  redirect(`/${slug}/products/new${suffix}`);
}
