import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** "‹ Fleet" above a page title: one tap back up, 44 px tall. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 mb-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft aria-hidden className="size-4" />
      {label}
    </Link>
  );
}
