"use client";

import { useTranslations } from "next-intl";
import { ActionForm, TextField } from "@/components/form-kit";
import { createShop } from "./actions/shop";

export function CreateShopForm() {
  const t = useTranslations("Vendor");
  return (
    <ActionForm action={createShop} submitLabel={t("createShop")}>
      <TextField
        name="name"
        label={t("shopName")}
        autoComplete="organization"
      />
    </ActionForm>
  );
}
