import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join a shop team" };

/**
 * Staff invite link (/account/join?token=…). Sign-in comes first (proxy.ts
 * sends signed-out visitors to /login and back here). The customer site is
 * English only; a Thai line helps shop staff.
 */
export default function JoinPage({ searchParams }: PageProps<"/account/join">) {
  return (
    <section className="mx-auto max-w-sm space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Join a shop team</h1>
        <p lang="th" className="text-muted-foreground">
          เข้าร่วมทีมร้าน
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Join searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Join({
  searchParams,
}: Pick<PageProps<"/account/join">, "searchParams">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  await requireUser(`/account/join?token=${encodeURIComponent(value)}`);
  if (!value) {
    return (
      <p role="alert">
        This invite link is incomplete. Ask the shop owner for a new one.
      </p>
    );
  }
  return <JoinForm token={value} />;
}
