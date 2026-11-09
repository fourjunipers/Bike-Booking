"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js, which makes the staff app installable and shows an
 * offline page when there's no connection. Skipped in development so cached
 * pages don't get in the way of hot reload.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Not fatal: the app works in the browser without it.
      });
  }, []);
  return null;
}
