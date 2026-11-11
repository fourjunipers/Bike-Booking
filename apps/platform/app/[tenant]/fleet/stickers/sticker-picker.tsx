"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export type StickerItem = {
  id: string;
  plate: string;
  detail: string;
  /** The QR code as inline SVG markup. */
  svg: string;
};

/**
 * Tick the bikes to print, or all of the ones listed. On paper only the ticked
 * stickers appear: the checkboxes, the toolbar and the app shell are hidden.
 */
export function StickerPicker({
  items,
  preselected,
}: {
  items: StickerItem[];
  preselected: string[];
}) {
  const t = useTranslations("Fleet");
  const [selected, setSelected] = useState(() => new Set(preselected));
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const count = items.filter((i) => selected.has(i.id)).length;

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  if (items.length === 0)
    return (
      <p className="rounded-lg border bg-card p-5 text-muted-foreground">
        {t("view.noneMatch")}
      </p>
    );

  return (
    <>
      <div className="sticky top-14 z-10 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 lg:top-0 print:hidden">
        <label className="flex min-h-11 items-center gap-3 font-medium">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={allSelected}
            onChange={(event) =>
              setSelected(
                event.target.checked ? new Set(items.map((i) => i.id)) : new Set(),
              )
            }
          />
          {t("sticker.selectAll", { count: items.length })}
        </label>
        <div className="flex items-center gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            {t("sticker.selected", { count })}
          </p>
          <Button
            type="button"
            className="h-11 px-5"
            disabled={count === 0}
            onClick={() => window.print()}
          >
            <Printer aria-hidden />
            {t("sticker.printAll")}
          </Button>
        </div>
      </div>
      <ul className="sticker-sheet divide-y overflow-hidden rounded-lg border bg-card print:grid print:grid-cols-3 print:gap-3 print:divide-y-0 print:overflow-visible print:rounded-none print:border-0 print:bg-white">
        {items.map((item) => {
          const on = selected.has(item.id);
          return (
            <li
              key={item.id}
              data-selected={on}
              className="print:hidden print:break-inside-avoid print:rounded-md print:border print:border-black print:p-3 print:text-center print:text-black data-[selected=true]:print:block"
            >
              <label className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-2 hover:bg-muted print:block print:p-0">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-primary print:hidden"
                  checked={on}
                  onChange={(event) => toggle(item.id, event.target.checked)}
                />
                <span className="min-w-0 flex-1 print:block">
                  <span className="block truncate font-medium print:text-base print:font-semibold">
                    {item.plate}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground print:text-xs print:text-black">
                    {item.detail}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="block w-12 shrink-0 rounded bg-white p-0.5 print:order-first print:mx-auto print:mb-1 print:w-full print:max-w-40 print:p-0"
                  dangerouslySetInnerHTML={{ __html: item.svg }}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );
}
