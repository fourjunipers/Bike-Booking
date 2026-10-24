# Motorbike rental marketplace

Bangkok motorbike rental marketplace. Product behaviour: [SPEC.md](SPEC.md). Build phases: [BUILD_PLAN.md](BUILD_PLAN.md). Rules for working on the code: [CLAUDE.md](CLAUDE.md). Decisions: [docs/decisions.md](docs/decisions.md).

## Requirements

- Node.js 24
- Docker Desktop (only for the local Supabase database)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npx playwright install chromium
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (write); `format:check` to check only |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | Security (RLS) tests against local Supabase |
| `npm run test:e2e` | End-to-end tests (Playwright, builds and serves on port 3100; sign-in tests need local Supabase) |
| `npx supabase start` | Start local Supabase (needs Docker) |
| `npx supabase db reset` | Recreate the local database from `supabase/migrations` and load `supabase/seed.sql` |
| `npm run db:types` | Regenerate `lib/supabase/database.types.ts` after a migration |

## Signing in locally

Go to http://localhost:3000/login and request a magic link for one of the seeded accounts. Open the email in Mailpit at http://127.0.0.1:54324.

| Email | Role |
| --- | --- |
| `admin@bike-booking.test` | Admin (must be in `ADMIN_EMAILS`) |
| `customer@bike-booking.test` | Customer with one confirmed booking at BSR |
| `owner@bsr.test` | BSR Bike Shop owner |
| `staff@bsr.test` | BSR Bike Shop staff |
| `owner@draft-shop.test` | Owner of a draft shop the public can't see |

Supabase Studio (database browser): http://127.0.0.1:54323

## Areas

- `/` customer site (English)
- `/login`, `/account` sign-in and customer profile
- `/vendor` vendor dashboard (Thai or English, from the `locale` cookie); shop members only
- `/admin` admin panel (English); admins only, everyone else gets not-found
