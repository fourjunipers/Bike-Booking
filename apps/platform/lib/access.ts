import "server-only";
import { notFound, redirect } from "next/navigation";
import {
  canSeeArea,
  canSeeTab,
  homeTab,
  type AdminArea,
  type StaffTab,
} from "./roles";
import { requireMembership } from "./session";

/** A staff tab page: members whose role lacks the tab go to their home tab. */
export async function requireTab(slug: string, tab: StaffTab) {
  const access = await requireMembership(slug);
  const { role, tenant } = access.membership;
  if (!canSeeTab(role, tab)) redirect(`/${tenant.slug}/${homeTab(role)}`);
  return access;
}

/** A shop-admin page (team, settings): owners and managers only. */
export async function requireArea(slug: string, area: AdminArea) {
  const access = await requireMembership(slug);
  if (!canSeeArea(access.membership.role, area)) notFound();
  return access;
}
