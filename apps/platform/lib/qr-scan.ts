/**
 * Reading a bike's QR sticker inside the app (Maintenance › Scan). A sticker
 * holds a link ending in /q/<token>. Only the token is used: the scan always
 * opens the bike on the site the person is already signed in to, whatever
 * address the sticker was printed with (an old domain, a preview), and a code
 * that isn't a sticker is never followed anywhere.
 */

const token = /^[0-9a-f]{32}$/;

/** The sticker token in a scanned code, or null when it isn't one of ours. */
export function stickerToken(scanned: string): string | null {
  const text = scanned.trim();
  if (token.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const match = /^\/q\/([0-9a-f]{32})\/?$/.exec(url.pathname);
  return match ? match[1] : null;
}
