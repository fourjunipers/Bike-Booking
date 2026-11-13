"use client";

import type { ComponentProps } from "react";

/**
 * A submit button that asks first. For a plain form (no ActionForm) whose
 * action can't be taken back, such as "Reset to A–Z". Without JavaScript it
 * submits without asking.
 */
export function ConfirmSubmit({
  question,
  ...props
}: { question: string } & Omit<ComponentProps<"button">, "type" | "onClick">) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(question)) event.preventDefault();
      }}
      {...props}
    />
  );
}
