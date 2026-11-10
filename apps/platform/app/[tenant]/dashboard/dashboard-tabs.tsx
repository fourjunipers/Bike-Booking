"use client";

import type { ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import type { DashboardTab } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export type DashboardTabView = {
  key: DashboardTab;
  label: string;
  count: number;
  /** Screen-reader text for the count, e.g. "3 items". */
  countLabel: string;
  /** Late with something in it: shown in the highlight colours. */
  alert: boolean;
  panel: ReactNode;
};

/**
 * The four dashboard tabs. Switching is instant (every panel is already on
 * the page) and keeps `?view=` in the address, so Refresh, Back and a
 * bookmark reopen the same tab. Arrow keys move between tabs.
 */
export function DashboardTabs({
  tabs,
  initial,
  label,
}: {
  tabs: DashboardTabView[];
  initial: DashboardTab;
  label: string;
}) {
  return (
    <Tabs.Root
      defaultValue={initial}
      onValueChange={(value) => {
        const url = new URL(window.location.href);
        if (value === "today") url.searchParams.delete("view");
        else url.searchParams.set("view", String(value));
        window.history.replaceState(null, "", url);
      }}
    >
      <Tabs.List
        aria-label={label}
        className="grid grid-cols-4 gap-1 rounded-lg border bg-card p-1"
      >
        {tabs.map((tab) => (
          <Tabs.Tab
            key={tab.key}
            value={tab.key}
            className={cn(
              "flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border border-transparent px-1 py-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:gap-2",
              "data-active:bg-primary data-active:text-primary-foreground data-active:hover:bg-primary",
              tab.alert &&
                "border-highlight-border bg-highlight text-highlight-foreground hover:bg-highlight hover:text-highlight-foreground",
            )}
          >
            <span className="max-w-full truncate">{tab.label}</span>
            <span
              aria-hidden
              data-alert={tab.alert || undefined}
              className={cn(
                "min-w-6 rounded-full px-1.5 text-center text-xs leading-5 tabular-nums",
                "bg-muted text-foreground",
                "in-data-active:bg-white/20 in-data-active:text-primary-foreground",
                tab.alert && "bg-primary text-primary-foreground",
              )}
            >
              {tab.count}
            </span>
            <span className="sr-only">({tab.countLabel})</span>
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Panel
          key={tab.key}
          value={tab.key}
          keepMounted
          className="mt-5 outline-none data-hidden:hidden"
        >
          {tab.panel}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
