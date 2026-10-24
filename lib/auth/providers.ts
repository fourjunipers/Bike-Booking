/** Social sign-in providers the login page offers, in the Supabase naming. */
export type OAuthProvider = "google" | "custom:line" | "apple";

const known: Record<string, OAuthProvider> = {
  google: "google",
  line: "custom:line",
  apple: "apple",
};

/**
 * NEXT_PUBLIC_AUTH_PROVIDERS, e.g. "google,line". Only list providers that are
 * configured in the Supabase project, or their buttons will fail.
 */
export function enabledProviders(
  value = process.env.NEXT_PUBLIC_AUTH_PROVIDERS,
): OAuthProvider[] {
  return (value ?? "")
    .split(",")
    .map((p) => known[p.trim().toLowerCase()])
    .filter((p): p is OAuthProvider => !!p);
}

/** Vendors sign in with LINE or Google; customers see Google first. */
export function providerOrder(
  providers: OAuthProvider[],
  forVendor: boolean,
): OAuthProvider[] {
  const order: OAuthProvider[] = forVendor
    ? ["custom:line", "google"]
    : ["google", "custom:line", "apple"];
  return order.filter((p) => providers.includes(p));
}
