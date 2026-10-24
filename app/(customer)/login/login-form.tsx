"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { providerOrder, type OAuthProvider } from "@/lib/auth/providers";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

const providerLabels: Record<OAuthProvider, string> = {
  google: "Continue with Google",
  "custom:line": "Continue with LINE",
  apple: "Continue with Apple",
};

const errorMessages: Record<string, string> = {
  signin: "Sign-in didn't complete. Please try again.",
  link: "That sign-in link is invalid or has expired. Request a new one below.",
};

export function LoginForm({ providers }: { providers: OAuthProvider[] }) {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const error = errorMessages[searchParams.get("error") ?? ""];
  const forVendor = next.startsWith("/vendor");

  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function signInWith(provider: OAuthProvider) {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // Ask vendors to add the platform's LINE Official Account as a friend,
        // which LINE push notifications need (Phase 6).
        queryParams:
          provider === "custom:line" ? { bot_prompt: "aggressive" } : undefined,
      },
    });
  }

  async function sendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    setState(error ? "error" : "sent");
  }

  return (
    <div className="space-y-6">
      {forVendor && (
        <p className="text-muted-foreground">
          Shop owners and staff: sign in with LINE or Google.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 p-3 text-sm"
        >
          {error}
        </p>
      )}

      {providerOrder(providers, forVendor).length > 0 && (
        <div className="flex flex-col gap-2">
          {providerOrder(providers, forVendor).map((provider) => (
            <Button
              key={provider}
              type="button"
              variant="outline"
              size="lg"
              className="h-11"
              onClick={() => signInWith(provider)}
            >
              {providerLabels[provider]}
            </Button>
          ))}
        </div>
      )}

      {state === "sent" ? (
        <p role="status" className="rounded-md border p-3 text-sm">
          Check your email for a sign-in link. It works once and expires in 1
          hour.
        </p>
      ) : (
        <form onSubmit={sendLink} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block h-11 w-full rounded-md border bg-background px-3"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            disabled={state === "sending"}
          >
            {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </Button>
          {state === "error" && (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t send the link. Check the address and try again.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
