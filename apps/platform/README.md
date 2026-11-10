# apps/platform

The rental management platform (product name not chosen yet).

- Spec: [docs/platform/SPEC.md](../../docs/platform/SPEC.md)
- Rules: [CLAUDE.md](CLAUDE.md) and the root [CLAUDE.md](../../CLAUDE.md)
- Contract with the marketplace: [docs/INTEGRATION.md](../../docs/INTEGRATION.md)
- Status: [docs/PROGRESS.md](../../docs/PROGRESS.md)

## Run it locally

1. From the repo root: `npm install` and `npx supabase start` (Docker).
2. Copy `.env.example` to `.env.local`. Fill the Supabase values from
   `npx supabase status` and pick a `DEMO_PASSWORD`.
3. `npm run seed -w @mango/platform` creates the demo shops and users.
4. `npm run dev -w @mango/platform` and open http://localhost:3200.
   Sign in as `owner@bsr.demo.test` (or any user the seed prints) with
   `DEMO_PASSWORD`, or ask for an email link and open it in Mailpit
   (http://127.0.0.1:54324).

## Tests

| Command | What |
| --- | --- |
| `npm test -w @mango/platform` | Unit tests (no database) |
| `npm run test:db -w @mango/platform` | RLS and team rules against local Supabase |
| `npm run test:e2e -w @mango/platform` | Playwright at phone and desktop widths (needs the seed) |

## Layout

```text
app/[tenant]/   one shop: dashboard, orders, new-order, maintenance (the staff
                app's tabs), team and settings (owners, managers), me (device)
app/login, app/auth/   sign-in and its callbacks
lib/            roles and tabs, session, settings rules, shop time
messages/       en.json, th.json (always add keys to both)
scripts/        seed.mts (local and staging demo data)
tests/db/       tenant isolation and team rules (Vitest, local Supabase)
e2e/            Playwright
```
