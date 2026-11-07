import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isCustomerLocale } from "@/i18n/config";
import { languageAlternates } from "@/i18n/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  if (!isCustomerLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: languageAlternates(locale, "/privacy"),
  };
}

const SECTIONS = ["collect", "shops", "payments", "google", "choices"] as const;

/**
 * Marketplace privacy notice (owner decision, 2026-11-07): booking details
 * are shared with the shop, which manages them on the Mango Works platform.
 * TODO(phase-8): legal review, company name and contact address.
 */
export default async function PrivacyPage({
  params,
}: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isCustomerLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("draft")}</p>
      </header>
      {SECTIONS.map((s) => (
        <section
          key={s}
          id={s}
          className={`space-y-2 rounded-xl border bg-card p-4 shadow-sm md:p-6 ${s === "shops" ? "border-primary/50" : ""}`}
        >
          <h2 className="text-xl font-semibold">{t(`${s}Title`)}</h2>
          <p>{t(s)}</p>
        </section>
      ))}
    </article>
  );
}
