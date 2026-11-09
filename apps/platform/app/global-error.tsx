"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Last-resort error page (outside the root layout, so no translations). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h1>Something went wrong · เกิดข้อผิดพลาด</h1>
        <button type="button" onClick={reset}>
          Try again · ลองอีกครั้ง
        </button>
      </body>
    </html>
  );
}
