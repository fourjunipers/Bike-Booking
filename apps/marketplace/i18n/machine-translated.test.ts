import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { customerLocales } from "./config";
import {
  machineTranslatedKeys,
  machineTranslatedLocales,
  reviewedLocales,
} from "./machine-translated";

const en = JSON.parse(
  readFileSync(join(__dirname, "..", "messages", "en.json"), "utf8"),
);

describe("machine-translated list", () => {
  it("names real English keys", () => {
    for (const key of machineTranslatedKeys) {
      const value = key
        .split(".")
        .reduce<unknown>((m, k) => (m as Record<string, unknown>)?.[k], en);
      expect(typeof value, key).toBe("string");
    }
  });

  it("covers every customer language except the reviewed ones", () => {
    expect([...machineTranslatedLocales, ...reviewedLocales].sort()).toEqual(
      [...customerLocales].sort(),
    );
  });
});
