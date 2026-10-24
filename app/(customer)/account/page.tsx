import type { Metadata } from "next";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { getMyProfile, requireUser } from "@/lib/auth/session";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your account" };

// TODO(phase-5): saved cards.
export default function AccountPage() {
  return (
    <section className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">Your account</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Account />
      </Suspense>
    </section>
  );
}

async function Account() {
  const user = await requireUser("/account");
  const profile = await getMyProfile();

  return (
    <>
      <ProfileForm
        name={profile?.name ?? ""}
        email={profile?.email ?? user.email ?? ""}
        whatsapp={profile?.whatsapp ?? ""}
        notify={
          profile?.notify_channels.includes("whatsapp")
            ? "email_whatsapp"
            : "email"
        }
      />
      <SignOutButton />
    </>
  );
}
