import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { isCustomerLocale } from "@/i18n/config";
import { languageAlternates } from "@/i18n/metadata";
import { enabledProviders } from "@/lib/auth/providers";
import { LoginForm } from "./login-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  if (!isCustomerLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "Login" });
  return {
    title: t("title"),
    alternates: languageAlternates(locale, "/login"),
  };
}

export default async function LoginPage({
  params,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Login" });

  return (
    <section className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {/* The form reads ?next and ?error from the URL. */}
      <Suspense>
        <LoginForm providers={enabledProviders()} />
      </Suspense>
    </section>
  );
}
