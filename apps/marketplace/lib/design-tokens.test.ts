import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Moto Mangos colours in app/globals.css meet WCAG AA: 4.5:1 for text,
 * 3:1 for input borders. Reads the real tokens, so a palette change that
 * breaks contrast fails here.
 */
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));

function token(name: string): string {
  const m = new RegExp(`--${name}:\s*([^;]+);`).exec(root);
  if (!m) throw new Error(`no --${name}`);
  const value = m[1].trim();
  const ref = /^var\(--([\w-]+)\)$/.exec(value);
  return ref ? token(ref[1]) : value;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(token(a)), luminance(token(b))].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
}

describe("design tokens", () => {
  it("are hex colours", () => {
    for (const name of ["mango", "leaf", "navy", "cream", "link", "input"])
      expect(token(name)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each([
    ["foreground", "background"],
    ["card-foreground", "card"],
    ["primary-foreground", "primary"],
    ["primary-foreground", "mango-strong"],
    ["secondary-foreground", "secondary"],
    ["muted-foreground", "background"],
    ["muted-foreground", "card"],
    ["muted-foreground", "muted"],
    ["accent-foreground", "accent"],
    ["link", "card"],
    ["link", "background"],
    ["link", "mango-soft"],
    ["destructive", "card"],
    ["navy", "sun"],
    ["leaf-ink", "leaf-soft"],
  ])("text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("white text on mango would fail, so buttons use navy", () => {
    expect(token("primary-foreground")).toBe(token("navy"));
  });

  it("input borders stand out at least 3:1", () => {
    expect(contrast("input", "card")).toBeGreaterThanOrEqual(3);
    expect(contrast("input", "background")).toBeGreaterThanOrEqual(3);
  });
});
