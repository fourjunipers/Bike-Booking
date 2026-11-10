"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, localeCookie } from "@/i18n/config";
import {
  parseTabBar,
  parseTheme,
  preferenceCookieMaxAge,
  tabBarCookie,
  themeCookie,
} from "@/lib/preferences";

const preferences = {
  locale: { cookie: localeCookie, valid: isLocale },
  theme: {
    cookie: themeCookie,
    valid: (v: string) => parseTheme(v) === v,
  },
  tabbar: {
    cookie: tabBarCookie,
    valid: (v: string) => parseTabBar(v) === v,
  },
} as const;

export type PreferenceName = keyof typeof preferences;

/**
 * Saves a per-device preference (language, appearance, tab bar position) in
 * a cookie. Used as a form action: the button's name is the preference and
 * its value the choice, so it works before JavaScript loads.
 */
export async function setPreference(formData: FormData) {
  for (const [name, entry] of Object.entries(preferences)) {
    const value = formData.get(name);
    if (typeof value === "string" && entry.valid(value)) {
      (await cookies()).set(entry.cookie, value, {
        path: "/",
        maxAge: preferenceCookieMaxAge,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
  }
  revalidatePath("/", "layout");
}
