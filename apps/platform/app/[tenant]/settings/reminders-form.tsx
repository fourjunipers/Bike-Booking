"use client";

import { useTranslations } from "next-intl";
import { ActionForm, SelectInput, TextInput } from "@/components/action-form";
import { saveReminders } from "./actions";

/**
 * Tax and insurance reminders (SPEC › Fleet › Renewal reminders): how many
 * days before an expiry a reminder is due, and an optional monthly digest.
 * The largest number also decides when a renewal first shows on the dashboard.
 */
export function RemindersForm({
  slug,
  days,
  digestDay,
}: {
  slug: string;
  days: number[];
  digestDay: number | null;
}) {
  const t = useTranslations("Settings.reminders");
  return (
    <ActionForm action={saveReminders} hidden={{ slug }}>
      <div className="grid gap-5 md:grid-cols-2">
        <TextInput
          name="renewal_reminder_days"
          label={t("days")}
          help={t("daysHelp")}
          inputMode="numeric"
          defaultValue={days.join(", ")}
        />
        <SelectInput
          name="renewal_digest_day"
          label={t("digest")}
          help={t("digestHelp")}
          defaultValue={digestDay === null ? "" : String(digestDay)}
          options={[
            { value: "", label: t("digestOff") },
            ...Array.from({ length: 28 }, (_, i) => ({
              value: String(i + 1),
              label: t("digestDay", { day: i + 1 }),
            })),
          ]}
        />
      </div>
    </ActionForm>
  );
}
