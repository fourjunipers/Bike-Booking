"use client";

import { ActionForm, CheckboxGroup, TextField } from "@/components/form-kit";
import type { ActionState } from "@/lib/forms";

const LINES = [
  ["BTS_SUKHUMVIT", "BTS Sukhumvit"],
  ["BTS_SILOM", "BTS Silom"],
  ["BTS_GOLD", "BTS Gold"],
  ["MRT_BLUE", "MRT Blue"],
  ["MRT_PURPLE", "MRT Purple"],
  ["MRT_YELLOW", "MRT Yellow"],
  ["MRT_PINK", "MRT Pink"],
  ["ARL", "Airport Rail Link"],
  ["SRT_DARK_RED", "SRT Dark Red"],
  ["SRT_LIGHT_RED", "SRT Light Red"],
] as const;

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function StationForm({
  action,
  station,
}: {
  action: Action;
  station?: {
    name_en: string;
    name_th: string | null;
    lines: string[];
    lat: number;
    lng: number;
  };
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="name_en"
          label="Name (English)"
          defaultValue={station?.name_en}
        />
        <TextField
          name="name_th"
          label="Name (Thai)"
          defaultValue={station?.name_th}
        />
        <TextField
          name="lat"
          label="Latitude"
          inputMode="decimal"
          defaultValue={station?.lat}
        />
        <TextField
          name="lng"
          label="Longitude"
          inputMode="decimal"
          defaultValue={station?.lng}
        />
      </div>
      <CheckboxGroup
        name="lines"
        legend="Lines"
        options={LINES.map(([value, label]) => ({ value, label }))}
        defaultValues={station?.lines ?? []}
      />
    </ActionForm>
  );
}
