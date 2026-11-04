"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "./actions";

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, {
    status: "idle" as const,
  });
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p>
        You&apos;ve been invited to help manage a rental shop&apos;s bookings
        and fleet.
      </p>
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? "Joining…" : "Join the team"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-destructive">
          This invite has expired or was already used. Ask the shop owner for a
          new link. <span lang="th">ลิงก์หมดอายุหรือถูกใช้แล้ว</span>
        </p>
      )}
    </form>
  );
}
