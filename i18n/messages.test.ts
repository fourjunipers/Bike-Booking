import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { customerLocales, customerNamespaces, locales } from "./config";

type Messages = Record<string, unknown>;

function load(locale: string): Messages {
  const file = join(__dirname, "..", "messages", `${locale}.json`);
  return JSON.parse(readFileSync(file, "utf8"));
}

/** "Vendor.title", "Vendor.nested.key", … for every leaf string. */
function keys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? keys(v as Messages, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

/** {placeholders} in a message, so translations keep them all. */
function placeholders(text: unknown): string[] {
  return [...String(text).matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
}

function get(messages: Messages, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>((m, k) => (m as Messages | undefined)?.[k], messages);
}

const en = load("en");
const customerKeys = keys(
  Object.fromEntries(customerNamespaces.map((ns) => [ns, en[ns]])),
);

describe("customer site messages", () => {
  it.each(customerLocales)("%s has every customer key", (locale) => {
    const messages = load(locale);
    const own = keys(
      Object.fromEntries(customerNamespaces.map((ns) => [ns, messages[ns]])),
    );
    expect(own.sort()).toEqual([...customerKeys].sort());
  });

  it.each(customerLocales)("%s keeps every {placeholder}", (locale) => {
    const messages = load(locale);
    for (const key of customerKeys) {
      expect(placeholders(get(messages, key)), key).toEqual(
        placeholders(get(en, key)),
      );
    }
  });
});

describe("vendor dashboard messages", () => {
  // The admin panel is English only.
  const shared = keys(en).filter((k) => !k.startsWith("Admin."));

  it.each(locales)("%s has every key English has", (locale) => {
    const own = keys(load(locale)).filter((k) => !k.startsWith("Admin."));
    expect(own.sort()).toEqual([...shared].sort());
  });
});
