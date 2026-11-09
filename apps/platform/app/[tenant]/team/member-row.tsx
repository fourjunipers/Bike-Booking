"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/form";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { changeMember, type TeamActionState } from "./actions";

export type MemberView = {
  membershipId: string;
  name: string;
  email: string;
  role: Role;
  isYou: boolean;
  roleOptions: { value: Role; label: string }[];
  canRemove: boolean;
};

/**
 * One team member: a card on phones, a table row from md up. The role is a
 * native select with a Save button, so it works the same with touch, mouse
 * and keyboard.
 */
export function MemberRow({
  slug,
  member,
  roleLabel,
}: {
  slug: string;
  member: MemberView;
  roleLabel: string;
}) {
  const t = useTranslations("Team");
  const tCommon = useTranslations("Common");
  const [state, action, pending] = useActionState<TeamActionState, FormData>(
    changeMember,
    {},
  );
  const selectId = `role-${member.membershipId}`;

  return (
    <li className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)] md:items-center md:gap-4">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {member.name}
          {member.isYou && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({t("you")})
            </span>
          )}
        </p>
      </div>
      <p className="truncate text-sm text-muted-foreground">{member.email}</p>
      <div className="space-y-2">
        {member.roleOptions.length > 0 ? (
          <form action={action} className="flex flex-wrap gap-2">
            <input type="hidden" name="slug" value={slug} />
            <input
              type="hidden"
              name="membershipId"
              value={member.membershipId}
            />
            <label htmlFor={selectId} className="sr-only">
              {t("changeRole", { name: member.name })}
            </label>
            <select
              // Reset to the saved role when it changes on the server.
              key={member.role}
              id={selectId}
              name="role"
              defaultValue={member.role}
              className={cn(inputClass, "h-10 w-auto min-w-32 flex-1")}
            >
              {member.roleOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              name="intent"
              value="role"
              variant="outline"
              className="h-10"
              disabled={pending}
            >
              {tCommon(pending ? "saving" : "save")}
            </Button>
            {member.canRemove && (
              <Button
                type="submit"
                name="intent"
                value="remove"
                variant="destructive"
                className="h-10"
                disabled={pending}
                onClick={(event) => {
                  if (!confirm(t("removeConfirm", { name: member.name })))
                    event.preventDefault();
                }}
              >
                {t("remove")}
              </Button>
            )}
          </form>
        ) : (
          <p className="text-sm">{roleLabel}</p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {t(state.error)}
          </p>
        )}
        {state.ok && !pending && (
          <p role="status" className="text-sm text-muted-foreground">
            {tCommon("saved")}
          </p>
        )}
      </div>
    </li>
  );
}
