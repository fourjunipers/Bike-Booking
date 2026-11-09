/** Social sign-in providers, in the Supabase naming. */
export type OAuthProvider = "google" | "custom:line";

const known: Record<string, OAuthProvider> = {
  google: "google",
  line: "custom:line",
};

/**
 * NEXT_PUBLIC_AUTH_PROVIDERS, e.g. "line,google". Only list providers that are
 * configured in the Supabase project, or their buttons fail. Staff see LINE
 * first (SPEC › Tech stack: LINE login matters for Thai staff).
 */
export function enabledProviders(
  value = process.env.NEXT_PUBLIC_AUTH_PROVIDERS,
): OAuthProvider[] {
  const listed = new Set(
    (value ?? "")
      .split(",")
      .map((p) => known[p.trim().toLowerCase()])
      .filter((p): p is OAuthProvider => !!p),
  );
  return (["custom:line", "google"] as const).filter((p) => listed.has(p));
}
