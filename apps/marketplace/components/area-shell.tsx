import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/** Placeholder chrome shared by the three areas until each gets real navigation. */
export function AreaShell({
  area,
  wide = false,
  nav,
  homeHref = "/",
  accountHref = "/account",
  children,
}: {
  area: string;
  /** Dashboards use the full desktop width (CLAUDE.md: desktop layouts). */
  wide?: boolean;
  /** Area navigation shown under the header. */
  nav?: React.ReactNode;
  /** Customer pages keep their language prefix on these links. */
  homeHref?: string;
  accountHref?: string;
  children: React.ReactNode;
}) {
  const width = wide ? "max-w-6xl" : "max-w-3xl";
  const areas = [
    { href: homeHref, label: "Customer" },
    { href: "/admin", label: "Admin" },
    { href: accountHref, label: "Account" },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card shadow-sm">
        <div className="relative overflow-hidden bg-navy text-white">
          {/* Mango stripe along the bottom of the bar. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-r from-sun via-mango to-mango-strong"
          />
          <nav
            aria-label="Areas"
            className={`mx-auto flex ${width} flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm`}
          >
            <Link
              href={homeHref}
              className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun"
            >
              <Logo />
            </Link>
            {/* Customers see only the brand; staff areas say where they are. */}
            {area !== "Customer" && (
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold tracking-wide">
                {area}
              </span>
            )}
            <ul className="ml-auto flex flex-wrap justify-end gap-x-3 gap-y-1">
              {areas.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="inline-flex min-h-11 items-center rounded-full px-2 font-semibold text-white/90 underline-offset-4 hover:text-sun hover:underline focus-visible:outline-2 focus-visible:outline-sun"
                  >
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        {nav}
      </header>
      <main className={`mx-auto w-full ${width} flex-1 px-4 py-6 md:py-8`}>
        {children}
      </main>
    </div>
  );
}
