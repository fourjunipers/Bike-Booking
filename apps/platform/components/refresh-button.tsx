"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Re-fetches the page's server data. Works with a click, a tap or the
 * keyboard. (An installed app has no browser pull-to-refresh, so this is the
 * dependable way on every device.)
 */
export function RefreshButton() {
  const t = useTranslations("Common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-10"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw aria-hidden className={cn(pending && "animate-spin")} />
      {t(pending ? "refreshing" : "refresh")}
    </Button>
  );
}
