import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { customerLocales } from "./config";
import {
  machineTranslatedKeys,
  machineTranslatedLocales,
  reviewedLocales,
  thaiNeedsNativeReview,
} from "./machine-translated";

const load = (locale: string) =>
  JSON.parse(
    readFileSync(join(__dirname, "..", "messages", `${locale}.json`), "utf8"),
  );
const en = load("en");
const th = load("th");
const get = (messages: unknown, key: string) =>
  key
    .split(".")
    .reduce<unknown>((m, k) => (m as Record<string, unknown>)?.[k], messages);

describe("machine-translated list", () => {
  it("names real English keys", () => {
    for (const key of machineTranslatedKeys)
      expect(typeof get(en, key), key).toBe("string");
  });

  it("covers every customer language except the reviewed ones", () => {
    expect([...machineTranslatedLocales, ...reviewedLocales].sort()).toEqual(
      [...customerLocales].sort(),
    );
  });
});

describe("Thai awaiting native review", () => {
  it("names real Thai keys, once each", () => {
    for (const key of thaiNeedsNativeReview)
      expect(typeof get(th, key), key).toBe("string");
    expect(new Set(thaiNeedsNativeReview).size).toBe(
      thaiNeedsNativeReview.length,
    );
  });
});
