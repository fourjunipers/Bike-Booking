import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { enabledProviders } from "@/lib/auth/providers";
import { safeNextPath } from "@/lib/auth/redirect";
import { getUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Login");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(
    typeof params.next === "string" ? params.next : null,
  );
  if (await getUser()) redirect(next);

  const t = await getTranslations("Login");
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- static PWA icon */}
        <img src="/icons/icon-192.png" alt="" width={48} height={48} />
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <LoginForm
        providers={enabledProviders()}
        next={next}
        error={error === "signin" || error === "link" ? error : null}
      />
    </main>
  );
}
