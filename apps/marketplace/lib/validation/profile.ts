import { z } from "zod";

/** "+66 81-234 5678" → "+66812345678". Empty input → null. */
export function normaliseWhatsapp(value: string): string | null {
  const compact = value.replace(/[\s\-().]/g, "");
  return compact === "" ? null : compact;
}

// E.164: "+", country code, up to 15 digits in total.
const E164 = /^\+[1-9]\d{7,14}$/;

// Messages are keys in the "Account" namespace, translated by the form.
export const profileFormSchema = z
  .object({
    name: z.string().trim().min(1, "nameRequired").max(100, "nameTooLong"),
    whatsapp: z
      .string()
      .transform(normaliseWhatsapp)
      .refine((v) => v === null || E164.test(v), {
        message: "whatsappFormat",
      }),
    notify: z.enum(["email", "email_whatsapp"]),
  })
  .refine((v) => v.notify === "email" || v.whatsapp !== null, {
    message: "whatsappNeeded",
    path: ["whatsapp"],
  });

export type ProfileForm = z.infer<typeof profileFormSchema>;

export function notifyChannels(
  notify: ProfileForm["notify"],
): ("email" | "whatsapp")[] {
  return notify === "email_whatsapp" ? ["email", "whatsapp"] : ["email"];
}
