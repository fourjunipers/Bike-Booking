# Decisions

Running log of decisions made during the build: what, why, date.

## 2026-10-22 · Phase 0

- **Next.js 16 with Cache Components and Partial Prefetching on.** These are the `create-next-app` defaults for this version and become the only mode in the next major release. Consequence: any page that reads cookies, headers or uncached data must do it inside `<Suspense>`.
- **next-intl without locale routing.** URLs carry no `/en` or `/th` prefix. Customer site and admin are always English and stay static. The vendor dashboard reads its language from the `locale` cookie (`i18n/vendor.ts`) inside the vendor layout's Suspense boundary and passes it explicitly. `i18n/request.ts` never reads cookies, so it can't make other pages dynamic. The language toggle is Phase 2.
- **No date library.** `lib/time.ts` uses fixed UTC+7 arithmetic. Thailand has no daylight saving time, so this is exact. If the platform ever expands to a timezone with DST, revisit.
- **Money is whole baht.** `lib/money.ts` throws on fractional baht and on satang amounts that aren't whole baht, so rounding mistakes fail loudly.
- **Supabase clients added in Phase 0** (`lib/supabase/client.ts`, `server.ts`), unused until Phase 1. Session refresh in `proxy.ts` (Next 16's name for middleware) is Phase 1.
- **`@types/node` bumped to 24** to match the installed Node 24 and satisfy Vitest 5's peer range.
- **shadcn/ui `base-nova` style** (Base UI primitives, the current shadcn default). It uses shadcn's `cn` package instead of `clsx` + `tailwind-merge`.
- **Line endings normalised to LF** via `.gitattributes`, so Prettier checks pass on Windows.
- **Hosting on Netlify instead of Vercel** (owner's decision, 2026-10-23). Vercel's free Hobby plan is non-commercial only, so launch would need Pro at $20/month. Netlify's free plan costs $0 while building and Personal is $9/month at launch, and the owner already uses Netlify. Trade-offs: production deploys cost credits (15 each; the free plan has 300/month and pauses every site when they run out), so we work on branches and merge to `main` in batches. Scheduled jobs move from Vercel Cron to Netlify Scheduled Functions (UTC cron, 30 s timeout). CLAUDE.md, SPEC.md, BUILD_PLAN.md and `.env.example` updated to match.
- **Playwright runs at 375 px wide** against a production build on port 3100. Set `PLAYWRIGHT_BASE_URL` to run against a deployed preview instead.
