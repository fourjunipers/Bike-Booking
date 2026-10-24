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
  children,
}: {
  area: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <nav
          aria-label="Areas"
          className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 text-sm"
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
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
