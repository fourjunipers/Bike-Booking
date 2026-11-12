import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Supabase client for the platform app's Server Components, Server Functions
 * and Route Handlers. Acts as the signed-in user (anon key + RLS) and points at
 * the `platform` schema, so platform code can't reach marketplace tables by
 * accident. The shared catalog is read with `.schema("public")`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, "platform">(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      db: { schema: "platform" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: proxy.ts refreshes the session on every request.
          }
        },
      },
    },
  );
}
