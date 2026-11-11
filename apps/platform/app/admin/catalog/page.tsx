import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page";
import { SignOutButton } from "@/components/sign-out-button";
import { catalogName, type CatalogEntry } from "@/lib/fleet-data";
import { getUser } from "@/lib/session";
import { createClient } from "@mango/db/platform-server";
import { ReviewForm } from "./review-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("title") };
}

/**
 * Catalog requests for Mango Works staff. Platform admins are the rows of
 * platform.platform_admins (the one place that role is defined); anyone else
 * gets "not found". The rest of platform admin arrives in Phase 11.
 */
export default async function AdminCatalogPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fcatalog");
  const supabase = await createClient();
  // RLS shows a user only their own row, so any row means "admin".
  const { data: admin } = await supabase
    .from("platform_admins")
    .select("user_id")
    .maybeSingle();
  if (!admin) notFound();

  const [t, tFleet, tNav, requests] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Fleet"),
    getTranslations("Nav"),
    supabase
      .schema("public")
      .from("bike_catalog")
      .select(
        "id, slug, make, model, year_from, year_to, cc, type, transmission, status, request_note, requested_by_tenant_id",
      )
      .eq("status", "requested")
      .not("requested_by_tenant_id", "is", null)
      .order("created_at"),
  ]);
  if (requests.error) throw requests.error;

  return (
    <NextIntlClientProvider>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <PageHeader
          title={t("title")}
          intro={t("intro")}
          actions={<SignOutButton label={tNav("signOut")} />}
        />
        {requests.data.length === 0 ? (
          <p className="rounded-lg border bg-card p-5 text-muted-foreground">
            {t("none")}
          </p>
        ) : (
          <ul className="space-y-4">
            {requests.data.map((entry) => (
              <li key={entry.id} className="rounded-lg border bg-card p-4">
                <p className="font-semibold">
                  {catalogName(entry as CatalogEntry)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[
                    `${entry.cc} cc`,
                    tFleet(`type.${entry.type}`),
                    tFleet(`transmission.${entry.transmission}`),
                  ].join(" · ")}
                </p>
                {entry.request_note && (
                  <p className="mt-2 text-sm">“{entry.request_note}”</p>
                )}
                <div className="mt-4">
                  <ReviewForm id={entry.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </NextIntlClientProvider>
  );
}
