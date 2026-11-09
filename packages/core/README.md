# @mango/core

Pure TypeScript rules shared by the apps: rental days, day-table pricing,
availability maths, closures, money and time. No React, Next.js or Supabase
(ESLint enforces this). Import one module at a time:

```ts
import { rentalDays } from "@mango/core/rental-days";
import { formatBaht } from "@mango/core/money";
```

Every function here is unit-tested (`npm test -w @mango/core`). Moved unchanged
from the marketplace's `lib/` in Step R; the Bangkok-only and whole-baht parts
are listed in `docs/PROGRESS.md` for platform Phase 2.
