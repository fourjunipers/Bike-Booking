import { redirect } from "next/navigation";
import { homeTab } from "@/lib/roles";
import { requireMembership } from "@/lib/session";

/** "/<shop>" opens the role's home tab (a mechanic lands on Maintenance). */
export default async function TenantHome({ params }: PageProps<"/[tenant]">) {
  const { tenant } = await params;
  const { membership } = await requireMembership(tenant);
  redirect(`/${membership.tenant.slug}/${homeTab(membership.role)}`);
}
