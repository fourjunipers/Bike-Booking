"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stickerToken } from "@/lib/qr-scan";

/** The browser's built-in code reader (not in TypeScript's DOM types yet). */
type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
type DetectorClass = new (options: { formats: string[] }) => Detector;

/** Reads one camera frame: the code's text, or null when none is in view. */
type ReadFrame = (video: HTMLVideoElement) => Promise<string | null>;

type Problem = "unsupported" | "denied" | "failed" | "notSticker";

/** Frames are shrunk to this before decoding: plenty for a sticker, and quick. */
const maxEdge = 640;

/**
 * How frames are read on this device. Chrome on Android has a code reader
 * built in. Safari on iPhone and Firefox don't, so there the frame is drawn
 * to a canvas and decoded by the jsQR library, which is only downloaded on
 * those browsers and only when the scanner is opened.
 */
async function frameReader(): Promise<ReadFrame> {
  const Reader = (window as unknown as { BarcodeDetector?: DetectorClass })
    .BarcodeDetector;
  if (Reader) {
    const reader = new Reader({ formats: ["qr_code"] });
    return async (video) => (await reader.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("no canvas");
  return async (video) => {
    const scale = Math.min(
      1,
      maxEdge / Math.max(video.videoWidth, video.videoHeight),
    );
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    if (!width || !height) return null;
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    // A printed sticker is dark on light; skipping the inverted pass halves the work.
    return (
      jsQR(image.data, width, height, { inversionAttempts: "dontInvert" })
        ?.data ?? null
    );
  };
}

/**
 * A camera button that reads a bike's QR sticker and opens the bike (SPEC ›
 * Staff app 4: "search by plate or scan the bike's QR"). Frames are read on
 * the device; nothing is uploaded. Works on Android, iPhone and laptops with
 * a camera.
 */
export function QrScanner() {
  const t = useTranslations("Maintenance");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
  }, []);

  const close = useCallback(() => {
    stop();
    setOpen(false);
    setProblem(null);
  }, [stop]);

  // Never leave the camera running when the page is left.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function start() {
    setProblem(null);
    setOpen(true);
    // No camera access at all (an old browser, or a page not served securely).
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem("unsupported");
      return;
    }
    try {
      // Asked for first, while the tap that opened the scanner still counts.
      const media = await navigator.mediaDevices.getUserMedia({
        // The back camera on a phone; whatever there is on a laptop.
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream.current = media;
      if (!video.current) return stop();
      video.current.srcObject = media;
      await video.current.play();
      const read = await frameReader();
      let busy = false;
      timer.current = setInterval(async () => {
        if (busy || !video.current || video.current.readyState < 2) return;
        busy = true;
        try {
          const code = await read(video.current);
          if (code !== null) {
            const token = stickerToken(code);
            if (token) {
              stop();
              router.push(`/q/${token}`);
            } else setProblem("notSticker");
          }
        } catch {
          // A frame that couldn't be read: try the next one.
        } finally {
          busy = false;
        }
      }, 250);
    } catch (error) {
      stop();
      setProblem(
        error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "SecurityError")
          ? "denied"
          : "failed",
      );
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 px-4"
        onClick={start}
      >
        <Camera aria-hidden />
        <span className="max-sm:sr-only">{t("scan")}</span>
      </Button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("scanTitle")}
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 text-white"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("scanTitle")}</h2>
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-transparent px-4 text-white"
              onClick={close}
            >
              <X aria-hidden />
              {tCommon("close")}
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
            {problem !== "unsupported" &&
              problem !== "denied" &&
              problem !== "failed" && (
                <video
                  ref={video}
                  muted
                  playsInline
                  className="max-h-[70svh] w-full max-w-md rounded-lg bg-black object-cover"
                />
              )}
            <p
              role={problem ? "alert" : "status"}
              className="max-w-md text-center"
            >
              {problem ? t(`scanProblem.${problem}`) : t("scanHint")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
