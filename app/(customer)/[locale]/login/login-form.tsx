"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isCustomerLocale, localePath } from "@/i18n/config";
import { providerOrder, type OAuthProvider } from "@/lib/auth/providers";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

const providerLabels = {
  google: "google",
  "custom:line": "line",
  apple: "apple",
} as const satisfies Record<OAuthProvider, string>;

const errorMessages: Record<string, "errorSignin" | "errorLink"> = {
  signin: "errorSignin",
  link: "errorLink",
};

export function LoginForm({ providers }: { providers: OAuthProvider[] }) {
  const t = useTranslations("Login");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const home = isCustomerLocale(locale) ? localePath(locale, "/") : "/";
  const next = safeNextPath(searchParams.get("next"), home);
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
      {forVendor && <p className="text-muted-foreground">{t("vendorHint")}</p>}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 p-3 text-sm"
        >
          {t(error)}
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
              {t(providerLabels[provider])}
            </Button>
          ))}
        </div>
      )}

      {state === "sent" ? (
        <p role="status" className="rounded-md border p-3 text-sm">
          {t("sent")}
        </p>
      ) : (
        <form onSubmit={sendLink} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              {t("email")}
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
            {state === "sending" ? t("sending") : t("send")}
          </Button>
          {state === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {t("sendFailed")}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
