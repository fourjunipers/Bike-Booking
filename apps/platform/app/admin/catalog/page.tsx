import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page";
import { SignOutButton } from "@/components/sign-out-button";
import { suggestCatalog } from "@/lib/catalog-match";
import { catalogName, getCatalog, type CatalogEntry } from "@/lib/fleet-data";
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
export default async function AdminCatalogPage({
  searchParams,
}: PageProps<"/admin/catalog">) {
  const kept = Number((await searchParams).kept) || 0;
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
    // The shop's note and name are private: only this function returns
    // them, and only to a platform admin.
    supabase.rpc("catalog_requests"),
  ]);
  if (requests.error) throw requests.error;
  const presets = await getCatalog();

  return (
    <NextIntlClientProvider>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <PageHeader
          title={t("title")}
          intro={t("intro")}
          actions={<SignOutButton label={tNav("signOut")} />}
        />
        {kept > 0 && (
          <p
            role="status"
            className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          >
            {t("keptLinked", { count: kept })}
          </p>
        )}
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
                <p className="text-sm text-muted-foreground">
                  {t("requestedBy", { shop: entry.requested_by_tenant_name })}
                </p>
                {entry.request_note && (
                  <p className="mt-2 text-sm">“{entry.request_note}”</p>
                )}
                <div className="mt-4">
                  <ReviewForm
                    id={entry.id}
                    presets={[
                      // "Did you mean" first, then every preset.
                      ...suggestCatalog(entry.make, entry.model, presets),
                      ...presets,
                    ]
                      .filter(
                        (preset, i, all) =>
                          all.findIndex((x) => x.id === preset.id) === i,
                      )
                      .map((preset) => ({
                        value: preset.id,
                        label: catalogName(preset),
                      }))}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </NextIntlClientProvider>
  );
}
