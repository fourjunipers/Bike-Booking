# Rental management platform — project rules

Source of truth: docs/platform/SPEC.md. Read the relevant section before every task.
The root CLAUDE.md also applies. Work only in apps/platform, packages/ and supabase/; never import from apps/marketplace.

## Stack
Next.js (App Router) + TypeScript strict, Supabase (Postgres, Auth, Storage, RLS),
Tailwind + shadcn/ui, Stripe Connect + Billing, Resend, LINE Messaging API, next-intl (en, th).

## Rules
- Every table has tenant_id and an RLS policy. Add an RLS test for every new table.
- Availability is enforced by the DB exclusion constraint on allocations/downtime. Never bypass it.
- Money = integer minor units + currency. Times = UTC in DB, tenant timezone in UI.
- All pricing goes through packages/core (quote). All availability through packages/core and the DB lock.
- Every order status change writes audit_events.
- Migrations only via supabase/migrations; never edit an applied migration.
- No service-role key in client code.
- Mobile-first: every staff screen must work at 375px wide.
- Strings via next-intl; add en and th keys together.

## Workflow
- One phase = one branch (platform/phase-N-name) = one PR.
- Before coding: write a short plan in the PR description; list the acceptance checks from SPEC.md.
- Done = typecheck, lint, unit, RLS and Playwright tests green in CI.
- Output complete files, not diffs or partial snippets.
