import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { isCustomerLocale, localePath } from "@/i18n/config";
import { getMyProfile, requireUser } from "@/lib/auth/session";
import { ProfileForm } from "./profile-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  if (!isCustomerLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("title") };
}

// TODO(phase-5): saved cards.
export default async function AccountPage({
  params,
}: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });

  return (
    <section className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Suspense
        fallback={<p className="text-muted-foreground">{t("loading")}</p>}
      >
        <Account
          next={
            isCustomerLocale(locale)
              ? localePath(locale, "/account")
              : "/account"
          }
          signOutLabel={t("signOut")}
        />
      </Suspense>
    </section>
  );
}

async function Account({
  next,
  signOutLabel,
}: {
  next: string;
  signOutLabel: string;
}) {
  const user = await requireUser(next);
  const profile = await getMyProfile();

  return (
    <>
      <ProfileForm
        name={profile?.name ?? ""}
        email={profile?.email ?? user.email ?? ""}
        whatsapp={profile?.whatsapp ?? ""}
        notify={
          profile?.notify_channels.includes("whatsapp")
            ? "email_whatsapp"
            : "email"
        }
      />
      <SignOutButton label={signOutLabel} />
    </>
  );
}
