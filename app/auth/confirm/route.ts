import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { syncRoleAfterSignIn } from "@/lib/auth/sync-role";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic links land here with a token hash (see supabase/templates). Verified
 * on the server, so the link works in any browser, not only the one that
 * asked for it.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error && data.user) {
      await syncRoleAfterSignIn(data.user);
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "link");
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
