# mango-works

Monorepo for Mango Works Co., Ltd.: the **Moto Mangos** motorbike rental marketplace and the rental management platform, on one shared Supabase database.

| Folder | What |
| --- | --- |
| [apps/marketplace](apps/marketplace) | Moto Mangos customer site (Next.js), deployed to Netlify as bike-booking-th |
| [apps/platform](apps/platform) | Rental management platform (scaffolded in platform Phase 0) |
| [packages/core](packages/core) | `@mango/core`: pure rental rules |
| [packages/db](packages/db) | `@mango/db`: Supabase clients and database types |
| [packages/config](packages/config) | `@mango/config`: shared tsconfig, ESLint, Prettier |
| [supabase](supabase) | Migrations, seed and local config for the one database |
| [docs](docs) | Specs, the integration contract and progress |

## Setup

Requires Node.js 24, plus Docker Desktop for the local database.

```bash
npm install                      # once, at the root (npm workspaces)
cp apps/marketplace/.env.example apps/marketplace/.env.local
npx supabase start               # local Supabase, from the root
npx supabase db reset            # apply migrations + seed
npm run dev                      # marketplace at http://localhost:3000
```

## Commands (root)

| Command | What it does |
| --- | --- |
| `npm run typecheck` / `npm run lint` / `npm test` | Run in every workspace |
| `npm run build` | Build the marketplace |
| `npm run test:db` | Marketplace database (RLS) tests, needs local Supabase |
| `npm run test:e2e` | Marketplace Playwright tests |
| `npm run db:types` | Regenerate `packages/db/src/database.types.ts` |

Rules for working in this repo: [CLAUDE.md](CLAUDE.md).
