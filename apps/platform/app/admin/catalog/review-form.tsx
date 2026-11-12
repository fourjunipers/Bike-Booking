"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { reviewRequest, type ReviewState } from "./actions";

export function ReviewForm({
  id,
  presets,
}: {
  id: string;
  /** Approved entries to merge into, closest matches first. */
  presets: { value: string; label: string }[];
}) {
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
        aria-describedby={`notes-help-${id}`}
        className={inputClass}
      />
      <p id={`notes-help-${id}`} className="text-xs text-muted-foreground">
        {t("notesHelp")}
      </p>
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
      <div className="flex flex-wrap items-end gap-2 border-t pt-3">
        <div className="min-w-0 flex-1">
          <label
            htmlFor={`merge-${id}`}
            className="mb-1.5 block text-sm font-medium"
          >
            {t("mergeInto")}
          </label>
          <select id={`merge-${id}`} name="merge_into" className={inputClass}>
            {presets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="submit"
          name="decision"
          value="merge"
          variant="outline"
          className="h-11 px-5"
          disabled={pending || presets.length === 0}
        >
          {t("merge")}
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
