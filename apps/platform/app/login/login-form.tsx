"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/form";
import type { OAuthProvider } from "@/lib/auth/providers";
import { createClient } from "@mango/db/client";

const providerLabel = {
  "custom:line": "line",
  google: "google",
} as const satisfies Record<OAuthProvider, string>;

type Mode = "password" | "link";
type Status = "idle" | "busy" | "sent" | "wrongPassword" | "sendFailed";

export function LoginForm({
  providers,
  next,
  error,
}: {
  providers: OAuthProvider[];
  next: string;
  error: "signin" | "link" | null;
}) {
  const t = useTranslations("Login");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function signInWith(provider: OAuthProvider) {
    await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("busy");
    const supabase = createClient();

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return setStatus("wrongPassword");
      router.replace(next);
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    setStatus(error ? "sendFailed" : "sent");
  }

  function switchMode() {
    setMode(mode === "password" ? "link" : "password");
    setStatus("idle");
  }

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 p-3 text-sm"
        >
          {t(error === "signin" ? "errorSignin" : "errorLink")}
        </p>
      )}

      {providers.length > 0 && (
        <div className="flex flex-col gap-2">
          {providers.map((provider) => (
            <Button
              key={provider}
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => signInWith(provider)}
            >
              {t(providerLabel[provider])}
            </Button>
          ))}
          <p className="pt-2 text-center text-sm text-muted-foreground">
            {t("or")}
          </p>
        </div>
      )}

      {status === "sent" ? (
        <p role="status" className="rounded-md border p-3 text-sm">
          {t("sent")}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field id="email" label={t("email")}>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
          {mode === "password" && (
            <Field id="password" label={t("password")}>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
          {(status === "wrongPassword" || status === "sendFailed") && (
            <p role="alert" className="text-sm text-destructive">
              {t(status)}
            </p>
          )}
          <Button
            type="submit"
            className="h-11 w-full"
            disabled={status === "busy"}
          >
            {mode === "password"
              ? t(status === "busy" ? "signingIn" : "signIn")
              : t(status === "busy" ? "sending" : "send")}
          </Button>
          <Button
            type="button"
            variant="link"
            className="w-full"
            onClick={switchMode}
          >
            {t(mode === "password" ? "useLink" : "usePassword")}
          </Button>
        </form>
      )}
    </div>
  );
}
