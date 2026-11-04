"use client";

import { useTranslations } from "next-intl";
import { ActionForm, CheckboxField } from "@/components/form-kit";
import { submitForReview } from "./actions/shop";

/** Vendor terms (SPEC "Vendor terms") and the submit button. */
export function SubmitForm({ ready }: { ready: boolean }) {
  const t = useTranslations("Home");
  return (
    <ActionForm action={submitForReview} submitLabel={t("submit")}>
      <div className="space-y-3 rounded-lg border p-4">
        <h3 className="font-semibold">{t("termsTitle")}</h3>
        <ol className="list-decimal space-y-1 pl-5">
          <li>{t("term1")}</li>
          <li>{t("term2")}</li>
          <li>{t("term3")}</li>
          <li>{t("term4")}</li>
        </ol>
        <CheckboxField name="accept_terms" label={t("acceptTerms")} />
      </div>
      {!ready && (
        <p className="text-sm text-muted-foreground">{t("notReadyHint")}</p>
      )}
    </ActionForm>
  );
}
