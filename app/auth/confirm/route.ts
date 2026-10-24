import type { EmailOtpType, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { syncRoleAfterSignIn } from "@/lib/auth/sync-role";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic links land here in one of two shapes:
 * - `token_hash` + `type`, from our custom template (supabase/templates).
 *   Verified on the server, so it works in any browser.
 * - `code`, from Supabase's default template, which verifies first and then
 *   redirects here. That's a PKCE code, so it only works in the browser that
 *   asked for the link. Used until the hosted project has custom SMTP and our
 *   template. TODO(phase-6): switch hosted email to Resend + custom template.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();
  let user: User | null = null;

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) user = data.user;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) user = data.user;
  }

  if (user) {
    await syncRoleAfterSignIn(user);
    return NextResponse.redirect(new URL(next, origin));
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "link");
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
