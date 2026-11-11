"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { reviewRequest, type ReviewState } from "./actions";

export function ReviewForm({ id }: { id: string }) {
  const t = useTranslations("Admin");
  const [state, action, pending] = useActionState<ReviewState, FormData>(
    reviewRequest,
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`notes-${id}`} className="sr-only">
        {t("notes")}
      </label>
      <input
        id={`notes-${id}`}
        name="notes"
        maxLength={500}
        placeholder={t("notes")}
        className={inputClass}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="decision"
          value="approve"
          className="h-11 px-5"
          disabled={pending}
        >
          {t("approve")}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          variant="outline"
          className="h-11 px-5"
          disabled={pending}
        >
          {t("reject")}
        </Button>
      </div>
      {state.failed && (
        <p role="alert" className="text-sm text-destructive">
          {t("failed")}
        </p>
      )}
    </form>
  );
}
