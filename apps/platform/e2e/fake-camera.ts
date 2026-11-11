import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";

/**
 * What the test browser's stand-in camera "sees": one still frame showing a
 * QR sticker, written as an uncompressed video file Chromium can play
 * (--use-file-for-fake-video-capture). With it, the scan tests read a real
 * code from camera frames with the real decoder, not a stand-in.
 *
 * The sticker's token belongs to no bike, so a successful read lands on
 * "Page not found" at /q/<token>, which is how the test knows it was read.
 */
export const cameraStickerToken = "c0ffee00c0ffee00c0ffee00c0ffee00";

const width = 640;
const height = 480;

/** Writes the camera file and returns its path. */
export function writeFakeCamera(): string {
  const code = QRCode.create(
    `https://printed.example.com/q/${cameraStickerToken}`,
    { errorCorrectionLevel: "M" },
  );
  const size = code.modules.size;
  // The code with a 4-module quiet zone, as large as fits, in the middle.
  const scale = Math.floor(Math.min(width, height) / (size + 8));
  const left = Math.floor((width - size * scale) / 2);
  const top = Math.floor((height - size * scale) / 2);

  // YUV 4:2:0: a brightness plane, then two colour planes at grey (no colour).
  const luma = Buffer.alloc(width * height, 235);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (!code.modules.get(row, column)) continue;
      for (let y = 0; y < scale; y++) {
        const start = (top + row * scale + y) * width + left + column * scale;
        luma.fill(16, start, start + scale);
      }
    }
  }
  const chroma = Buffer.alloc((width * height) / 2, 128);
  const directory = join(tmpdir(), "mango-platform-e2e");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, "sticker.y4m");
  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`),
      Buffer.from("FRAME\n"),
      luma,
      chroma,
    ]),
  );
  return file;
}
