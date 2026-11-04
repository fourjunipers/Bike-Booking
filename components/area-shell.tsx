import Link from "next/link";

const areas = [
  { href: "/", label: "Customer" },
  { href: "/vendor", label: "Vendor" },
  { href: "/admin", label: "Admin" },
  { href: "/account", label: "Account" },
] as const;

/** Placeholder chrome shared by the three areas until each gets real navigation. */
export function AreaShell({
  area,
  wide = false,
  nav,
  children,
}: {
  area: string;
  /** Dashboards use the full desktop width (CLAUDE.md: desktop layouts). */
  wide?: boolean;
  /** Area navigation shown under the header. */
  nav?: React.ReactNode;
  children: React.ReactNode;
}) {
  const width = wide ? "max-w-6xl" : "max-w-3xl";
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <nav
          aria-label="Areas"
          className={`mx-auto flex ${width} items-center gap-4 px-4 py-3 text-sm`}
        >
          <span className="font-semibold">{area}</span>
          <ul className="ml-auto flex flex-wrap justify-end gap-x-3 gap-y-1">
            {areas.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="underline-offset-4 hover:underline"
                >
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {nav}
      </header>
      <main className={`mx-auto w-full ${width} flex-1 px-4 py-6 md:py-8`}>
        {children}
      </main>
    </div>
  );
}
