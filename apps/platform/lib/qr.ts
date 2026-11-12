import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * QR stickers (SPEC › Fleet). A sticker encodes a link to /q/<token>: the
 * token is random and says nothing about the bike, and the link only opens the
 * bike for someone signed in to its shop.
 */

/** This deployment's address, from the request (works on previews and custom domains). */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const protocol = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${protocol}://${host}`;
}

export function stickerUrl(origin: string, token: string): string {
  return `${origin}/q/${token}`;
}

/** The QR as inline SVG markup: sharp at any print size, no image request. */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
