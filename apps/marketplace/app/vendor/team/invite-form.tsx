"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm, inputClass } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { createInvite } from "../actions/team";

/** Creates a single-use link and offers ways to send it: copy, LINE, email. */
export function InviteForm({ shopName }: { shopName: string }) {
  const t = useTranslations("Team");
  return (
    <ActionForm
      action={createInvite}
      submitLabel={t("createLink")}
      className="space-y-4"
      onSaved={(link) => <InviteLink link={link} shopName={shopName} />}
    >
      {null}
    </ActionForm>
  );
}

function InviteLink({ link, shopName }: { link: string; shopName: string }) {
  const t = useTranslations("Team");
  const [copied, setCopied] = useState(false);
  const message = t("shareText", { shop: shopName, link });
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <label htmlFor="invite-link" className="text-sm font-medium">
        {t("linkLabel")}
      </label>
      <input
        id="invite-link"
        readOnly
        value={link}
        className={inputClass}
        onFocus={(e) => e.target.select()}
      />
      <p className="text-sm text-muted-foreground">{t("linkOnce")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? t("copied") : t("copy")}
        </Button>
        <a
          href={`https://line.me/R/share?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center rounded-md border px-4"
        >
          {t("sendLine")}
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(t("emailSubject", { shop: shopName }))}&body=${encodeURIComponent(message)}`}
          className="inline-flex h-11 items-center rounded-md border px-4"
        >
          {t("sendEmail")}
        </a>
      </div>
    </div>
  );
}
