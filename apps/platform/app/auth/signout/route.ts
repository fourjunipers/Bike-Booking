import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@mango/db/platform-server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 so the browser follows with GET.
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
}
