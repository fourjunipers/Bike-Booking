"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavIcon, type NavItem } from "./nav";

function useActive(href: string) {
  const pathname = usePathname();
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A sidebar row (desktop). */
export function SidebarLink({ item }: { item: NavItem }) {
  const active = useActive(item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "bg-highlight text-highlight-foreground",
      )}
    >
      <NavIcon
        navKey={item.key}
        className={cn("size-5", active && "text-primary-text")}
      />
      {item.label}
    </Link>
  );
}

/** One tab of the phone tab bar: icon over label, at least 44 px tall. */
export function TabLink({ item }: { item: NavItem }) {
  const active = useActive(item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[0.7rem] font-medium text-muted-foreground focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
        // Selected: orange label and icon, and an orange bar on the edge.
        active &&
          "text-primary-text after:absolute after:inset-x-3 after:top-0 after:h-0.5 after:rounded-full after:bg-primary",
      )}
    >
      <NavIcon navKey={item.key} className="size-6" />
      <span className="max-w-full truncate">{item.label}</span>
    </Link>
  );
}
