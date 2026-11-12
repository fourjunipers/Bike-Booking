"use client";

import { useEffect } from "react";

/** Brings a section into view once the page has drawn, e.g. after "sold". */
export function ScrollTo({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);
  return null;
}
