/**
 * Only same-site paths are allowed as post-login destinations, so a crafted
 * `next` parameter can't send the user to another site.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/",
): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return fallback;
  }
  return next;
}
