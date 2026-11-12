/**
 * Customer-site text that is an UNREVIEWED MACHINE TRANSLATION.
 *
 * English and Thai are written or approved by the owner. These keys in the
 * other eight languages were translated by Claude (marketplace UI batch,
 * 12 Nov 2026) and nobody has checked them yet. Have a native speaker review
 * them, then delete the keys here. i18n/machine-translated.test.ts keeps the
 * list honest (every key exists in English).
 */

/** Locales whose customer text is reviewed: never listed below. */
export const reviewedLocales = ["en", "th"] as const;

/** "Namespace.key" in every unreviewed language. */
export const machineTranslatedKeys = [
  // Book ahead / Ride today, type toggles (UI batch items 3 and 4).
  "Search.search",
  "Search.when",
  "Search.bookAhead",
  "Search.rideToday",
  "Search.bookAheadHint",
  "Search.rideTodayHint",
  "Search.typesHint",
  "Search.readyNowOnly",
  // Place search (item 2).
  "Search.placeLabel",
  "Search.placePlaceholder",
  "Search.placeSearching",
  "Search.placeNoMatches",
  "Search.placeUnavailable",
  "Search.placeChosen",
  "Search.clearPlace",
  "Search.stationFilter",
] as const;

/** The languages these keys are machine-translated in. */
export const machineTranslatedLocales = [
  "zh",
  "ja",
  "ko",
  "ru",
  "de",
  "fr",
  "es",
  "it",
] as const;

/**
 * Thai written by Claude in the same batch: approved by the owner for use,
 * but NOT yet checked by a native Thai speaker. Review, then delete the keys.
 */
export const thaiNeedsNativeReview = [
  // Page titles and descriptions, Thailand-wide (approved 12 Nov 2026).
  "Customer.title",
  "Customer.metaDescription",
  "Search.metaDescription",
  "Bike.metaTitle",
  "Bike.metaDescription",
  "Bike.listingDescription",
  "Shop.metaTitle",
  // Search form.
  ...machineTranslatedKeys,
  "Search.station",
  "Search.chooseStation",
  "Search.gpsFailed",
  // Vendor help text ("Ride today").
  "Fleet.helpReady",
] as const;
