import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page";
import { requireTab } from "@/lib/access";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("new-order") };
}

/** The booking steps (SPEC › Staff app 3) and the phase that builds each. */
const steps = [
  { key: "dates", phase: 3 },
  { key: "bike", phase: 3 },
  { key: "customer", phase: 4 },
  { key: "extras", phase: 3 },
  { key: "price", phase: 3 },
  { key: "sign", phase: 5 },
  { key: "pay", phase: 7 },
] as const;

export default async function NewOrderPage({
  params,
}: PageProps<"/[tenant]/new-order">) {
  const { tenant: slug } = await params;
  await requireTab(slug, "new-order");
  const [t, tCommon] = await Promise.all([
    getTranslations("NewOrder"),
    getTranslations("Common"),
  ]);

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step, i) => (
          <li
            key={step.key}
            className="flex items-center gap-4 rounded-lg border bg-card p-4"
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-semibold"
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium">{t(step.key)}</p>
              <p className="text-sm text-muted-foreground">
                {tCommon("comingIn", { phase: step.phase })}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
