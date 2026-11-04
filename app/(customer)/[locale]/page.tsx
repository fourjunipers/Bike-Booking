import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isCustomerLocale } from "@/i18n/config";
import { languageAlternates } from "@/i18n/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isCustomerLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "Customer" });
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: languageAlternates(locale, "/"),
  };
}

// TODO(phase-3): home screen (location, dates, bike types, Get your bike now).
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Customer" });

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("intro")}</p>
    </section>
  );
}
