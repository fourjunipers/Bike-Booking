/** Parses ADMIN_EMAILS ("a@x.com, B@y.com") into a lower-cased set. */
export function parseAdminEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

export function isAdminEmail(
  email: string | null | undefined,
  adminEmails: Set<string>,
): boolean {
  return !!email && adminEmails.has(email.trim().toLowerCase());
}
