import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { syncRoleAfterSignIn } from "@/lib/auth/sync-role";
import { createClient } from "@/lib/supabase/server";

/** OAuth providers (Google, LINE, Apple) return here with a PKCE code. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await syncRoleAfterSignIn(data.user);
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "signin");
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
