import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Supabase client for public data on the server, with no user session: it
 * reads only what anyone may read (RLS as anon). It doesn't touch cookies, so
 * it can be used inside cached functions ("use cache") and on static pages.
 */
export function createPublicClient() {
  return createClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
