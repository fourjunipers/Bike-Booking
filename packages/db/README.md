# @mango/db

Supabase client factories and the generated `Database` types for the one shared
Supabase project (migrations live in `/supabase/migrations`).

| Import | Use |
| --- | --- |
| `@mango/db/server` | Server Components, Server Functions, Route Handlers; acts as the signed-in user (RLS) |
| `@mango/db/client` | Client Components (anon key, RLS) |
| `@mango/db/public` | Public reads on the server with no session; safe inside `"use cache"` |
| `@mango/db/admin` | Service role, server only (`server-only` breaks the build if a client imports it) |
| `@mango/db/database.types` | Generated types |

After a migration, regenerate the types against local Supabase:

```bash
npm run db:types
```
