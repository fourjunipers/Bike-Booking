"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "./actions";

export function JoinForm({ token }: { token: string }) {
  const t = useTranslations("Join");
  const locale = useLocale();
  const [state, action, pending] = useActionState(acceptInvite, {
    status: "idle" as const,
  });
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p>{t("intro")}</p>
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? t("joining") : t("join")}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-destructive">
          {t("expired")}{" "}
          {locale !== "th" && <span lang="th">ลิงก์หมดอายุหรือถูกใช้แล้ว</span>}
        </p>
      )}
    </form>
  );
}
