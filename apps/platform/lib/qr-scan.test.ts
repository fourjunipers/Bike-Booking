import { describe, expect, it } from "vitest";
import { stickerToken } from "./qr-scan";

const token = "0123456789abcdef0123456789abcdef";

describe("reading a scanned sticker", () => {
  it("takes the token from a sticker link, whatever address it was printed with", () => {
    expect(stickerToken(`https://app.example.com/q/${token}`)).toBe(token);
    // Printed from a preview, or before a domain change: still the same bike.
    expect(
      stickerToken(`https://deploy-preview-8--site.netlify.app/q/${token}`),
    ).toBe(token);
    expect(stickerToken(`http://localhost:3200/q/${token}/`)).toBe(token);
    expect(stickerToken(`  https://x.test/q/${token}?utm=1 `)).toBe(token);
    expect(stickerToken(token)).toBe(token);
  });

  it("never follows a code that isn't a bike sticker", () => {
    for (const other of [
      "https://evil.example.com/login",
      `https://evil.example.com/redirect?to=/q/${token}`,
      `https://x.test/q/${token}/extra`,
      `https://x.test/q/${token.toUpperCase()}`,
      `https://x.test/q/${token.slice(1)}`,
      `javascript:location='/q/${token}'`,
      `mailto:a@b.c?subject=/q/${token}`,
      "WIFI:S:Shop;T:WPA;P:secret;;",
      "1กข-1234",
      "",
    ])
      expect(stickerToken(other), other).toBeNull();
  });
});
