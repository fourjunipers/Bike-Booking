import Image from "next/image";
import Link from "next/link";

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
        <div className="relative bg-card text-foreground">
          {/* Mango stripe along the bottom of the bar. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-r from-sun via-mango to-mango-strong"
          />
          <nav
            aria-label="Areas"
            className={`mx-auto flex ${width} flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm`}
          >
            {/* The customer area links to its language's home page. */}
            <Link
              href={homeHref}
              className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Image
                src="/logo.png"
                alt="Moto Mangos – motorbike rental in Thailand"
                width={710}
                height={290}
                priority
                className="h-12 w-auto md:h-14"
              />
            </Link>
            {/* Customers see only the brand; staff areas say where they are. */}
            {area !== "Customer" && (
              <span className="rounded-full bg-muted px-3 py-1 font-semibold tracking-wide">
                {area}
              </span>
            )}
            <ul className="ml-auto flex flex-wrap justify-end gap-x-3 gap-y-1">
              {areas.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="inline-flex min-h-11 items-center rounded-full px-2 font-semibold text-foreground underline-offset-4 hover:text-link hover:underline focus-visible:outline-2 focus-visible:outline-ring"
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
