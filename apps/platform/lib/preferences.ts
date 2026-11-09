/**
 * Per-device display preferences, kept in cookies so the server renders the
 * right layout on the first paint (no flash). Not shared across devices.
 */

/** Where the staff app's tab bar sits on phones and tablets (SPEC › Staff app). */
export const tabBarCookie = "mw_tabbar";
export const tabBarPositions = ["bottom", "top"] as const;
export type TabBarPosition = (typeof tabBarPositions)[number];

export function parseTabBar(value: string | undefined): TabBarPosition {
  return value === "top" ? "top" : "bottom";
}

/** Light, dark, or follow the device. */
export const themeCookie = "mw_theme";
export const themes = ["system", "light", "dark"] as const;
export type Theme = (typeof themes)[number];

export function parseTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

/** A year: long enough to feel permanent, short enough to expire on unused devices. */
export const preferenceCookieMaxAge = 60 * 60 * 24 * 365;
