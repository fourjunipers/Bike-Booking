import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { isCustomerLocale, localePath } from "@/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { JoinForm } from "./join-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/join">): Promise<Metadata> {
  const { locale } = await params;
  if (!isCustomerLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "Join" });
  return { title: t("title") };
}

/**
 * Staff invite link (/account/join?token=…). Sign-in comes first (proxy.ts
 * sends signed-out visitors to /login and back here). Invite links have no
 * language prefix, so a Thai line helps shop staff on the English page.
 */
export default async function JoinPage({
  params,
  searchParams,
}: PageProps<"/[locale]/account/join">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Join" });
  const tTh = await getTranslations({ locale: "th", namespace: "Join" });

  return (
    <section className="mx-auto max-w-sm space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {locale !== "th" && (
          <p lang="th" className="text-muted-foreground">
            {tTh("title")}
          </p>
        )}
      </div>
      <Suspense
        fallback={<p className="text-muted-foreground">{t("loading")}</p>}
      >
        <Join
          searchParams={searchParams}
          path={
            isCustomerLocale(locale)
              ? localePath(locale, "/account/join")
              : "/account/join"
          }
          incomplete={t("incomplete")}
        />
      </Suspense>
    </section>
  );
}

async function Join({
  searchParams,
  path,
  incomplete,
}: Pick<PageProps<"/[locale]/account/join">, "searchParams"> & {
  path: string;
  incomplete: string;
}) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  await requireUser(`${path}?token=${encodeURIComponent(value)}`);
  if (!value) return <p role="alert">{incomplete}</p>;
  return <JoinForm token={value} />;
}
