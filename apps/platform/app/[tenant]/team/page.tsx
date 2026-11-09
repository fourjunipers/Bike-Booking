import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { assignableRoles, canChangeMember, roles } from "@/lib/roles";
import { createClient } from "@mango/db/server";
import { MemberRow, type MemberView } from "./member-row";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("team") };
}

/** Team (SPEC › Team, settings and platform): who works here and their role. */
export default async function TeamPage({
  params,
}: PageProps<"/[tenant]/team">) {
  const { tenant: slug } = await params;
  const { user, membership } = await requireArea(slug, "team");
  const supabase = await createClient();
  const [{ data, error }, t, tRoles] = await Promise.all([
    supabase.rpc("tenant_members", { p_tenant_id: membership.tenant.id }),
    getTranslations("Team"),
    getTranslations("Roles"),
  ]);
  if (error) throw error;

  const actor = membership.role;
  const members: MemberView[] = (data ?? [])
    .sort(
      (a, b) =>
        roles.indexOf(a.role) - roles.indexOf(b.role) ||
        (a.name ?? a.email).localeCompare(b.name ?? b.email),
    )
    .map((m) => ({
      membershipId: m.membership_id,
      name: m.name || m.email,
      email: m.email,
      role: m.role,
      isYou: m.user_id === user.id,
      roleOptions: canChangeMember(actor, m.role, m.role)
        ? assignableRoles(actor)
            .filter((r) => canChangeMember(actor, m.role, r))
            .map((r) => ({ value: r, label: tRoles(r) }))
        : [],
      canRemove: canChangeMember(actor, m.role, null),
    }));

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro", { shop: membership.tenant.name })}
      />
      <div className="overflow-hidden rounded-lg border bg-card">
        <div
          aria-hidden
          className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)] gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid"
        >
          <span>{t("name")}</span>
          <span>{t("email")}</span>
          <span>{t("role")}</span>
        </div>
        <ul className="divide-y">
          {members.map((member) => (
            <MemberRow
              key={member.membershipId}
              slug={slug}
              member={member}
              roleLabel={tRoles(member.role)}
            />
          ))}
        </ul>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{t("inviteLater")}</p>
    </>
  );
}
