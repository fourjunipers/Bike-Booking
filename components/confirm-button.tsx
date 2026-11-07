"use client";

import { Button } from "@/components/ui/button";

/** A submit button that asks first (e.g. before deleting). */
export function ConfirmButton({
  message,
  children,
  className,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      variant="destructive"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
