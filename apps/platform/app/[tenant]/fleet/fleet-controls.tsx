"use client";

import { useEffect } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fleetViewCookie } from "@/lib/fleet-view";

/** Opens or closes every group on the page. The groups are native <details>. */
export function ExpandCollapse({
  expandLabel,
  collapseLabel,
}: {
  expandLabel: string;
  collapseLabel: string;
}) {
  const setAll = (open: boolean) => {
    for (const group of document.querySelectorAll<HTMLDetailsElement>(
      "details[data-fleet-group]",
    ))
      group.open = open;
  };
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 px-3"
        onClick={() => setAll(true)}
      >
        <ChevronsUpDown aria-hidden />
        {expandLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 px-3"
        onClick={() => setAll(false)}
      >
        <ChevronsDownUp aria-hidden />
        {collapseLabel}
      </Button>
    </div>
  );
}

/**
 * Remembers this person's last fleet view (grouping, filters, sort) on this
 * device, like the other per-device choices: opening Fleet again brings it
 * back. Saved views shared across devices arrive with reports (Phase 10).
 */
export function RememberView({ slug, query }: { slug: string; query: string }) {
  useEffect(() => {
    const name = fleetViewCookie(slug);
    document.cookie = query
      ? `${name}=${encodeURIComponent(query)}; path=/${slug}; max-age=31536000; samesite=lax`
      : `${name}=; path=/${slug}; max-age=0; samesite=lax`;
  }, [slug, query]);
  return null;
}
