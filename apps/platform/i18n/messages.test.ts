import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import th from "../messages/th.json";
import { locales } from "./config";

/** Every key path in a messages object, e.g. "Login.title". */
function keys(messages: object, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? keys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

/** The {placeholders} in every message, by key path. */
function placeholders(messages: object): Record<string, string[]> {
  const flat: Record<string, string[]> = {};
  const walk = (obj: object, prefix: string) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        walk(value, `${prefix}${key}.`);
      } else {
        flat[`${prefix}${key}`] = [...String(value).matchAll(/\{(\w+)\}/g)]
          .map((m) => m[1])
          .sort();
      }
    }
  };
  walk(messages, "");
  return flat;
}

describe("message files", () => {
  it("exist for every staff language", () => {
    expect(locales).toEqual(["en", "th"]);
  });

  it("have the same keys in English and Thai (CLAUDE.md: add both together)", () => {
    expect(keys(th).sort()).toEqual(keys(en).sort());
  });

  it("use the same placeholders in both languages", () => {
    expect(placeholders(th)).toEqual(placeholders(en));
  });

  it("have no empty messages", () => {
    for (const messages of [en, th]) {
      for (const [key, value] of Object.entries(placeholders(messages))) {
        void value;
        const text = key
          .split(".")
          .reduce<unknown>(
            (obj, part) => (obj as Record<string, unknown>)[part],
            messages,
          );
        expect(String(text).trim(), key).not.toBe("");
      }
    }
  });
});
