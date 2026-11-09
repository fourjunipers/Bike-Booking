import { z } from "zod";

/**
 * Shop settings an owner or manager can edit in Phase 0 (SPEC › Built for any
 * country). Nothing defaults to Thailand: each value is checked against what
 * the runtime's Intl data knows, and the database checks again.
 */

/** Codes Intl still names that aren't countries or territories. */
const notCountries = new Set(["EU", "EZ", "UN", "QO", "XA", "XB", "ZZ"]);

function regionNames(locale: string) {
  return new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
}

export function isCountry(code: string): boolean {
  return (
    /^[A-Z]{2}$/.test(code) &&
    !notCountries.has(code) &&
    regionNames("en").of(code) !== undefined
  );
}

export function isCurrency(code: string): boolean {
  return (
    /^[A-Z]{3}$/.test(code) && Intl.supportedValuesOf("currency").includes(code)
  );
}

export function isTimeZone(zone: string): boolean {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** A BCP 47 tag in canonical form ("en-gb" → "en-GB"), or null. */
export function canonicalLocale(tag: string): string | null {
  try {
    const [canonical] = Intl.getCanonicalLocales(tag);
    return canonical && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(canonical)
      ? canonical
      : null;
  } catch {
    return null;
  }
}

export const tenantSettingsSchema = z.object({
  name: z.string().trim().min(1, "required").max(120, "tooLong"),
  country: z.string().trim().toUpperCase().refine(isCountry, "invalidCountry"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isCurrency, "invalidCurrency"),
  timezone: z.string().trim().refine(isTimeZone, "invalidTimezone"),
  locale: z
    .string()
    .trim()
    .transform((tag, ctx) => {
      const canonical = canonicalLocale(tag);
      if (!canonical) {
        ctx.addIssue({ code: "custom", message: "invalidLocale" });
        return z.NEVER;
      }
      return canonical;
    }),
});

export type TenantSettings = z.infer<typeof tenantSettingsSchema>;

/** Options for the settings form, named in the viewer's language. */
export function settingsOptions(displayLocale: string) {
  const regions = regionNames(displayLocale);
  const currencies = new Intl.DisplayNames([displayLocale], {
    type: "currency",
  });
  const countries: { code: string; name: string }[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (isCountry(code)) {
        countries.push({ code, name: regions.of(code) ?? code });
      }
    }
  }
  return {
    countries: countries.sort((x, y) =>
      x.name.localeCompare(y.name, displayLocale),
    ),
    currencies: Intl.supportedValuesOf("currency").map((code) => ({
      code,
      name: currencies.of(code) ?? code,
    })),
    timeZones: Intl.supportedValuesOf("timeZone"),
  };
}
