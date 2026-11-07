/**
 * Shop-side screens hidden from the live site (owner decision, 2026-11-07):
 * shop data now lives on the Mango Works platform, so the vendor dashboard
 * and the admin screens that manage shops and the bike catalog are
 * unmaintained. Their code and tables stay; proxy.ts redirects these paths.
 */

/** Vendor dashboard, shop approvals, shop list and bike catalog. */
const HIDDEN = [
  /^\/vendor(\/|$)/,
  /^\/admin\/?$/,
  /^\/admin\/(shops|catalog)(\/|$)/,
];

/** Staff invites to a shop (customer-side URL, shop-side job). */
const HIDDEN_CUSTOMER_PATHS = [/^\/account\/join(\/|$)/];

/** Where the admin area opens now that approvals are hidden. */
export const ADMIN_HOME = "/admin/ranking";

/**
 * Where to send a request for a hidden screen, or null if it isn't hidden.
 * `path` is the customer path without its language prefix when `customer`.
 */
export function hiddenRedirect(
  path: string,
  customer = false,
): "/" | typeof ADMIN_HOME | null {
  if (customer)
    return HIDDEN_CUSTOMER_PATHS.some((r) => r.test(path)) ? "/" : null;
  if (/^\/admin\/?$/.test(path)) return ADMIN_HOME;
  return HIDDEN.some((r) => r.test(path)) ? "/" : null;
}
