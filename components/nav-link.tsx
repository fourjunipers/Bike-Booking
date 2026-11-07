"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const linkClass =
  "inline-flex min-h-11 items-center rounded-md px-3 font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground aria-[current=page]:font-semibold";

/**
 * A navigation link that marks the current section (aria-current + style).
 * The pathname is request data, so the marking streams in inside Suspense
 * and a plain link renders meanwhile.
 */
export function NavLink(props: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <Link href={props.href} className={linkClass}>
          {props.children}
        </Link>
      }
    >
      <ActiveLink {...props} />
    </Suspense>
  );
}

function ActiveLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={linkClass}
    >
      {children}
    </Link>
  );
}
