import { getTranslations } from "next-intl/server";
import { ArrowDown, ArrowUp } from "lucide-react";
import { moveProduct } from "@/app/[tenant]/products/actions";
import { moveTarget } from "@/lib/general-products";

/**
 * The manual order (owner, 13 and 14 Nov 2026): one order per shop, shared by
 * Fleet and the Products list; owners and managers change it, everyone else
 * sees it. "Reorder" above a list (components/fleet/list-bits ListToolbar)
 * turns on reorder mode, where each line shows quiet "Move up" and "Move
 * down" arrows. Plain forms and buttons, so they work with a finger, a mouse,
 * a keyboard, and without JavaScript.
 */

/** Small to see, 44 px to tap. */
const arrow =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground/80 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:hover:bg-transparent";

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

/**
 * "Move up" and "Move down" for one line, in reorder mode. The top line can't
 * go up; the bottom one can't go down. Dragging comes later (design §5.8):
 * the handle goes first in this group, before the arrows, in the row's last
 * column (rowGrid({ reorder: true })).
 */
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
    <span data-reorder className="-my-2.5 inline-flex shrink-0">
      {/* A drag handle goes here. */}
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
