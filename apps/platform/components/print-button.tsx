"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" className="h-11 px-5" onClick={() => window.print()}>
      <Printer aria-hidden />
      {label}
    </Button>
  );
}
