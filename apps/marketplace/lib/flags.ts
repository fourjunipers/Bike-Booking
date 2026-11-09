/**
 * Feature flags read from the environment at build/request time.
 *
 * BOOKING_ENABLED turns on checkout, booking pages and the shop simulator.
 * It stays off in production until Mango Works can receive marketplace
 * bookings (its Phase 8): a booking taken before then would reach no shop.
 * Set it to "true" only for Netlify deploy previews and local development.
 */
export function bookingEnabled(): boolean {
  return process.env.BOOKING_ENABLED === "true";
}
