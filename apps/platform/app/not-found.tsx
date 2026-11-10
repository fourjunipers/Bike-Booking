import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <main className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("body")}</p>
      <Link href="/" className={buttonVariants({ className: "h-10 w-fit" })}>
        {t("home")}
      </Link>
    </main>
  );
}
