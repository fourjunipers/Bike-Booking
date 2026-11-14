"use client";

import { useLayoutEffect } from "react";
import { isDarkTheme, type Theme } from "@/lib/preferences";

/**
 * Keeps the page's `dark` class in step with the Appearance choice after the
 * first paint (bug, 14 Nov 2026).
 *
 * The root layout sets the class on <html> when the server renders, and a
 * small script in <head> adds it for "Match device" on a dark phone. Choosing
 * another appearance re-renders the layout without reloading the page, and
 * React only rewrites <html>'s class when the server's own value changes. So
 * on a dark phone, going from Match device to Light changed nothing on the
 * server's side (neither had the class), and the class the script had added
 * stayed: Light did nothing. Dark then looked the same as before, and Match
 * device took the class away again, turning the app light. This sets the class
 * from the choice and the device every time the choice changes, and follows
 * the device while "Match device" is on.
 */
export function ThemeSync({ theme }: { theme: Theme }) {
  useLayoutEffect(() => {
    const device = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        isDarkTheme(theme, device.matches),
      );
    apply();
    if (theme !== "system") return;
    device.addEventListener("change", apply);
    return () => device.removeEventListener("change", apply);
  }, [theme]);
  return null;
}
