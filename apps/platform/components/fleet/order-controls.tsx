import { getTranslations } from "next-intl/server";
import { ArrowDown, ArrowDownAZ, ArrowUp } from "lucide-react";
import {
  moveProduct,
  resetProductOrder,
} from "@/app/[tenant]/products/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonVariants } from "@/components/ui/button";
import { moveTarget } from "@/lib/general-products";
import { cn } from "@/lib/utils";

/**
 * The manual order, step one (owner, 13 Nov 2026): "Move up" and "Move down"
 * on each line of Fleet and of the Products list, and "Reset to A–Z". One
 * order per shop, shared by both lists; owners and managers change it,
 * everyone else sees it. Plain forms and buttons, so they work with a
 * finger, a mouse, a keyboard, and without JavaScript.
 */

const arrow =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40 disabled:hover:bg-card";

/**
 * The two forms a line's arrows submit. They sit outside the line itself:
 * on Fleet a line is a <summary>, which can't hold a form, so its buttons
 * point at these by id.
 */
export function MoveForms({
  slug,
  id,
  shown,
}: {
  slug: string;
  id: string;
  /** The lines on screen, in order. */
  shown: string[];
}) {
  return (
    <>
      {(["up", "down"] as const).map((direction) => {
        const move = moveTarget(shown, id, direction);
        if (!move) return null;
        return (
          <form
            key={direction}
            id={`move-${direction}-${id}`}
            action={moveProduct}
            hidden
          >
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="target" value={move.target} />
            <input type="hidden" name="place" value={move.place} />
          </form>
        );
      })}
    </>
  );
}

/** "Move up" and "Move down" for one line. The top line can't go up; the bottom one can't go down. */
export async function MoveButtons({
  id,
  name,
  shown,
}: {
  id: string;
  name: string;
  shown: string[];
}) {
  const t = await getTranslations("Products.order");
  return (
    <span className="-my-1 inline-flex shrink-0 gap-1">
      {(["up", "down"] as const).map((direction) => {
        const Icon = direction === "up" ? ArrowUp : ArrowDown;
        return (
          <button
            key={direction}
            type="submit"
            form={`move-${direction}-${id}`}
            disabled={!moveTarget(shown, id, direction)}
            aria-label={`${t(direction)}: ${name}`}
            title={t(direction)}
            className={arrow}
          >
            <Icon aria-hidden className="size-4" />
          </button>
        );
      })}
    </span>
  );
}

/**
 * Above a list, for owners and managers: "Reset to A–Z" while the shop has
 * its own order, and a line saying why the arrows are gone while a search or
 * filter is on.
 */
export async function OrderBar({
  slug,
  custom,
  filtered,
}: {
  slug: string;
  /** The shop has its own order. */
  custom: boolean;
  /** A search or filter is on: the order can't be changed in this view. */
  filtered: boolean;
}) {
  const t = await getTranslations("Products.order");
  if (!custom && !filtered) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        {filtered ? t("filtered") : t("custom")}
      </p>
      {custom && !filtered && (
        <form action={resetProductOrder}>
          <input type="hidden" name="slug" value={slug} />
          {/* It wipes a hand-made order, so it asks first. */}
          <ConfirmSubmit
            question={t("resetConfirm")}
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
          >
            <ArrowDownAZ aria-hidden />
            {t("reset")}
          </ConfirmSubmit>
        </form>
      )}
    </div>
  );
}
