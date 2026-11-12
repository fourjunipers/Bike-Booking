import { timingSafeEqual } from "node:crypto";

/** "Authorization: Bearer $CRON_SECRET", compared in constant time. */
export function cronAuthorised(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
