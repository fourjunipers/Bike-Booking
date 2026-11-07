import "server-only";

/**
 * The marketplace's only door to shop data (owner decision, 2026-11-07).
 *
 * Shops, bikes, prices, availability and bookings belong to the Mango Works
 * rental platform; this module hides where they come from. Today it reads
 * this project's own database (./current-db.ts, temporary); later it calls
 * the platform API, with the same functions and types, so pages and
 * components don't change. docs/INTEGRATION.md lists every function, the
 * data it needs and the rules it must follow.
 *
 * Pages, components and route handlers import from "@/lib/data" only, never
 * from Supabase clients, for anything about shops, bikes or bookings.
 */

export {
  createBooking,
  getAvailability,
  getBooking,
  getCatalogModel,
  getListing,
  getQuote,
  getRankingWeights,
  getShopById,
  getShopBySlug,
  getShopSignals,
  listFeaturedShops,
  listShopReviews,
  listStations,
  searchOffers,
} from "./current-db";

export type * from "./types";
