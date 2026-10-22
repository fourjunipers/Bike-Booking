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
| `npm run test:e2e` | End-to-end tests (Playwright, builds and serves on port 3100) |
| `npx supabase start` | Start local Supabase (needs Docker) |
| `npx supabase db reset` | Recreate the local database from `supabase/migrations` |

## Areas

- `/` customer site (English)
- `/vendor` vendor dashboard (Thai or English, from the `locale` cookie)
- `/admin` admin panel (English)
