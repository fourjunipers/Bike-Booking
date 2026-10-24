import type { Metadata } from "next";
import { Suspense } from "react";
import { enabledProviders } from "@/lib/auth/providers";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {/* The form reads ?next and ?error from the URL. */}
      <Suspense>
        <LoginForm providers={enabledProviders()} />
      </Suspense>
    </section>
  );
}
