"use client";

import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { deleteModel } from "../fleet/actions";

/**
 * "Delete product", the last thing on a product's page (owner, 13 Nov 2026).
 * A product can be deleted only when it has no vehicles at all, retired and
 * sold ones included: they hold its history. While any remain, the button
 * says so in a pop-up and does nothing else. The database refuses too (a
 * vehicle points at its product), so the rule can't be got round.
 */
export function DeleteProductButton({
  slug,
  id,
  hasVehicles,
  label,
  confirm,
  blocked,
  general,
}: {
  slug: string;
  id: string;
  hasVehicles: boolean;
  label: string;
  /** Asked before deleting. */
  confirm: string;
  /** "This product still has vehicles. Remove all its vehicles first." */
  blocked: string;
  /** A general product: what holds it is its stock, and the refusal says so. */
  general?: boolean;
}) {
  if (hasVehicles)
    return (
      <Button
        type="button"
        variant="outline"
        className="h-11 border-destructive/40 px-5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => window.alert(blocked)}
      >
        {label}
      </Button>
    );
  return (
    <ActionForm
      action={deleteModel}
      hidden={{ slug, id, ...(general ? { general: "1" } : {}) }}
      submitLabel={label}
      confirm={confirm}
      destructive
    />
  );
}
